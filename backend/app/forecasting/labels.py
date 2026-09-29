"""Forecasting label construction without future leakage.

Observation window: features computed only on ECG in [t - obs, t).
Forecast horizon H: label is positive iff a target event starts in (t, t+H].

Splits must be recording-level: never mix overlapping windows of the same
recording across train and test.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class ForecastExample:
    record_id: str
    prediction_time_s: float
    observation_start_s: float
    observation_end_s: float
    horizon_s: float
    label: int
    lead_time_s: float | None


def _event_starts(annotations: list[dict], target: str) -> list[float]:
    starts: list[float] = []
    for a in annotations:
        if a.get("event_type") == target:
            starts.append(float(a["start_time"]))
    return sorted(starts)


def make_forecast_labels(
    record_id: str,
    duration_s: float,
    annotations: list[dict],
    target_event: str,
    observation_s: float,
    horizon_s: float,
    step_s: float = 10.0,
) -> list[ForecastExample]:
    """Build examples. Features for each example must use only [obs_start, pred_time)."""
    if observation_s <= 0 or horizon_s <= 0:
        raise ValueError("Observation window and horizon must be positive.")
    starts = _event_starts(annotations, target_event)
    examples: list[ForecastExample] = []
    t = observation_s
    # last prediction time such that horizon still inside recording (for evaluable GT)
    while t + horizon_s <= duration_s:
        future = [s for s in starts if t < s <= t + horizon_s]
        label = 1 if future else 0
        lead = float(future[0] - t) if future else None
        examples.append(
            ForecastExample(
                record_id=record_id,
                prediction_time_s=t,
                observation_start_s=t - observation_s,
                observation_end_s=t,
                horizon_s=horizon_s,
                label=label,
                lead_time_s=lead,
            )
        )
        t += step_s
    return examples


def recording_level_split(
    record_ids: list[str],
    test_fraction: float = 0.3,
    seed: int = 0,
) -> tuple[list[str], list[str]]:
    """Split by recording identifier, not by shuffling windows."""
    ids = sorted(set(record_ids))
    rng = np.random.default_rng(seed)
    perm = rng.permutation(len(ids))
    n_test = max(1, int(round(len(ids) * test_fraction))) if len(ids) > 1 else 0
    test_idx = set(perm[:n_test].tolist())
    train = [ids[i] for i in range(len(ids)) if i not in test_idx]
    test = [ids[i] for i in range(len(ids)) if i in test_idx]
    return train, test
