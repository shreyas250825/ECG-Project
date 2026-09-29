"""Simple signal-quality estimation for research display.

Scores are heuristic computational indices, not clinical SQI products.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class QualityResult:
    score: float
    label: str
    reasons: list[str]


def estimate_signal_quality(signal: np.ndarray, fs: float, r_peaks: np.ndarray) -> QualityResult:
    x = np.asarray(signal, dtype=np.float64)
    reasons: list[str] = []
    score = 1.0

    if len(x) < fs:
        return QualityResult(0.0, "insufficient", ["Segment shorter than 1 second."])

    std = float(np.std(x))
    if std < 1e-6:
        return QualityResult(0.0, "insufficient", ["Flat or empty signal."])

    clip_frac = float(np.mean(np.abs(x) > (np.percentile(np.abs(x), 99) * 1.2)))
    if clip_frac > 0.02:
        score -= 0.25
        reasons.append("Possible clipping / extreme amplitude outliers.")

    if len(r_peaks) >= 3:
        rr = np.diff(r_peaks) / fs
        cv = float(np.std(rr) / (np.mean(rr) + 1e-9))
        expected = len(x) / fs / 0.85  # ~70 bpm expected count scale
        rate_ratio = len(r_peaks) / max(expected, 1e-6)
        if cv > 0.6:
            score -= 0.2
            reasons.append("Very high RR variability may indicate noise or ectopy.")
        if rate_ratio < 0.4 or rate_ratio > 2.5:
            score -= 0.25
            reasons.append("Detected beat rate is far from a typical adult range.")
    else:
        score -= 0.4
        reasons.append("Too few R peaks for a stable quality estimate.")

    hf = np.mean(np.abs(np.diff(x))) / (std + 1e-9)
    if hf > 0.8:
        score -= 0.15
        reasons.append("High-frequency content relative to amplitude (possible EMG/noise).")

    score = float(np.clip(score, 0.0, 1.0))
    if score >= 0.75:
        label = "acceptable"
    elif score >= 0.45:
        label = "marginal"
    else:
        label = "poor"
    if not reasons:
        reasons.append("No major computational quality flags.")
    return QualityResult(score=score, label=label, reasons=reasons)
