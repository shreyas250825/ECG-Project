"""Train baseline sklearn models on labelled forecast windows. No fake metrics."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.core.config import settings
from app.core.errors import ResearchError
from app.db.store import store
from app.forecasting.engine import evidence_status, score_from_sklearn, EvidenceThresholds
from app.forecasting.labels import make_forecast_labels, recording_level_split
from app.processing.features import FEATURE_ORDER, vector_to_array
from app.schemas.api import DISCLAIMER
from app.services.analysis import window_features

log = logging.getLogger(__name__)

THRESHOLDS = EvidenceThresholds()


def _model_factory(name: str) -> Any:
    if name == "logistic_regression":
        clf = LogisticRegression(max_iter=400, class_weight="balanced")
    elif name == "random_forest":
        clf = RandomForestClassifier(n_estimators=80, min_samples_leaf=2, class_weight="balanced", random_state=0)
    elif name == "gradient_boosting":
        clf = GradientBoostingClassifier(random_state=0)
    else:
        raise ResearchError("Unknown model. Use logistic_regression, random_forest, or gradient_boosting.", "bad_model")
    return Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("clf", clf),
        ]
    )


def _examples_for_record(record_id: str, target: str, obs: float, horizon: float, step: float) -> list[dict]:
    rec = store.get_record(record_id)
    sig = store.get_signal(record_id)
    anns = store.get_annotations(record_id)
    if not rec or not sig:
        raise ResearchError("Record not found.", "no_ecg", 404)
    if not anns:
        raise ResearchError("Missing annotations; forecasting cannot run.", "missing_annotations")
    duration = float(len(sig["signal"]) / sig["fs"])
    labels = make_forecast_labels(record_id, duration, anns, target, obs, horizon, step)
    signal = np.asarray(sig["signal"], dtype=np.float64)
    fs = float(sig["fs"])
    rows = []
    for ex in labels:
        try:
            fv = window_features(signal, fs, ex.observation_start_s, ex.observation_end_s)
        except ResearchError:
            continue
        rows.append({"example": ex, "features": fv["values"], "sufficient": fv["sufficient"]})
    return rows


def train_models(req) -> dict:
    ids = req.record_ids or [r["id"] for r in store.list_records() if store.get_annotations(r["id"])]
    if not ids:
        raise ResearchError("No annotated records available for training.", "missing_annotations")

    all_rows: list[dict] = []
    for rid in ids:
        all_rows.extend(_examples_for_record(rid, req.target_event, req.observation_s, req.horizon_s, req.step_s))
    if len(all_rows) < 10:
        raise ResearchError("Not enough labelled windows after feature extraction.", "insufficient_data")

    rec_ids = [r["example"].record_id for r in all_rows]
    unique = sorted(set(rec_ids))
    if len(unique) == 1:
        train_ids, test_ids = unique, []
        note = "Single-recording split: test metrics withheld to avoid leaking overlapping windows."
    else:
        train_ids, test_ids = recording_level_split(unique, 0.3, seed=0)
        note = "Recording-level split (no overlapping windows of the same recording in train and test)."

    def pack(id_set: list[str]) -> tuple[np.ndarray, np.ndarray]:
        subset = [r for r in all_rows if r["example"].record_id in id_set]
        X = np.vstack([vector_to_array(r["features"]) for r in subset])
        y = np.array([r["example"].label for r in subset], dtype=int)
        return X, y

    X_train, y_train = pack(train_ids)
    if len(np.unique(y_train)) < 2:
        raise ResearchError("Training labels contain a single class; cannot train a classifier.", "insufficient_data")

    pipe = _model_factory(req.model_name)
    pipe.fit(X_train, y_train)

    metrics: dict[str, float | None] = {}
    if test_ids:
        X_test, y_test = pack(test_ids)
        if len(X_test) and len(np.unique(y_test)) == 2:
            proba = pipe.predict_proba(X_test)[:, 1]
            pred = (proba >= 0.5).astype(int)
            metrics = {
                "sensitivity": float(recall_score(y_test, pred, zero_division=0)),
                "recall": float(recall_score(y_test, pred, zero_division=0)),
                "precision": float(precision_score(y_test, pred, zero_division=0)),
                "f1": float(f1_score(y_test, pred, zero_division=0)),
                "auroc": float(roc_auc_score(y_test, proba)),
                "auprc": float(average_precision_score(y_test, proba)),
                "specificity": float(recall_score(y_test == 0, pred == 0, zero_division=0)),
                "false_alarm_rate": float(1.0 - recall_score(y_test == 0, pred == 0, zero_division=0)),
                "n_test": float(len(y_test)),
            }
        else:
            metrics = {}
            note += " Test set lacked both classes; metrics not reported."
    else:
        metrics = {}

    Path(settings.model_dir).mkdir(parents=True, exist_ok=True)
    model_row = store.add_model_run(
        {
            "model_name": req.model_name,
            "model_version": "0.1.0",
            "dataset_version": "demo-synth-or-uploads",
            "observation_window": req.observation_s,
            "forecast_horizon": req.horizon_s,
            "training_config": {
                "target_event": req.target_event,
                "step_s": req.step_s,
                "train_record_ids": train_ids,
                "test_record_ids": test_ids,
                "n_train_windows": int(len(y_train)),
                "positive_train": int(y_train.sum()),
            },
            "metrics": metrics,
            "split_note": note,
            "feature_order": FEATURE_ORDER,
        }
    )
    path = Path(settings.model_dir) / f"{model_row['id']}.joblib"
    joblib.dump(pipe, path)
    model_row["artifact_path"] = str(path)
    store.model_runs[model_row["id"]] = model_row
    if metrics:
        store.add_evaluation({"model_id": model_row["id"], "metrics": metrics, "split_note": note})
    log.info("model_training", extra={"event": "model_training", "execution_mode": "software"})
    return {**model_row, "disclaimer": DISCLAIMER, "trained": True}


def load_model(model_id: str | None) -> tuple[Any | None, dict | None]:
    runs = store.list_model_runs()
    if model_id:
        row = store.get_model_run(model_id)
    else:
        row = runs[-1] if runs else None
    if not row:
        return None, None
    path = row.get("artifact_path")
    if not path or not Path(path).exists():
        return None, row
    return joblib.load(path), row


def run_forecast(req) -> dict:
    rec = store.get_record(req.record_id)
    sig = store.get_signal(req.record_id)
    anns = store.get_annotations(req.record_id)
    if not rec or not sig:
        raise ResearchError("Record not found.", "no_ecg", 404)
    if not anns:
        raise ResearchError("Missing annotations; forecasting cannot run.", "missing_annotations")

    model, model_row = load_model(req.model_id)
    trained = model is not None
    signal = np.asarray(sig["signal"], dtype=np.float64)
    fs = float(sig["fs"])
    duration = len(signal) / fs
    pred_t = req.prediction_time_s
    if pred_t is None:
        vt = [a for a in anns if a.get("event_type") == req.target_event]
        if vt:
            pred_t = max(req.observation_s, float(vt[0]["start_time"]) - req.horizon_s * 0.5)
        else:
            pred_t = min(duration - req.horizon_s, req.observation_s)

    if pred_t < req.observation_s:
        raise ResearchError("Insufficient pre-event data for the observation window.", "insufficient_data")

    fv = window_features(signal, fs, pred_t - req.observation_s, pred_t)
    score = score_from_sklearn(model, vector_to_array(fv["values"])) if trained else None
    status = evidence_status(score, trained, fv["sufficient"], THRESHOLDS)

    future = [
        a
        for a in anns
        if a.get("event_type") == req.target_event and pred_t < float(a["start_time"]) <= pred_t + req.horizon_s
    ]
    gt = 1 if future else 0
    lead = float(future[0]["start_time"] - pred_t) if future else None

    message = {
        "MODEL_NOT_TRAINED": "Model not trained on this dataset.",
        "INSUFFICIENT_EVIDENCE": "Insufficient evidence for reliable forecasting.",
        "LOW_EVIDENCE": "Low model-estimated evidence for a target event within the horizon.",
        "MODERATE_EVIDENCE": "Moderate model-estimated evidence for a target event within the horizon.",
        "ELEVATED_MODEL_ESTIMATED_RISK": "Elevated model-estimated risk (experimental; not a diagnosis).",
    }[status]

    payload = {
        "disclaimer": DISCLAIMER,
        "horizon_note": "Forecasting horizon is an experimental parameter. The system does not assume a fixed warning time.",
        "target_event": req.target_event,
        "observation_window_s": req.observation_s,
        "forecast_horizon_s": req.horizon_s,
        "prediction_time_s": pred_t,
        "observation_start_s": pred_t - req.observation_s,
        "model_id": model_row["id"] if model_row else None,
        "model_name": model_row["model_name"] if model_row else None,
        "model_score": score,
        "status": status,
        "message": message,
        "ground_truth_in_horizon": gt,
        "lead_time_seconds": lead,
        "event_markers": anns,
        "duration_seconds": duration,
        "features_sufficient": fv["sufficient"],
        "not_a_statement_of_certainty": True,
    }
    store.add_forecast_result(
        {
            "record_id": req.record_id,
            "timestamp": pred_t,
            "target_event": req.target_event,
            "forecast_horizon": req.horizon_s,
            "model_score": score,
            "prediction": status,
            "ground_truth": gt,
            "lead_time_seconds": lead,
        }
    )
    log.info("forecast_run", extra={"event": "forecast_run", "execution_mode": "software"})
    return payload
