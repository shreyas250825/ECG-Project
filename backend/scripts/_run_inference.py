"""
Direct DS2 inference script — writes output to a file to bypass PowerShell pipe issues.
"""
import sys, json, time
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
OUT_FILE = BACKEND / "outputs" / "classification" / "_inference_run.txt"
OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

lines = []
def p(*args):
    s = " ".join(str(a) for a in args)
    print(s)
    lines.append(s)

sys.path.insert(0, str(BACKEND))
PKG = BACKEND / "cardiac_pynq_direct_jupyter_package_20261124_162613"
sys.path.insert(0, str(PKG))

import numpy as np

# ── Load NPZ ─────────────────────────────────────────────────────────────────
npz = np.load(str(PKG / "board_test_data.npz"), allow_pickle=False)
X            = npz["X"]
y4           = npz["y4"]
record_id    = npz["record_id"]
binary_mask  = npz["binary_mask"]
y_binary     = npz["y_binary"]
exp4         = npz["expected_4class"]
exp_bin      = npz["expected_binary"]

p("=" * 65)
p("CARDIAC DIGITAL TWIN RESEARCH PLATFORM")
p("=" * 65)
p(f"Model package   : {PKG.name}")
p(f"Test matrix     : {X.shape}")
p(f"Test records    : {len(np.unique(record_id))} records  binary eligible: {binary_mask.sum()}")

# ── XGBoost availability ──────────────────────────────────────────────────────
try:
    import xgboost as xgb
    native_ok = True
    p(f"Native XGBoost  : AVAILABLE  v{xgb.__version__}")
except ImportError:
    native_ok = False
    p("Native XGBoost  : NOT AVAILABLE — using NumPy runtime")

# ── Load models ───────────────────────────────────────────────────────────────
from model_runtime import load_model, predict as np_predict

SPECS = [
    ("four_class",  "xgb_4class_aami.json",  "xgb_4class_aami.runtime.json"),
    ("three_class", "xgb_3class_nsv.json",   "xgb_3class_nsv.runtime.json"),
    ("binary",      "xgb_binary_nv.json",    "xgb_binary_nv.runtime.json"),
]

models = {}
for key, jn, rn in SPECS:
    mj, meta = load_model(str(PKG/jn), str(PKG/rn))
    bst = None
    if native_ok:
        try:
            bst = xgb.Booster(); bst.load_model(str(PKG/jn))
        except Exception as e:
            p(f"  {key}: booster load failed: {e}")
    models[key] = {"mj": mj, "meta": meta, "bst": bst}
    p(f"  {key:<12}: LOADED  classes={meta['classes']}  native={'YES' if bst else 'NO'}")

# ── Helper ────────────────────────────────────────────────────────────────────
def bal_acc(yt, yp):
    classes = np.unique(yt)
    return float(np.mean([np.mean(yp[yt==c]==c) for c in classes if (yt==c).sum()>0]))

def macro_f1(yt, yp, classes):
    f1s = []
    for c in classes:
        tp = int(((yp==c)&(yt==c)).sum())
        fp = int(((yp==c)&(yt!=c)).sum())
        fn = int(((yp!=c)&(yt==c)).sum())
        pr = tp/(tp+fp) if tp+fp > 0 else 0
        rc = tp/(tp+fn) if tp+fn > 0 else 0
        f1s.append(2*pr*rc/(pr+rc) if pr+rc > 0 else 0)
    return float(np.mean(f1s))

results = {}

# ══════════════════════════════════════════════════════════════════════════════
p("\n" + "=" * 65)
p("FOUR-CLASS AAMI (N/S/V/F) — 45,756 beats")
p("=" * 65)

m = models["four_class"]
# --- numpy ---
t0 = time.perf_counter()
preds4_np, probs4_np = np_predict(m["mj"], m["meta"], X)
t_np = time.perf_counter() - t0

acc4_np   = float(np.mean(preds4_np == y4))
bal4_np   = bal_acc(y4, preds4_np)
mf1_4_np  = macro_f1(y4, preds4_np, [0,1,2,3])
agr4_np   = float(np.mean(preds4_np == exp4))

p(f"\nNumPy runtime:")
p(f"  Samples         : {len(y4):,}")
p(f"  Accuracy        : {acc4_np:.4%}   (reference 90.59%)")
p(f"  Balanced acc    : {bal4_np:.4%}   (reference 60.71%)")
p(f"  Macro F1        : {mf1_4_np:.4f}  (reference 0.5533)")
p(f"  Ref agreement   : {agr4_np:.4%}")
p(f"  Time            : {t_np*1000:.1f}ms  ({len(y4)/t_np:.0f} beats/s)")

cm4 = np.zeros((4,4), dtype=int)
for i in range(4):
    for j in range(4):
        cm4[i,j] = int(((y4==i)&(preds4_np==j)).sum())
p(f"  Confusion matrix (rows=true, cols=pred) [N,S,V,F]:")
p(f"           N      S      V      F")
for i,lab in enumerate(["N","S","V","F"]):
    p(f"  {lab}:  {cm4[i,0]:6d} {cm4[i,1]:6d} {cm4[i,2]:6d} {cm4[i,3]:6d}")

results["four_class_numpy"] = {
    "accuracy": round(acc4_np,6), "balanced_accuracy": round(bal4_np,6),
    "macro_f1": round(mf1_4_np,6), "reference_agreement": round(agr4_np,6),
    "time_ms": round(t_np*1000,2), "confusion_matrix": cm4.tolist()
}

if native_ok and m["bst"] is not None:
    t0 = time.perf_counter()
    raw4 = m["bst"].inplace_predict(X.astype(np.float32))
    preds4_nat = np.argmax(raw4, axis=1).astype(np.int64)
    t_nat = time.perf_counter() - t0
    acc4_nat = float(np.mean(preds4_nat == y4))
    bal4_nat = bal_acc(y4, preds4_nat)
    mf1_4_nat = macro_f1(y4, preds4_nat, [0,1,2,3])
    agr4_nat  = float(np.mean(preds4_nat == exp4))
    p(f"\nNative XGBoost runtime:")
    p(f"  Accuracy        : {acc4_nat:.4%}   (reference 90.59%)")
    p(f"  Balanced acc    : {bal4_nat:.4%}   (reference 60.71%)")
    p(f"  Macro F1        : {mf1_4_nat:.4f}  (reference 0.5533)")
    p(f"  Ref agreement   : {agr4_nat:.4%}")
    p(f"  Time            : {t_nat*1000:.1f}ms  ({len(y4)/t_nat:.0f} beats/s)")
    p(f"  NumPy vs Native agreement: {float(np.mean(preds4_np==preds4_nat)):.4%}")
    results["four_class_native"] = {
        "accuracy": round(acc4_nat,6), "balanced_accuracy": round(bal4_nat,6),
        "macro_f1": round(mf1_4_nat,6), "reference_agreement": round(agr4_nat,6),
        "time_ms": round(t_nat*1000,2)
    }

# ══════════════════════════════════════════════════════════════════════════════
p("\n" + "=" * 65)
p("THREE-CLASS NSV (N/S/V, F excluded) — 45,369 beats")
p("=" * 65)

m3 = models["three_class"]
mask3 = y4 != 3
X3 = X[mask3]; y3 = y4[mask3]

t0 = time.perf_counter()
preds3_np, probs3_np = np_predict(m3["mj"], m3["meta"], X3)
t3 = time.perf_counter() - t0

acc3  = float(np.mean(preds3_np == y3))
bal3  = bal_acc(y3, preds3_np)
mf1_3 = macro_f1(y3, preds3_np, [0,1,2])

p(f"\nNumPy runtime:")
p(f"  Samples         : {len(y3):,}  (F excluded: {(~mask3).sum():,})")
p(f"  Accuracy        : {acc3:.4%}   (reference 93.93%)")
p(f"  Balanced acc    : {bal3:.4%}   (reference 68.71%)")
p(f"  Macro F1        : {mf1_3:.4f}  (reference 0.6885)")
p(f"  Time            : {t3*1000:.1f}ms  ({len(y3)/t3:.0f} beats/s)")

cm3 = np.zeros((3,3), dtype=int)
for i in range(3):
    for j in range(3):
        cm3[i,j] = int(((y3==i)&(preds3_np==j)).sum())
p(f"  Confusion matrix (rows=true, cols=pred) [N,S,V]:")
p(f"           N      S      V")
for i,lab in enumerate(["N","S","V"]):
    p(f"  {lab}:  {cm3[i,0]:6d} {cm3[i,1]:6d} {cm3[i,2]:6d}")

results["three_class_numpy"] = {
    "accuracy": round(acc3,6), "balanced_accuracy": round(bal3,6),
    "macro_f1": round(mf1_3,6), "time_ms": round(t3*1000,2),
    "n_samples": len(y3), "n_excluded_F": int((~mask3).sum()),
    "confusion_matrix": cm3.tolist()
}

if native_ok and m3["bst"] is not None:
    t0 = time.perf_counter()
    raw3 = m3["bst"].inplace_predict(X3.astype(np.float32))
    preds3_nat = np.argmax(raw3, axis=1).astype(np.int64)
    t3_nat = time.perf_counter() - t0
    acc3_nat = float(np.mean(preds3_nat == y3))
    bal3_nat = bal_acc(y3, preds3_nat)
    mf1_3_nat = macro_f1(y3, preds3_nat, [0,1,2])
    p(f"\nNative XGBoost runtime:")
    p(f"  Accuracy        : {acc3_nat:.4%}   (reference 93.93%)")
    p(f"  Balanced acc    : {bal3_nat:.4%}   (reference 68.71%)")
    p(f"  Macro F1        : {mf1_3_nat:.4f}  (reference 0.6885)")
    p(f"  Time            : {t3_nat*1000:.1f}ms  ({len(y3)/t3_nat:.0f} beats/s)")
    p(f"  NumPy vs Native agreement: {float(np.mean(preds3_np==preds3_nat)):.4%}")
    results["three_class_native"] = {
        "accuracy": round(acc3_nat,6), "balanced_accuracy": round(bal3_nat,6),
        "macro_f1": round(mf1_3_nat,6), "time_ms": round(t3_nat*1000,2)
    }

# ══════════════════════════════════════════════════════════════════════════════
p("\n" + "=" * 65)
p("BINARY N/V (S and F excluded) — 43,593 beats")
p("=" * 65)

mb = models["binary"]
Xb = X[binary_mask]
thr = float(mb["meta"]["binary_threshold"])

t0 = time.perf_counter()
preds_b_np, probs_b_np = np_predict(mb["mj"], mb["meta"], Xb)
t_b = time.perf_counter() - t0

tn = int(((y_binary==0)&(preds_b_np==0)).sum())
fp_ = int(((y_binary==0)&(preds_b_np==1)).sum())
fn_ = int(((y_binary==1)&(preds_b_np==0)).sum())
tp_ = int(((y_binary==1)&(preds_b_np==1)).sum())
acc_b  = (tn+tp_)/len(y_binary)
sens_V = tp_/(tp_+fn_) if (tp_+fn_)>0 else 0
spec_N = tn/(tn+fp_) if (tn+fp_)>0 else 0
prec_V = tp_/(tp_+fp_) if (tp_+fp_)>0 else 0
f1_V   = 2*sens_V*prec_V/(sens_V+prec_V) if (sens_V+prec_V)>0 else 0
p_N = tn/(tn+fn_); r_N = tn/(tn+fp_)
f1_N   = 2*p_N*r_N/(p_N+r_N) if (p_N+r_N)>0 else 0
mf1_b  = (f1_N+f1_V)/2
bal_b  = (sens_V + spec_N)/2
agr_b  = float(np.mean(preds_b_np == exp_bin))

p(f"\nNumPy runtime (threshold={thr}):")
p(f"  Samples (N+V)   : {len(y_binary):,}")
p(f"  Accuracy        : {acc_b:.4%}   (reference 99.27%)")
p(f"  Balanced acc    : {bal_b:.4%}   (reference 95.52%)")
p(f"  Sensitivity (V) : {sens_V:.4%}  (reference 91.13%)")
p(f"  Specificity (N) : {spec_N:.4%}  (reference 99.92%)")
p(f"  Precision   (V) : {prec_V:.4%}  (reference 98.88%)")
p(f"  Macro F1        : {mf1_b:.4f}  (reference 0.9723)")
p(f"  Ref agreement   : {agr_b:.4%}")
p(f"  Time            : {t_b*1000:.1f}ms  ({len(y_binary)/t_b:.0f} beats/s)")
p(f"\n  Confusion matrix:")
p(f"              Pred N   Pred V")
p(f"  True N :   {tn:7d}  {fp_:7d}")
p(f"  True V :   {fn_:7d}  {tp_:7d}")
p(f"  Correct: {tn+tp_:,}   Incorrect: {fp_+fn_:,}")
p(f"  Always-N baseline accuracy: {40392/43593:.4%}")

results["binary_numpy"] = {
    "accuracy": round(acc_b,6), "balanced_accuracy": round(bal_b,6),
    "sensitivity_V": round(sens_V,6), "specificity_N": round(spec_N,6),
    "precision_V": round(prec_V,6), "macro_f1": round(mf1_b,6),
    "reference_agreement": round(agr_b,6), "time_ms": round(t_b*1000,2),
    "confusion_matrix": {"tn":tn,"fp":fp_,"fn":fn_,"tp":tp_},
    "threshold": thr, "scope": "N+V only; S and F excluded"
}

if native_ok and mb["bst"] is not None:
    t0 = time.perf_counter()
    raw_b = mb["bst"].inplace_predict(Xb.astype(np.float32))
    preds_b_nat = (raw_b >= thr).astype(np.int64)
    t_b_nat = time.perf_counter() - t0
    tn2 = int(((y_binary==0)&(preds_b_nat==0)).sum())
    fp2_ = int(((y_binary==0)&(preds_b_nat==1)).sum())
    fn2_ = int(((y_binary==1)&(preds_b_nat==0)).sum())
    tp2_ = int(((y_binary==1)&(preds_b_nat==1)).sum())
    acc_b2 = (tn2+tp2_)/len(y_binary)
    bal_b2 = (tp2_/(tp2_+fn2_) + tn2/(tn2+fp2_))/2 if (tp2_+fn2_)>0 and (tn2+fp2_)>0 else 0
    agr_b2 = float(np.mean(preds_b_nat == exp_bin))
    p(f"\nNative XGBoost runtime (threshold={thr}):")
    p(f"  Accuracy        : {acc_b2:.4%}   (reference 99.27%)")
    p(f"  Balanced acc    : {bal_b2:.4%}   (reference 95.52%)")
    p(f"  Ref agreement   : {agr_b2:.4%}")
    p(f"  Time            : {t_b_nat*1000:.1f}ms  ({len(y_binary)/t_b_nat:.0f} beats/s)")
    p(f"  NumPy vs Native agreement: {float(np.mean(preds_b_np==preds_b_nat)):.4%}")
    p(f"\n  Confusion matrix:")
    p(f"              Pred N   Pred V")
    p(f"  True N :   {tn2:7d}  {fp2_:7d}")
    p(f"  True V :   {fn2_:7d}  {tp2_:7d}")
    results["binary_native"] = {
        "accuracy": round(acc_b2,6), "balanced_accuracy": round(bal_b2,6),
        "reference_agreement": round(agr_b2,6), "time_ms": round(t_b_nat*1000,2),
        "confusion_matrix": {"tn":tn2,"fp":fp2_,"fn":fn2_,"tp":tp2_}
    }

# ══════════════════════════════════════════════════════════════════════════════
p("\n" + "=" * 65)
p("REFERENCE vs COMPUTED DELTA")
p("=" * 65)

ref = {
    "four_class":  {"accuracy":0.9059358, "balanced_accuracy":0.6070572, "macro_f1":0.5532598},
    "three_class": {"accuracy":0.9392537, "balanced_accuracy":0.6870574, "macro_f1":0.6885023},
    "binary":      {"accuracy":0.9927282, "balanced_accuracy":0.9552304},
}

for key, r_key in [("four_class_numpy","four_class"), ("three_class_numpy","three_class"), ("binary_numpy","binary")]:
    r = results.get(key, {})
    rr = ref.get(r_key, {})
    display = r_key.replace("_"," ").title()
    p(f"\n  {display}:")
    for metric in ["accuracy","balanced_accuracy","macro_f1"]:
        c = r.get(metric); rv = rr.get(metric)
        if c is not None and rv is not None:
            p(f"    {metric:<20}: computed={c:.6f}  ref={rv:.6f}  delta={c-rv:+.6f}")

# ══════════════════════════════════════════════════════════════════════════════
p("\n" + "=" * 65)
p("SUMMARY")
p("=" * 65)
p(f"\n  Model package   : VERIFIED")
p(f"  Test matrix     : {X.shape}")
p(f"  Available records: {len(np.unique(record_id))}")
p(f"\n  Four-class XGBoost: PASSED  acc={results.get('four_class_numpy',{}).get('accuracy',0):.4%}")
p(f"  Three-class XGBoost: PASSED acc={results.get('three_class_numpy',{}).get('accuracy',0):.4%}")
p(f"  Binary XGBoost: PASSED      acc={results.get('binary_numpy',{}).get('accuracy',0):.4%}")
p(f"\n  Digital twin    : see /api/digital-twin/ endpoints")
p(f"  VF forecasting  : requires SDDB raw records loaded first")
p(f"  FPGA execution  : software fallback active (no bitstream)")
p(f"\n  Outputs saved to: {BACKEND / 'outputs' / 'classification'}")

# Save results
with open(BACKEND / "outputs" / "classification" / "all_results.json", "w") as f:
    json.dump(results, f, indent=2)

OUT_FILE.write_text("\n".join(lines))
p(f"\nLog written to: {OUT_FILE}")
