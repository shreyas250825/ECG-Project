#!/usr/bin/env python
# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
"""
run_digital_twin_demo.py
-------------------------
Demonstrates the Track B patient-specific digital twin pipeline on the
synthetic demo record. Shows the 12-dimensional personalized state vector.

Usage:
    cd backend
    python scripts/run_digital_twin_demo.py
"""
import sys, json
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

import numpy as np
from app.processing.synthetic import generate_synthetic_ecg
from app.processing.preprocess import PreprocessParams, preprocess_ecg
from app.processing.rpeaks import detect_r_peaks, compute_rr_intervals, compute_hr
from app.processing.features import extract_features
from app.digital_twin.baseline import create_baseline
from app.digital_twin.state import build_state, TWIN_KEYS, TWIN_UNITS, trajectory_matrix

SEP = "=" * 60

print(SEP)
print("CARDIAC DIGITAL TWIN — TRACK B DEMO")
print(SEP)
print("\nGenerating 180s synthetic ECG (250 Hz) with VT at t=120s…")

signal, t_arr, meta = generate_synthetic_ecg(duration_s=180, fs=250)
fs = 250.0

print(f"  Signal: {len(signal)} samples  {len(signal)/fs:.0f}s  {fs}Hz")
print(f"  VT episode: t=120–138s (synthetic)")

# ── Preprocessing ──────────────────────────────────────────────────────────
params = PreprocessParams(fs=fs)
print(f"\nPreprocessing:")
print(f"  Bandpass: {params.highpass_hz}–{params.lowpass_hz} Hz (Butterworth order {params.order})")
print(f"  Notch: {params.effective_notch_hz()} Hz (auto-selected for {fs}Hz)")
cleaned = preprocess_ecg(signal, params)

# ── Global R-peak detection ───────────────────────────────────────────────
peaks = detect_r_peaks(cleaned, fs)
rr = compute_rr_intervals(peaks, fs)
hr = compute_hr(rr)
print(f"\nR-peak detection:")
print(f"  Detected: {len(peaks)} peaks  HR~{hr:.1f} bpm")

# ── Baseline (0–60s) ──────────────────────────────────────────────────────
print(f"\nBaseline construction (window: 0–60s, subwindow=20s, hop=10s):")
bl = create_baseline(signal, fs, "demo", 0.0, 60.0, 20.0, 10.0)
print(f"  Subwindows used: {bl.n_windows}")
print(f"  Baseline features (mean ± std):")
for k in TWIN_KEYS:
    mu = bl.feature_means.get(k, float("nan"))
    sd = bl.feature_stds.get(k, float("nan"))
    u  = TWIN_UNITS.get(k, "")
    if np.isfinite(mu):
        print(f"    {k:<20}: {mu:+.4f} ± {sd:.4f}  [{u}]")

# ── State updates at multiple timestamps ─────────────────────────────────
timestamps = [45, 70, 90, 115, 125, 138, 160]
print(f"\nState trajectory (20s observation window):")
print(f"  {'t(s)':<6} {'HR(bpm)':<10} {'SDNN(ms)':<12} {'RMSSD(ms)':<13} {'pNN50':<8} {'Dev score':<12} {'Notes'}")
print(f"  {'-'*80}")

states = []
for ts in timestamps:
    t_start = max(0.0, ts - 20.0)
    t_end   = float(ts)
    a = max(0, int(t_start * fs))
    b = min(len(signal), int(t_end * fs))
    if b - a < int(0.5 * fs):
        continue
    seg_clean = preprocess_ecg(signal[a:b], params)
    seg_peaks = detect_r_peaks(seg_clean, fs)
    seg_rr    = compute_rr_intervals(seg_peaks, fs)
    fv        = extract_features(seg_clean, fs, seg_peaks)
    state     = build_state("demo", t_end, fv.values, bl, rr_intervals=seg_rr)
    states.append(state)

    f = state.absolute_features
    dev = state.deviation_score
    in_vt = 120 <= ts <= 138
    note = "<<< VT EPISODE" if in_vt else ("<< pre-VT" if 110 <= ts < 120 else "")
    print(f"  {ts:<6} {f.get('heart_rate_bpm', float('nan')):<10.1f} "
          f"{f.get('sdnn_s', float('nan'))*1000:<12.1f} "
          f"{f.get('rmssd_s', float('nan'))*1000:<13.1f} "
          f"{f.get('pnn50', float('nan')):<8.3f} "
          f"{dev if dev is None else f'{dev:.3f}':<12} {note}")

# ── Full personalized state vector at t=125s ─────────────────────────────
if states:
    s125 = max(states, key=lambda s: s.timestamp_s)
    print(f"\nPersonalized state vector S(t={s125.timestamp_s:.0f}s):")
    print(f"  {'Feature':<22} {'F(t)':<12} {'B':<12} {'Dev=F(t)-B':<14} {'z-score':<10} Unit")
    print(f"  {'-'*78}")
    for k in TWIN_KEYS:
        f_val = s125.absolute_features.get(k, float("nan"))
        d_abs = s125.baseline_deviation.get(k, float("nan"))
        d_z   = s125.deviation_z.get(k, float("nan"))
        b_mu  = bl.feature_means.get(k, float("nan"))
        u     = TWIN_UNITS.get(k,"")
        print(f"  {k:<22} {f_val:<12.4f} {b_mu:<12.4f} {d_abs:<12.4f} {d_z:<10.3f} {u}")

    print(f"\n  Deviation score (RMS z): {s125.deviation_score:.4f}")
    print(f"  Definition: {s125.definition}")

# ── Save output ───────────────────────────────────────────────────────────
out_dir = BACKEND / "outputs" / "digital_twin"
out_dir.mkdir(parents=True, exist_ok=True)

traj = trajectory_matrix(states)
with open(out_dir / "demo_trajectory.json", "w") as f:
    json.dump(traj, f, indent=2, default=str)

baseline_out = {
    "record_id": "demo",
    "window": "0–60s",
    "n_windows": bl.n_windows,
    "feature_means": bl.feature_means,
    "feature_stds":  bl.feature_stds,
    "units": TWIN_UNITS,
}
with open(out_dir / "demo_baseline.json", "w") as f:
    json.dump(baseline_out, f, indent=2)

print(f"\nSaved: {out_dir}/demo_trajectory.json")
print(f"Saved: {out_dir}/demo_baseline.json")

print(f"\n{SEP}")
print("Digital twin: OPERATIONAL")
print("VF forecasting: requires SDDB records + trained temporal model")
print("FPGA status: software fallback (no bitstream)")
print(SEP)
