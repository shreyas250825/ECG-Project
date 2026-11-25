"""ECG preprocessing: baseline wander, band-pass, optional notch, normalisation.

Parameters are explicit and reproducible. This is signal conditioning, not diagnosis.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.signal import butter, filtfilt, iirnotch, lfilter


@dataclass(frozen=True)
class PreprocessParams:
    fs: float
    highpass_hz: float = 0.5
    lowpass_hz: float = 40.0
    notch_hz: float | None = None   # None = auto-detect from fs; 60Hz for ≥360Hz, else 50Hz
    notch_q: float = 30.0
    order: int = 4
    normalize: bool = True

    def effective_notch_hz(self) -> float | None:
        if self.notch_hz is not None:
            return self.notch_hz
        # Auto-detect: MIT-BIH (360 Hz) → 60 Hz; most EU databases → 50 Hz
        if self.fs >= 350:
            return 60.0
        return 50.0


def _butter_bandpass(low: float, high: float, fs: float, order: int) -> tuple[np.ndarray, np.ndarray]:
    nyq = 0.5 * fs
    low_n = max(low / nyq, 1e-6)
    high_n = min(high / nyq, 0.999)
    if low_n >= high_n:
        raise ValueError("Invalid band-pass cutoffs relative to sampling rate.")
    return butter(order, [low_n, high_n], btype="band")


def fir_lowpass_coeffs(fs: float, cutoff_hz: float = 40.0, numtaps: int = 31) -> np.ndarray:
    """Linear-phase FIR used for software vs FPGA DSP comparison (same coefficients)."""
    from scipy.signal import firwin

    nyq = 0.5 * fs
    return firwin(numtaps, cutoff_hz / nyq).astype(np.float64)


def apply_fir(signal: np.ndarray, coeffs: np.ndarray) -> np.ndarray:
    return lfilter(coeffs, [1.0], signal).astype(np.float64)


def preprocess_ecg(signal: np.ndarray, params: PreprocessParams) -> np.ndarray:
    x = np.asarray(signal, dtype=np.float64)
    if x.ndim != 1:
        raise ValueError("preprocess_ecg expects a 1-D lead.")
    if len(x) < 32:
        raise ValueError("ECG segment too short for filtering.")

    b, a = _butter_bandpass(params.highpass_hz, params.lowpass_hz, params.fs, params.order)
    y = filtfilt(b, a, x)

    if params.effective_notch_hz() is not None:
        notch_hz = params.effective_notch_hz()
        nyq = 0.5 * params.fs
        if notch_hz < nyq:
            bn, an = iirnotch(notch_hz / nyq, params.notch_q)
            # Use lfilter for notch — causal single-pass, fast for long signals
            y = lfilter(bn, an, y)

    if params.normalize:
        std = float(np.std(y))
        if std > 1e-9:
            y = (y - float(np.mean(y))) / std
        else:
            y = y - float(np.mean(y))
    return y

    if params.normalize:
        std = float(np.std(y))
        if std > 1e-9:
            y = (y - float(np.mean(y))) / std
        else:
            y = y - float(np.mean(y))
    return y
