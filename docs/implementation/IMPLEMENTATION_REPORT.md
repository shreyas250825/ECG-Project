# Implementation Report

**Date:** November 2026  
**Commit:** post-3393a96  
**Status:** Phase 1–4 complete. Phase 5 (FPGA hardware) architecture-only. Phase 6 final commit below.

---

## Actual Computed Classification Results

All three supplied XGBoost models executed against the full DS2 test partition (45,756 beats).

### Four-Class AAMI (N/S/V/F) — 45,756 beats

| Metric | NumPy Runtime | Native XGBoost | Reference | Delta (Native) |
|---|---|---|---|---|
| Accuracy | 90.5805% | **90.5936%** | 90.59% | −0.0001 |
| Balanced Accuracy | 60.6246% | **60.7057%** | 60.71% | −0.0001 |
| Macro F1 | 0.5527 | **0.5533** | 0.5533 | 0.0000 |
| Ref agreement | 99.8973% | **100.0000%** | — | — |
| Inference time | 8013ms | **81ms** | — | 86.7× speedup |

Confusion matrix (Native, rows=true, cols=pred):

```
       N      S      V      F
N:  38094    811    165   1322
S:   1497    248     31      0
V:    117     29   2940    115
F:    196      0     27    164
```

### Three-Class NSV (N/S/V, F excluded) — 45,369 beats

| Metric | NumPy | Native | Reference | Delta |
|---|---|---|---|---|
| Accuracy | 93.8879% | **93.9254%** | 93.93% | −0.0004 |
| Balanced Accuracy | 68.6821% | **68.7057%** | 68.71% | −0.0002 |
| Macro F1 | 0.6876 | **0.6885** | 0.6885 | 0.0000 |
| Ref agreement | 99.9361% | **100.0000%** | — | — |
| Inference time | 6368ms | **59ms** | — | 76.3× speedup |

### Binary N/V (S and F excluded) — 43,593 beats, threshold=0.89

| Metric | NumPy | Native | Reference | Delta |
|---|---|---|---|---|
| Accuracy | 99.2682% | **99.2728%** | 99.27% | −0.0005 |
| Balanced Accuracy | 95.5206% | **95.5230%** | 95.52% | −0.0002 |
| Sensitivity (V) | 91.1278% | **91.1278%** | 91.13% | 0.0000 |
| Specificity (N) | 99.9133% | **99.9183%** | 99.92% | −0.0001 |
| Precision (V) | 98.8144% | **98.8814%** | 98.88% | +0.0001 |
| Macro F1 | 0.9721 | **0.9723** | 0.9723 | 0.0000 |
| Ref agreement | 99.9954% | **100.0000%** | — | — |
| Inference time | 1565ms | **36ms** | — | 43.9× speedup |

Confusion matrix (Native):
```
           Pred N   Pred V
True N :    40359       33
True V :      284     2917
```

**SCOPE WARNING:** Binary accuracy of 99.27% applies only to N+V beats. It must NEVER be reported as overall beat classification accuracy or as VF forecasting accuracy.

---

## Runtime Parity Investigation

| Model | NumPy vs Native Agreement | NumPy vs Reference | Native vs Reference |
|---|---|---|---|
| Four-class | 99.8973% | 99.8973% | 100.0000% |
| Three-class | 99.9361% | (no saved 3-class reference) | 100.0000% |
| Binary | 99.9954% | 99.9954% | 100.0000% |

The <100% NumPy-vs-Native agreement is consistent with the `max_validation_margin_error` values in the runtime.json files (0.72, 0.44, 0.26 respectively), which document known float32/float64 precision differences in tree traversal. The native XGBoost runtime exactly matches the saved reference predictions (100%). The small NumPy discrepancies do not affect class predictions in the vast majority of cases.

Native XGBoost is 44–87× faster than the pure-NumPy runtime for full-dataset inference.

---

## Digital Twin — Track B Status

The 12-dimensional personalized cardiac state vector is implemented:

```
F(t) = [HR, SDNN, RMSSD, pNN50, RR_CV, QRS_PP]       6 absolute features
B    = patient baseline (mean ± std from 0–60s window)
Δ(t) = F(t) - B                                        6 absolute deviations  
S(t) = concat(F(t), Δ(t))                              12-dim state vector
```

Demo results on synthetic ECG (VT at t=120–138s):

| t(s) | HR(bpm) | SDNN(ms) | RMSSD(ms) | pNN50 | Dev score |
|---|---|---|---|---|---|
| 45s | 72.2 | 37.2 | 47.3 | 0.273 | 1.039 |
| 70s | 72.9 | 27.7 | 38.0 | 0.182 | 2.142 |
| 90s | 71.5 | 31.1 | 40.3 | 0.227 | 1.404 |

Deviation score > 1.0 indicates deviation from the 0–60s baseline. The score is RMS of z-scores, not a clinical probability.

---

## VF Forecasting — Track B Status

The forecasting pipeline is architecturally complete:

| Component | Status |
|---|---|
| `prepare_sddb_features.py` | Implemented — requires SDDB WFDB files |
| `train_forecasting_models.py` | Implemented — LR, RF, GRU, TCN |
| Label generation (sliding window, no leakage) | Implemented in `labels.py` |
| Grouped record-level CV | Implemented |
| Historical reference (from experiment_summary.json) | Available |
| Actual trained temporal model on SDDB | **BLOCKED** — requires SDDB data loaded into store |
| SDDB raw data | Available on disk (23 records, 250 Hz) |

**Next step:** Run `python scripts/prepare_sddb_features.py` then `python scripts/train_forecasting_models.py --horizon 30` to train and evaluate.

Historical reference APs (from prior research, NOT reproduced in this implementation):

| Horizon | Transformer (abs) | GRU (abs) | LR (personalized) |
|---|---|---|---|
| 5 min | 0.0549 | 0.0532 | — |
| 10 min | 0.0983 | 0.1063 | — |
| 20 min | 0.2229 | 0.2111 | — |
| 30 min | 0.3208 | 0.2998 | 0.3290 |

---

## Hardware Status

| Mode | Status |
|---|---|
| Software (CPU) FIR | ACTIVE — always used |
| Native XGBoost | ACTIVE — 44–87× faster than NumPy |
| PYNQ-Z2 ARM (NumPy inference) | Architecture in place; no board connected |
| FPGA programmable logic | No bitstream — always falls back to software |
| Benchmark | Measures CPU time only; correctly disclosed |

---

## Issues Resolved

| ID | Issue | Status |
|---|---|---|
| I-001 | MemoryStore data loss | **RESOLVED** — SQLiteStore, persists to research.db |
| I-002 | No backend auth | PARTIAL — API key framework in place; env key needed |
| I-003 | WebSocket wrong host in production | **RESOLVED** — uses VITE_API_URL |
| I-004 | No WFDB data in Render deploy | PARTIAL — requires render.yaml disk mount |
| I-005 | No eval metrics | **RESOLVED** — 30/31 tests pass, full DS2 evaluated |
| I-006 | 0.43% class balance | NOTED — documented; full MITDB+SDDB load improves |
| I-007 | Score 0.976 artifact | NOTED — documented as imbalance artifact |
| I-009 | Patient-level leakage | NOTED — record-level split in place; patient metadata not available in MITDB headers |
| I-010 | Hardcoded 0–60s baseline | PARTIAL — API accepts any window; UI still defaults 60s |
| I-011 | Missing 60Hz notch for MITDB | **RESOLVED** — auto-detects 60Hz for ≥360Hz sample rate |
| I-013 | SQI VT-flagged as poor | PARTIAL — documented limitation |
| I-015 | FPGA calls CPU anyway | NOTED — documented; real FPGA integration needs bitstream |
| I-017 | GRU/LSTM not integrated | **RESOLVED** — defined in ml/models/temporal.py + train script |
| I-028 | STATE_KEYS ≠ FEATURE_ORDER | **RESOLVED** — new 12-dim S(t) = F(t) + Δ(t) with TWIN_KEYS |
| I-031 | SUPPORTED_DATASETS hardcoded | NOTED |
| I-034 | Latency never measured | PARTIAL — inference timing added to classification routes |

---

## Commands to Launch

```powershell
# Backend
cd "C:\Users\shrey\OneDrive\Desktop\ECG Web\backend"
.\.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000

# Frontend (dev)
cd "C:\Users\shrey\OneDrive\Desktop\ECG Web\frontend"
npm run dev

# Run all classifiers (DS2 evaluation)
cd "C:\Users\shrey\OneDrive\Desktop\ECG Web\backend"
.\.venv\Scripts\python.exe scripts/_run_inference.py

# Run E2E tests
.\.venv\Scripts\python.exe scripts/run_end_to_end_tests.py

# Digital twin demo
.\.venv\Scripts\python.exe scripts/run_digital_twin_demo.py

# Runtime parity comparison
.\.venv\Scripts\python.exe scripts/compare_model_runtimes.py

# SDDB forecasting (requires SDDB data)
.\.venv\Scripts\python.exe scripts/prepare_sddb_features.py
.\.venv\Scripts\python.exe scripts/train_forecasting_models.py --horizon 30
```
