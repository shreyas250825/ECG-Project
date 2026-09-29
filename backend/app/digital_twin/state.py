"""Computational cardiac digital twin (ECG feature state), not an anatomical model."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.digital_twin.baseline import PatientBaseline
from app.processing.features import FEATURE_ORDER


STATE_KEYS = [
    "heart_rate_bpm",
    "rr_cv",
    "sdnn_s",
    "qrs_width_s",
    "qrs_amplitude",
    "morphology_std",
]


@dataclass
class DigitalTwinState:
    record_id: str
    timestamp_s: float
    state_vector: dict[str, float]
    deviation: dict[str, float]
    deviation_score: float | None
    definition: str
    notes: list[str]


def build_state(
    record_id: str,
    timestamp_s: float,
    features: dict[str, float],
    baseline: PatientBaseline | None,
) -> DigitalTwinState:
    state = {k: float(features.get(k, np.nan)) for k in STATE_KEYS}
    if baseline is None:
        return DigitalTwinState(
            record_id=record_id,
            timestamp_s=timestamp_s,
            state_vector=state,
            deviation={},
            deviation_score=None,
            definition=(
                "A patient-specific computational representation of cardiac electrical "
                "characteristics derived from ECG features and their temporal evolution."
            ),
            notes=["No baseline available; deviation not computed."],
        )
    full_dev = baseline.deviation(features)
    return DigitalTwinState(
        record_id=record_id,
        timestamp_s=timestamp_s,
        state_vector=state,
        deviation={k: full_dev.get(k, float("nan")) for k in STATE_KEYS},
        deviation_score=baseline.deviation_score(features),
        definition=(
            "A patient-specific computational representation of cardiac electrical "
            "characteristics derived from ECG features and their temporal evolution."
        ),
        notes=[
            "Not an anatomical 3D heart, electrophysiology solver, or clinical digital twin.",
            "Deviation is versus the learned baseline window only.",
        ],
    )


def trajectory_matrix(states: list[DigitalTwinState]) -> list[dict]:
    return [
        {
            "timestamp_s": s.timestamp_s,
            "state_vector": s.state_vector,
            "deviation_score": s.deviation_score,
        }
        for s in states
    ]
