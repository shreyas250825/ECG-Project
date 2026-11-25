"""
Full DS2 evaluation of all three XGBoost classifiers.

Computes metrics from actual model predictions against ground-truth labels.
Never returns stored CSV values as freshly computed results.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import numpy as np

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
_PKG_DIR = _BACKEND_ROOT / "cardiac_pynq_direct_jupyter_package_20261124_162613"
_NPZ_PATH = _PKG_DIR / "board_test_data.npz"
_OUTPUTS_DIR = _BACKEND_ROOT / "outputs" / "classification"


# ── Metric helpers ────────────────────────────────────────────────────────────

def _accuracy(y_true, y_pred) -> float:
    return float(np.mean(y_true == y_pred))


def _balanced_accuracy(y_true, y_pred) -> float:
    classes = np.unique(y_true)
    per_class = []
    for c in classes:
        mask = y_true == c
        if mask.sum() == 0:
            continue
        per_class.append(np.mean(y_pred[mask] == c))
    return float(np.mean(per_class)) if per_class else 0.0


def _confusion_matrix(y_true, y_pred, labels) -> np.ndarray:
    n = len(labels)
    cm = np.zeros((n, n), dtype=np.int64)
    for i, ti in enumerate(labels):
        for j, tj in enumerate(labels):
            cm[i, j] = int(np.sum((y_true == ti) & (y_pred == tj)))
    return cm


def _precision_recall_f1_per_class(y_true, y_pred, labels) -> dict:
    result = {}
    for c in labels:
        tp = int(np.sum((y_pred == c) & (y_true == c)))
        fp = int(np.sum((y_pred == c) & (y_true != c)))
        fn = int(np.sum((y_pred != c) & (y_true == c)))
        p = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        r = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f = 2 * p * r / (p + r) if (p + r) > 0 else 0.0
        result[int(c)] = {"precision": p, "recall": r, "f1": f, "support": int(tp + fn)}
    return result


def _macro_f1(y_true, y_pred, labels) -> float:
    prf = _precision_recall_f1_per_class(y_true, y_pred, labels)
    return float(np.mean([v["f1"] for v in prf.values()]))


def _roc_auc_ovr(y_true, probs, labels) -> float:
    """Macro one-vs-rest ROC-AUC."""
    from sklearn.preprocessing import label_binarize
    from sklearn.metrics import roc_auc_score
    if len(labels) == 2:
        return float(roc_auc_score(y_true, probs[:, 1]))
    y_bin = label_binarize(y_true, classes=labels)
    aucs = []
    for i in range(len(labels)):
        if y_bin[:, i].sum() == 0:
            continue
        try:
            aucs.append(roc_auc_score(y_bin[:, i], probs[:, i]))
        except Exception:
            pass
    return float(np.mean(aucs)) if aucs else float("nan")


def _average_precision_ovr(y_true, probs, labels) -> float:
    """Macro one-vs-rest average precision."""
    from sklearn.preprocessing import label_binarize
    from sklearn.metrics import average_precision_score
    if len(labels) == 2:
        return float(average_precision_score(y_true, probs[:, 1]))
    y_bin = label_binarize(y_true, classes=labels)
    aps = []
    for i in range(len(labels)):
        if y_bin[:, i].sum() == 0:
            continue
        try:
            aps.append(average_precision_score(y_bin[:, i], probs[:, i]))
        except Exception:
            pass
    return float(np.mean(aps)) if aps else float("nan")


# ── Per-record helper ─────────────────────────────────────────────────────────

def _per_record_metrics(y_true, y_pred, record_ids, labels) -> list[dict]:
    rows = []
    for rec in sorted(np.unique(record_ids)):
        mask = record_ids == rec
        yt = y_true[mask]
        yp = y_pred[mask]
        rows.append({
            "record": str(rec),
            "n": int(mask.sum()),
            "accuracy": _accuracy(yt, yp),
            "per_class_counts": {
                str(c): {"true": int((yt == c).sum()), "pred": int((yp == c).sum())}
                for c in labels
            },
        })
    return rows


# ── Main evaluation function ──────────────────────────────────────────────────

def run_full_evaluation(runtime: str = "native") -> dict:
    """
    Load all three models and run full DS2 evaluation.

    Returns a dict with results for each model, plus reference comparison.
    """
    from .model_registry import get_registry

    if not _NPZ_PATH.exists():
        return {"error": f"NPZ not found: {_NPZ_PATH}"}

    # Load test data
    data = np.load(str(_NPZ_PATH), allow_pickle=False)
    X               = data["X"]                   # (45756, 259) float32
    y4              = data["y4"]                  # (45756,) int64 — AAMI 4-class
    record_id       = data["record_id"]           # (45756,) str
    binary_mask     = data["binary_mask"]         # (45756,) bool — N+V only
    y_binary        = data["y_binary"]            # (43593,) int64 — binary labels
    expected_4class = data["expected_4class"]     # (45756,) int64
    expected_binary = data["expected_binary"]     # (43593,) int64

    registry = get_registry()
    results = {}

    # ── Four-class ───────────────────────────────────────────────────────────
    model = registry.get("four_class")
    t0 = time.perf_counter()
    preds4, probs4 = model.predict(X, runtime=runtime)
    t_inf = time.perf_counter() - t0
    labels4 = [0, 1, 2, 3]
    prf4 = _precision_recall_f1_per_class(y4, preds4, labels4)
    results["four_class"] = {
        "n_samples": len(y4),
        "runtime": runtime,
        "inference_time_s": round(t_inf, 4),
        "throughput_beats_per_s": round(len(y4) / t_inf, 1),
        "accuracy": round(_accuracy(y4, preds4), 6),
        "balanced_accuracy": round(_balanced_accuracy(y4, preds4), 6),
        "macro_f1": round(_macro_f1(y4, preds4, labels4), 6),
        "roc_auc_macro_ovr": round(_roc_auc_ovr(y4, probs4, labels4), 6),
        "average_precision_macro_ovr": round(_average_precision_ovr(y4, probs4, labels4), 6),
        "per_class": prf4,
        "confusion_matrix": _confusion_matrix(y4, preds4, labels4).tolist(),
        "reference_agreement": round(float(np.mean(preds4 == expected_4class)), 6),
        "per_record": _per_record_metrics(y4, preds4, record_id, labels4),
    }

    # ── Three-class (exclude F, label==3) ────────────────────────────────────
    mask3 = y4 != 3
    X3, y3 = X[mask3], y4[mask3]
    # Remap: N=0, S=1, V=2 (same labels; F-excluded y4 already uses 0,1,2)
    rec3 = record_id[mask3]
    model3 = registry.get("three_class")
    t0 = time.perf_counter()
    preds3, probs3 = model3.predict(X3, runtime=runtime)
    t_inf3 = time.perf_counter() - t0
    labels3 = [0, 1, 2]
    prf3 = _precision_recall_f1_per_class(y3, preds3, labels3)
    results["three_class"] = {
        "n_samples": int(mask3.sum()),
        "n_excluded_F": int((~mask3).sum()),
        "runtime": runtime,
        "inference_time_s": round(t_inf3, 4),
        "throughput_beats_per_s": round(mask3.sum() / t_inf3, 1),
        "accuracy": round(_accuracy(y3, preds3), 6),
        "balanced_accuracy": round(_balanced_accuracy(y3, preds3), 6),
        "macro_f1": round(_macro_f1(y3, preds3, labels3), 6),
        "roc_auc_macro_ovr": round(_roc_auc_ovr(y3, probs3, labels3), 6),
        "average_precision_macro_ovr": round(_average_precision_ovr(y3, probs3, labels3), 6),
        "per_class": prf3,
        "confusion_matrix": _confusion_matrix(y3, preds3, labels3).tolist(),
        "note": "F-category beats excluded; three-class N/S/V only",
        "per_record": _per_record_metrics(y3, preds3, rec3, labels3),
    }

    # ── Binary N/V (binary_mask selects N+V beats only) ─────────────────────
    Xb = X[binary_mask]
    rec_b = record_id[binary_mask]
    model_b = registry.get("binary")
    t0 = time.perf_counter()
    preds_b, probs_b = model_b.predict(Xb, runtime=runtime)
    t_inf_b = time.perf_counter() - t0
    labels_b = [0, 1]
    tn = int(np.sum((y_binary == 0) & (preds_b == 0)))
    fp = int(np.sum((y_binary == 0) & (preds_b == 1)))
    fn = int(np.sum((y_binary == 1) & (preds_b == 0)))
    tp = int(np.sum((y_binary == 1) & (preds_b == 1)))
    sensitivity_V = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    specificity_N = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    precision_V   = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    results["binary"] = {
        "n_samples": int(binary_mask.sum()),
        "runtime": runtime,
        "threshold_used": model_b.binary_threshold,
        "inference_time_s": round(t_inf_b, 4),
        "throughput_beats_per_s": round(binary_mask.sum() / t_inf_b, 1),
        "accuracy": round(_accuracy(y_binary, preds_b), 6),
        "balanced_accuracy": round(_balanced_accuracy(y_binary, preds_b), 6),
        "macro_f1": round(_macro_f1(y_binary, preds_b, labels_b), 6),
        "sensitivity_V": round(sensitivity_V, 6),
        "specificity_N": round(specificity_N, 6),
        "precision_V": round(precision_V, 6),
        "roc_auc_v_positive": round(_roc_auc_ovr(y_binary, probs_b, labels_b), 6),
        "average_precision_v_positive": round(_average_precision_ovr(y_binary, probs_b, labels_b), 6),
        "confusion_matrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
        "correct_predictions": tn + tp,
        "incorrect_predictions": fp + fn,
        "reference_agreement": round(float(np.mean(preds_b == expected_binary)), 6),
        "scope_note": (
            "Binary classifier trained on N and V beats only. "
            "S and F beats are excluded from this evaluation. "
            "Must NOT be presented as four-class accuracy."
        ),
        "per_record": _per_record_metrics(y_binary, preds_b, rec_b, labels_b),
    }

    # ── Reference metrics from experiment_summary.json ───────────────────────
    summary_path = _BACKEND_ROOT / "experiment_results" / "experiment_summary.json"
    reference = {}
    if summary_path.exists():
        try:
            raw = json.loads(summary_path.read_text())
            reference = {
                "four_class": raw.get("four_class_metrics", {}),
                "three_class": raw.get("three_class_metrics_F_excluded", {}),
                "binary": raw.get("binary_NV_metrics_SF_excluded", {}),
            }
        except Exception:
            pass

    # ── Compute differences vs reference ─────────────────────────────────────
    def _diff(computed_key: str, ref_key: str, metric: str) -> dict:
        c = results.get(computed_key, {}).get(metric)
        r = reference.get(ref_key, {}).get(metric)
        if c is None or r is None:
            return {"computed": c, "reference": r, "delta": None}
        return {"computed": round(c, 6), "reference": round(r, 6), "delta": round(c - r, 6)}

    comparison = {
        "four_class": {
            "accuracy":          _diff("four_class", "four_class", "accuracy"),
            "balanced_accuracy": _diff("four_class", "four_class", "balanced_accuracy"),
            "macro_f1":          _diff("four_class", "four_class", "macro_f1"),
        },
        "three_class": {
            "accuracy":          _diff("three_class", "three_class", "accuracy"),
            "balanced_accuracy": _diff("three_class", "three_class", "balanced_accuracy"),
            "macro_f1":          _diff("three_class", "three_class", "macro_f1"),
        },
        "binary": {
            "accuracy":          _diff("binary", "binary", "accuracy"),
            "balanced_accuracy": _diff("binary", "binary", "balanced_accuracy"),
            "sensitivity_V":     _diff("binary", "binary", "sensitivity_V"),
            "specificity_N":     _diff("binary", "binary", "specificity_N"),
        },
    }

    # ── Runtime parity ────────────────────────────────────────────────────────
    # Compare native vs numpy predictions on a 1000-sample subset
    parity = {}
    rng = np.random.default_rng(42)
    idx_sample = rng.choice(len(X), min(1000, len(X)), replace=False)
    X_sample = X[idx_sample]

    for key in ["four_class", "three_class", "binary"]:
        m = registry.get(key)
        # pick the right labels/mask
        if key == "binary":
            mask_s = binary_mask[idx_sample]
            Xs = X_sample[mask_s]
        elif key == "three_class":
            mask_s = y4[idx_sample] != 3
            Xs = X_sample[mask_s]
        else:
            Xs = X_sample
        if len(Xs) == 0:
            parity[key] = "insufficient_sample"
            continue
        p_np, _ = m.predict(Xs, runtime="numpy")
        p_nat = None
        if m.booster is not None:
            try:
                p_nat, _ = m.predict(Xs, runtime="native")
            except Exception:
                pass
        parity[key] = {
            "sample_size": len(Xs),
            "numpy_vs_native_agreement": (
                round(float(np.mean(p_np == p_nat)), 6) if p_nat is not None else "native_unavailable"
            ),
        }

    return {
        "results": results,
        "reference_metrics": reference,
        "comparison_vs_reference": comparison,
        "runtime_parity": parity,
        "dataset_info": {
            "n_total_beats": int(len(X)),
            "n_records": int(len(np.unique(record_id))),
            "records": sorted(np.unique(record_id).tolist()),
            "feature_count": int(X.shape[1]),
            "binary_eligible": int(binary_mask.sum()),
        },
    }


def save_evaluation(results: dict, output_dir: Path | None = None) -> Path:
    """Save evaluation results to outputs/classification/."""
    out = output_dir or _OUTPUTS_DIR
    out.mkdir(parents=True, exist_ok=True)
    path = out / "evaluation_results.json"
    with open(path, "w") as f:
        json.dump(results, f, indent=2, default=str)

    # Per-record CSV
    import csv
    rows = []
    for model_key in ["four_class", "three_class", "binary"]:
        for rec in results.get("results", {}).get(model_key, {}).get("per_record", []):
            rows.append({"model": model_key, **rec})
    if rows:
        pr_path = out / "per_record_metrics.csv"
        with open(pr_path, "w", newline="") as f:
            dw = csv.DictWriter(f, fieldnames=["model", "record", "n", "accuracy"])
            dw.writeheader()
            for r in rows:
                dw.writerow({"model": r["model"], "record": r["record"],
                             "n": r["n"], "accuracy": r["accuracy"]})

    return path
