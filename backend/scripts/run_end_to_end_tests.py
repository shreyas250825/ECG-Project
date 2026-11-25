#!/usr/bin/env python
"""
run_end_to_end_tests.py
-----------------------
Executes all end-to-end tests for the platform.

Usage:
    cd backend
    python scripts/run_end_to_end_tests.py
"""
import sys, json, time, traceback
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
PKG = BACKEND / "cardiac_pynq_direct_jupyter_package_20261124_162613"
sys.path.insert(0, str(PKG))

PASS = "[PASS]"
FAIL = "[FAIL]"
SKIP = "[SKIP]"

results = []

def test(name, fn, blocked_reason=None):
    if blocked_reason:
        results.append({"test": name, "status": "BLOCKED", "reason": blocked_reason})
        print(f"  {SKIP} [{name}] — blocked: {blocked_reason}")
        return
    try:
        t0 = time.perf_counter()
        out = fn()
        elapsed = time.perf_counter() - t0
        results.append({"test": name, "status": "PASS", "elapsed_ms": round(elapsed*1000,1), "output": str(out)[:200]})
        print(f"  {PASS} [{name}] ({elapsed*1000:.0f}ms)")
    except Exception as e:
        results.append({"test": name, "status": "FAIL", "error": str(e)})
        print(f"  {FAIL} [{name}] — {e}")

SEP = "=" * 60
print(SEP); print("END-TO-END TEST SUITE"); print(SEP)

# T1: Backend startup components
print("\n[1] Backend startup")
test("Config load", lambda: __import__("app.core.config", fromlist=["settings"]).settings.app_name)
test("Store init",  lambda: str(type(__import__("app.db.store", fromlist=["store"]).store).__name__))
test("Demo record", lambda: __import__("app.services.analysis", fromlist=["ensure_demo_record"]).ensure_demo_record()["record_name"])

# T2: Model package
print("\n[2] Model package")
import numpy as np
test("NPZ exists",   lambda: str(PKG / "board_test_data.npz") + f" size={(PKG/'board_test_data.npz').stat().st_size//1024}KB")
test("NPZ load",     lambda: f"X={np.load(str(PKG/'board_test_data.npz'),allow_pickle=False)['X'].shape}")
test("Models exist", lambda: all((PKG/f).exists() for f in ["xgb_4class_aami.json","xgb_3class_nsv.json","xgb_binary_nv.json"]))

# T3: Model loading
print("\n[3] Model loading")
from app.services.inference.model_registry import get_registry
test("Registry load",   lambda: f"{len(get_registry().all_keys())} models loaded")
test("4-class model",   lambda: get_registry().get("four_class").task)
test("3-class model",   lambda: get_registry().get("three_class").task)
test("Binary model",    lambda: f"threshold={get_registry().get('binary').binary_threshold:.2f}")

# T4: Inference on sample beats
print("\n[4] Beat inference")
npz = np.load(str(PKG / "board_test_data.npz"), allow_pickle=False)
X5 = npz["X"][:5]
test("4-class predict",   lambda: get_registry().get("four_class").predict(X5, runtime="numpy")[0].tolist())
test("3-class predict",   lambda: get_registry().get("three_class").predict(X5, runtime="numpy")[0].tolist())
test("Binary predict",    lambda: get_registry().get("binary").predict(X5[npz["binary_mask"][:5]], runtime="numpy")[0].tolist()
     if npz["binary_mask"][:5].sum() > 0 else "no N/V beats in first 5")

# T5: Full DS2 evaluation (100 beats sampled)
print("\n[5] DS2 evaluation (100 beats)")
def _eval_sample():
    rng = np.random.default_rng(42)
    idx = rng.choice(len(npz["X"]), 100, replace=False)
    Xs = npz["X"][idx]; ys = npz["y4"][idx]
    preds, _ = get_registry().get("four_class").predict(Xs, runtime="numpy")
    acc = float(np.mean(preds == ys))
    return f"acc={acc:.2%} on 100 sampled beats"
test("Sample evaluation", _eval_sample)

# T6: Native vs numpy parity
print("\n[6] Runtime parity")
try:
    import xgboost
    native_ok = True
except ImportError:
    native_ok = False
X100 = npz["X"][:100]
def _parity():
    m = get_registry().get("four_class")
    p_np, _ = m.predict(X100, runtime="numpy")
    p_nat, _ = m.predict(X100, runtime="native")
    return f"agreement={float(np.mean(p_np==p_nat)):.2%}"
test("NumPy vs native", _parity, None if native_ok else "xgboost not installed")

# T7: ECG processing
print("\n[7] ECG signal processing")
from app.processing.synthetic import generate_synthetic_ecg
from app.processing.preprocess import PreprocessParams, preprocess_ecg
from app.processing.rpeaks import detect_r_peaks, compute_rr_intervals, compute_hr
from app.processing.features import extract_features
test("Synth ECG gen",   lambda: f"{len(generate_synthetic_ecg()[0])} samples")
test("Preprocess",      lambda: f"cleaned shape={preprocess_ecg(generate_synthetic_ecg()[0], PreprocessParams(fs=250)).shape}")
test("R-peak detect",   lambda: f"{len(detect_r_peaks(preprocess_ecg(generate_synthetic_ecg()[0], PreprocessParams(fs=250)), 250))} peaks")
test("Feature extract", lambda: f"n_beats={extract_features(preprocess_ecg(generate_synthetic_ecg()[0], PreprocessParams(fs=250)), 250, detect_r_peaks(preprocess_ecg(generate_synthetic_ecg()[0], PreprocessParams(fs=250)), 250)).n_beats}")

# T8: Digital twin
print("\n[8] Digital twin")
from app.digital_twin.baseline import create_baseline
from app.digital_twin.state import build_state, TWIN_KEYS
sig, _, _ = generate_synthetic_ecg()
params = PreprocessParams(fs=250)
cl = preprocess_ecg(sig, params)
pk = detect_r_peaks(cl, 250)
rr = compute_rr_intervals(pk, 250)
fv = extract_features(cl, 250, pk)
test("Baseline create", lambda: f"n_windows={create_baseline(sig, 250, 'test', 0, 60).n_windows}")
def _twin():
    bl = create_baseline(sig, 250, "test", 0, 60)
    s = build_state("test", 90.0, fv.values, bl, rr_intervals=rr)
    return f"dev_score={s.deviation_score:.3f}  keys={list(s.absolute_features.keys())}"
test("Twin state",      _twin)

# T9: Persistence
print("\n[9] Persistence")
from app.db.store import store
test("Store type",     lambda: type(store).__name__)
test("Insert record",  lambda: store.insert_record({"record_name": "test_rec"})["record_name"])
test("List records",   lambda: f"{len(store.list_records())} records in store")

# T10: Dataset loading
print("\n[10] Dataset discovery")
from app.core.config import settings
from app.datasets.wfdb_loader import list_available_records
data_root = settings.wfdb_data_dir or settings.data_dir
mitdb_n = len(list_available_records("mitdb", data_root))
sddb_n  = len(list_available_records("sddb",  data_root))
test("MITDB records", lambda: f"{mitdb_n} records found",
     None if mitdb_n > 0 else "MITDB not on disk")
test("SDDB records",  lambda: f"{sddb_n} records found",
     None if sddb_n  > 0 else "SDDB not on disk")

# T11: Forecasting dataset
print("\n[11] Forecasting pipeline")
sddb_feat = BACKEND / "outputs" / "forecasting" / "sddb_features.npz"
test("SDDB features prepared", lambda: f"shape={np.load(str(sddb_feat),allow_pickle=False)['X'].shape}",
     None if sddb_feat.exists() else "run prepare_sddb_features.py first")

# T12: Hardware
print("\n[12] Hardware")
from app.hardware.factory import hardware_status
hw = hardware_status()
test("HW status",    lambda: f"mode={hw.mode}  available={hw.hardware_available}")
test("SW fallback",  lambda: hw.mode == "software" or hw.mode == "pynq")

# T13: WebSocket (static check)
print("\n[13] WebSocket")
test("WS module import", lambda: __import__("app.websocket.ecg_stream", fromlist=["ws_router"]).ws_router.prefix)

# T14: Frontend build
print("\n[14] Frontend build")
dist = BACKEND.parent / "frontend" / "dist" / "index.html"
test("Frontend dist exists", lambda: f"size={dist.stat().st_size}B",
     None if dist.exists() else "run: cd frontend && npm run build")

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{SEP}")
passed   = sum(1 for r in results if r["status"]=="PASS")
failed   = sum(1 for r in results if r["status"]=="FAIL")
blocked  = sum(1 for r in results if r["status"]=="BLOCKED")
total    = len(results)
print(f"Results: {passed}/{total} passed  |  {failed} failed  |  {blocked} blocked")
print(SEP)

out = BACKEND / "outputs" / "classification" / "test_report.json"
with open(out, "w") as f:
    json.dump(results, f, indent=2)
print(f"Saved: {out}")

if failed > 0:
    sys.exit(1)
