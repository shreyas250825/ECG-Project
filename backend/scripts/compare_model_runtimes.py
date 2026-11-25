#!/usr/bin/env python
"""
compare_model_runtimes.py
--------------------------
Compares NumPy vs Native XGBoost runtime prediction agreement and speed.

Usage:
    cd backend
    python scripts/compare_model_runtimes.py
"""
import sys, json, time
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
PKG = BACKEND / "cardiac_pynq_direct_jupyter_package_20261124_162613"
sys.path.insert(0, str(PKG))
OUTPUTS = BACKEND / "outputs" / "classification"
OUTPUTS.mkdir(parents=True, exist_ok=True)

import numpy as np
from model_runtime import load_model, predict as np_predict

try:
    import xgboost as xgb
    native_ok = True
    print(f"Native XGBoost: AVAILABLE v{xgb.__version__}")
except ImportError:
    native_ok = False
    print("Native XGBoost: NOT AVAILABLE — numpy-only comparison")

data = np.load(str(PKG / "board_test_data.npz"), allow_pickle=False)
X = data["X"]; y4 = data["y4"]
binary_mask = data["binary_mask"]; y_binary = data["y_binary"]
exp4 = data["expected_4class"]; exp_bin = data["expected_binary"]

SPECS = [
    ("four_class",  "xgb_4class_aami.json",  "xgb_4class_aami.runtime.json",  X, y4, exp4, None),
    ("three_class", "xgb_3class_nsv.json",   "xgb_3class_nsv.runtime.json",   X[y4!=3], y4[y4!=3], None, None),
    ("binary",      "xgb_binary_nv.json",    "xgb_binary_nv.runtime.json",    X[binary_mask], y_binary, exp_bin, None),
]

print(f"\n{'='*70}")
print("RUNTIME PARITY AND SPEED COMPARISON")
print(f"{'='*70}")

results = {}
for key, jn, rn, Xe, ye, expected, _ in SPECS:
    mj, meta = load_model(str(PKG/jn), str(PKG/rn))
    bst = None
    if native_ok:
        try:
            bst = xgb.Booster(); bst.load_model(str(PKG/jn))
        except Exception as e:
            print(f"  {key}: booster load failed: {e}")

    # NumPy inference
    t0 = time.perf_counter()
    preds_np, _ = np_predict(mj, meta, Xe)
    t_np = time.perf_counter() - t0

    res = {
        "numpy_time_ms": round(t_np*1000, 2),
        "numpy_throughput_per_s": round(len(Xe)/t_np, 0),
        "numpy_vs_reference": round(float(np.mean(preds_np == expected)), 6) if expected is not None and len(expected)==len(preds_np) else None,
    }

    if native_ok and bst is not None:
        # Native inference
        t0 = time.perf_counter()
        raw = bst.inplace_predict(Xe.astype(np.float32))
        if meta["task"] == "binary":
            thr = float(meta["binary_threshold"])
            preds_nat = (raw >= thr).astype(np.int64)
        else:
            preds_nat = np.argmax(raw, axis=1).astype(np.int64)
        t_nat = time.perf_counter() - t0

        agreement = float(np.mean(preds_np == preds_nat))
        speedup = t_np / t_nat if t_nat > 0 else float("inf")

        res.update({
            "native_time_ms": round(t_nat*1000, 2),
            "native_throughput_per_s": round(len(Xe)/t_nat, 0),
            "numpy_vs_native_agreement": round(agreement, 6),
            "native_speedup_over_numpy": round(speedup, 1),
            "native_vs_reference": round(float(np.mean(preds_nat == expected)), 6) if expected is not None and len(expected)==len(preds_nat) else None,
        })

        print(f"\n  {key} [{len(Xe):,} beats]:")
        print(f"    NumPy  : {t_np*1000:.1f}ms  ({len(Xe)/t_np:.0f} beats/s)")
        print(f"    Native : {t_nat*1000:.1f}ms  ({len(Xe)/t_nat:.0f} beats/s)  speedup={speedup:.1f}×")
        print(f"    NumPy vs Native agreement: {agreement:.4%}")
        if expected is not None and len(expected)==len(preds_nat):
            print(f"    Native vs reference:       {float(np.mean(preds_nat==expected)):.4%}")
            print(f"    NumPy  vs reference:       {float(np.mean(preds_np==expected)):.4%}")
    else:
        print(f"\n  {key}: numpy={t_np*1000:.1f}ms  native=unavailable")

    results[key] = res

out_path = OUTPUTS / "runtime_parity.json"
with open(out_path, "w") as f:
    json.dump(results, f, indent=2)

print(f"\n{'='*70}")
print(f"Saved: {out_path}")
print("\nSUMMARY")
for key, res in results.items():
    ag = res.get("numpy_vs_native_agreement")
    sp = res.get("native_speedup_over_numpy")
    print(f"  {key:<12}: agreement={ag if ag is None else f'{ag:.4%}'}  speedup={sp if sp is None else f'{sp:.1f}x'}")
