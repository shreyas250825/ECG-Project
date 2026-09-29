"""R-peak detection based on the Pan–Tompkins pipeline (1985).

This is QRS detection, not arrhythmia diagnosis. Thresholds are computational.
"""

from __future__ import annotations

import numpy as np
from scipy.signal import butter, filtfilt, find_peaks


def _bandpass_qrs(signal: np.ndarray, fs: float) -> np.ndarray:
    nyq = 0.5 * fs
    low = 5.0 / nyq
    high = min(15.0 / nyq, 0.45)
    b, a = butter(2, [low, high], btype="band")
    return filtfilt(b, a, signal)


def detect_r_peaks(signal: np.ndarray, fs: float) -> np.ndarray:
    """Return sample indices of detected R peaks."""
    x = np.asarray(signal, dtype=np.float64)
    if len(x) < int(0.5 * fs):
        return np.array([], dtype=int)

    bp = _bandpass_qrs(x, fs)
    diff = np.diff(bp, prepend=bp[0])
    squared = diff**2
    win = max(1, int(0.15 * fs))
    mwa = np.convolve(squared, np.ones(win) / win, mode="same")

    height = float(np.percentile(mwa, 75) * 0.5 + np.mean(mwa) * 0.2)
    min_distance = max(1, int(0.30 * fs))
    peaks, _ = find_peaks(mwa, height=height, distance=min_distance)

    refined: list[int] = []
    search = max(1, int(0.05 * fs))
    for p in peaks:
        lo = max(0, p - search)
        hi = min(len(x), p + search)
        refined.append(int(lo + np.argmax(np.abs(x[lo:hi]))))
    if not refined:
        return np.array([], dtype=int)
    uniq = np.unique(refined)
    return uniq.astype(int)


def compute_rr_intervals(r_peaks: np.ndarray, fs: float) -> np.ndarray:
    """RR intervals in seconds."""
    if len(r_peaks) < 2:
        return np.array([], dtype=np.float64)
    return np.diff(r_peaks.astype(np.float64)) / float(fs)


def compute_hr(rr_intervals: np.ndarray) -> float | None:
    if len(rr_intervals) == 0:
        return None
    mean_rr = float(np.mean(rr_intervals))
    if mean_rr <= 0:
        return None
    return 60.0 / mean_rr
