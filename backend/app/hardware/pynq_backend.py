"""PYNQ FPGA backend. Does not pretend an overlay exists if the bitstream is missing."""

from __future__ import annotations

from pathlib import Path

from app.core.config import settings
from app.hardware.base import BenchmarkResult, ECGAccelerator, HardwareStatus
from app.hardware.software import SoftwareECGAccelerator


class PYNQECGAccelerator(ECGAccelerator):
    def __init__(self) -> None:
        self._overlay = None
        self._fallback = SoftwareECGAccelerator()
        self._initialized = False
        self._reason = "PYNQ not initialized"

    def available(self) -> bool:
        if not settings.pynq_enable:
            return False
        try:
            import pynq  # noqa: F401
        except Exception:
            return False
        bit = settings.pynq_bitstream_path
        if not bit or not Path(bit).exists():
            return False
        return True

    def initialize(self) -> HardwareStatus:
        if not settings.pynq_enable:
            self._reason = "PYNQ_ENABLE is false"
            return self.status()
        try:
            from pynq import Overlay  # type: ignore
        except Exception:
            self._reason = "PYNQ Python API not installed on this host"
            return self.status()
        bit = settings.pynq_bitstream_path
        if not bit or not Path(bit).exists():
            self._reason = "PYNQ overlay/bitstream not found; FPGA accelerator not loaded"
            return self.status()
        try:
            self._overlay = Overlay(bit)
            self._initialized = True
            self._reason = "Overlay loaded"
            return self.status()
        except Exception as exc:
            self._overlay = None
            self._initialized = False
            self._reason = f"Failed to load overlay: {exc}"
            return self.status()

    def status(self) -> HardwareStatus:
        if self._initialized and self._overlay is not None:
            return HardwareStatus(
                mode="pynq",
                hardware_available=True,
                board_name=settings.pynq_board_name or "configured",
                accelerator_name="ecg_fir_overlay",
                reason=None,
                overlay_loaded=True,
            )
        return HardwareStatus(
            mode="software",
            hardware_available=False,
            board_name=settings.pynq_board_name or None,
            accelerator_name=None,
            reason=self._reason or "PYNQ board not connected/configured",
            overlay_loaded=False,
        )

    def preprocess_ecg(self, signal, fs: float):
        # Until a real FIR IP is mapped, do not fabricate FPGA output.
        if not self._initialized:
            return self._fallback.preprocess_ecg(signal, fs)
        return self._fallback.preprocess_ecg(signal, fs)

    def process_batch(self, batch, fs: float):
        return self._fallback.process_batch(batch, fs)

    def benchmark(self, signal, fs: float, repeats: int = 5) -> BenchmarkResult:
        if not self._initialized:
            result = self._fallback.benchmark(signal, fs, repeats)
            result.notes.append("PYNQ overlay not loaded; software FIR timed instead.")
            return result
        result = self._fallback.benchmark(signal, fs, repeats)
        result.mode = "pynq"
        result.resource_utilization = None
        result.power = None
        result.notes.append(
            "Overlay object exists but FIR IP mapping is not yet implemented; "
            "latency is not claimed as FPGA time. Resource utilization: not measured."
        )
        return result
