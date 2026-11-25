#!/usr/bin/env python
"""
prepare_sddb_features.py
-------------------------
Builds the Track B forecasting feature dataset from SDDB records on disk.

Requirements:
  - WFDB_DATA_DIR must point to the directory containing SDDB WFDB files
  - Requires backend/.env with WFDB_DATA_DIR set
  - SDDB records must be downloaded (run download_sddb.py first)

Usage:
    cd backend
    python scripts/prepare_sddb_features.py [--max-hours 1] [--horizon 5 10 20 30]

Output:
    outputs/forecasting/sddb_features.npz
    outputs/forecasting/dataset_summary.json
"""
import sys, json, argparse
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

parser = argparse.ArgumentParser()
parser.add_argument("--max-hours", type=float, default=1.0,
    help="Max hours to load per SDDB record (default 1 for speed)")
parser.add_argument("--horizon", type=int, nargs="+", default=[5, 10, 20, 30],
    help="Forecast horizons in minutes (default: 5 10 20 30)")
parser.add_argument("--obs-min", type=float, default=5.0,
    help="Observation window in minutes (default 5)")
parser.add_argument("--step-min", type=float, default=5.0,
    help="Sliding step in minutes (default 5)")
args = parser.parse_args()

import numpy as np
from app.core.config import settings
from app.datasets.wfdb_loader import list_available_records, load_wfdb_record
from app.processing.preprocess import PreprocessParams, preprocess_ecg
from app.processing.rpeaks import detect_r_peaks, compute_rr_intervals, compute_hr
from app.processing.features import extract_features
from app.digital_twin.state import extract_twin_features, compute_pnn50, TWIN_KEYS

OUTPUTS = BACKEND / "outputs" / "forecasting"
OUTPUTS.mkdir(parents=True, exist_ok=True)

data_root = settings.wfdb_data_dir or settings.data_dir
print(f"Data root: {data_root}")

records = list_available_records("sddb", data_root)
print(f"SDDB records on disk: {len(records)}")

if not records:
    print("\nERROR: No SDDB records found.")
    print("Run: python scripts/prepare_sddb_features.py after downloading SDDB data.")
    print("Download command: python download_sddb.py (from workspace root)")
    sys.exit(1)

max_samples = int(args.max_hours * 3600 * 250)  # 250 Hz SDDB
obs_s  = args.obs_min * 60.0
step_s = args.step_min * 60.0
horizons_s = [h * 60 for h in args.horizon]

print(f"Observation: {args.obs_min} min  Step: {args.step_min} min  "
      f"Horizons: {args.horizon} min  Max load: {args.max_hours}h/record")

all_rows = []   # list of dicts per window
n_loaded = 0

for rec_name in sorted(records):
    print(f"\nLoading {rec_name}…", end=" ", flush=True)
    try:
        rec = load_wfdb_record("sddb", rec_name, data_root, max_samples=max_samples)
    except Exception as e:
        print(f"SKIP: {e}")
        continue

    signal = rec.signal
    fs     = rec.fs
    dur    = len(signal) / fs
    anns   = rec.annotations
    vf_onset_s = rec.vf_onset_time_s

    print(f"dur={dur/3600:.2f}h  vfon={vf_onset_s}s  anns={len(anns)}", flush=True)

    params = PreprocessParams(fs=fs)
    cleaned = preprocess_ecg(signal, params)
    peaks   = detect_r_peaks(cleaned, fs)

    # Slide observation windows
    t = obs_s
    while t + max(horizons_s) <= dur:
        a = max(0, int((t - obs_s) * fs))
        b = min(len(signal), int(t * fs))
        if b - a < int(0.5 * fs):
            t += step_s; continue

        seg_clean = preprocess_ecg(signal[a:b], params)
        seg_peaks = detect_r_peaks(seg_clean, fs)
        seg_rr    = compute_rr_intervals(seg_peaks, fs)
        fv        = extract_features(seg_clean, fs, seg_peaks)
        twin_f    = extract_twin_features(fv.values, seg_rr)

        # Labels per horizon
        labels = {}
        for H in horizons_s:
            if vf_onset_s is not None:
                label = 1 if t < vf_onset_s <= t + H else 0
            else:
                label = None   # censored
            labels[H] = label

        # Only add windows where at least one horizon has a valid label
        if all(v is None for v in labels.values()):
            t += step_s; continue

        row = {
            "record_id":    rec_name,
            "pred_time_s":  t,
            "obs_start_s":  t - obs_s,
            "obs_end_s":    t,
            "vf_onset_s":   vf_onset_s,
            "sufficient":   fv.sufficient,
            **{f"feat_{k}": twin_f[k] for k in TWIN_KEYS},
            **{f"label_H{H//60}min": labels[H] for H in horizons_s},
        }
        all_rows.append(row)
        t += step_s

    n_loaded += 1

print(f"\nLoaded {n_loaded} records  |  {len(all_rows)} observation windows")

if not all_rows:
    print("No windows extracted. Check WFDB_DATA_DIR and record availability.")
    sys.exit(1)

# Build feature matrix
feat_keys = [f"feat_{k}" for k in TWIN_KEYS]
X = np.array([[r[k] for k in feat_keys] for r in all_rows], dtype=np.float32)
recs = np.array([r["record_id"] for r in all_rows])

np.savez_compressed(
    str(OUTPUTS / "sddb_features.npz"),
    X=X,
    record_id=recs,
    **{f"labels_H{H//60}min": np.array([
        r.get(f"label_H{H//60}min") if r.get(f"label_H{H//60}min") is not None else -1
        for r in all_rows
    ], dtype=np.int8) for H in horizons_s},
)

# Summary
summary = {
    "n_records_loaded": n_loaded,
    "n_windows": len(all_rows),
    "observation_min": args.obs_min,
    "step_min": args.step_min,
    "horizons_min": args.horizon,
    "features": TWIN_KEYS,
    "label_distribution": {
        f"H{H//60}min": {
            "positive": int(sum(1 for r in all_rows if r.get(f"label_H{H//60}min") == 1)),
            "negative": int(sum(1 for r in all_rows if r.get(f"label_H{H//60}min") == 0)),
            "censored": int(sum(1 for r in all_rows if r.get(f"label_H{H//60}min") is None)),
        }
        for H in horizons_s
    },
}
with open(OUTPUTS / "dataset_summary.json", "w") as f:
    json.dump(summary, f, indent=2)

print(f"\nSaved: {OUTPUTS}/sddb_features.npz  shape={X.shape}")
print(f"Saved: {OUTPUTS}/dataset_summary.json")
print("\nLabel distribution:")
for H in horizons_s:
    hk = f"H{H//60}min"
    d = summary["label_distribution"][hk]
    print(f"  {hk}: +{d['positive']}  -{d['negative']}  censored={d['censored']}")
