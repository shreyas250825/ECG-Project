"""Patient-specific baseline from an explicit past window only (no future leakage)."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from app.processing.features import FEATURE_ORDER, extract_features, vector_to_array
from app.processing.preprocess import PreprocessParams, preprocess_ecg
from app.processing.rpeaks import detect_r_peaks


@dataclass
class PatientBaseline:
    record_id: str
    window_start_s: float
    window_end_s: float
    feature_means: dict[str, float]
    feature_stds: dict[str, float]
    n_windows: int
    notes: list[str] = field(default_factory=list)

    def deviation(self, current: dict[str, float]) -> dict[str, float]:
        out: dict[str, float] = {}
        for k in FEATURE_ORDER:
            mu = self.feature_means.get(k, np.nan)
            sd = self.feature_stds.get(k, np.nan)
            val = current.get(k, np.nan)
            if not np.isfinite(mu) or not np.isfinite(val):
                out[k] = float("nan")
            elif not np.isfinite(sd) or sd < 1e-8:
                out[k] = float(val - mu)
            else:
                out[k] = float((val - mu) / sd)
        return out

    def deviation_score(self, current: dict[str, float]) -> float | None:
        z = np.array(list(self.deviation(current).values()), dtype=np.float64)
        z = z[np.isfinite(z)]
        if len(z) == 0:
            return None
        return float(np.sqrt(np.mean(z**2)))


def create_baseline(
    signal: np.ndarray,
    fs: float,
    record_id: str,
    window_start_s: float,
    window_end_s: float,
    subwindow_s: float = 20.0,
    hop_s: float = 10.0,
) -> PatientBaseline:
    if window_end_s <= window_start_s:
        raise ValueError("Baseline window must have positive duration.")
    if window_start_s < 0:
        raise ValueError("Baseline window cannot start before the recording.")

    start = int(window_start_s * fs)
    end = int(window_end_s * fs)
    if end > len(signal):
        raise ValueError("Baseline window extends beyond available ECG.")

    params = PreprocessParams(fs=fs)
    rows: list[np.ndarray] = []
    t = window_start_s
    notes = [
        "Baseline uses only samples inside the configured window.",
        "Deviation from learned baseline is not a clinical abnormality label.",
    ]
    while t + subwindow_s <= window_end_s:
        a = int(t * fs)
        b = int((t + subwindow_s) * fs)
        seg = signal[a:b]
        cleaned = preprocess_ecg(seg, params)
        peaks = detect_r_peaks(cleaned, fs)
        fv = extract_features(cleaned, fs, peaks)
        arr = vector_to_array(fv.values)
        if np.isfinite(arr).sum() >= 6:
            rows.append(arr)
        t += hop_s

    if len(rows) < 2:
        raise ValueError("Insufficient baseline duration or quality to estimate statistics.")

    mat = np.vstack(rows)
    means = np.nanmean(mat, axis=0)
    stds = np.nanstd(mat, axis=0, ddof=1)
    return PatientBaseline(
        record_id=record_id,
        window_start_s=window_start_s,
        window_end_s=window_end_s,
        feature_means={k: float(means[i]) for i, k in enumerate(FEATURE_ORDER)},
        feature_stds={k: float(stds[i]) if np.isfinite(stds[i]) else 0.0 for i, k in enumerate(FEATURE_ORDER)},
        n_windows=len(rows),
        notes=notes,
    )
