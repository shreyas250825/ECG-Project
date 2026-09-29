"""Standalone PYNQ interface used on the board. Backend has an equivalent HAL."""

from __future__ import annotations

from pathlib import Path


def overlay_available(bitstream_path: str) -> bool:
    return bool(bitstream_path) and Path(bitstream_path).exists()


def load_overlay(bitstream_path: str):
    if not overlay_available(bitstream_path):
        raise FileNotFoundError("Bitstream not found; FPGA accelerator not available.")
    from pynq import Overlay  # type: ignore

    return Overlay(bitstream_path)
