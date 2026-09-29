"""Experimental forecasting inference with honest status labels.

Thresholds are configuration, not clinical cut-offs. Untrained models return no scores.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

from app.processing.features import FEATURE_ORDER


@dataclass
class EvidenceThresholds:
    """Configurable mapping from model score to evidence language."""

    insufficient_below: float = 0.0  # unused if model missing
    low_below: float = 0.33
    moderate_below: float = 0.66


def evidence_status(score: float | None, trained: bool, sufficient_input: bool, thresholds: EvidenceThresholds) -> str:
    if not trained:
        return "MODEL_NOT_TRAINED"
    if not sufficient_input or score is None or not np.isfinite(score):
        return "INSUFFICIENT_EVIDENCE"
    if score < thresholds.low_below:
        return "LOW_EVIDENCE"
    if score < thresholds.moderate_below:
        return "MODERATE_EVIDENCE"
    return "ELEVATED_MODEL_ESTIMATED_RISK"


def score_from_sklearn(model: Any, feature_row: np.ndarray) -> float | None:
    if model is None:
        return None
    x = feature_row.reshape(1, -1)
    if np.any(~np.isfinite(x)):
        return None
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(x)[0]
        classes = list(getattr(model, "classes_", [0, 1]))
        if 1 in classes:
            return float(proba[classes.index(1)])
        return float(proba[-1])
    if hasattr(model, "decision_function"):
        z = float(np.ravel(model.decision_function(x))[0])
        return float(1.0 / (1.0 + np.exp(-z)))
    pred = model.predict(x)[0]
    return float(pred)


def empty_feature_row() -> np.ndarray:
    return np.full(len(FEATURE_ORDER), np.nan)
