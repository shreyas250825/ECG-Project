# WFDB Dataset Integration

## Overview

The platform now supports loading real ECG recordings from:
- **MIT-BIH Arrhythmia Database** (`mitdb`) — 48 records, 360 Hz, 30-min excerpts
- **Sudden Cardiac Death Holter Database** (`sddb`) — 23 records, 250 Hz, up to 25-hour recordings

Real records flow through the exact same signal-processing pipeline as the synthetic demo (filtering → R-peak detection → feature extraction → rhythm detection → digital twin).

---

## Setup

### 1. Install dependencies
```bash
cd backend
pip install -r requirements.txt   # now includes wfdb>=4.1.0
```

### 2. Point the config at the downloaded data

In your `.env` file (already set if you used the physionet mirror download):
```
WFDB_DATA_DIR=./physionet.org/files
```

Expected layout:
```
physionet.org/files/
  mitdb/1.0.0/100.hea  100.dat  100.atr ...
  sddb/1.0.0/30.hea    30.dat   30.ari  ...
```

If your data is elsewhere, set `WFDB_DATA_DIR` to the root containing `mitdb/` and `sddb/` directories.

### 3. Download the data (if not done)

MIT-BIH (~100 MB, 48 records × ~1.9 MB each):
```powershell
python download_mitdb.py
```

SDDB (~500 MB, 23 records × 10–63 MB each — long recordings):
```powershell
python download_sddb_fast.py
```

Both scripts resume interrupted downloads automatically.

---

## Usage

### Via the frontend

1. Start the backend: `uvicorn app.main:app --reload` (from `backend/`)
2. Start the frontend: `npm run dev` (from `frontend/`)
3. Open **Datasets** → **Dataset browser** tab
4. Click **Load** next to any record
5. The record appears in **Analysis** page dropdown immediately

### Via the API

**List available records on disk:**
```bash
GET /api/datasets
GET /api/datasets/mitdb
GET /api/datasets/sddb
```

**Load a record into memory:**
```bash
POST /api/datasets/load
{
  "dataset": "mitdb",
  "record_name": "100",
  "lead_index": 0,
  "max_samples": null   # null = 1 hour at native fs; set a number to limit RAM
}
```

**Analyse the loaded record:**
```bash
POST /api/processing/run?record_id=<id from load response>
```

**Example — load and analyse MITDB record 100:**
```bash
# Load
curl -X POST http://localhost:8000/api/datasets/load \
  -H "Content-Type: application/json" \
  -d '{"dataset":"mitdb","record_name":"100","max_samples":21600}'

# Note the record id from the response, then:
curl -X POST "http://localhost:8000/api/processing/run?record_id=<id>"
```

---

## Memory behaviour

SDDB recordings can be 25 hours long (~22 million samples per lead). To avoid loading the full recording into RAM:

- Default: first **1 hour** (= `DEFAULT_MAX_SAMPLES = 250 * 3600`) is loaded
- Override with `max_samples` in the load request
- The `truncated` and `truncation_note` fields in the record dict tell you if the recording was capped
- The synthetic demo record is unaffected — it always loads fully (180 s)

---

## Annotation schema

All annotations (from `.atr`, `.ari`, or derived from header) follow this dict structure:

```python
{
    "event_type":          str,   # e.g. "pvc", "vt", "normal_sinus_rhythm"
    "start_time":          float, # seconds from recording start (= sample / fs)
    "end_time":            float, # seconds from recording start
    "annotation_source":   str,   # "wfdb_atr_beat" | "wfdb_atr_rhythm" | "header_vfon_derived"
    "original_symbol":     str,   # original WFDB symbol, e.g. "V", "(VT"
}
```

The ML pipeline reads only `event_type` and `start_time`. The `original_symbol` is for audit purposes.

---

## SDDB event timing

SDDB headers contain a `#vfon: HH:MM:SS` comment giving the clock time of VF onset. The loader:

1. Parses the clock time from the comment
2. Subtracts the recording base time (from the header) to get seconds-from-start
3. Handles midnight roll-over (recordings that cross 00:00)
4. If the computed offset is **within the loaded segment**, injects a `"vf"` annotation with `annotation_source: "header_vfon_derived"`
5. If the offset is beyond the truncated window, no annotation is injected — and the record's `event_positive` is set to `True` regardless, because the event exists in the full recording

**Records without `vfon`** have `event_positive: null` (uncertain) — they are NOT assumed to be confirmed negative controls.

---

## Dataset audit — remaining uncertainties

| Record set | Uncertainty |
|---|---|
| SDDB 40, 42, 44, 48, 49 (no vfon in header) | Event status uncertain. Do not use as negative controls without independent verification. |
| SDDB records with only `.ari` (beat-only) annotations | `annotation_status: "partial"` — rhythm labels absent; VT forecasting labels cannot be built from beat annotations alone. |
| MITDB records 102, 104 | Paced rhythm — R-peak detector may undercount; features computed but reliability is lower. |
| All SDDB records (partial download) | Only the first ~1 hour is loaded by default. VF events that occur later in the recording will not appear in annotations until a full-duration load is requested. |
| MITDB records without VT/VF | `annotation_status: "verified"` (beat annotations from human annotators) but no positive forecasting labels for VT target. Useful for normal-vs-arrhythmia classification. |

---

## Running the tests

```bash
cd backend
python -m pytest tests/test_wfdb_loader.py tests/test_api.py tests/test_processing.py -v
```

Tests that require files on disk are automatically skipped if the files are not yet downloaded. All logic tests (annotation conversion, vfon parsing, missing-file errors) run without any downloaded data.

**Test output (as of implementation):**
- 52 passed, 1 skipped (SDDB VF annotation — skipped because record 30 is partially downloaded and VF onset is beyond the loaded window)
- 0 failures
