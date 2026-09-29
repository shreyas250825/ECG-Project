"""CPU FIR reference matching backend SoftwareECGAccelerator."""

from __future__ import annotations

import numpy as np
from scipy.signal import firwin, lfilter


def fir_lowpass(signal: np.ndarray, fs: float, cutoff_hz: float = 40.0, numtaps: int = 31) -> np.ndarray:
    nyq = 0.5 * fs
    coeffs = firwin(numtaps, cutoff_hz / nyq)
    return lfilter(coeffs, [1.0], np.asarray(signal, dtype=np.float64))
