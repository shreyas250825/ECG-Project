from __future__ import annotations

import time

import numpy as np

from app.hardware.base import BenchmarkResult, ECGAccelerator, HardwareStatus
from app.processing.preprocess import apply_fir, fir_lowpass_coeffs


class SoftwareECGAccelerator(ECGAccelerator):
    def __init__(self) -> None:
        self._ready = True

    def available(self) -> bool:
        return True

    def initialize(self) -> HardwareStatus:
        self._ready = True
        return self.status()

    def status(self) -> HardwareStatus:
        return HardwareStatus(
            mode="software",
            hardware_available=False,
            board_name=None,
            accelerator_name="numpy_scipy_fir",
            reason="PYNQ board not connected/configured",
            overlay_loaded=False,
        )

    def preprocess_ecg(self, signal: np.ndarray, fs: float) -> np.ndarray:
        coeffs = fir_lowpass_coeffs(fs)
        return apply_fir(np.asarray(signal, dtype=np.float64), coeffs)

    def process_batch(self, batch: np.ndarray, fs: float) -> np.ndarray:
        x = np.asarray(batch, dtype=np.float64)
        if x.ndim == 1:
            return self.preprocess_ecg(x, fs)
        return np.vstack([self.preprocess_ecg(row, fs) for row in x])

    def benchmark(self, signal: np.ndarray, fs: float, repeats: int = 5) -> BenchmarkResult:
        x = np.asarray(signal, dtype=np.float64)
        times: list[float] = []
        out = None
        for _ in range(max(1, repeats)):
            t0 = time.perf_counter()
            out = self.preprocess_ecg(x, fs)
            times.append((time.perf_counter() - t0) * 1000.0)
        latency = float(np.median(times))
        n = len(x)
        throughput = (n / (latency / 1000.0)) if latency > 0 else None
        return BenchmarkResult(
            mode="software",
            latency_ms=latency,
            throughput_samples_per_s=throughput,
            batch_size=1,
            resource_utilization=None,
            power=None,
            notes=["FIR low-pass on CPU (SciPy lfilter).", "FPGA resource/power: not measured."],
        )
