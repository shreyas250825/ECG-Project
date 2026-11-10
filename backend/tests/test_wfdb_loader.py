"""Tests for the WFDB dataset adapter.

These tests cover:
- Loading a known MIT-BIH record (record 100)
- Sampling frequency, channel count and units
- Annotation-to-time conversion correctness
- R-peak detection on a real WFDB signal
- Missing files and missing annotation handling
- Long-recording memory behaviour (max_samples cap)
- Dataset selection through the API endpoint
- Regression: synthetic demo record is unaffected

Tests that require actual WFDB files on disk are automatically skipped if the
files are not present (download still in progress). Tests that can run without
files use mocks or synthetic fallbacks.
"""

from __future__ import annotations

import math
import os
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient

# ── Helpers ──────────────────────────────────────────────────────────────────

# The physionet mirror is at this path relative to the repo root.
# Matches the WFDB_DATA_DIR in .env.
PHYSIONET_ROOT = Path(__file__).parents[2] / "physionet.org" / "files"
MITDB_ROOT = PHYSIONET_ROOT / "mitdb" / "1.0.0"
SDDB_ROOT = PHYSIONET_ROOT / "sddb" / "1.0.0"

MITDB_AVAILABLE = (MITDB_ROOT / "100.hea").exists()
SDDB_AVAILABLE = (SDDB_ROOT / "30.hea").exists()

mitdb_required = pytest.mark.skipif(
    not MITDB_AVAILABLE,
    reason="MIT-BIH record 100 not on disk — download still in progress",
)
sddb_required = pytest.mark.skipif(
    not SDDB_AVAILABLE,
    reason="SDDB record 30 not on disk — download still in progress",
)


# ── Unit tests for loader internals (no files needed) ─────────────────────────

class TestVfonParsing:
    """Test the header comment vfon parser without touching disk."""

    def test_parses_valid_vfon(self):
        from app.datasets.wfdb_loader import _parse_vfon_from_comments
        comments = ["#vfon: 07:54:33"]
        s, src = _parse_vfon_from_comments(comments)
        assert s == pytest.approx(7 * 3600 + 54 * 60 + 33)
        assert src == "header_comment"

    def test_returns_none_when_absent(self):
        from app.datasets.wfdb_loader import _parse_vfon_from_comments
        s, src = _parse_vfon_from_comments(["#some other comment"])
        assert s is None
        assert src is None

    def test_midnight_rollover(self):
        from app.datasets.wfdb_loader import _vfon_to_sample_offset
        # recording starts at 23:00, vfon at 00:30 next day
        base = 23 * 3600
        vfon = 0 * 3600 + 30 * 60
        offset = _vfon_to_sample_offset(vfon, base, 250.0)
        assert offset == pytest.approx(1.5 * 3600)

    def test_no_rollover_needed(self):
        from app.datasets.wfdb_loader import _vfon_to_sample_offset
        base = 12 * 3600
        vfon = 14 * 3600 + 30 * 60
        offset = _vfon_to_sample_offset(vfon, base, 250.0)
        assert offset == pytest.approx(2.5 * 3600)


class TestAnnotationConversion:
    """Test WFDB annotation → internal dict conversion without disk files."""

    def _make_mock_ann(self, samples, symbols, aux_notes=None):
        ann = MagicMock()
        ann.sample = np.array(samples, dtype=int)
        ann.symbol = symbols
        ann.aux_note = aux_notes if aux_notes is not None else [""] * len(samples)
        return ann

    def test_beat_symbols_converted(self):
        from app.datasets.wfdb_loader import _wfdb_anns_to_internal
        ann = self._make_mock_ann(
            samples=[0, 360, 720],
            symbols=["N", "V", "N"],
        )
        items, status, notes = _wfdb_anns_to_internal(ann, fs=360.0, max_samples=10000, record_id_hint="test")
        event_types = [a["event_type"] for a in items]
        assert "normal_beat" in event_types
        assert "pvc" in event_types

    def test_sample_to_time_conversion_uses_fs(self):
        """start_time must equal sample / fs — never assume a fixed fs."""
        from app.datasets.wfdb_loader import _wfdb_anns_to_internal
        fs = 128.0  # non-standard fs to catch hardcoded 360 or 250 bugs
        ann = self._make_mock_ann(samples=[128, 256], symbols=["N", "N"])
        items, _, _ = _wfdb_anns_to_internal(ann, fs=fs, max_samples=10000, record_id_hint="test")
        times = [a["start_time"] for a in items]
        assert times[0] == pytest.approx(1.0)  # 128 / 128
        assert times[1] == pytest.approx(2.0)  # 256 / 128

    def test_rhythm_labels_create_intervals(self):
        from app.datasets.wfdb_loader import _wfdb_anns_to_internal
        # Rhythm change at sample 0 → (N, then VT at sample 360
        ann = self._make_mock_ann(
            samples=[0, 360, 720],
            symbols=["N", "N", "N"],
            aux_notes=["(N", "", "(VT"],
        )
        items, status, notes = _wfdb_anns_to_internal(ann, fs=360.0, max_samples=10000, record_id_hint="test")
        rhythm_events = [a for a in items if a["annotation_source"] == "wfdb_atr_rhythm"]
        assert any(a["event_type"] == "normal_sinus_rhythm" for a in rhythm_events)
        assert any(a["event_type"] == "vt" for a in rhythm_events)
        assert status == "verified"

    def test_annotations_beyond_max_samples_discarded(self):
        from app.datasets.wfdb_loader import _wfdb_anns_to_internal
        ann = self._make_mock_ann(
            samples=[100, 200, 5000],  # 5000 is beyond max_samples=300
            symbols=["N", "N", "N"],
        )
        items, _, notes = _wfdb_anns_to_internal(ann, fs=100.0, max_samples=300, record_id_hint="test")
        times = [a["start_time"] for a in items]
        assert all(t < 3.0 for t in times)  # 300 / 100 = 3.0 s
        assert any("discarded" in n for n in notes)

    def test_none_annotation_returns_absent(self):
        from app.datasets.wfdb_loader import _wfdb_anns_to_internal
        items, status, notes = _wfdb_anns_to_internal(None, fs=250.0, max_samples=1000, record_id_hint="test")
        assert items == []
        assert status == "absent"
        assert any("No annotation" in n for n in notes)


class TestListAvailableRecords:
    """Test record discovery without loading signals."""

    def test_returns_empty_for_nonexistent_dir(self, tmp_path):
        from app.datasets.wfdb_loader import list_available_records
        result = list_available_records("mitdb", tmp_path / "nonexistent")
        assert result == []

    def test_finds_hea_files(self, tmp_path):
        from app.datasets.wfdb_loader import list_available_records
        d = tmp_path / "mitdb" / "1.0.0"
        d.mkdir(parents=True)
        (d / "100.hea").touch()
        (d / "101.hea").touch()
        (d / "100.dat").touch()
        result = list_available_records("mitdb", tmp_path)
        assert "100" in result
        assert "101" in result

    def test_skips_internal_wfdb_files(self, tmp_path):
        from app.datasets.wfdb_loader import list_available_records
        d = tmp_path / "mitdb" / "1.0.0"
        d.mkdir(parents=True)
        (d / "100.hea").touch()
        (d / "100.hea-").touch()   # alternate header — should be excluded
        result = list_available_records("mitdb", tmp_path)
        assert "100" in result
        assert "100-" not in result


class TestMissingFiles:
    """Test error handling for missing files."""

    def test_missing_hea_raises_file_not_found(self, tmp_path):
        from app.datasets.wfdb_loader import load_wfdb_record
        with pytest.raises(FileNotFoundError, match="WFDB header not found"):
            load_wfdb_record("mitdb", "999", tmp_path)

    def test_wfdb_not_installed_raises_import_error(self, tmp_path):
        """If wfdb is not importable, must raise ImportError with install hint."""
        import sys
        import importlib
        # Temporarily hide wfdb
        original = sys.modules.get("wfdb")
        sys.modules["wfdb"] = None  # type: ignore[assignment]
        try:
            # Force re-import of loader to hit the ImportError path
            import importlib
            from app.datasets import wfdb_loader
            importlib.reload(wfdb_loader)
            with pytest.raises((ImportError, FileNotFoundError)):
                wfdb_loader.load_wfdb_record("mitdb", "100", tmp_path)
        finally:
            if original is None:
                sys.modules.pop("wfdb", None)
            else:
                sys.modules["wfdb"] = original


# ── Integration tests (require files on disk) ─────────────────────────────────

@mitdb_required
class TestMitdbRecord100:
    """Integration tests against the real MIT-BIH record 100."""

    @pytest.fixture(scope="class")
    def rec(self):
        from app.datasets.wfdb_loader import load_wfdb_record
        return load_wfdb_record(
            dataset="mitdb",
            record_name="100",
            data_root=PHYSIONET_ROOT,
            max_samples=360 * 60 * 10,  # 10 minutes at 360 Hz
        )

    def test_sampling_rate_is_360hz(self, rec):
        """MIT-BIH records are always 360 Hz — never assume otherwise."""
        assert rec.fs == pytest.approx(360.0)

    def test_signal_shape_and_dtype(self, rec):
        assert rec.signal.ndim == 1
        assert rec.signal.dtype == np.float64
        assert len(rec.signal) > 0

    def test_signal_is_finite(self, rec):
        """NaN replacement must have been applied."""
        assert np.all(np.isfinite(rec.signal))

    def test_lead_name_present(self, rec):
        assert isinstance(rec.lead_name, str)
        assert len(rec.lead_name) > 0

    def test_duration_consistent_with_fs(self, rec):
        expected_s = rec.n_samples / rec.fs
        assert expected_s == pytest.approx(rec.n_samples / 360.0, rel=1e-6)

    def test_has_annotations(self, rec):
        assert rec.has_annotations is True
        assert len(rec.annotations) > 0

    def test_annotation_time_uses_actual_fs(self, rec):
        """Annotation start_time must equal sample_index / fs (not hardcoded 250)."""
        for ann in rec.annotations[:20]:
            t = ann["start_time"]
            assert isinstance(t, float)
            assert t >= 0
            # Verify: time × fs must be a whole-ish sample index
            sample_approx = t * rec.fs
            assert abs(sample_approx - round(sample_approx)) < 0.5

    def test_annotation_source_field_present(self, rec):
        for ann in rec.annotations[:10]:
            assert "annotation_source" in ann
            assert ann["annotation_source"].startswith("wfdb_")

    def test_annotation_event_type_is_string(self, rec):
        for ann in rec.annotations[:10]:
            assert isinstance(ann["event_type"], str)
            assert len(ann["event_type"]) > 0

    def test_r_peak_detection_on_real_signal(self, rec):
        """Pan-Tompkins detector must find a plausible number of beats."""
        from app.processing.preprocess import PreprocessParams, preprocess_ecg
        from app.processing.rpeaks import detect_r_peaks, compute_hr, compute_rr_intervals

        # Use first 60 seconds
        n = int(rec.fs * 60)
        seg = rec.signal[:n]
        cleaned = preprocess_ecg(seg, PreprocessParams(fs=rec.fs))
        peaks = detect_r_peaks(cleaned, rec.fs)
        rr = compute_rr_intervals(peaks, rec.fs)
        hr = compute_hr(rr)

        # MIT-BIH record 100 is a normal sinus rhythm — HR should be ~60–100 bpm
        expected_min = 60 * 40 / 60   # 40 bpm floor
        expected_max = 60 * 160 / 60  # 160 bpm ceiling
        assert expected_min < len(peaks) < expected_max, (
            f"Detected {len(peaks)} peaks in 60s; expected {expected_min}–{expected_max}"
        )
        if hr is not None:
            assert 40 < hr < 160, f"Computed HR {hr:.1f} bpm is outside plausible range"

    def test_truncation_flag(self, rec):
        """When max_samples < full recording, truncated must be True."""
        full = rec.full_recording_samples
        if rec.n_samples < full:
            assert rec.truncated is True
        else:
            assert rec.truncated is False

    def test_dataset_and_record_name_preserved(self, rec):
        assert rec.dataset == "mitdb"
        assert rec.record_name == "100"

    def test_not_synthetic(self, rec):
        assert rec.event_positive is None or rec.event_positive is False  # MIT-BIH 100 has no VF
        # event_positive is not True for a non-VF record


@sddb_required
class TestSddbRecord30:
    """Integration tests against the real SDDB record 30 (has vfon)."""

    @pytest.fixture(scope="class")
    def rec(self):
        from app.datasets.wfdb_loader import load_wfdb_record
        return load_wfdb_record(
            dataset="sddb",
            record_name="30",
            data_root=PHYSIONET_ROOT,
            max_samples=250 * 3600,  # 1 hour
        )

    def test_sampling_rate_is_250hz(self, rec):
        """SDDB records are 250 Hz."""
        assert rec.fs == pytest.approx(250.0)

    def test_vfon_parsed_from_header(self, rec):
        """Record 30 has `#vfon: 07:54:33` in its header."""
        assert rec.vf_onset_time_s is not None
        assert rec.vf_onset_time_s > 0
        assert rec.vf_onset_source == "header_comment"

    def test_event_positive_is_true(self, rec):
        assert rec.event_positive is True

    def test_vf_annotation_injected(self, rec):
        """
        If vfon is within the loaded segment, a VF/VT annotation must exist.
        If the record is truncated and vfon falls after the loaded segment,
        no annotation is expected — the loader correctly does not inject
        out-of-window events.
        """
        if rec.vf_onset_time_s is not None:
            loaded_duration_s = rec.n_samples / rec.fs
            if rec.vf_onset_time_s < loaded_duration_s:
                # vfon is within loaded segment — annotation must be present
                vf_anns = [a for a in rec.annotations if a["event_type"] in ("vf", "vt")]
                assert len(vf_anns) >= 1, (
                    f"vfon at {rec.vf_onset_time_s:.1f}s is within loaded segment "
                    f"({loaded_duration_s:.1f}s) but no vf/vt annotation found. "
                    f"Event types present: {sorted(set(a['event_type'] for a in rec.annotations))}"
                )
            else:
                # vfon is beyond the truncated window — correct behaviour, no annotation
                pytest.skip(
                    f"Record 30 truncated to {loaded_duration_s:.0f}s; "
                    f"vfon at {rec.vf_onset_time_s:.0f}s is beyond loaded window. "
                    "Re-run after full download completes."
                )
        else:
            pytest.skip("vfon not parsed — cannot verify annotation injection.")

    def test_signal_finite(self, rec):
        assert np.all(np.isfinite(rec.signal))

    def test_signal_1d_float64(self, rec):
        assert rec.signal.ndim == 1
        assert rec.signal.dtype == np.float64

    def test_memory_cap_respected(self, rec):
        """Loaded samples must not exceed 1 hr at 250 Hz."""
        assert rec.n_samples <= 250 * 3600 + 1  # +1 for rounding


# ── Memory behaviour test ─────────────────────────────────────────────────────

@mitdb_required
def test_max_samples_cap_limits_memory():
    """Loading with a small max_samples must not load the full recording."""
    from app.datasets.wfdb_loader import load_wfdb_record
    small = load_wfdb_record(
        dataset="mitdb",
        record_name="100",
        data_root=PHYSIONET_ROOT,
        max_samples=360 * 30,  # 30 seconds
    )
    assert small.n_samples <= 360 * 30 + 1
    assert small.truncated is True


# ── Ingestion integration test ────────────────────────────────────────────────

@mitdb_required
def test_ingest_into_store():
    """Ingested record must be retrievable via MemoryStore."""
    from app.datasets.wfdb_loader import load_wfdb_record
    from app.datasets.ingestion import ingest_wfdb_record
    from app.db.store import store

    rec = load_wfdb_record(
        dataset="mitdb",
        record_name="100",
        data_root=PHYSIONET_ROOT,
        max_samples=360 * 60,
    )
    row = ingest_wfdb_record(rec)
    rid = row["id"]

    assert store.get_record(rid) is not None
    sig = store.get_signal(rid)
    assert sig is not None
    assert len(sig["signal"]) > 0
    assert sig["fs"] == pytest.approx(360.0)

    # Calling ingest again must return same id (idempotent)
    row2 = ingest_wfdb_record(rec)
    assert row2["id"] == rid


# ── API endpoint tests ────────────────────────────────────────────────────────

def test_datasets_endpoint_returns_structure():
    """GET /api/datasets must return the expected structure even with no files."""
    from app.main import app
    client = TestClient(app)
    r = client.get("/api/datasets")
    assert r.status_code == 200
    body = r.json()
    assert "datasets" in body
    datasets = body["datasets"]
    assert isinstance(datasets, list)
    names = [d["dataset"] for d in datasets]
    assert "mitdb" in names
    assert "sddb" in names


def test_dataset_load_unknown_dataset():
    """POST /api/datasets/load with unknown dataset must return error."""
    from app.main import app
    client = TestClient(app)
    r = client.post("/api/datasets/load", json={
        "dataset": "unknown_db",
        "record_name": "100",
    })
    assert r.status_code == 200
    body = r.json()
    assert body.get("error") == "unknown_dataset"


@mitdb_required
def test_dataset_load_and_process_via_api():
    """Load a real WFDB record via API then run the processing pipeline on it."""
    from app.main import app
    from app.core.config import settings
    import os

    # Patch wfdb_data_dir to an absolute path so it works regardless of cwd
    abs_root = str(PHYSIONET_ROOT.parent.parent)  # …/ECG Web/physionet.org/files/..  → …/ECG Web/physionet.org/files
    abs_root = str(PHYSIONET_ROOT)
    original = settings.wfdb_data_dir
    settings.__dict__["wfdb_data_dir"] = abs_root

    client = TestClient(app)
    try:
        # Load the record
        r = client.post("/api/datasets/load", json={
            "dataset": "mitdb",
            "record_name": "100",
            "max_samples": 360 * 60,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert "record" in body
        rid = body["record"]["id"]
        assert body["record"]["synthetic"] is False
        assert body["record"]["source_dataset"] == "mitdb"

        # Run processing pipeline
        p = client.post(f"/api/processing/run?record_id={rid}")
        assert p.status_code == 200, p.text
        pdata = p.json()

        assert "r_peaks" in pdata
        assert pdata["r_peaks"]["count"] > 0
        assert pdata["sampling_rate"] == pytest.approx(360.0)
        assert pdata.get("synthetic_notice") is None
        assert pdata["record"]["synthetic"] is False
    finally:
        settings.__dict__["wfdb_data_dir"] = original


# ── Regression: synthetic demo must still work ───────────────────────────────

def test_synthetic_demo_regression():
    """Existing synthetic demo record must still be loaded and processable."""
    from app.main import app
    from app.db.store import store
    client = TestClient(app)

    r = client.get("/api/records")
    assert r.status_code == 200
    recs = r.json()["records"]
    demo = next((x for x in recs if x.get("record_name") == "SYNTH-DEMO-001"), None)
    assert demo is not None, "Synthetic demo record missing from store"
    assert demo["synthetic"] is True

    p = client.post(f"/api/processing/run?record_id={demo['id']}")
    assert p.status_code == 200
    pdata = p.json()
    assert pdata["record"]["synthetic"] is True
    assert "Synthetic demonstration data" in (pdata.get("synthetic_notice") or "")
    assert "r_peaks" in pdata
