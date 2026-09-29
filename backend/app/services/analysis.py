"""Orchestrates ECG analysis without fabricating results."""

from __future__ import annotations

import io
import logging
from pathlib import Path

import numpy as np
import pandas as pd

from app.core.errors import ResearchError
from app.db.store import store
from app.digital_twin.baseline import PatientBaseline, create_baseline
from app.digital_twin.state import build_state
from app.hardware.factory import get_accelerator
from app.processing.detection import detect_rhythm
from app.processing.features import FEATURE_META, extract_features
from app.processing.preprocess import PreprocessParams, preprocess_ecg
from app.processing.quality import estimate_signal_quality
from app.processing.rpeaks import compute_hr, compute_rr_intervals, detect_r_peaks
from app.processing.synthetic import generate_synthetic_ecg
from app.schemas.api import DISCLAIMER

log = logging.getLogger(__name__)


def downsample_series(y: np.ndarray, max_points: int = 4000) -> tuple[list[float], list[int]]:
    n = len(y)
    if n <= max_points:
        return y.astype(float).tolist(), list(range(n))
    idx = np.linspace(0, n - 1, max_points).astype(int)
    return y[idx].astype(float).tolist(), idx.tolist()


def ensure_demo_record() -> dict:
    existing = next((r for r in store.list_records() if r.get("record_name") == "SYNTH-DEMO-001"), None)
    if existing:
        return existing
    signal, t, meta = generate_synthetic_ecg()
    row = store.insert_record(
        {
            "source_dataset": meta["dataset"],
            "record_name": meta["record_id"],
            "sampling_rate": meta["sampling_rate"],
            "duration_seconds": meta["duration_seconds"],
            "lead_count": 1,
            "format": "synthetic_csv",
            "has_annotations": True,
            "privacy_status": "synthetic_non_identifiable",
            "source_url": meta["source"],
            "purpose": meta["purpose"],
            "synthetic": True,
            "disclaimer": meta["disclaimer"],
            "lead": meta["lead"],
        }
    )
    store.set_signal(row["id"], signal.tolist(), float(meta["sampling_rate"]), t.tolist())
    store.set_annotations(row["id"], meta["annotations"])
    return row


def parse_csv_bytes(content: bytes, sampling_rate: float, signal_column: str, time_column: str | None) -> tuple[np.ndarray, float]:
    df = pd.read_csv(io.BytesIO(content))
    if signal_column not in df.columns:
        raise ResearchError(f"Signal column '{signal_column}' not found. Columns: {list(df.columns)}", "invalid_ecg")
    sig = pd.to_numeric(df[signal_column], errors="coerce").to_numpy(dtype=np.float64)
    if np.any(~np.isfinite(sig)):
        raise ResearchError("ECG column contains non-numeric values.", "invalid_ecg")
    fs = sampling_rate
    if time_column and time_column in df.columns:
        tt = pd.to_numeric(df[time_column], errors="coerce").to_numpy(dtype=np.float64)
        if len(tt) > 1 and np.all(np.isfinite(tt)):
            dt = np.median(np.diff(tt))
            if dt > 0:
                fs = float(1.0 / dt)
    return sig, fs


def analyse_record(record_id: str, execution_mode: str = "auto") -> dict:
    rec = store.get_record(record_id)
    sig_pack = store.get_signal(record_id)
    if not rec or not sig_pack:
        raise ResearchError("ECG record not found.", "no_ecg", 404)
    signal = np.asarray(sig_pack["signal"], dtype=np.float64)
    fs = float(sig_pack["fs"])
    if fs <= 0:
        raise ResearchError("Incorrect sampling rate.", "invalid_fs")

    acc = get_accelerator()
    hw = acc.status()
    params = PreprocessParams(fs=fs)
    cleaned = preprocess_ecg(signal, params)
    fir = acc.preprocess_ecg(signal, fs)
    peaks = detect_r_peaks(cleaned, fs)
    rr = compute_rr_intervals(peaks, fs)
    hr = compute_hr(rr)
    quality = estimate_signal_quality(cleaned, fs, peaks)
    feats = extract_features(cleaned, fs, peaks)
    det = detect_rhythm(rr, feats.values.get("qrs_width_s"), hr)

    raw_y, idx = downsample_series(signal)
    clean_y, _ = downsample_series(cleaned)
    peak_times = (peaks / fs).astype(float).tolist()
    rr_times = ((peaks[1:] + peaks[:-1]) / 2 / fs).astype(float).tolist() if len(peaks) > 1 else []

    run = store.add_processing_run(
        {
            "record_id": record_id,
            "execution_mode": hw.mode,
            "software_version": "0.1.0",
            "processing_parameters": params.__dict__,
            "status": "completed",
            "latency_ms": None,
        }
    )
    log.info(
        "processing_run",
        extra={"event": "processing_run", "execution_mode": hw.mode},
    )

    return {
        "disclaimer": DISCLAIMER,
        "synthetic_notice": rec.get("disclaimer") if rec.get("synthetic") else None,
        "record": rec,
        "processing_run_id": run["id"],
        "execution": {
            "requested": execution_mode,
            "mode": hw.mode,
            "hardware_available": hw.hardware_available,
            "reason": hw.reason,
        },
        "sampling_rate": fs,
        "n_samples": int(len(signal)),
        "duration_seconds": float(len(signal) / fs),
        "waveforms": {
            "indices": idx,
            "raw": raw_y,
            "cleaned": clean_y,
            "time_s": (np.array(idx) / fs).astype(float).tolist(),
        },
        "r_peaks": {"indices": peaks.tolist(), "times_s": peak_times, "count": int(len(peaks))},
        "rr_intervals_s": rr.tolist(),
        "rr_mid_times_s": rr_times,
        "heart_rate_bpm": hr,
        "signal_quality": {"score": quality.score, "label": quality.label, "reasons": quality.reasons},
        "detection": {
            "label": det.label,
            "evidence": det.evidence,
            "note": "Detection indicates that the target rhythm is present in the analysed ECG.",
            "disclaimer": det.disclaimer,
        },
        "features": feats.as_dict(),
        "feature_metadata": FEATURE_META,
        "fir_dsp_preview": downsample_series(fir)[0][:500],
        "annotations": store.get_annotations(record_id),
    }


def create_record_baseline(record_id: str, start: float, end: float, sub: float, hop: float) -> dict:
    sig_pack = store.get_signal(record_id)
    if not sig_pack:
        raise ResearchError("ECG record not found.", "no_ecg", 404)
    signal = np.asarray(sig_pack["signal"], dtype=np.float64)
    fs = float(sig_pack["fs"])
    try:
        bl = create_baseline(signal, fs, record_id, start, end, sub, hop)
    except ValueError as exc:
        raise ResearchError(str(exc), "insufficient_baseline") from exc
    row = store.set_baseline(
        record_id,
        {
            "record_id": record_id,
            "baseline_window": {"start_s": bl.window_start_s, "end_s": bl.window_end_s},
            "baseline_statistics": {"means": bl.feature_means, "stds": bl.feature_stds},
            "n_windows": bl.n_windows,
            "notes": bl.notes,
        },
    )
    return {**row, "disclaimer": DISCLAIMER}


def baseline_from_store(record_id: str) -> PatientBaseline | None:
    row = store.get_baseline(record_id)
    if not row:
        return None
    stats = row["baseline_statistics"]
    win = row["baseline_window"]
    return PatientBaseline(
        record_id=record_id,
        window_start_s=win["start_s"],
        window_end_s=win["end_s"],
        feature_means=stats["means"],
        feature_stds=stats["stds"],
        n_windows=row.get("n_windows", 0),
        notes=row.get("notes", []),
    )


def window_features(signal: np.ndarray, fs: float, start_s: float, end_s: float) -> dict:
    a = max(0, int(start_s * fs))
    b = min(len(signal), int(end_s * fs))
    if b - a < int(0.5 * fs):
        raise ResearchError("Insufficient pre-event / observation data.", "insufficient_data")
    cleaned = preprocess_ecg(signal[a:b], PreprocessParams(fs=fs))
    peaks = detect_r_peaks(cleaned, fs)
    return extract_features(cleaned, fs, peaks).as_dict()


def update_twin(record_id: str, timestamp_s: float | None, window_s: float) -> dict:
    sig = store.get_signal(record_id)
    if not sig:
        raise ResearchError("ECG record not found.", "no_ecg", 404)
    signal = np.asarray(sig["signal"], dtype=np.float64)
    fs = float(sig["fs"])
    t_end = float(len(signal) / fs) if timestamp_s is None else timestamp_s
    t_start = max(0.0, t_end - window_s)
    fv = window_features(signal, fs, t_start, t_end)
    bl = baseline_from_store(record_id)
    state = build_state(record_id, t_end, fv["values"], bl)
    payload = {
        "record_id": record_id,
        "timestamp": t_end,
        "state_vector": state.state_vector,
        "deviation": state.deviation,
        "deviation_score": state.deviation_score,
        "definition": state.definition,
        "notes": state.notes,
        "current_features": fv["values"],
        "baseline": store.get_baseline(record_id),
        "disclaimer": DISCLAIMER,
        "language": "Deviation from learned baseline",
    }
    store.add_twin_state(payload)
    return payload


def save_upload(filename: str, content: bytes, cfg_fs: float, signal_col: str, time_col: str | None, lead: str) -> dict:
    suffix = Path(filename).suffix.lower()
    if suffix != ".csv":
        raise ResearchError("Initial parser supports CSV. WFDB/EDF can be added when files are present.", "invalid_ecg")
    signal, fs = parse_csv_bytes(content, cfg_fs, signal_col, time_col)
    row = store.insert_record(
        {
            "source_dataset": "researcher_upload",
            "record_name": Path(filename).stem,
            "sampling_rate": fs,
            "duration_seconds": float(len(signal) / fs),
            "lead_count": 1,
            "format": "csv",
            "has_annotations": False,
            "privacy_status": "deidentified_required",
            "synthetic": False,
            "lead": lead,
            "disclaimer": "Uploaded research file. Not a clinical diagnosis workflow.",
        }
    )
    store.set_signal(row["id"], signal.tolist(), fs)
    return row
