"""Rule-based detection vs experimental forecasting — separate outputs.

Detection: rhythm evidence in the analysed window (now).
Forecasting: model estimate for a future horizon (separate module).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class DetectionResult:
    label: str
    evidence: str
    disclaimer: str


def detect_rhythm(rr: np.ndarray, qrs_width_s: float | None, hr_bpm: float | None) -> DetectionResult:
    """Heuristic computational categories for research display, not diagnosis."""
    disclaimer = (
        "Detection indicates that the target rhythm pattern is present in the analysed ECG "
        "according to computational rules. This is not a clinical diagnosis."
    )
    if len(rr) < 3 or hr_bpm is None:
        return DetectionResult("other_unknown", "Insufficient beats for detection.", disclaimer)

    median_rr = float(np.median(rr))
    wide = qrs_width_s is not None and np.isfinite(qrs_width_s) and qrs_width_s > 0.12
    short_frac = float(np.mean(rr < 0.40))
    premature_frac = float(np.mean(rr < 0.75 * median_rr))

    if hr_bpm >= 150 and wide and short_frac > 0.6:
        return DetectionResult(
            "vt",
            "High rate with wide-QRS-like width and many short RR intervals in this window.",
            disclaimer,
        )
    if hr_bpm >= 180 and short_frac > 0.8:
        return DetectionResult(
            "vf_analysis_candidate",
            "Very high detected rate; VF analysis only if annotated data exist. Unconfirmed.",
            disclaimer,
        )
    if premature_frac > 0.08 and premature_frac < 0.4:
        return DetectionResult(
            "pvc_ventricular_ectopy",
            "Intermittent short RR intervals relative to the median (ectopy-like pattern).",
            disclaimer,
        )
    if 50 <= hr_bpm <= 100 and premature_frac < 0.08:
        return DetectionResult(
            "normal_sinus_like",
            "Rate and RR pattern consistent with a regular rhythm in this window.",
            disclaimer,
        )
    return DetectionResult("other_unknown", "Pattern does not match configured detection rules.", disclaimer)
