#!/usr/bin/env python
"""
train_forecasting_models.py
----------------------------
Trains Track B forecasting models on the prepared SDDB feature dataset.

Prerequisite: run prepare_sddb_features.py first.

Usage:
    cd backend
    python scripts/train_forecasting_models.py [--horizon 30] [--feature-set absolute|deviation|personalized]

Implements:
  - Dummy baseline (prevalence)
  - Logistic Regression
  - Random Forest
  - GRU (requires torch)
  - Transformer (requires torch)

Uses grouped 5-fold cross-validation (by record).
"""
import sys, json, argparse, time
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

parser = argparse.ArgumentParser()
parser.add_argument("--horizon",     type=int, default=30, choices=[5,10,20,30])
parser.add_argument("--feature-set", default="absolute", choices=["absolute","deviation","personalized"])
parser.add_argument("--seed",        type=int, default=42)
args = parser.parse_args()

import numpy as np
from sklearn.linear_model  import LogisticRegression
from sklearn.ensemble       import RandomForestClassifier
from sklearn.preprocessing  import StandardScaler
from sklearn.impute         import SimpleImputer
from sklearn.pipeline       import Pipeline
from sklearn.metrics        import roc_auc_score, average_precision_score, f1_score
import joblib

OUTPUTS = BACKEND / "outputs" / "forecasting"
NPZ_PATH = OUTPUTS / "sddb_features.npz"

if not NPZ_PATH.exists():
    print(f"ERROR: {NPZ_PATH} not found.")
    print("Run: python scripts/prepare_sddb_features.py first.")
    sys.exit(1)

data = np.load(str(NPZ_PATH), allow_pickle=False)
X = data["X"].astype(np.float32)
record_id = data["record_id"]
label_key = f"labels_H{args.horizon}min"

if label_key not in data:
    print(f"ERROR: {label_key} not in NPZ. Available: {list(data.keys())}")
    sys.exit(1)

y_raw = data[label_key].astype(np.int8)
# Remove censored windows (label == -1)
valid = y_raw >= 0
X, y, recs = X[valid], y_raw[valid].astype(int), record_id[valid]

n_pos = int(y.sum()); n_neg = int((y==0).sum())
print(f"Dataset: {len(y)} windows  +{n_pos}  -{n_neg}  "
      f"prevalence={n_pos/len(y)*100:.2f}%  horizon={args.horizon}min")

if n_pos < 2:
    print("ERROR: Fewer than 2 positive examples. Load more SDDB records first.")
    sys.exit(1)

# Grouped 5-fold cross-validation by record
unique_recs = sorted(np.unique(recs))
n_folds = min(5, len(unique_recs))
rng = np.random.default_rng(args.seed)
shuffled = rng.permutation(unique_recs)
folds = [shuffled[i::n_folds].tolist() for i in range(n_folds)]

print(f"CV: {n_folds}-fold grouped by record  ({len(unique_recs)} records)")

models_to_try = [
    ("Dummy (prevalence)", None),
    ("Logistic Regression",
     Pipeline([("imp", SimpleImputer("median")), ("sc", StandardScaler()),
               ("clf", LogisticRegression(max_iter=400, class_weight="balanced", random_state=args.seed))])),
    ("Random Forest",
     Pipeline([("imp", SimpleImputer("median")),
               ("clf", RandomForestClassifier(n_estimators=100, class_weight="balanced",
                                               min_samples_leaf=2, random_state=args.seed))])),
]

# Try GRU/Transformer if torch available
try:
    import torch
    from torch import nn
    sys.path.insert(0, str(BACKEND))
    from ml.models.temporal import GRUForecaster, TemporalConvForecaster
    models_to_try.append(("GRU", "gru"))
    models_to_try.append(("TCN", "tcn"))
    torch_ok = True
    print("PyTorch available — GRU and TCN will be trained.")
except ImportError:
    torch_ok = False
    print("PyTorch not available — skipping GRU/TCN.")

results = {}

for model_name, model_obj in models_to_try:
    fold_auroc = []; fold_ap = []
    print(f"\n  {model_name}:")

    for fi, test_recs in enumerate(folds):
        test_mask  = np.isin(recs, test_recs)
        train_mask = ~test_mask
        X_tr, y_tr = X[train_mask], y[train_mask]
        X_te, y_te = X[test_mask],  y[test_mask]

        if y_te.sum() == 0 or y_tr.sum() == 0:
            print(f"    fold {fi+1}: skip (no positives in split)")
            continue

        if model_obj is None:
            # Dummy: predict training prevalence
            prev = y_tr.mean()
            proba_te = np.full(len(y_te), prev)
        elif isinstance(model_obj, str):
            # Torch model
            if not torch_ok: continue
            n_feat = X_tr.shape[1]
            if model_obj == "gru":
                net = GRUForecaster(n_feat, hidden=32)
            else:
                net = TemporalConvForecaster(n_feat, hidden=32)
            # Simple single-step training (not sequence — treat each window independently)
            Xt = torch.tensor(X_tr, dtype=torch.float32).unsqueeze(1)  # (N,1,F)
            yt = torch.tensor(y_tr, dtype=torch.float32)
            opt = torch.optim.Adam(net.parameters(), lr=1e-3)
            pos_weight = torch.tensor([(y_tr==0).sum() / max(y_tr.sum(), 1)], dtype=torch.float32)
            loss_fn = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
            net.train()
            for epoch in range(30):
                opt.zero_grad()
                logits = net(Xt)
                loss = loss_fn(logits, yt)
                loss.backward(); opt.step()
            net.eval()
            with torch.no_grad():
                Xte_t = torch.tensor(X_te, dtype=torch.float32).unsqueeze(1)
                logits_te = net(Xte_t)
                proba_te = torch.sigmoid(logits_te).numpy()
        else:
            model_obj.fit(X_tr, y_tr)
            proba_te = model_obj.predict_proba(X_te)[:, 1]

        try:
            au = roc_auc_score(y_te, proba_te)
            ap = average_precision_score(y_te, proba_te)
            fold_auroc.append(au); fold_ap.append(ap)
            print(f"    fold {fi+1}: AUROC={au:.3f}  AP={ap:.4f}  "
                  f"(+{y_te.sum()}/{len(y_te)})")
        except Exception as e:
            print(f"    fold {fi+1}: metric error: {e}")

    if fold_auroc:
        mean_auroc = float(np.mean(fold_auroc))
        mean_ap    = float(np.mean(fold_ap))
        print(f"    Mean: AUROC={mean_auroc:.3f}  AP={mean_ap:.4f}")
        results[model_name] = {"mean_auroc": round(mean_auroc,4), "mean_ap": round(mean_ap,4),
                                "n_folds": len(fold_auroc)}

# Train final LR model on all data
print(f"\nTraining final Logistic Regression on all data ({len(y)} windows)…")
final_pipe = Pipeline([
    ("imp", SimpleImputer("median")), ("sc", StandardScaler()),
    ("clf", LogisticRegression(max_iter=400, class_weight="balanced", random_state=args.seed))
])
final_pipe.fit(X, y)
(BACKEND / "models").mkdir(parents=True, exist_ok=True)
model_path = BACKEND / "models" / f"sddb_lr_H{args.horizon}min.joblib"
joblib.dump(final_pipe, model_path)
print(f"Saved: {model_path}")

# Save results
summary = {
    "horizon_min":    args.horizon,
    "feature_set":    args.feature_set,
    "n_windows":      len(y),
    "n_positive":     n_pos,
    "n_negative":     n_neg,
    "prevalence":     round(n_pos/len(y), 4),
    "cv_folds":       n_folds,
    "model_results":  results,
    "final_model":    str(model_path),
    "note": (
        "Cross-validated on record-level grouped splits. "
        "DS2 partition used for development — not an independent external validation cohort."
    ),
}
out_path = OUTPUTS / f"training_results_H{args.horizon}min.json"
with open(out_path, "w") as f:
    json.dump(summary, f, indent=2)
print(f"Saved: {out_path}")
print("\nForecasting model training complete.")
