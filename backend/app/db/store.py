"""In-memory research store used when Supabase is not configured."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id() -> str:
    return str(uuid.uuid4())


class MemoryStore:
    def __init__(self) -> None:
        self.records: dict[str, dict] = {}
        self.annotations: dict[str, list[dict]] = {}
        self.processing_runs: dict[str, dict] = {}
        self.features: list[dict] = []
        self.baselines: dict[str, dict] = {}
        self.twin_states: list[dict] = []
        self.model_runs: dict[str, dict] = {}
        self.forecast_results: list[dict] = []
        self.evaluation_results: dict[str, dict] = {}
        self.hardware_runs: list[dict] = []
        self.signals: dict[str, dict] = {}

    def backend_name(self) -> str:
        return "memory" if not settings.supabase_configured else "supabase_preferred_memory_fallback"

    def insert_record(self, payload: dict) -> dict:
        rid = payload.get("id") or _id()
        row = {**payload, "id": rid, "created_at": payload.get("created_at") or _now()}
        self.records[rid] = row
        return row

    def list_records(self) -> list[dict]:
        return list(self.records.values())

    def get_record(self, record_id: str) -> dict | None:
        return self.records.get(record_id)

    def set_signal(self, record_id: str, signal: list[float], fs: float, time: list[float] | None = None) -> None:
        self.signals[record_id] = {"signal": signal, "fs": fs, "time": time}

    def get_signal(self, record_id: str) -> dict | None:
        return self.signals.get(record_id)

    def set_annotations(self, record_id: str, items: list[dict]) -> None:
        self.annotations[record_id] = items

    def get_annotations(self, record_id: str) -> list[dict]:
        return self.annotations.get(record_id, [])

    def add_processing_run(self, payload: dict) -> dict:
        row = {**payload, "id": payload.get("id") or _id(), "created_at": _now()}
        self.processing_runs[row["id"]] = row
        return row

    def add_model_run(self, payload: dict) -> dict:
        row = {**payload, "id": payload.get("id") or _id(), "created_at": _now()}
        self.model_runs[row["id"]] = row
        return row

    def list_model_runs(self) -> list[dict]:
        return list(self.model_runs.values())

    def get_model_run(self, model_id: str) -> dict | None:
        return self.model_runs.get(model_id)

    def add_forecast_result(self, payload: dict) -> dict:
        row = {**payload, "id": payload.get("id") or _id()}
        self.forecast_results.append(row)
        return row

    def add_evaluation(self, payload: dict) -> dict:
        row = {**payload, "id": payload.get("id") or _id()}
        self.evaluation_results[row["id"]] = row
        return row

    def list_evaluations(self) -> list[dict]:
        return list(self.evaluation_results.values())

    def add_hardware_run(self, payload: dict) -> dict:
        row = {**payload, "id": payload.get("id") or _id(), "created_at": _now()}
        self.hardware_runs.append(row)
        return row

    def set_baseline(self, record_id: str, payload: dict) -> dict:
        row = {**payload, "id": payload.get("id") or _id(), "created_at": _now()}
        self.baselines[record_id] = row
        return row

    def get_baseline(self, record_id: str) -> dict | None:
        return self.baselines.get(record_id)

    def add_twin_state(self, payload: dict) -> dict:
        self.twin_states.append(payload)
        return payload


store = MemoryStore()
