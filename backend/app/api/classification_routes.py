"""
Beat classification API — Track A.

Serves the three supplied XGBoost models:
  four_class  : N/S/V/F  AAMI four-class
  three_class : N/S/V    (F excluded)
  binary      : N/V      (S and F excluded)

IMPORTANT SCOPE NOTE:
  These classifiers detect observed beat morphology in the MIT-BIH database.
  Binary accuracy of 99.27% is NOT ventricular fibrillation forecasting accuracy.
  A V-class beat is not equivalent to VT/VF.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Literal

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.schemas.api import DISCLAIMER

router = APIRouter(prefix="/classification", tags=["Beat Classification — Track A"])

_PKG = Path(__file__).resolve().parents[2] / "cardiac_pynq_direct_jupyter_package_20261124_162613"
_NPZ = _PKG / "board_test_data.npz"
_OUTPUTS = Path(__file__).resolve().parents[2] / "outputs" / "classification"


# ── Lazy registry ─────────────────────────────────────────────────────────────
_registry = None

def _get_registry():
    global _registry
    if _registry is None:
        from app.services.inference.model_registry import get_registry
        _registry = get_registry()
    return _registry


# ── Request / Response models ─────────────────────────────────────────────────

class BeatRequest(BaseModel):
    features: list[float] = Field(..., min_length=259, max_length=259,
        description="259 ECG features: 252 morphology samples + 7 RR features")
    model_key: Literal["four_class", "three_class", "binary"] = "four_class"
    runtime: Literal["native", "numpy"] = "native"


class BatchBeatRequest(BaseModel):
    features_matrix: list[list[float]] = Field(...,
        description="N × 259 feature matrix")
    model_key: Literal["four_class", "three_class", "binary"] = "four_class"
    runtime: Literal["native", "numpy"] = "native"


class ClassificationResponse(BaseModel):
    model_key: str
    runtime: str
    prediction: int
    class_label: str
    probabilities: dict[str, float]
    threshold_applied: float | None
    inference_time_ms: float
    scope_note: str
    disclaimer: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/models")
def list_models():
    """List all loaded beat-classification models with health status."""
    registry = _get_registry()
    return {
        "models": registry.status_all()["models"],
        "scope": (
            "Beat morphology classifiers trained on MIT-BIH. "
            "Track A: observed beat classification. "
            "Track B (VF forecasting) is a separate pipeline."
        ),
        "disclaimer": DISCLAIMER,
    }


@router.get("/models/{model_key}")
def model_detail(model_key: str):
    """Return metadata for a single model."""
    registry = _get_registry()
    try:
        m = registry.get(model_key)
        return {
            "status": m.status(),
            "class_labels": m.labels,
            "disclaimer": DISCLAIMER,
        }
    except KeyError as e:
        raise HTTPException(404, str(e))


@router.post("/predict", response_model=ClassificationResponse)
def predict_single(req: BeatRequest):
    """Classify a single ECG beat from its 259-feature vector."""
    registry = _get_registry()
    m = registry.get(req.model_key)
    X = np.array(req.features, dtype=np.float32).reshape(1, -1)
    t0 = time.perf_counter()
    preds, probs = m.predict(X, runtime=req.runtime)
    t_ms = (time.perf_counter() - t0) * 1000
    pred_int = int(preds[0])
    return ClassificationResponse(
        model_key=req.model_key,
        runtime=req.runtime,
        prediction=pred_int,
        class_label=m.labels.get(pred_int, str(pred_int)),
        probabilities={m.labels.get(c, str(c)): round(float(probs[0, i]), 6)
                       for i, c in enumerate(m.classes)},
        threshold_applied=m.binary_threshold if m.task == "binary" else None,
        inference_time_ms=round(t_ms, 3),
        scope_note=(
            "Binary N/V: S and F beats excluded. "
            "This is morphology classification, not arrhythmia forecasting."
            if req.model_key == "binary"
            else "Beat morphology classification, not arrhythmia forecasting."
        ),
        disclaimer=DISCLAIMER,
    )


@router.post("/predict-batch")
def predict_batch(req: BatchBeatRequest):
    """Classify a batch of beats."""
    registry = _get_registry()
    m = registry.get(req.model_key)
    X = np.array(req.features_matrix, dtype=np.float32)
    if X.ndim != 2 or X.shape[1] != 259:
        raise HTTPException(422, f"Expected shape (n, 259), got {X.shape}")
    t0 = time.perf_counter()
    preds, probs = m.predict(X, runtime=req.runtime)
    t_ms = (time.perf_counter() - t0) * 1000
    return {
        "model_key": req.model_key,
        "runtime": req.runtime,
        "n_beats": len(preds),
        "predictions": preds.tolist(),
        "class_labels": [m.labels.get(int(p), str(p)) for p in preds],
        "probabilities": probs.tolist(),
        "inference_time_ms": round(t_ms, 3),
        "disclaimer": DISCLAIMER,
    }


@router.post("/evaluate-ds2")
def evaluate_ds2(
    runtime: str = "native",
    max_beats: int | None = None,
):
    """
    Run full DS2 evaluation on the supplied board_test_data.npz.
    Returns actual computed metrics — not stored CSV values.
    
    max_beats: if provided, subsample for faster response (None = full 45,756)
    """
    if not _NPZ.exists():
        raise HTTPException(503, f"NPZ test data not found at {_NPZ}")

    data = np.load(str(_NPZ), allow_pickle=False)
    X, y4 = data["X"], data["y4"]
    record_id = data["record_id"]
    binary_mask = data["binary_mask"]
    y_binary = data["y_binary"]
    exp4 = data["expected_4class"]
    exp_bin = data["expected_binary"]

    if max_beats is not None and max_beats < len(X):
        rng = np.random.default_rng(42)
        idx = rng.choice(len(X), max_beats, replace=False)
        X = X[idx]; y4 = y4[idx]; record_id = record_id[idx]
        binary_mask = binary_mask[idx]
        y_binary = y_binary[:0]  # will be re-extracted
        # re-extract binary subset from sampled
        y_binary = data["y_binary"]  # keep all; mask applied below
        exp4 = exp4[idx]; exp_bin = exp_bin[:0]
        note = f"Subsampled to {max_beats} beats (seed=42)"
    else:
        note = "Full DS2 evaluation (45,756 beats)"

    registry = _get_registry()
    results = {}

    # Four-class
    m4 = registry.get("four_class")
    t0 = time.perf_counter()
    preds4, probs4 = m4.predict(X, runtime=runtime)
    t4 = time.perf_counter() - t0
    acc4  = float(np.mean(preds4 == y4))
    classes4 = [0,1,2,3]
    bal4 = float(np.mean([np.mean(preds4[y4==c]==c) for c in classes4 if (y4==c).sum()>0]))
    f1s4 = []
    for c in classes4:
        tp = int(((preds4==c)&(y4==c)).sum()); fp = int(((preds4==c)&(y4!=c)).sum())
        fn = int(((preds4!=c)&(y4==c)).sum())
        pr = tp/(tp+fp) if tp+fp>0 else 0; rc = tp/(tp+fn) if tp+fn>0 else 0
        f1s4.append(2*pr*rc/(pr+rc) if pr+rc>0 else 0)
    results["four_class"] = {
        "n_samples": int(len(y4)),
        "accuracy": round(acc4, 6),
        "balanced_accuracy": round(bal4, 6),
        "macro_f1": round(float(np.mean(f1s4)), 6),
        "reference_agreement": round(float(np.mean(preds4 == exp4)), 6) if len(exp4)==len(preds4) else None,
        "inference_time_ms": round(t4*1000, 2),
        "reference": {"accuracy": 0.905936, "balanced_accuracy": 0.607057, "macro_f1": 0.553260},
    }

    # Three-class (F excluded)
    mask3 = y4 != 3
    X3, y3 = X[mask3], y4[mask3]
    m3 = registry.get("three_class")
    t0 = time.perf_counter()
    preds3, _ = m3.predict(X3, runtime=runtime)
    t3 = time.perf_counter() - t0
    acc3 = float(np.mean(preds3 == y3))
    bal3 = float(np.mean([np.mean(preds3[y3==c]==c) for c in [0,1,2] if (y3==c).sum()>0]))
    f1s3 = []
    for c in [0,1,2]:
        tp = int(((preds3==c)&(y3==c)).sum()); fp = int(((preds3==c)&(y3!=c)).sum())
        fn = int(((preds3!=c)&(y3==c)).sum())
        pr = tp/(tp+fp) if tp+fp>0 else 0; rc = tp/(tp+fn) if tp+fn>0 else 0
        f1s3.append(2*pr*rc/(pr+rc) if pr+rc>0 else 0)
    results["three_class"] = {
        "n_samples": int(len(y3)),
        "n_excluded_F": int(len(y4) - len(y3)),
        "accuracy": round(acc3, 6),
        "balanced_accuracy": round(bal3, 6),
        "macro_f1": round(float(np.mean(f1s3)), 6),
        "inference_time_ms": round(t3*1000, 2),
        "reference": {"accuracy": 0.939254, "balanced_accuracy": 0.687057, "macro_f1": 0.688502},
    }

    # Binary (N+V only)
    Xb = data["X"][data["binary_mask"]]
    yb = data["y_binary"]
    mb = registry.get("binary")
    t0 = time.perf_counter()
    preds_b, probs_b = mb.predict(Xb, runtime=runtime)
    t_b = time.perf_counter() - t0
    tn = int(((yb==0)&(preds_b==0)).sum()); fp_ = int(((yb==0)&(preds_b==1)).sum())
    fn_ = int(((yb==1)&(preds_b==0)).sum()); tp_ = int(((yb==1)&(preds_b==1)).sum())
    results["binary"] = {
        "n_samples": int(len(yb)),
        "accuracy": round((tn+tp_)/len(yb), 6),
        "balanced_accuracy": round((tp_/(tp_+fn_) + tn/(tn+fp_))/2 if (tp_+fn_)>0 and (tn+fp_)>0 else 0, 6),
        "sensitivity_V": round(tp_/(tp_+fn_) if (tp_+fn_)>0 else 0, 6),
        "specificity_N": round(tn/(tn+fp_) if (tn+fp_)>0 else 0, 6),
        "confusion_matrix": {"tn": tn, "fp": fp_, "fn": fn_, "tp": tp_},
        "inference_time_ms": round(t_b*1000, 2),
        "threshold": mb.binary_threshold,
        "scope": "N and V beats only; S and F excluded from this evaluation",
        "reference": {"accuracy": 0.992728, "balanced_accuracy": 0.955230},
    }

    return {
        "evaluation_note": note,
        "runtime": runtime,
        "results": results,
        "disclaimer": DISCLAIMER,
        "scope_warning": (
            "Binary classifier accuracy must NOT be reported as overall beat "
            "classification accuracy or as VF forecasting accuracy."
        ),
    }


@router.get("/results/latest")
def latest_results():
    """Return most recent saved evaluation results if available."""
    out_file = _OUTPUTS / "all_results.json"
    if not out_file.exists():
        return {"message": "No saved evaluation. Run /evaluate-ds2 first.", "results": None}
    return json.loads(out_file.read_text())
