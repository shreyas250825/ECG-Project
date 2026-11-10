"""WFDB dataset adapter for MIT-BIH Arrhythmia Database and SDDB.

Loads real ECG recordings from WFDB-compatible .hea/.dat/.atr files and
converts them to the internal record/signal/annotation schema used by
MemoryStore.

Design constraints
------------------
- Never fabricate signal data or annotations.
- Never assume all datasets use the same sampling frequency.
- Never load an entire long SDDB recording (up to 25 h) into RAM; support
  bounded-memory access via a configurable sample limit.
- Distinguish event-positive, event-negative and uncertain annotation status
  from verified source metadata — do not assume `vfon` absence = confirmed
  negative control.
- Do not generate forecasting labels here; that responsibility belongs to
  labels.py after event timing has passed validation.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

import numpy as np

log = logging.getLogger(__name__)

# ── WFDB symbol → internal event_type mapping ────────────────────────────────
# Based on MIT-BIH annotation guidelines and SDDB header metadata.
# Only symbols that map to a clearly defined arrhythmia type are translated;
# all others become "other_beat" or "rhythm_annotation".
# Reference: https://www.physionet.org/physiobank/database/html/mitdbdir/intro.htm

BEAT_SYMBOL_MAP: dict[str, str] = {
    # Normal / supraventricular
    "N": "normal_beat",
    "L": "lbbb_beat",
    "R": "rbbb_beat",
    "A": "apb_beat",          # atrial premature beat
    "a": "aberrated_apb",
    "J": "nodal_junctional_premature_beat",
    "S": "supraventricular_premature_beat",
    "e": "atrial_escape_beat",
    "j": "nodal_escape_beat",
    # Ventricular
    "V": "pvc",               # premature ventricular contraction
    "E": "ventricular_escape_beat",
    "F": "fusion_beat",
    "f": "fusion_paced_beat",
    # Paced
    "/": "paced_beat",
    # Noise / artifact
    "~": "signal_quality_change",
    "|": "isolated_qrs_artifact",
    # Unknown
    "Q": "unclassifiable_beat",
    "?": "beat_not_classified",
}

RHYTHM_SYMBOL_MAP: dict[str, str] = {
    "(N":   "normal_sinus_rhythm",
    "(AFIB": "atrial_fibrillation",
    "(AFL":  "atrial_flutter",
    "(B":    "ventricular_bigeminy",
    "(T":    "ventricular_trigeminy",
    "(SBR":  "sinus_bradycardia",
    "(SVTA": "supraventricular_tachyarrhythmia",
    "(VT":   "vt",            # ventricular tachycardia → primary ML target
    "(VFL":  "vt",            # ventricular flutter treated as VT
    "(VF":   "vf",            # ventricular fibrillation
    "(AB":   "atrial_bigeminy",
    "(IVR":  "idioventricular_rhythm",
    "(P":    "paced_rhythm",
    "(PREX": "pre_excitation",
    "(NOD":  "nodal_rhythm",
    "(WPW":  "wpw_syndrome",
    "(EAR":  "ectopic_atrial_rhythm",
    "(J":    "junctional_escape_rhythm",
    "(BBB":  "bundle_branch_block",
    "(BII":  "second_degree_av_block",
}

# Max samples to load per recording when no explicit limit is set.
# SDDB records can be ~25 h × 250 Hz × 2 leads = ~45 M samples per lead.
# Default: load first 60 min = 900 000 samples at 250 Hz (a safe RAM budget).
DEFAULT_MAX_SAMPLES = 250 * 3600  # 1 hour at 250 Hz — overridden per call


@dataclass
class WfdbRecord:
    """Parsed WFDB record ready for ingestion into MemoryStore."""

    # Identity
    dataset: str            # e.g. "mitdb", "sddb"
    record_name: str        # e.g. "100", "30"
    record_path: str        # filesystem path to the .hea file (without extension)

    # Signal (single lead, 1-D)
    signal: np.ndarray      # float64, physical units (mV)
    fs: float               # sampling frequency in Hz (from .hea, not assumed)
    lead_name: str          # e.g. "MLII", "ECG"
    lead_units: str         # e.g. "mV", "V"
    n_samples: int          # actual loaded samples (may be < full recording)
    full_recording_samples: int  # total samples in recording on disk
    truncated: bool         # True if only a segment was loaded

    # Annotations (may be empty)
    annotations: list[dict]  # internal annotation dicts (see annotation schema)
    has_annotations: bool
    annotation_status: Literal["verified", "partial", "absent", "uncertain"]
    annotation_notes: list[str]

    # SDDB-specific event metadata
    vf_onset_time_s: float | None   # from `#vfon:` header comment, seconds from rec start
    vf_onset_source: str | None     # "header_comment" if parsed from .hea
    event_positive: bool | None     # True/False/None (None = uncertain)

    # Provenance
    source_url: str
    privacy_status: str
    disclaimer: str


def _physionet_url(dataset: str, record_name: str) -> str:
    return f"https://physionet.org/files/{dataset}/1.0.0/{record_name}"


def _parse_vfon_from_comments(comments: list[str]) -> tuple[float | None, str | None]:
    """
    Parse `#vfon: HH:MM:SS` from WFDB header comments.
    Returns (seconds_since_midnight, "header_comment") or (None, None).

    The `vfon` time is clock time, not seconds-from-recording-start.
    Callers must subtract the recording start time to get event-relative
    sample indices.  This function only extracts the raw clock value.
    """
    for c in (comments or []):
        stripped = c.strip().lstrip("#").strip()
        if stripped.lower().startswith("vfon:"):
            time_str = stripped[5:].strip()
            try:
                parts = time_str.split(":")
                if len(parts) == 3:
                    h, m, s = int(parts[0]), int(parts[1]), float(parts[2])
                    return h * 3600 + m * 60 + s, "header_comment"
            except (ValueError, IndexError):
                log.warning("Could not parse vfon time string: %r", time_str)
    return None, None


def _clock_to_seconds(time_str: str) -> float | None:
    """Convert HH:MM:SS string to seconds since midnight.  Returns None on failure."""
    try:
        parts = time_str.strip().split(":")
        if len(parts) == 3:
            h, m, s = int(parts[0]), int(parts[1]), float(parts[2])
            return h * 3600 + m * 60 + s
    except (ValueError, IndexError):
        pass
    return None


def _vfon_to_sample_offset(
    vfon_clock_s: float,
    base_time_clock_s: float,
    fs: float,
) -> float:
    """
    Convert vfon clock time to seconds-from-recording-start.
    Handles midnight roll-over if vfon < base_time (recording crosses midnight).
    """
    offset_s = vfon_clock_s - base_time_clock_s
    if offset_s < 0:
        offset_s += 24 * 3600  # midnight roll-over
    return offset_s


def _wfdb_anns_to_internal(
    ann,
    fs: float,
    max_samples: int,
    record_id_hint: str,
) -> tuple[list[dict], str, list[str]]:
    """
    Convert a wfdb Annotation object to internal annotation dicts.

    Returns:
        annotations: list of dicts with required fields
        status: "verified" | "partial" | "absent" | "uncertain"
        notes: list of human-readable notes about the annotation set
    """
    if ann is None:
        return [], "absent", ["No annotation file found for this record."]

    notes: list[str] = []
    annotations: list[dict] = []

    samples = ann.sample
    symbols = ann.symbol
    aux_notes = ann.aux_note if ann.aux_note is not None else [""] * len(samples)

    # Rhythm annotations are carried in aux_note (e.g. "(VT", "(N")
    # Beat annotations are in symbol
    current_rhythm: str | None = None
    rhythm_start_s: float | None = None

    i = 0
    while i < len(samples):
        s = int(samples[i])
        if s >= max_samples:
            notes.append(f"Annotations beyond loaded segment ({max_samples} samples) were discarded.")
            break

        sym = symbols[i] if i < len(symbols) else ""
        aux = str(aux_notes[i]).strip() if i < len(aux_notes) else ""
        time_s = s / fs

        # ── Rhythm label change (carried in aux_note) ────────────────────────
        if aux:
            # Close out the previous rhythm interval
            if current_rhythm is not None and rhythm_start_s is not None:
                annotations.append({
                    "event_type": current_rhythm,
                    "start_time": rhythm_start_s,
                    "end_time": time_s,
                    "annotation_source": "wfdb_atr_rhythm",
                    "original_symbol": f"rhythm:{current_rhythm}",
                })
            # Map to internal event type
            new_rhythm = RHYTHM_SYMBOL_MAP.get(aux)
            if new_rhythm is None:
                # Unknown rhythm label — store as-is with a safe name
                new_rhythm = f"rhythm_{aux.lstrip('(').lower()}"
                notes.append(f"Unknown rhythm label '{aux}' stored as '{new_rhythm}'.")
            current_rhythm = new_rhythm
            rhythm_start_s = time_s

        # ── Beat annotation ──────────────────────────────────────────────────
        if sym and sym not in ("", "+", "[", "]", "!"):
            event_type = BEAT_SYMBOL_MAP.get(sym, f"beat_{sym}")
            annotations.append({
                "event_type": event_type,
                "start_time": time_s,
                "end_time": time_s + 0.08,  # ~80 ms beat window
                "annotation_source": "wfdb_atr_beat",
                "original_symbol": sym,
            })

        i += 1

    # Close out the final rhythm interval
    if current_rhythm is not None and rhythm_start_s is not None:
        final_time_s = max_samples / fs
        annotations.append({
            "event_type": current_rhythm,
            "start_time": rhythm_start_s,
            "end_time": final_time_s,
            "annotation_source": "wfdb_atr_rhythm",
            "original_symbol": f"rhythm:{current_rhythm}",
        })

    n_beat = sum(1 for a in annotations if a["annotation_source"] == "wfdb_atr_beat")
    n_rhythm = sum(1 for a in annotations if a["annotation_source"] == "wfdb_atr_rhythm")
    notes.append(f"Loaded {n_beat} beat annotations and {n_rhythm} rhythm intervals.")

    # Determine verification status
    has_vt = any(a["event_type"] == "vt" for a in annotations)
    has_vf = any(a["event_type"] == "vf" for a in annotations)
    if n_beat + n_rhythm == 0:
        status = "absent"
    elif n_rhythm > 0:
        status = "verified"  # rhythm labels from human annotators
        if has_vt:
            notes.append("Record contains VT rhythm annotations — positive for VT forecasting target.")
        if has_vf:
            notes.append("Record contains VF rhythm annotations.")
    else:
        # Beat-only annotations — partial (no rhythm context)
        status = "partial"
        notes.append("Beat-level annotations only; no rhythm labels found.")

    return annotations, status, notes


def load_wfdb_record(
    dataset: str,
    record_name: str,
    data_root: str | Path,
    lead_index: int = 0,
    max_samples: int | None = None,
    annotation_extension: str = "atr",
) -> WfdbRecord:
    """
    Load a single WFDB record from disk.

    Parameters
    ----------
    dataset : str
        Dataset identifier, e.g. "mitdb" or "sddb".
    record_name : str
        Record identifier, e.g. "100" or "30".
    data_root : str or Path
        Root directory containing the WFDB files.
        Expected layout: <data_root>/<dataset>/1.0.0/<record_name>.hea etc.
        OR: <data_root>/<record_name>.hea (flat layout).
    lead_index : int
        Which signal channel to extract (0-indexed). Default 0.
    max_samples : int or None
        Maximum number of samples to load. None → DEFAULT_MAX_SAMPLES.
        Use a lower value for very long SDDB recordings to avoid OOM.
    annotation_extension : str
        Annotation file extension to try, e.g. "atr", "ari".

    Returns
    -------
    WfdbRecord

    Raises
    ------
    FileNotFoundError
        If the .hea file cannot be found at any expected path.
    ValueError
        If the record is malformed (bad channel count, zero fs, etc.).
    ImportError
        If the wfdb package is not installed.
    """
    try:
        import wfdb  # type: ignore[import]
    except ImportError as exc:
        raise ImportError(
            "The 'wfdb' package is required to load WFDB records. "
            "Install it with: pip install wfdb>=4.1.0"
        ) from exc

    if max_samples is None:
        max_samples = DEFAULT_MAX_SAMPLES

    root = Path(data_root)
    # Try multiple directory layouts
    candidate_dirs: list[Path] = [
        root / dataset / "1.0.0",    # physionet mirror layout
        root / dataset,
        root,
    ]
    hea_dir: Path | None = None
    for d in candidate_dirs:
        if (d / f"{record_name}.hea").exists():
            hea_dir = d
            break

    if hea_dir is None:
        searched = [str(d / f"{record_name}.hea") for d in candidate_dirs]
        raise FileNotFoundError(
            f"WFDB header not found for record '{record_name}' in dataset '{dataset}'. "
            f"Searched: {searched}"
        )

    record_path = str(hea_dir / record_name)

    # ── Read header first to get shape without loading data ──────────────────
    try:
        header = wfdb.rdheader(record_path)
    except Exception as exc:
        raise ValueError(f"Cannot read WFDB header at '{record_path}': {exc}") from exc

    fs = float(header.fs)
    if fs <= 0:
        raise ValueError(f"Invalid sampling frequency {fs} Hz in record '{record_name}'.")

    n_sig = header.n_sig
    if n_sig == 0:
        raise ValueError(f"Record '{record_name}' has no signal channels.")
    if lead_index >= n_sig:
        raise ValueError(
            f"lead_index={lead_index} out of range; record '{record_name}' has {n_sig} channel(s)."
        )

    total_samples: int = header.sig_len if header.sig_len else 0
    truncated = total_samples > max_samples

    # ── Load signal (bounded to max_samples) ─────────────────────────────────
    sampto = min(max_samples, total_samples) if total_samples > 0 else max_samples
    try:
        record = wfdb.rdrecord(record_path, channels=[lead_index], sampto=sampto, physical=True)
    except Exception as exc:
        raise ValueError(f"Cannot read WFDB record '{record_name}': {exc}") from exc

    raw_signal = record.p_signal  # shape (n_samples, 1) or (n_samples, n_channels)
    if raw_signal is None or raw_signal.size == 0:
        raise ValueError(f"Record '{record_name}' returned empty signal array.")

    if raw_signal.ndim == 2:
        signal_1d = raw_signal[:, 0].astype(np.float64)
    else:
        signal_1d = raw_signal.astype(np.float64)

    # Replace NaN samples (WFDB uses NaN for missing/invalid samples)
    n_nan = int(np.sum(np.isnan(signal_1d)))
    if n_nan > 0:
        signal_1d = np.where(np.isnan(signal_1d), 0.0, signal_1d)
        log.warning(
            "Record %s/%s: replaced %d NaN samples with 0.0.",
            dataset, record_name, n_nan
        )

    n_loaded = len(signal_1d)

    # Lead name and units
    lead_name = (record.sig_name or ["unknown"])[0]
    lead_units = (record.units or ["unknown"])[0]

    # ── Parse SDDB vfon from header comments ─────────────────────────────────
    comments: list[str] = list(header.comments or [])
    vfon_clock_s, vfon_source = _parse_vfon_from_comments(comments)

    # Recording base time from header
    base_time_clock_s: float | None = None
    if header.base_time:
        base_time_clock_s = _clock_to_seconds(str(header.base_time))

    vf_onset_s: float | None = None
    event_positive: bool | None = None
    ann_notes_extra: list[str] = []

    if vfon_clock_s is not None and base_time_clock_s is not None:
        vf_onset_s = _vfon_to_sample_offset(vfon_clock_s, base_time_clock_s, fs)
        if vf_onset_s < 0 or vf_onset_s > total_samples / fs:
            ann_notes_extra.append(
                f"Computed vfon offset {vf_onset_s:.1f}s is outside recording duration "
                f"({total_samples/fs:.1f}s); setting to None."
            )
            vf_onset_s = None
        else:
            event_positive = True
            ann_notes_extra.append(
                f"VF onset at {vf_onset_s:.1f}s from recording start "
                f"(clock: {vfon_clock_s:.0f}s, base: {base_time_clock_s:.0f}s)."
            )
    elif vfon_clock_s is not None and base_time_clock_s is None:
        ann_notes_extra.append(
            "vfon header comment found but recording base_time is missing; "
            "cannot compute event offset. Event status: uncertain."
        )
        event_positive = None  # uncertain — do NOT assume negative
    elif dataset == "sddb":
        # SDDB records without vfon are ambiguous — do not assume confirmed negative
        ann_notes_extra.append(
            "No vfon header comment found in this SDDB record. "
            "Event status is uncertain — do not treat as a confirmed negative control."
        )
        event_positive = None

    # ── Load annotations ─────────────────────────────────────────────────────
    ann = None
    ann_ext_used: str | None = None
    for ext in [annotation_extension, "atr", "ari"]:
        ann_path = hea_dir / f"{record_name}.{ext}"
        if ann_path.exists():
            try:
                ann = wfdb.rdann(record_path, ext, sampto=sampto)
                ann_ext_used = ext
                break
            except Exception as exc:
                log.warning("Could not load annotation '%s' for %s: %s", ext, record_name, exc)

    annotations, ann_status, ann_notes = _wfdb_anns_to_internal(
        ann, fs, n_loaded, record_name
    )
    ann_notes = ann_notes + ann_notes_extra

    if ann_ext_used:
        ann_notes.append(f"Annotation file extension used: .{ann_ext_used}")

    # If vfon resolved and no VT/VF rhythm annotations, add a synthetic event
    # annotation from the header so the ML pipeline can use it — but flag clearly.
    if vf_onset_s is not None and vf_onset_s < n_loaded / fs:
        has_vf_ann = any(a["event_type"] in ("vt", "vf") for a in annotations)
        if not has_vf_ann:
            annotations.append({
                "event_type": "vf",
                "start_time": vf_onset_s,
                "end_time": vf_onset_s + 60.0,  # conservative 60s window
                "annotation_source": "header_vfon_derived",
                "original_symbol": "vfon_header",
                "note": (
                    "Derived from #vfon header comment. "
                    "End time is conservative (60 s); use with caution for forecasting."
                ),
            })
            ann_notes.append(
                "Added VF event annotation derived from #vfon header comment "
                "(no rhythm annotation file provided this event)."
            )

    disclaimer = (
        f"Real ECG recording from PhysioNet {dataset.upper()} (record {record_name}). "
        "Research use only. Not for clinical diagnosis."
    )

    return WfdbRecord(
        dataset=dataset,
        record_name=record_name,
        record_path=record_path,
        signal=signal_1d,
        fs=fs,
        lead_name=lead_name,
        lead_units=lead_units,
        n_samples=n_loaded,
        full_recording_samples=total_samples,
        truncated=truncated,
        annotations=annotations,
        has_annotations=len(annotations) > 0,
        annotation_status=ann_status,
        annotation_notes=ann_notes,
        vf_onset_time_s=vf_onset_s,
        vf_onset_source=vfon_source if vf_onset_s is not None else None,
        event_positive=event_positive,
        source_url=_physionet_url(dataset, record_name),
        privacy_status="physionet_public_deidentified",
        disclaimer=disclaimer,
    )


def list_available_records(
    dataset: str,
    data_root: str | Path,
) -> list[str]:
    """
    Return a list of record names available on disk for a given dataset.
    Looks for .hea files in the expected directory layouts.
    """
    root = Path(data_root)
    candidate_dirs: list[Path] = [
        root / dataset / "1.0.0",
        root / dataset,
        root,
    ]
    found: list[str] = []
    for d in candidate_dirs:
        if d.exists():
            for hea in sorted(d.glob("*.hea")):
                name = hea.stem
                # Skip WFDB internal files
                if not name.startswith(".") and not name.endswith("-"):
                    found.append(name)
            if found:
                break
    return sorted(set(found))
