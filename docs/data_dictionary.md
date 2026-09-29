# Data dictionary

| Entity | Meaning |
| --- | --- |
| research_records | De-identified ECG recording metadata (no direct identifiers) |
| record_annotations | Event type, start/end time in seconds, annotation source |
| processing_runs | DSP execution log, software vs PYNQ mode |
| features | Feature vector JSON at a timestamp |
| patient_baselines | Statistics from an explicit baseline window |
| digital_twin_states | State vector and deviation score |
| model_runs | Training configuration and metrics (null if not evaluated) |
| forecast_results | Score, evidence status, ground truth, observed lead time |
| hardware_runs | Benchmark attempts; unmeasured fields stored as null |

Feature units and limitations are documented in `backend/app/processing/features.py` (`FEATURE_META`).
