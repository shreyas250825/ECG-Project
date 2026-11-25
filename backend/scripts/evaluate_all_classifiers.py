#!/usr/bin/env python
"""
evaluate_all_classifiers.py
----------------------------
Runs full DS2 evaluation on all three classifiers (both runtimes),
generates comparison CSV, and saves per-record metrics.

Usage:
    cd backend
    python scripts/evaluate_all_classifiers.py
"""
import sys, json, time, csv
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
except ImportError:
    native_ok = False

data = np.load(str(PKG / "board_test_data.npz"), allow_pickle=False)
X = data["X"]; y4 = data["y4"]; record_id = data["record_id"]
binary_mask = data["binary_mask"]; y_binary = data["y_binary"]
exp4 = data["expected_4class"]; exp_bin = data["expected_binary"]

SPECS = [
    ("four_class",  "xgb_4class_aami.json",  "xgb_4class_aami.runtime.json",  [0,1,2,3]),
    ("three_class", "xgb_3class_nsv.json",   "xgb_3class_nsv.runtime.json",   [0,1,2]),
    ("binary",      "xgb_binary_nv.json",    "xgb_binary_nv.runtime.json",    [0,1]),
]

def _bal(yt, yp, classes):
    return float(np.mean([np.mean(yp[yt==c]==c) for c in classes if (yt==c).sum()>0]))

def _macro_f1(yt, yp, classes):
    f1s = []
    for c in classes:
        tp = int(((yp==c)&(yt==c)).sum()); fp = int(((yp==c)&(yt!=c)).sum()); fn = int(((yp!=c)&(yt==c)).sum())
        pr = tp/(tp+fp) if tp+fp>0 else 0; rc = tp/(tp+fn) if tp+fn>0 else 0
        f1s.append(2*pr*rc/(pr+rc) if pr+rc>0 else 0)
    return float(np.mean(f1s))

comparison_rows = []
per_record_rows = []

for key, jn, rn, classes in SPECS:
    mj, meta = load_model(str(PKG/jn), str(PKG/rn))
    bst = None
    if native_ok:
        try:
            bst = xgb.Booster(); bst.load_model(str(PKG/jn))
        except Exception: pass

    # Select data
    if key == "binary":
        Xe, ye, re = X[binary_mask], y_binary, record_id[binary_mask]
    elif key == "three_class":
        m3 = y4 != 3
        Xe, ye, re = X[m3], y4[m3], record_id[m3]
    else:
        Xe, ye, re = X, y4, record_id

    for rt_name, use_native in [("numpy", False), ("native", native_ok and bst is not None)]:
        if rt_name == "native" and not use_native:
            continue
        t0 = time.perf_counter()
        if use_native:
            raw = bst.inplace_predict(Xe.astype(np.float32))
            if key == "binary":
                thr = float(meta["binary_threshold"])
                preds = (raw >= thr).astype(np.int64)
            else:
                preds = np.argmax(raw, axis=1).astype(np.int64)
        else:
            preds, _ = np_predict(mj, meta, Xe)
        elapsed = time.perf_counter() - t0

        acc = float(np.mean(preds == ye))
        bal = _bal(ye, preds, classes)
        mf1 = _macro_f1(ye, preds, classes)

        comparison_rows.append({
            "model": key, "runtime": rt_name,
            "n_samples": len(ye),
            "accuracy": round(acc,6), "balanced_accuracy": round(bal,6),
            "macro_f1": round(mf1,6),
            "inference_ms": round(elapsed*1000,2),
        })
        print(f"{key} [{rt_name}]: acc={acc:.4%} bal={bal:.4%} f1={mf1:.4f} {elapsed*1000:.1f}ms")

        # Per-record
        for rec in sorted(np.unique(re)):
            mask = re == rec
            pacc = float(np.mean(preds[mask] == ye[mask]))
            per_record_rows.append({
                "model": key, "runtime": rt_name,
                "record": str(rec), "n": int(mask.sum()),
                "accuracy": round(pacc,6)
            })

# Save comparison CSV
with open(OUTPUTS / "classification_comparison.csv", "w", newline="") as f:
    dw = csv.DictWriter(f, fieldnames=["model","runtime","n_samples","accuracy","balanced_accuracy","macro_f1","inference_ms"])
    dw.writeheader(); dw.writerows(comparison_rows)

# Save per-record CSV
with open(OUTPUTS / "per_record_metrics.csv", "w", newline="") as f:
    dw = csv.DictWriter(f, fieldnames=["model","runtime","record","n","accuracy"])
    dw.writeheader(); dw.writerows(per_record_rows)

print(f"\nSaved: {OUTPUTS}/classification_comparison.csv")
print(f"Saved: {OUTPUTS}/per_record_metrics.csv")
