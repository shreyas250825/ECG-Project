from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


DISCLAIMER = (
    "Research prototype only. Model outputs are experimental estimates derived from ECG data "
    "and are not clinical diagnoses, medical advice, or treatment recommendations."
)


class HealthResponse(BaseModel):
    status: str
    supabase: dict[str, Any]
    hardware_mode: str
    hardware_available: bool
    research_prototype: bool = True
    not_for_clinical_diagnosis: bool = True


class CsvParseConfig(BaseModel):
    sampling_rate: float = Field(gt=0)
    signal_column: str = "signal"
    time_column: str | None = None
    lead: str = "unknown"


class ProcessingRunRequest(BaseModel):
    record_id: str
    execution_mode: str = "auto"


class BaselineRequest(BaseModel):
    record_id: str
    window_start_s: float = 0.0
    window_end_s: float = 60.0
    subwindow_s: float = 20.0
    hop_s: float = 10.0


class DigitalTwinRequest(BaseModel):
    record_id: str
    timestamp_s: float | None = None
    window_s: float = 20.0


class TrainRequest(BaseModel):
    model_name: str = "logistic_regression"
    target_event: str = "vt"
    observation_s: float = 30.0
    horizon_s: float = 60.0
    step_s: float = 5.0
    record_ids: list[str] | None = None


class ForecastRunRequest(BaseModel):
    record_id: str
    observation_s: float = 30.0
    horizon_s: float = 60.0
    prediction_time_s: float | None = None
    target_event: str = "vt"
    model_id: str | None = None


class HardwareModeRequest(BaseModel):
    mode: str = "auto"


class HardwareInitRequest(BaseModel):
    dummy: bool = True
