"""Hardware abstraction: FPGA acceleration is optional."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import numpy as np


@dataclass
class HardwareStatus:
    mode: str
    hardware_available: bool
    board_name: str | None
    accelerator_name: str | None
    reason: str | None = None
    overlay_loaded: bool = False


@dataclass
class BenchmarkResult:
    mode: str
    latency_ms: float | None
    throughput_samples_per_s: float | None
    batch_size: int
    resource_utilization: dict | None = None
    power: float | None = None
    notes: list[str] = field(default_factory=list)


class ECGAccelerator(ABC):
    @abstractmethod
    def available(self) -> bool: ...

    @abstractmethod
    def initialize(self) -> HardwareStatus: ...

    @abstractmethod
    def preprocess_ecg(self, signal: np.ndarray, fs: float) -> np.ndarray: ...

    @abstractmethod
    def process_batch(self, batch: np.ndarray, fs: float) -> np.ndarray: ...

    @abstractmethod
    def benchmark(self, signal: np.ndarray, fs: float, repeats: int = 5) -> BenchmarkResult: ...

    @abstractmethod
    def status(self) -> HardwareStatus: ...
