"""
Patient-specific cardiac digital twin state engine.

Track B: Patient-specific monitoring model using physiological ECG features.
NOT an electrophysiological simulator. NOT an anatomical model.

Implements the 12-dimensional personalized cardiac state vector:
  F(t) = [HR, SDNN, RMSSD, pNN50, RR_CV, QRS_PP]          6 absolute features
  B    = [B_HR, B_SDNN, B_RMSSD, B_pNN50, B_RR_CV, B_QRS_PP]  patient baseline
  Δ(t) = F(t) - B                                            6 absolute deviations
  S(t) = concat(F(t), Δ(t))                                 12-dim state vector

Feature definitions
-------------------
HR       : heart rate (bpm)             = 60 / mean(RR)
SDNN     : std(RR, ddof=1)             [s]  — SDNN-like; requires ≥5 min for
           guideline-compliant SDNN; here computed on the available window
RMSSD    : sqrt(mean(diff(RR)²))       [s]  — parasympathetic HRV index
pNN50    : fraction of successive RR pairs with |ΔRR| > 50 ms  [0–1]
RR_CV    : std(RR) / mean(RR)          [dimensionless] — relative variability
QRS_PP   : median peak-to-peak QRS amplitude  [a.u. after normalization]

Deviation: Δ_k(t) = F_k(t) - B_k  (absolute difference, not z-score)
  Z-score deviations are computed separately and stored in deviation_z.
  The state vector uses absolute deviations for interpretability.

Deviation score: RMS of finite z-score deviations (backward compatible with
  the existing baseline.py implementation).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np

from app.digital_twin.baseline import PatientBaseline
from app.processing.features import FEATURE_ORDER

log = logging.getLogger(__name__)

# ── Track B physiological feature keys ───────────────────────────────────────
TWIN_KEYS = [
    "heart_rate_bpm",   # HR [bpm]
    "sdnn_s",           # SDNN-like [s]
    "rmssd_s",          # RMSSD [s]
    "pnn50",            # pNN50 [0–1]
    "rr_cv",            # RR coefficient of variation [1]
    "qrs_amplitude",    # Median QRS peak-to-peak amplitude [a.u.]
]

TWIN_UNITS = {
    "heart_rate_bpm": "bpm",
    "sdnn_s":         "s (SDNN-like)",
    "rmssd_s":        "s (RMSSD)",
    "pnn50":          "fraction [0-1] (|ΔRR|>50ms)",
    "rr_cv":          "dimensionless (std/mean RR)",
    "qrs_amplitude":  "a.u. (after z-normalization)",
}

TWIN_NOTES = {
    "sdnn_s": (
        "Computed on the observation window (default 20s). "
        "Guideline-compliant SDNN requires ≥5 min; this is an approximation."
    ),
    "rmssd_s": "Sensitive to ectopic beats; interpreted as RR-based RMSSD approximation.",
    "pnn50":   "Uses RR intervals, not verified NN intervals; may be elevated by ectopy.",
    "qrs_amplitude": "Relative amplitude after z-normalization; not millivolt-calibrated.",
}

# Legacy STATE_KEYS kept for backward compatibility with existing routes
STATE_KEYS = [
    "heart_rate_bpm",
    "rr_cv",
    "sdnn_s",
    "qrs_width_s",
    "qrs_amplitude",
    "morphology_std",
]


def compute_pnn50(rr: np.ndarray) -> float:
    """pNN50: fraction of consecutive RR pairs with |difference| > 50 ms."""
    if len(rr) < 2:
        return float("nan")
    diffs = np.abs(np.diff(rr)) * 1000.0  # convert to ms
    return float(np.mean(diffs > 50.0))


def extract_twin_features(features: dict[str, float],
                          rr_intervals: np.ndarray | None = None) -> dict[str, float]:
    """
    Build the 6-dimensional Track B absolute feature vector F(t).

    Features are taken from the existing 15-feature pipeline where available.
    pNN50 is computed from raw RR intervals if supplied; otherwise estimated
    from RMSSD and SDNN via a heuristic approximation.
    """
    pnn50_val = float("nan")
    if rr_intervals is not None and len(rr_intervals) >= 2:
        pnn50_val = compute_pnn50(rr_intervals)
    else:
        # Heuristic: pNN50 ≈ 0 when RMSSD ≈ 0; rough linear approximation
        rmssd = features.get("rmssd_s", float("nan"))
        if np.isfinite(rmssd):
            pnn50_val = float(np.clip(rmssd * 4.0, 0, 1))

    return {
        "heart_rate_bpm": float(features.get("heart_rate_bpm", float("nan"))),
        "sdnn_s":         float(features.get("sdnn_s", float("nan"))),
        "rmssd_s":        float(features.get("rmssd_s", float("nan"))),
        "pnn50":          pnn50_val,
        "rr_cv":          float(features.get("rr_cv", float("nan"))),
        "qrs_amplitude":  float(features.get("qrs_amplitude", float("nan"))),
    }


@dataclass
class DigitalTwinState:
    record_id: str
    timestamp_s: float

    # 6-dimensional absolute physiological feature vector F(t)
    absolute_features: dict[str, float] = field(default_factory=dict)

    # 6-dimensional baseline deviation vector Δ(t) = F(t) - B (absolute)
    baseline_deviation: dict[str, float] = field(default_factory=dict)

    # 6-dimensional z-score deviation vector (standardized)
    deviation_z: dict[str, float] = field(default_factory=dict)

    # 12-dimensional personalized state vector S(t) = concat(F(t), Δ(t))
    personalized_state: dict[str, float] = field(default_factory=dict)

    # Scalar deviation score: RMS of finite z-scores
    deviation_score: float | None = None

    # Legacy 6-feature state vector (backward compat with existing UI routes)
    state_vector: dict[str, float] = field(default_factory=dict)
    deviation: dict[str, float] = field(default_factory=dict)

    definition: str = ""
    notes: list[str] = field(default_factory=list)
    units: dict[str, str] = field(default_factory=dict)


def build_state(
    record_id: str,
    timestamp_s: float,
    features: dict[str, float],
    baseline: PatientBaseline | None,
    rr_intervals: np.ndarray | None = None,
) -> DigitalTwinState:
    """
    Construct the 12-dimensional personalized cardiac state vector.

    Parameters
    ----------
    record_id    : identifier for the ECG recording
    timestamp_s  : end of the observation window (seconds from recording start)
    features     : 15-feature dict from extract_features()
    baseline     : patient-specific PatientBaseline or None
    rr_intervals : raw RR intervals [s] for pNN50 computation (optional)
    """
    # ── Absolute feature vector F(t) ─────────────────────────────────────────
    f_abs = extract_twin_features(features, rr_intervals)

    # ── Legacy state vector (backward compat) ────────────────────────────────
    legacy_state = {k: float(features.get(k, float("nan"))) for k in STATE_KEYS}

    if baseline is None:
        return DigitalTwinState(
            record_id=record_id,
            timestamp_s=timestamp_s,
            absolute_features=f_abs,
            baseline_deviation={k: float("nan") for k in TWIN_KEYS},
            deviation_z={k: float("nan") for k in TWIN_KEYS},
            personalized_state={
                **{f"abs_{k}": v for k, v in f_abs.items()},
                **{f"dev_{k}": float("nan") for k in TWIN_KEYS},
            },
            deviation_score=None,
            state_vector=legacy_state,
            deviation={},
            definition=(
                "Patient-specific ECG feature state model. "
                "No baseline available — absolute features only."
            ),
            notes=["No baseline available; deviation not computed."],
            units=TWIN_UNITS,
        )

    # ── Baseline deviation Δ(t) = F(t) - B ───────────────────────────────────
    delta_abs: dict[str, float] = {}
    delta_z:   dict[str, float] = {}
    for k in TWIN_KEYS:
        f_val = f_abs.get(k, float("nan"))
        b_mu  = baseline.feature_means.get(k, float("nan"))
        b_sd  = baseline.feature_stds.get(k, 0.0)
        if np.isfinite(f_val) and np.isfinite(b_mu):
            delta_abs[k] = float(f_val - b_mu)
            delta_z[k]   = float((f_val - b_mu) / b_sd) if b_sd > 1e-8 else float(f_val - b_mu)
        else:
            delta_abs[k] = float("nan")
            delta_z[k]   = float("nan")

    # ── Personalized state S(t) = concat(F(t), Δ(t)) ─────────────────────────
    personalized = {
        **{f"abs_{k}": f_abs[k] for k in TWIN_KEYS},
        **{f"dev_{k}": delta_abs[k] for k in TWIN_KEYS},
    }

    # ── Deviation score: RMS of finite z-scores ───────────────────────────────
    z_arr = np.array([delta_z[k] for k in TWIN_KEYS], dtype=np.float64)
    z_finite = z_arr[np.isfinite(z_arr)]
    dev_score = float(np.sqrt(np.mean(z_finite ** 2))) if len(z_finite) > 0 else None

    # ── Full baseline deviation via legacy path ───────────────────────────────
    full_dev = baseline.deviation(features)
    legacy_dev = {k: full_dev.get(k, float("nan")) for k in STATE_KEYS}

    return DigitalTwinState(
        record_id=record_id,
        timestamp_s=timestamp_s,
        absolute_features=f_abs,
        baseline_deviation=delta_abs,
        deviation_z=delta_z,
        personalized_state=personalized,
        deviation_score=dev_score,
        state_vector=legacy_state,   # backward compat
        deviation=legacy_dev,        # backward compat
        definition=(
            "Patient-specific ECG feature state model. "
            "F(t) = [HR, SDNN, RMSSD, pNN50, RR_CV, QRS_PP]. "
            "S(t) = concat(F(t), F(t)-B). "
            "Not an anatomical model or electrophysiological simulator."
        ),
        notes=[
            "Absolute deviation: F(t) - B (same units as features).",
            "Z-score deviation: (F(t) - B) / sigma_B.",
            "Deviation score: RMS of finite z-scores across TWIN_KEYS.",
            "SDNN/RMSSD/pNN50 computed on the observation window (not guideline 5-min).",
            TWIN_NOTES["pnn50"],
        ],
        units=TWIN_UNITS,
    )


def trajectory_matrix(states: list[DigitalTwinState]) -> list[dict]:
    """Serialize state history for plotting and storage."""
    return [
        {
            "timestamp_s":        s.timestamp_s,
            "absolute_features":  s.absolute_features,
            "baseline_deviation": s.baseline_deviation,
            "deviation_score":    s.deviation_score,
            # Legacy fields
            "state_vector":       s.state_vector,
        }
        for s in states
    ]
