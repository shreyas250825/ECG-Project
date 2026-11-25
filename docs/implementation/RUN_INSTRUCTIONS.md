# Run Instructions

## Prerequisites

- Python 3.11+ with venv in `backend/.venv`
- Node.js 18+ with `npm`
- `backend/.env` with `WFDB_DATA_DIR` set

## 1. Start the backend

```powershell
cd "C:\Users\shrey\OneDrive\Desktop\ECG Web\backend"
.\.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000
```

On first start: automatically loads 3 XGBoost models + creates SQLite DB (research.db).

## 2. Start the frontend (development)

```powershell
cd "C:\Users\shrey\OneDrive\Desktop\ECG Web\frontend"
npm run dev
```

Open: http://localhost:5173

## 3. Run model inference (DS2 evaluation)

```powershell
cd "C:\Users\shrey\OneDrive\Desktop\ECG Web\backend"
.\.venv\Scripts\python.exe scripts/_run_inference.py
```

Outputs to `outputs/classification/`.

## 4. Beat Classification page

Navigate to: **Beat Classification** in the sidebar.

- Select Four-class / Three-class / Binary
- Choose Native XGBoost or NumPy runtime
- Click "Run DS2 Evaluation" for live 2000-beat sample
- Full saved results auto-load from `outputs/classification/all_results.json`

## 5. SDDB Forecasting (Track B)

Requires SDDB records on disk:

```powershell
# Prepare features
.\.venv\Scripts\python.exe scripts/prepare_sddb_features.py --max-hours 1

# Train LR + RF (+ GRU/TCN if torch installed)
.\.venv\Scripts\python.exe scripts/train_forecasting_models.py --horizon 30

# Evaluate all horizons
.\.venv\Scripts\python.exe scripts/evaluate_forecasting_models.py
```

## 6. Digital twin demo

```powershell
.\.venv\Scripts\python.exe scripts/run_digital_twin_demo.py
```

## 7. E2E tests

```powershell
.\.venv\Scripts\python.exe scripts/run_end_to_end_tests.py
```

Expected: 30/31 PASS, 1 BLOCKED (SDDB features).

## 8. Install PyTorch for GRU/Transformer (optional)

```powershell
.\.venv\Scripts\pip.exe install torch --index-url https://download.pytorch.org/whl/cpu
```

## API endpoints

| Path | Description |
|---|---|
| GET /api/health | Backend health |
| GET /api/classification/models | List loaded models |
| POST /api/classification/predict | Single beat inference |
| POST /api/classification/evaluate-ds2 | Full DS2 evaluation |
| POST /api/processing/run | ECG analysis pipeline |
| POST /api/baseline/create | Patient baseline |
| POST /api/digital-twin/update | Twin state update |
| POST /api/model/train | Train forecasting model |
| POST /api/forecast/run | Run forecast |
| GET /api/datasets | List WFDB datasets |
| POST /api/datasets/load | Load a WFDB record |
| /ws/ecg-analysis/{id} | WebSocket ECG replay |
