"""Ingest a WfdbRecord into the MemoryStore.

Converts the WfdbRecord dataclass into the exact record/signal/annotation
schema expected by MemoryStore and the rest of the pipeline.
This is the only place that calls store.insert_record / set_signal /
set_annotations for real dataset records — keeping ingestion logic in one spot.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.errors import ResearchError
from app.db.store import store
from app.datasets.wfdb_loader import WfdbRecord, list_available_records, load_wfdb_record

log = logging.getLogger(__name__)

# Stable record-ID prefix so the same physical record always gets the same id
# within a server session.  Avoids duplicates on repeated calls to
# GET /api/records (which calls ensure_demo_record on every request).
_INGESTED: dict[str, str] = {}  # (dataset, record_name) → store record id


def _stable_id(dataset: str, record_name: str) -> str:
    """Return a deterministic UUID-like string for a (dataset, record_name) pair."""
    import hashlib
    h = hashlib.sha1(f"{dataset}:{record_name}".encode()).hexdigest()
    return str(uuid.UUID(h[:32]))


def ingest_wfdb_record(wfdb_rec: WfdbRecord) -> dict:
    """
    Insert a WfdbRecord into MemoryStore.
    If the record was already ingested this session, return the existing store row.

    Returns the store record dict (same shape as ensure_demo_record / save_upload).
    """
    key = (wfdb_rec.dataset, wfdb_rec.record_name)
    existing_id = _INGESTED.get(key)  # type: ignore[arg-type]
    if existing_id and store.get_record(existing_id):
        return store.get_record(existing_id)  # type: ignore[return-value]

    rid = _stable_id(wfdb_rec.dataset, wfdb_rec.record_name)

    # Build extra provenance for long SDDB recordings
    truncation_note: str | None = None
    if wfdb_rec.truncated:
        loaded_min = wfdb_rec.n_samples / wfdb_rec.fs / 60
        full_min = wfdb_rec.full_recording_samples / wfdb_rec.fs / 60
        truncation_note = (
            f"Loaded first {loaded_min:.1f} min of {full_min:.1f} min recording "
            f"(bounded to {wfdb_rec.n_samples:,} samples for memory efficiency)."
        )

    row = store.insert_record({
        "id": rid,
        "source_dataset": wfdb_rec.dataset,
        "record_name": wfdb_rec.record_name,
        "sampling_rate": wfdb_rec.fs,
        "duration_seconds": wfdb_rec.n_samples / wfdb_rec.fs,
        "full_duration_seconds": (
            wfdb_rec.full_recording_samples / wfdb_rec.fs
            if wfdb_rec.full_recording_samples else None
        ),
        "lead_count": 1,
        "lead": wfdb_rec.lead_name,
        "lead_units": wfdb_rec.lead_units,
        "format": "wfdb",
        "has_annotations": wfdb_rec.has_annotations,
        "annotation_status": wfdb_rec.annotation_status,
        "annotation_notes": wfdb_rec.annotation_notes,
        "privacy_status": wfdb_rec.privacy_status,
        "synthetic": False,
        "source_url": wfdb_rec.source_url,
        "disclaimer": wfdb_rec.disclaimer,
        "truncated": wfdb_rec.truncated,
        "truncation_note": truncation_note,
        # SDDB-specific
        "vf_onset_time_s": wfdb_rec.vf_onset_time_s,
        "vf_onset_source": wfdb_rec.vf_onset_source,
        "event_positive": wfdb_rec.event_positive,
    })

    # Store signal — signal is already 1-D float64 ndarray
    store.set_signal(rid, wfdb_rec.signal.tolist(), wfdb_rec.fs)

    # Store annotations if present
    if wfdb_rec.annotations:
        store.set_annotations(rid, wfdb_rec.annotations)

    _INGESTED[key] = rid  # type: ignore[assignment]
    log.info(
        "wfdb_ingested",
        extra={
            "event": "wfdb_ingested",
            "dataset": wfdb_rec.dataset,
            "record": wfdb_rec.record_name,
            "n_samples": wfdb_rec.n_samples,
            "has_annotations": wfdb_rec.has_annotations,
            "truncated": wfdb_rec.truncated,
        },
    )
    return row


def _data_root() -> str:
    """Return the effective WFDB data root directory."""
    return settings.wfdb_data_dir or settings.data_dir


def load_and_ingest(
    dataset: str,
    record_name: str,
    data_root: str | None = None,
    lead_index: int = 0,
    max_samples: int | None = None,
) -> dict:
    """
    Load a WFDB record from disk and ingest it into MemoryStore.
    Returns the MemoryStore record dict.

    Raises ResearchError (not raw exceptions) so callers get clean API errors.
    """
    root = data_root or _data_root()
    try:
        wfdb_rec = load_wfdb_record(
            dataset=dataset,
            record_name=record_name,
            data_root=root,
            lead_index=lead_index,
            max_samples=max_samples,
        )
    except FileNotFoundError as exc:
        raise ResearchError(str(exc), "record_not_found", 404) from exc
    except ValueError as exc:
        raise ResearchError(str(exc), "invalid_record", 422) from exc
    except ImportError as exc:
        raise ResearchError(str(exc), "wfdb_not_installed", 500) from exc
    except Exception as exc:
        raise ResearchError(
            f"Unexpected error loading {dataset}/{record_name}: {exc}",
            "load_error", 500
        ) from exc

    return ingest_wfdb_record(wfdb_rec)


def get_dataset_records(
    dataset: str,
    data_root: str | None = None,
) -> list[dict[str, Any]]:
    """
    Return a lightweight listing of records available on disk for a dataset.
    Does NOT load signals — just reads headers.
    """
    root = data_root or _data_root()
    try:
        import wfdb  # type: ignore[import]
    except ImportError:
        return []

    names = list_available_records(dataset, root)
    results: list[dict[str, Any]] = []
    for name in names:
        from pathlib import Path as _Path
        candidate_dirs = [
            _Path(root) / dataset / "1.0.0",
            _Path(root) / dataset,
            _Path(root),
        ]
        hea_dir = next((d for d in candidate_dirs if (d / f"{name}.hea").exists()), None)
        if hea_dir is None:
            continue
        try:
            hdr = wfdb.rdheader(str(hea_dir / name))
            fs = float(hdr.fs)
            total_s = hdr.sig_len / fs if hdr.sig_len and fs > 0 else None
            # Check which annotation files exist
            has_atr = (hea_dir / f"{name}.atr").exists()
            has_ari = (hea_dir / f"{name}.ari").exists()
            # Parse vfon from comments (SDDB only)
            from app.datasets.wfdb_loader import _parse_vfon_from_comments
            vfon_s, _ = _parse_vfon_from_comments(list(hdr.comments or []))
            already_loaded = _stable_id(dataset, name) in {
                v for v in _INGESTED.values()
            }
            results.append({
                "record_name": name,
                "dataset": dataset,
                "sampling_rate_hz": fs,
                "duration_seconds": total_s,
                "n_signals": hdr.n_sig,
                "lead_names": list(hdr.sig_name or []),
                "has_atr": has_atr,
                "has_ari": has_ari,
                "vfon_present": vfon_s is not None,
                "loaded": already_loaded,
            })
        except Exception as exc:
            results.append({
                "record_name": name,
                "dataset": dataset,
                "error": str(exc),
                "loaded": False,
            })
    return results
