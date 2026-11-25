"""
SQLite-backed persistent store.

Replaces the pure in-memory MemoryStore for local development.
Survives backend restarts. Data is stored in backend/research.db.

Schema mirrors MemoryStore's dict structure for drop-in compatibility.
Large signal arrays are stored as compressed binary (not JSON).
"""
from __future__ import annotations

import json
import sqlite3
import uuid
import zlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

_DB_PATH = Path(__file__).resolve().parents[2] / "research.db"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id() -> str:
    return str(uuid.uuid4())


def _compress(arr: list[float]) -> bytes:
    """Compress a float list to bytes for compact storage."""
    return zlib.compress(np.array(arr, dtype=np.float64).tobytes(), level=1)


def _decompress(blob: bytes) -> list[float]:
    """Decompress bytes back to float list."""
    return np.frombuffer(zlib.decompress(blob), dtype=np.float64).tolist()


class SQLiteStore:
    """
    Persistent SQLite-backed research data store.

    Provides the same interface as MemoryStore so existing routes work unchanged.
    """

    def __init__(self, db_path: Path | None = None) -> None:
        self._path = db_path or _DB_PATH
        self._conn: sqlite3.Connection | None = None
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(str(self._path), check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
        return self._conn

    def _init_db(self) -> None:
        conn = self._connect()
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS records (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS signals (
            record_id TEXT PRIMARY KEY,
            signal_blob BLOB NOT NULL,
            fs REAL NOT NULL,
            time_blob BLOB
        );
        CREATE TABLE IF NOT EXISTS annotations (
            record_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            PRIMARY KEY (record_id)
        );
        CREATE TABLE IF NOT EXISTS processing_runs (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS baselines (
            record_id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS twin_states (
            id TEXT PRIMARY KEY,
            record_id TEXT,
            timestamp REAL,
            payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS model_runs (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS forecast_results (
            id TEXT PRIMARY KEY,
            record_id TEXT,
            payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS evaluation_results (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS hardware_runs (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """)
        conn.commit()

    def backend_name(self) -> str:
        return f"sqlite:{self._path.name}"

    # ── Records ───────────────────────────────────────────────────────────────
    def insert_record(self, payload: dict) -> dict:
        rid = payload.get("id") or _id()
        row = {**payload, "id": rid, "created_at": payload.get("created_at") or _now()}
        conn = self._connect()
        conn.execute(
            "INSERT OR REPLACE INTO records (id, payload, created_at) VALUES (?, ?, ?)",
            (rid, json.dumps(row), row["created_at"]),
        )
        conn.commit()
        return row

    def list_records(self) -> list[dict]:
        rows = self._connect().execute("SELECT payload FROM records").fetchall()
        return [json.loads(r["payload"]) for r in rows]

    def get_record(self, record_id: str) -> dict | None:
        row = self._connect().execute(
            "SELECT payload FROM records WHERE id=?", (record_id,)
        ).fetchone()
        return json.loads(row["payload"]) if row else None

    # ── Signals ───────────────────────────────────────────────────────────────
    def set_signal(self, record_id: str, signal: list[float],
                   fs: float, time: list[float] | None = None) -> None:
        blob = _compress(signal)
        t_blob = _compress(time) if time else None
        conn = self._connect()
        conn.execute(
            "INSERT OR REPLACE INTO signals (record_id, signal_blob, fs, time_blob) VALUES (?,?,?,?)",
            (record_id, blob, fs, t_blob),
        )
        conn.commit()

    def get_signal(self, record_id: str) -> dict | None:
        row = self._connect().execute(
            "SELECT signal_blob, fs, time_blob FROM signals WHERE record_id=?", (record_id,)
        ).fetchone()
        if not row:
            return None
        return {
            "signal": _decompress(row["signal_blob"]),
            "fs": row["fs"],
            "time": _decompress(row["time_blob"]) if row["time_blob"] else None,
        }

    # ── Annotations ───────────────────────────────────────────────────────────
    def set_annotations(self, record_id: str, items: list[dict]) -> None:
        conn = self._connect()
        conn.execute(
            "INSERT OR REPLACE INTO annotations (record_id, payload) VALUES (?,?)",
            (record_id, json.dumps(items)),
        )
        conn.commit()

    def get_annotations(self, record_id: str) -> list[dict]:
        row = self._connect().execute(
            "SELECT payload FROM annotations WHERE record_id=?", (record_id,)
        ).fetchone()
        return json.loads(row["payload"]) if row else []

    # ── Processing runs ───────────────────────────────────────────────────────
    def add_processing_run(self, payload: dict) -> dict:
        row = {**payload, "id": payload.get("id") or _id(), "created_at": _now()}
        conn = self._connect()
        conn.execute(
            "INSERT OR REPLACE INTO processing_runs (id, payload, created_at) VALUES (?,?,?)",
            (row["id"], json.dumps(row), row["created_at"]),
        )
        conn.commit()
        return row

    # ── Baselines ─────────────────────────────────────────────────────────────
    def set_baseline(self, record_id: str, payload: dict) -> dict:
        row = {**payload, "id": payload.get("id") or _id(), "created_at": _now()}
        conn = self._connect()
        conn.execute(
            "INSERT OR REPLACE INTO baselines (record_id, payload, created_at) VALUES (?,?,?)",
            (record_id, json.dumps(row), row["created_at"]),
        )
        conn.commit()
        return row

    def get_baseline(self, record_id: str) -> dict | None:
        row = self._connect().execute(
            "SELECT payload FROM baselines WHERE record_id=?", (record_id,)
        ).fetchone()
        return json.loads(row["payload"]) if row else None

    # ── Twin states ───────────────────────────────────────────────────────────
    def add_twin_state(self, payload: dict) -> dict:
        row = {**payload, "id": payload.get("id") or _id()}
        conn = self._connect()
        conn.execute(
            "INSERT OR REPLACE INTO twin_states (id, record_id, timestamp, payload) VALUES (?,?,?,?)",
            (row["id"], row.get("record_id"), row.get("timestamp"), json.dumps(row)),
        )
        conn.commit()
        return row

    def list_twin_states(self, record_id: str | None = None) -> list[dict]:
        if record_id:
            rows = self._connect().execute(
                "SELECT payload FROM twin_states WHERE record_id=? ORDER BY timestamp",
                (record_id,),
            ).fetchall()
        else:
            rows = self._connect().execute(
                "SELECT payload FROM twin_states ORDER BY timestamp"
            ).fetchall()
        return [json.loads(r["payload"]) for r in rows]

    # ── Model runs ────────────────────────────────────────────────────────────
    def add_model_run(self, payload: dict) -> dict:
        row = {**payload, "id": payload.get("id") or _id(), "created_at": _now()}
        conn = self._connect()
        conn.execute(
            "INSERT OR REPLACE INTO model_runs (id, payload, created_at) VALUES (?,?,?)",
            (row["id"], json.dumps(row), row["created_at"]),
        )
        conn.commit()
        return row

    def list_model_runs(self) -> list[dict]:
        rows = self._connect().execute(
            "SELECT payload FROM model_runs ORDER BY created_at"
        ).fetchall()
        return [json.loads(r["payload"]) for r in rows]

    def get_model_run(self, model_id: str) -> dict | None:
        row = self._connect().execute(
            "SELECT payload FROM model_runs WHERE id=?", (model_id,)
        ).fetchone()
        return json.loads(row["payload"]) if row else None

    # Needed by ml.py which patches artifact_path directly
    @property
    def model_runs(self) -> _ModelRunsProxy:
        return _ModelRunsProxy(self)

    # ── Forecast results ──────────────────────────────────────────────────────
    def add_forecast_result(self, payload: dict) -> dict:
        row = {**payload, "id": payload.get("id") or _id()}
        conn = self._connect()
        conn.execute(
            "INSERT OR REPLACE INTO forecast_results (id, record_id, payload) VALUES (?,?,?)",
            (row["id"], row.get("record_id"), json.dumps(row)),
        )
        conn.commit()
        return row

    def list_forecast_results(self, record_id: str | None = None) -> list[dict]:
        if record_id:
            rows = self._connect().execute(
                "SELECT payload FROM forecast_results WHERE record_id=?", (record_id,)
            ).fetchall()
        else:
            rows = self._connect().execute(
                "SELECT payload FROM forecast_results"
            ).fetchall()
        return [json.loads(r["payload"]) for r in rows]

    # ── Evaluations ───────────────────────────────────────────────────────────
    def add_evaluation(self, payload: dict) -> dict:
        row = {**payload, "id": payload.get("id") or _id()}
        conn = self._connect()
        conn.execute(
            "INSERT OR REPLACE INTO evaluation_results (id, payload) VALUES (?,?)",
            (row["id"], json.dumps(row)),
        )
        conn.commit()
        return row

    def list_evaluations(self) -> list[dict]:
        rows = self._connect().execute(
            "SELECT payload FROM evaluation_results"
        ).fetchall()
        return [json.loads(r["payload"]) for r in rows]

    # ── Hardware runs ─────────────────────────────────────────────────────────
    def add_hardware_run(self, payload: dict) -> dict:
        row = {**payload, "id": payload.get("id") or _id(), "created_at": _now()}
        conn = self._connect()
        conn.execute(
            "INSERT OR REPLACE INTO hardware_runs (id, payload, created_at) VALUES (?,?,?)",
            (row["id"], json.dumps(row), row["created_at"]),
        )
        conn.commit()
        return row


class _ModelRunsProxy:
    """Thin proxy so ml.py's `store.model_runs[id] = row` writes through to SQLite."""

    def __init__(self, store: SQLiteStore) -> None:
        self._store = store

    def __setitem__(self, key: str, value: dict) -> None:
        self._store.add_model_run(value)

    def values(self) -> list[dict]:
        return self._store.list_model_runs()
