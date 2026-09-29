"""Replay streaming of analysis quantities. Not a live clinical monitor."""

from __future__ import annotations

import asyncio
import json

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.db.store import store
from app.digital_twin.baseline import PatientBaseline
from app.digital_twin.state import build_state
from app.processing.features import extract_features
from app.processing.preprocess import PreprocessParams, preprocess_ecg
from app.processing.quality import estimate_signal_quality
from app.processing.rpeaks import compute_hr, compute_rr_intervals, detect_r_peaks
from app.schemas.api import DISCLAIMER
from app.services.analysis import baseline_from_store, ensure_demo_record
from app.forecasting.engine import evidence_status, score_from_sklearn, EvidenceThresholds
from app.processing.features import vector_to_array
from app.services.ml import load_model

ws_router = APIRouter()


@ws_router.websocket("/ws/ecg-analysis/{record_id}")
async def ecg_analysis_ws(websocket: WebSocket, record_id: str):
    await websocket.accept()
    ensure_demo_record()
    if record_id == "demo":
        recs = store.list_records()
        record_id = recs[0]["id"] if recs else record_id
    sig = store.get_signal(record_id)
    if not sig:
        await websocket.send_json({"error": "no_ecg", "message": "ECG record not found.", "disclaimer": DISCLAIMER})
        await websocket.close()
        return
    speed = 1.0
    signal = np.asarray(sig["signal"], dtype=np.float64)
    fs = float(sig["fs"])
    hop = int(fs * 1.0)
    win = int(fs * 8.0)
    i = 0
    model, _ = load_model(None)
    bl = baseline_from_store(record_id)
    try:
        while True:
            # non-blocking receive for speed commands
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
                data = json.loads(msg)
                if "speed" in data:
                    speed = float(data["speed"])
            except asyncio.TimeoutError:
                pass
            except WebSocketDisconnect:
                return

            if i + win >= len(signal):
                i = 0
            seg = signal[i : i + win]
            t0 = i / fs
            cleaned = preprocess_ecg(seg, PreprocessParams(fs=fs))
            peaks = detect_r_peaks(cleaned, fs)
            rr = compute_rr_intervals(peaks, fs)
            hr = compute_hr(rr)
            q = estimate_signal_quality(cleaned, fs, peaks)
            fv = extract_features(cleaned, fs, peaks)
            st = build_state(record_id, t0 + win / fs, fv.values, bl)
            score = score_from_sklearn(model, vector_to_array(fv.values)) if model is not None else None
            status = evidence_status(score, model is not None, fv.sufficient, EvidenceThresholds())
            step = max(1, int(fs / 25))
            await websocket.send_json(
                {
                    "timestamp": t0,
                    "ecg_segment": cleaned[::step].tolist(),
                    "signal_quality": q.label,
                    "r_peaks": peaks.tolist(),
                    "hr": hr,
                    "features": fv.values,
                    "digital_twin_state": st.state_vector,
                    "deviation_score": st.deviation_score,
                    "forecast_output": {"status": status, "model_score": score},
                    "disclaimer": DISCLAIMER,
                    "replay": True,
                }
            )
            i += hop
            await asyncio.sleep(max(0.05, 1.0 / max(speed, 0.1)))
    except WebSocketDisconnect:
        return
