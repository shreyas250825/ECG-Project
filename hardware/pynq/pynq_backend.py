"""Board-side PYNQ FIR accelerator wrapper. Falls back if overlay missing."""

from __future__ import annotations

from hardware.pynq.interface import load_overlay, overlay_available
from hardware.pynq.software_backend import fir_lowpass


class PYNQECGAccelerator:
    def __init__(self, bitstream_path: str = "") -> None:
        self.bitstream_path = bitstream_path
        self.overlay = None

    def initialize(self) -> dict:
        if not overlay_available(self.bitstream_path):
            return {
                "mode": "software",
                "hardware_available": False,
                "reason": "PYNQ board not connected/configured",
            }
        try:
            self.overlay = load_overlay(self.bitstream_path)
            return {"mode": "pynq", "hardware_available": True, "reason": None}
        except Exception as exc:
            return {"mode": "software", "hardware_available": False, "reason": str(exc)}

    def preprocess_ecg(self, signal, fs: float):
        return fir_lowpass(signal, fs)
