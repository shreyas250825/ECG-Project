#!/usr/bin/env python
"""
verify_model_package.py
-----------------------
Verifies the model package, loads all three XGBoost models, runs full DS2
evaluation, and prints actual computed metrics.

Usage:
    cd backend
    python scripts/verify_model_package.py
"""
import sys
import json
import time
from pathlib import Path

# --- path setup ---
BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

import numpy as np

PKG = BACKEND / "cardiac_pynq_direct_jupyter_package_20261124_162613"
NPZ = PKG / "board_test_data.npz"
OUTPUTS = BACKEND / "outputs" / "classification"
OUTPUTS.mkdir(parents=True, exist_ok=True)

MODELS = [
    ("four_class",  "xgb_4class_aami.json",  "xgb_4class_aami.runtime.json"),
    ("three_class", "xgb_3class_nsv.json",   "xgb_3class_nsv.runtime.json"),
    ("binary",      "xgb_binary_nv.json",    "xgb_binary_nv.runtime.json"),
]

SEP = "=" * 70

def banner(text):
    print(f"\n{SEP}")
    print(f"  {text}")
    print(SEP)

# ─── 1. Package verification ──────────────────────────────────────────────────
banner("CARDIAC DIGITAL TWIN RESEARCH PLATFORM — MODEL PACKAGE VERIFICATION")
print(f"\nPackage path : {PKG}")
print(f"Package found: {PKG.exists()}")

if not PKG.exists():
    print("\nERROR: Package directory not found. Cannot continue.")
    sys.exit(1)

for key, json_name, rt_name in MODELS:
    jp = PKG / json_name
    rp = PKG / rt_name
    print(f"  {key:<12}: json={'OK' if jp.exists() else 'MISSING'} "
          f"({jp.stat().st_size//1024}KB)  "
          f"runtime={'OK' if rp.exists() else 'MISSING'}")

# ─── 2. NPZ verification ──────────────────────────────────────────────────────
banner("Test Feature Matrix (board_test_data.npz)")
if not NPZ.exists():
    print(f"MISSING: {NPZ}")
    sys.exit(1)

data = np.load(str(NPZ), allow_pickle=False)
X            = data["X"]
y4           = data["y4"]
record_id    = data["record_id"]
binary_mask  = data["binary_mask"]
y_binary     = data["y_binary"]
exp4         = data["expected_4class"]
exp_bin      = data["expected_binary"]

print(f"\n  X shape         : {X.shape}  dtype={X.dtype}")
print(f"  y4 (4-class)    : {y4.shape}  classes={np.unique(y4).tolist()}")
print(f"  record_id       : {record_id.shape}  unique={len(np.unique(record_id))} records")
print(f"  binary_mask     : {binary_mask.sum()} eligible N+V beats of {len(binary_mask)}")
print(f"  y_binary        : {y_binary.shape}  classes={np.unique(y_binary).tolist()}")
print(f"  expected_4class : {exp4.shape}")
print(f"  expected_binary : {exp_bin.shape}")
print(f"\n  Records: {sorted(np.unique(record_id).tolist())}")
print(f"\n  4-class distribution:")
for c, label in zip([0,1,2,3], ["N","S","V","F"]):
    n = int((y4 == c).sum())
    print(f"    {label} ({c}): {n:,} ({100*n/len(y4):.2f}%)")

# ─── 3. XGBoost availability ─────────────────────────────────────────────────
banner("Runtime Availability")
try:
    import xgboost as xgb
    print(f"  Native XGBoost : AVAILABLE  v{xgb.__version__}")
    native_ok = True
except ImportError:
    print("  Native XGBoost : NOT INSTALLED  (numpy runtime will be used)")
    native_ok = False

# ─── 4. Load models ───────────────────────────────────────────────────────────
banner("Loading Models")
sys.path.insert(0, str(PKG))
from model_runtime import load_model, predict as np_predict

models = {}
for key, json_name, rt_name in MODELS:
    model_json, meta = load_model(str(PKG / json_name), str(PKG / rt_name))
    booster = None
    if native_ok:
        try:
            booster = xgb.Booster()
            booster.load_model(str(PKG / json_name))
        except Exception as e:
            print(f"  Warning: native booster failed for {key}: {e}")
    models[key] = {"model_json": model_json, "meta": meta, "booster": booster}
    print(f"  {key:<12}: LOADED  task={meta['task']}  "
          f"classes={meta['classes']}  native={'YES' if booster else 'NO (numpy)'}")

# ─── 5. Four-class evaluation ─────────────────────────────────────────────────
banner("Four-Class AAMI Evaluation (N/S/V/F)")
m = models["four_class"]

for rt_name, use_native in [("numpy", False), ("native", True)]:
    if use_native and not native_ok:
        continue
    t0 = time.perf_counter()
    if use_native:
        dm = xgb.DMatrix(X.astype(np.float32))
        raw = m["booster"].inplace_predict(X.astype(np.float32))
        preds4 = np.argmax(raw, axis=1).astype(np.int64)
        probs4 = raw.astype(np.float32)
    else:
        preds4, probs4 = np_predict(m["model_json"], m["meta"], X)
    t_inf = time.perf_counter() - t0

    correct = int((preds4 == y4).sum())
    acc = correct / len(y4)
    # balanced accuracy
    classes = [0,1,2,3]
    bal = np.mean([np.mean(preds4[y4==c] == c) for c in classes if (y4==c).sum()>0])
    # macro F1
    f1s = []
    for c in classes:
        tp = int(((preds4==c)&(y4==c)).sum())
        fp = int(((preds4==c)&(y4!=c)).sum())
        fn = int(((preds4!=c)&(y4==c)).sum())
        p = tp/(tp+fp) if (tp+fp)>0 else 0
        r = tp/(tp+fn) if (tp+fn)>0 else 0
        f1s.append(2*p*r/(p+r) if (p+r)>0 else 0)
    macro_f1 = float(np.mean(f1s))
    parity = float(np.mean(preds4 == exp4))

    print(f"\n  Runtime         : {rt_name.upper()}")
    print(f"  Samples         : {len(y4):,}")
    print(f"  Accuracy        : {acc:.4%}  (reference: 90.59%)")
    print(f"  Balanced acc    : {bal:.4%}  (reference: 60.71%)")
    print(f"  Macro F1        : {macro_f1:.4f}  (reference: 0.5533)")
    print(f"  Ref agreement   : {parity:.4%}")
    print(f"  Inference time  : {t_inf*1000:.1f}ms  ({len(y4)/t_inf:.0f} beats/s)")

    # confusion matrix
    cm = np.zeros((4,4), dtype=int)
    for i in range(4):
        for j in range(4):
            cm[i,j] = int(((y4==i)&(preds4==j)).sum())
    print(f"\n  Confusion matrix (rows=true, cols=pred):")
    print(f"           N      S      V      F")
    for i, lab in enumerate(["N","S","V","F"]):
        print(f"  {lab}:  {cm[i,0]:6d} {cm[i,1]:6d} {cm[i,2]:6d} {cm[i,3]:6d}")

    # save first runtime only to outputs
    if rt_name == ("native" if native_ok else "numpy"):
        out = {
            "runtime": rt_name, "n_samples": len(y4),
            "accuracy": round(acc,6), "balanced_accuracy": round(float(bal),6),
            "macro_f1": round(macro_f1,6), "reference_agreement": round(parity,6),
            "inference_time_ms": round(t_inf*1000,2),
            "confusion_matrix": cm.tolist(),
            "per_class_f1": {str(c): round(f1s[c],4) for c in range(4)},
        }
        with open(OUTPUTS / "four_class_metrics.json", "w") as f:
            json.dump(out, f, indent=2)

# ─── 6. Three-class evaluation ────────────────────────────────────────────────
banner("Three-Class NSV Evaluation (N/S/V, F excluded)")
m3 = models["three_class"]
mask3 = y4 != 3
X3, y3 = X[mask3], y4[mask3]

t0 = time.perf_counter()
preds3, probs3 = np_predict(m3["model_json"], m3["meta"], X3)
t_inf3 = time.perf_counter() - t0

classes3 = [0,1,2]
correct3 = int((preds3 == y3).sum())
acc3 = correct3 / len(y3)
bal3 = np.mean([np.mean(preds3[y3==c] == c) for c in classes3 if (y3==c).sum()>0])
f1s3 = []
for c in classes3:
    tp = int(((preds3==c)&(y3==c)).sum())
    fp = int(((preds3==c)&(y3!=c)).sum())
    fn = int(((preds3!=c)&(y3==c)).sum())
    p = tp/(tp+fp) if (tp+fp)>0 else 0
    r = tp/(tp+fn) if (tp+fn)>0 else 0
    f1s3.append(2*p*r/(p+r) if (p+r)>0 else 0)
macro_f1_3 = float(np.mean(f1s3))
print(f"\n  Runtime         : NUMPY")
print(f"  Samples         : {len(y3):,}  (F-excluded: {mask3.sum():,} of {len(y4):,})")
print(f"  Accuracy        : {acc3:.4%}  (reference: 93.93%)")
print(f"  Balanced acc    : {bal3:.4%}  (reference: 68.71%)")
print(f"  Macro F1        : {macro_f1_3:.4f}  (reference: 0.6885)")
print(f"  Inference time  : {t_inf3*1000:.1f}ms  ({len(y3)/t_inf3:.0f} beats/s)")

cm3 = np.zeros((3,3), dtype=int)
for i in range(3):
    for j in range(3):
        cm3[i,j] = int(((y3==i)&(preds3==j)).sum())
print(f"\n  Confusion matrix (rows=true, cols=pred):")
print(f"           N      S      V")
for i, lab in enumerate(["N","S","V"]):
    print(f"  {lab}:  {cm3[i,0]:6d} {cm3[i,1]:6d} {cm3[i,2]:6d}")

out3 = {
    "runtime": "numpy", "n_samples": len(y3), "n_excluded_F": int((~mask3).sum()),
    "accuracy": round(acc3,6), "balanced_accuracy": round(float(bal3),6),
    "macro_f1": round(macro_f1_3,6), "inference_time_ms": round(t_inf3*1000,2),
    "confusion_matrix": cm3.tolist(),
    "per_class_f1": {str(c): round(f1s3[c],4) for c in range(3)},
}
with open(OUTPUTS / "three_class_metrics.json", "w") as f:
    json.dump(out3, f, indent=2)

# ─── 7. Binary evaluation ─────────────────────────────────────────────────────
banner("Binary N/V Evaluation (S and F excluded)")
mb = models["binary"]
Xb = X[binary_mask]
threshold_b = float(mb["meta"].get("binary_threshold", 0.89))

for rt_name, use_native in [("numpy", False), ("native", True)]:
    if use_native and not native_ok:
        continue
    t0 = time.perf_counter()
    if use_native:
        raw_b = mb["booster"].inplace_predict(Xb.astype(np.float32))
        probs_b = np.column_stack([1-raw_b, raw_b]).astype(np.float32)
        preds_b = (raw_b >= threshold_b).astype(np.int64)
    else:
        preds_b, probs_b = np_predict(mb["model_json"], mb["meta"], Xb)
    t_inf_b = time.perf_counter() - t0

    tn = int(((y_binary==0)&(preds_b==0)).sum())
    fp = int(((y_binary==0)&(preds_b==1)).sum())
    fn = int(((y_binary==1)&(preds_b==0)).sum())
    tp = int(((y_binary==1)&(preds_b==1)).sum())
    acc_b = (tn+tp) / len(y_binary)
    bal_b = 0.5*(tp/(tp+fn) if (tp+fn)>0 else 0) + 0.5*(tn/(tn+fp) if (tn+fp)>0 else 0)
    sens_V = tp/(tp+fn) if (tp+fn)>0 else 0
    spec_N = tn/(tn+fp) if (tn+fp)>0 else 0
    prec_V = tp/(tp+fp) if (tp+fp)>0 else 0
    f1_V = 2*sens_V*prec_V/(sens_V+prec_V) if (sens_V+prec_V)>0 else 0
    f1_N_p = tn/(tn+fn); f1_N_r = tn/(tn+fp)
    f1_N = 2*f1_N_p*f1_N_r/(f1_N_p+f1_N_r) if (f1_N_p+f1_N_r)>0 else 0
    macro_f1_b = (f1_N + f1_V) / 2
    parity_b = float(np.mean(preds_b == exp_bin))

    print(f"\n  Runtime         : {rt_name.upper()}")
    print(f"  Samples (N+V)   : {len(y_binary):,}  (threshold={threshold_b})")
    print(f"  Accuracy        : {acc_b:.4%}  (reference: 99.27%)")
    print(f"  Balanced acc    : {bal_b:.4%}  (reference: 95.52%)")
    print(f"  Sensitivity (V) : {sens_V:.4%}  (reference: 91.13%)")
    print(f"  Specificity (N) : {spec_N:.4%}  (reference: 99.92%)")
    print(f"  Precision (V)   : {prec_V:.4%}  (reference: 98.88%)")
    print(f"  Macro F1        : {macro_f1_b:.4f}  (reference: 0.9723)")
    print(f"  Ref agreement   : {parity_b:.4%}")
    print(f"  Inference time  : {t_inf_b*1000:.1f}ms  ({len(y_binary)/t_inf_b:.0f} beats/s)")
    print(f"\n  Confusion matrix:")
    print(f"              Pred N   Pred V")
    print(f"  True N :   {tn:7d}  {fp:7d}")
    print(f"  True V :   {fn:7d}  {tp:7d}")

    if rt_name == ("native" if native_ok else "numpy"):
        out_b = {
            "runtime": rt_name, "n_samples": len(y_binary),
            "threshold_used": threshold_b,
            "accuracy": round(acc_b,6), "balanced_accuracy": round(bal_b,6),
            "sensitivity_V": round(sens_V,6), "specificity_N": round(spec_N,6),
            "precision_V": round(prec_V,6), "macro_f1": round(macro_f1_b,6),
            "reference_agreement": round(parity_b,6),
            "confusion_matrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
            "inference_time_ms": round(t_inf_b*1000,2),
            "scope": "N and V beats only; S and F excluded",
        }
        with open(OUTPUTS / "binary_metrics.json", "w") as f:
            json.dump(out_b, f, indent=2)

# ─── 8. Runtime parity ────────────────────────────────────────────────────────
banner("Runtime Parity — NumPy vs Native XGBoost")
rng = np.random.default_rng(42)
idx_s = rng.choice(len(X), 1000, replace=False)
Xs = X[idx_s]

parity_results = {}
for key in ["four_class", "three_class", "binary"]:
    m_ = models[key]
    # filter
    if key == "binary":
        keep = binary_mask[idx_s]
        Xs_ = Xs[keep]
        y_ = y_binary[:0]  # shape ref only
    elif key == "three_class":
        keep = y4[idx_s] != 3
        Xs_ = Xs[keep]
    else:
        Xs_ = Xs

    if len(Xs_) == 0:
        print(f"  {key}: insufficient sample in subset")
        continue

    p_np, _ = np_predict(m_["model_json"], m_["meta"], Xs_)
    if native_ok and m_["booster"] is not None:
        if key == "binary":
            raw_ = m_["booster"].inplace_predict(Xs_.astype(np.float32))
            p_nat = (raw_ >= threshold_b).astype(np.int64)
        else:
            raw_ = m_["booster"].inplace_predict(Xs_.astype(np.float32))
            p_nat = np.argmax(raw_, axis=1).astype(np.int64)
        agree = float(np.mean(p_np == p_nat))
        parity_results[key] = {"n": len(Xs_), "agreement": agree}
        print(f"  {key:<12}: {len(Xs_)} beats  "
              f"numpy=={agree:.4%} of native predictions")
    else:
        parity_results[key] = {"n": len(Xs_), "agreement": "native_unavailable"}
        print(f"  {key:<12}: {len(Xs_)} beats  native unavailable")

with open(OUTPUTS / "runtime_parity.json", "w") as f:
    json.dump(parity_results, f, indent=2)

# ─── 9. Summary ───────────────────────────────────────────────────────────────
banner("Summary")
print(f"\n  Model package   : VERIFIED")
print(f"  Test matrix     : {X.shape}")
print(f"  Test records    : {len(np.unique(record_id))}")
print(f"  Native XGBoost  : {'AVAILABLE' if native_ok else 'NOT AVAILABLE'}")
print(f"\n  Four-class      : {'PASSED' if acc >= 0.90 else 'CHECK'} (acc={acc:.4%})")
print(f"  Three-class     : {'PASSED' if acc3 >= 0.93 else 'CHECK'} (acc={acc3:.4%})")
print(f"  Binary          : {'PASSED' if acc_b >= 0.99 else 'CHECK'} (acc={acc_b:.4%})")
print(f"\n  Outputs saved to: {OUTPUTS}")
print(f"\n  NOTE: Binary accuracy applies to N+V beats only.")
print(f"  NEVER report binary accuracy as overall beat classification accuracy.")
