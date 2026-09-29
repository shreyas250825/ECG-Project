from __future__ import annotations

from app.core.config import settings
from app.hardware.base import ECGAccelerator, HardwareStatus
from app.hardware.pynq_backend import PYNQECGAccelerator
from app.hardware.software import SoftwareECGAccelerator

_software = SoftwareECGAccelerator()
_pynq = PYNQECGAccelerator()
_preferred = "auto"


def set_mode(mode: str) -> None:
    global _preferred
    if mode not in {"auto", "software", "pynq"}:
        raise ValueError("mode must be auto, software, or pynq")
    _preferred = mode


def get_accelerator() -> ECGAccelerator:
    if _preferred == "software":
        return _software
    if _preferred == "pynq":
        return _pynq
    return _pynq if _pynq.available() else _software


def hardware_status() -> HardwareStatus:
    acc = get_accelerator()
    st = acc.status()
    if _preferred == "pynq" and not st.hardware_available:
        return HardwareStatus(
            mode="software",
            hardware_available=False,
            board_name=settings.pynq_board_name or None,
            accelerator_name=None,
            reason=st.reason or "PYNQ board not connected/configured",
            overlay_loaded=False,
        )
    return st
