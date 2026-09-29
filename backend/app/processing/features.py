"""Feature extraction with explicit metadata (units, interpretation, limitations)."""

from __future__ import annotations

from dataclasses import dataclass, asdict

import numpy as np
from scipy.stats import kurtosis, skew


FEATURE_META: dict[str, dict[str, str]] = {
    "mean_rr_s": {
        "units": "s",
        "source": "RR intervals",
        "interpretation": "Average interval between detected R peaks.",
        "limitations": "Depends on QRS detection accuracy; not equivalent to a clinical HRV report.",
    },
    "median_rr_s": {
        "units": "s",
        "source": "RR intervals",
        "interpretation": "Median RR; more robust to isolated outliers than the mean.",
        "limitations": "Still detection-dependent.",
    },
    "sdnn_s": {
        "units": "s",
        "source": "RR intervals",
        "interpretation": "Standard deviation of NN/RR intervals (SDNN-like computational analogue).",
        "limitations": "Requires sufficient beats; not a certified HRV metric.",
    },
    "rmssd_s": {
        "units": "s",
        "source": "successive RR differences",
        "interpretation": "Root mean square of successive RR differences.",
        "limitations": "Unreliable with few beats or frequent ectopy.",
    },
    "heart_rate_bpm": {
        "units": "bpm",
        "source": "mean RR",
        "interpretation": "60 / mean RR from detected peaks.",
        "limitations": "Instantaneous clinical HR monitors may differ.",
    },
    "rr_cv": {
        "units": "1",
        "source": "RR intervals",
        "interpretation": "Coefficient of variation of RR.",
        "limitations": "Confounded by noise and missed/extra detections.",
    },
    "qrs_width_s": {
        "units": "s",
        "source": "beat windows around R",
        "interpretation": "Median estimated QRS width from amplitude envelope around R.",
        "limitations": "Heuristic; not a measured 12-lead QRS duration.",
    },
    "qrs_amplitude": {
        "units": "a.u.",
        "source": "cleaned ECG",
        "interpretation": "Median peak-to-peak amplitude in a short QRS window.",
        "limitations": "Units depend on normalisation; not millivolt calibrated unless input is.",
    },
    "r_peak_amplitude": {
        "units": "a.u.",
        "source": "cleaned ECG at R indices",
        "interpretation": "Median R-peak sample amplitude.",
        "limitations": "Lead- and scale-dependent.",
    },
    "mean_signal": {
        "units": "a.u.",
        "source": "cleaned ECG",
        "interpretation": "Mean of the analysed segment.",
        "limitations": "Near zero after normalisation.",
    },
    "std_signal": {
        "units": "a.u.",
        "source": "cleaned ECG",
        "interpretation": "Standard deviation of the segment.",
        "limitations": "Affected by remaining noise and ectopy.",
    },
    "skewness": {
        "units": "1",
        "source": "cleaned ECG",
        "interpretation": "Third standardised moment.",
        "limitations": "Sensitive to outliers.",
    },
    "kurtosis": {
        "units": "1",
        "source": "cleaned ECG",
        "interpretation": "Fourth standardised moment (Fisher).",
        "limitations": "Sensitive to outliers.",
    },
    "signal_energy": {
        "units": "a.u.^2",
        "source": "cleaned ECG",
        "interpretation": "Mean squared amplitude.",
        "limitations": "Scale-dependent.",
    },
    "morphology_std": {
        "units": "a.u.",
        "source": "aligned beat templates",
        "interpretation": "Average pointwise standard deviation across aligned beats.",
        "limitations": "Requires several aligned beats; alignment errors inflate the value.",
    },
}


@dataclass
class FeatureVector:
    values: dict[str, float]
    n_beats: int
    sufficient: bool
    notes: list[str]

    def as_dict(self) -> dict:
        return asdict(self)


FEATURE_ORDER = list(FEATURE_META.keys())


def _qrs_width(segment: np.ndarray, fs: float) -> float:
    env = np.abs(segment)
    thr = 0.3 * float(np.max(env) + 1e-9)
    above = np.where(env >= thr)[0]
    if len(above) < 2:
        return float("nan")
    return float((above[-1] - above[0]) / fs)


def compute_hrv_features(rr: np.ndarray) -> dict[str, float]:
    if len(rr) == 0:
        return {
            "mean_rr_s": float("nan"),
            "median_rr_s": float("nan"),
            "sdnn_s": float("nan"),
            "rmssd_s": float("nan"),
            "heart_rate_bpm": float("nan"),
            "rr_cv": float("nan"),
        }
    mean_rr = float(np.mean(rr))
    out = {
        "mean_rr_s": mean_rr,
        "median_rr_s": float(np.median(rr)),
        "sdnn_s": float(np.std(rr, ddof=1)) if len(rr) > 1 else 0.0,
        "heart_rate_bpm": 60.0 / mean_rr if mean_rr > 0 else float("nan"),
        "rr_cv": float(np.std(rr) / (mean_rr + 1e-12)),
    }
    if len(rr) > 1:
        out["rmssd_s"] = float(np.sqrt(np.mean(np.diff(rr) ** 2)))
    else:
        out["rmssd_s"] = float("nan")
    return out


def extract_features(cleaned: np.ndarray, fs: float, r_peaks: np.ndarray) -> FeatureVector:
    x = np.asarray(cleaned, dtype=np.float64)
    notes: list[str] = []
    rr = np.diff(r_peaks.astype(np.float64)) / fs if len(r_peaks) >= 2 else np.array([])
    hrv = compute_hrv_features(rr)

    qrs_w: list[float] = []
    qrs_amp: list[float] = []
    half = int(0.06 * fs)
    beats: list[np.ndarray] = []
    for p in r_peaks:
        lo, hi = int(p) - half, int(p) + half
        if lo < 0 or hi >= len(x):
            continue
        seg = x[lo:hi]
        qrs_w.append(_qrs_width(seg, fs))
        qrs_amp.append(float(np.ptp(seg)))
        beats.append(seg)

    r_amp = [float(x[int(p)]) for p in r_peaks if 0 <= int(p) < len(x)]

    morph_std = float("nan")
    if len(beats) >= 3:
        stacked = np.stack(beats, axis=0)
        morph_std = float(np.mean(np.std(stacked, axis=0)))

    values = {
        **hrv,
        "qrs_width_s": float(np.nanmedian(qrs_w)) if qrs_w else float("nan"),
        "qrs_amplitude": float(np.median(qrs_amp)) if qrs_amp else float("nan"),
        "r_peak_amplitude": float(np.median(r_amp)) if r_amp else float("nan"),
        "mean_signal": float(np.mean(x)),
        "std_signal": float(np.std(x)),
        "skewness": float(skew(x, bias=False)) if len(x) > 3 else float("nan"),
        "kurtosis": float(kurtosis(x, fisher=True, bias=False)) if len(x) > 3 else float("nan"),
        "signal_energy": float(np.mean(x**2)),
        "morphology_std": morph_std,
    }

    n_beats = int(len(r_peaks))
    sufficient = n_beats >= 8 and len(rr) >= 7
    if not sufficient:
        notes.append("Insufficient beats for stable HRV-like features.")
    notes.append("QT-related features are omitted unless a dedicated T-wave detector is validated.")
    return FeatureVector(values=values, n_beats=n_beats, sufficient=sufficient, notes=notes)


def vector_to_array(values: dict[str, float]) -> np.ndarray:
    return np.array([values.get(k, np.nan) for k in FEATURE_ORDER], dtype=np.float64)
