from fastapi import APIRouter, File, Form, UploadFile

from app.core.config import settings
from app.db.store import store
from app.db.supabase import supabase_client
from app.hardware.factory import get_accelerator, hardware_status, set_mode
from app.hardware.software import SoftwareECGAccelerator
from app.schemas.api import (
    BaselineRequest,
    DigitalTwinRequest,
    DISCLAIMER,
    ForecastRunRequest,
    HardwareModeRequest,
    TrainRequest,
)
from app.services.analysis import (
    analyse_record,
    create_record_baseline,
    ensure_demo_record,
    save_upload,
    update_twin,
)
from app.services.ml import load_model, run_forecast, train_models
from app.services.pipeline import STAGES

router = APIRouter()


@router.get("/health")
def health():
    hw = hardware_status()
    return {
        "status": "ok",
        "supabase": supabase_client.health(),
        "hardware_mode": hw.mode,
        "hardware_available": hw.hardware_available,
        "research_prototype": True,
        "not_for_clinical_diagnosis": True,
        "store": store.backend_name(),
    }


@router.get("/system/status")
def system_status():
    hw = hardware_status()
    return {
        "app": settings.app_name,
        "env": settings.app_env,
        "disclaimer": DISCLAIMER,
        "supabase": supabase_client.health(),
        "hardware": hw.__dict__,
        "models_trained": len(store.list_model_runs()),
        "records": len(store.list_records()),
        "pynq_enable": settings.pynq_enable,
    }


@router.get("/hardware/status")
def hw_status():
    st = hardware_status()
    return {
        **st.__dict__,
        "connection": "CONNECTED" if st.hardware_available else "NOT CONNECTED",
        "board": st.board_name or "Unknown until detected/configured",
        "accelerator": st.accelerator_name or "Unknown until actual overlay is loaded",
        "pynq_enable": settings.pynq_enable,
        "pynq_ip": settings.pynq_ip or None,
    }


@router.post("/hardware/mode")
def hw_mode(body: HardwareModeRequest):
    set_mode(body.mode)
    return hw_status()


@router.post("/hardware/initialize")
def hw_init():
    acc = get_accelerator()
    st = acc.initialize()
    store.add_hardware_run({"hardware_mode": st.mode, "board_name": st.board_name, "accelerator_name": st.accelerator_name})
    return {**st.__dict__, "disclaimer": DISCLAIMER}


@router.post("/hardware/benchmark")
def hw_bench():
    rec = ensure_demo_record()
    sig = store.get_signal(rec["id"])
    import numpy as np

    x = np.asarray(sig["signal"][: int(sig["fs"] * 10)], dtype=float)
    sw = SoftwareECGAccelerator().benchmark(x, float(sig["fs"]))
    acc = get_accelerator()
    other = acc.benchmark(x, float(sig["fs"]))
    def pack(b):
        return {
            "mode": b.mode,
            "latency_ms": b.latency_ms,
            "throughput_samples_per_s": b.throughput_samples_per_s,
            "batch_size": b.batch_size,
            "resource_utilization": b.resource_utilization,
            "power": b.power,
            "notes": b.notes,
        }
    return {
        "software": pack(sw),
        "selected_accelerator": pack(other),
        "unmeasured_display": "Not measured",
        "disclaimer": DISCLAIMER,
    }


@router.get("/pipeline")
def pipeline():
    return {"stages": STAGES, "disclaimer": DISCLAIMER}


@router.get("/records")
def records():
    ensure_demo_record()
    return {"records": store.list_records(), "disclaimer": DISCLAIMER}


@router.get("/records/{record_id}")
def record_detail(record_id: str):
    rec = store.get_record(record_id)
    if not rec:
        return {"error": "not_found", "message": "Record not found."}
    return {
        "record": rec,
        "annotations": store.get_annotations(record_id),
        "disclaimer": DISCLAIMER,
    }


@router.post("/ecg/upload")
async def upload(
    file: UploadFile = File(...),
    sampling_rate: float = Form(250),
    signal_column: str = Form("signal"),
    time_column: str | None = Form(None),
    lead: str = Form("unknown"),
):
    content = await file.read()
    row = save_upload(file.filename or "upload.csv", content, sampling_rate, signal_column, time_column or None, lead)
    return {"record": row, "disclaimer": DISCLAIMER}


@router.post("/processing/run")
def processing_run(record_id: str, execution_mode: str = "auto"):
    return analyse_record(record_id, execution_mode)


@router.post("/features/extract")
def features_extract(record_id: str):
    out = analyse_record(record_id)
    return {"features": out["features"], "feature_metadata": out["feature_metadata"], "disclaimer": DISCLAIMER}


@router.post("/baseline/create")
def baseline(body: BaselineRequest):
    return create_record_baseline(body.record_id, body.window_start_s, body.window_end_s, body.subwindow_s, body.hop_s)


@router.post("/digital-twin/update")
def twin(body: DigitalTwinRequest):
    return update_twin(body.record_id, body.timestamp_s, body.window_s)


@router.post("/model/train")
def train(body: TrainRequest):
    return train_models(body)


@router.get("/model/runs")
def model_runs():
    return {"runs": store.list_model_runs(), "disclaimer": DISCLAIMER}


@router.post("/forecast/run")
def forecast(body: ForecastRunRequest):
    return run_forecast(body)


@router.get("/results/{id}")
def results(id: str):
    run = store.get_model_run(id)
    if not run:
        return {"message": "No experimental result available yet.", "metrics": None}
    if not run.get("metrics"):
        return {"message": "No experimental result available yet.", "model": run, "metrics": None}
    return {"model": run, "metrics": run["metrics"], "disclaimer": DISCLAIMER}


@router.get("/evaluation/{model_id}")
def evaluation(model_id: str):
    return results(model_id)


@router.get("/evaluation")
def evaluation_list():
    ev = store.list_evaluations()
    if not ev:
        return {"message": "No experimental result available yet.", "results": []}
    return {"results": ev, "disclaimer": DISCLAIMER}


@router.get("/scope")
def scope():
    return {
        "disclaimer": DISCLAIMER,
        "rows": [
            {"entity": "Normal sinus-like rhythm", "role": "Detection / characterisation"},
            {"entity": "PVC / ventricular ectopy", "role": "Detection / characterisation; forecasting only if labels exist"},
            {"entity": "VT / ventricular tachyarrhythmia", "role": "PRIMARY experimental forecasting target"},
            {"entity": "VF", "role": "Optional analysis only with suitable annotated data"},
            {"entity": "AF / SVT / flutter", "role": "Not a primary forecasting target (other/non-target if present)"},
            {"entity": "Heart attack (MI)", "role": "OUT OF SCOPE"},
            {"entity": "Cardiac arrest", "role": "NOT directly predicted"},
        ],
        "note": (
            "Cardiac arrest is a clinical endpoint, whereas ventricular arrhythmias are abnormal cardiac rhythms "
            "that may contribute to cardiac arrest. This project focuses on ventricular-arrhythmia-related ECG analysis."
        ),
    }
