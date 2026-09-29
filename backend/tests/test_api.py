from fastapi.testclient import TestClient

from app.main import app
from app.db.store import store

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["research_prototype"] is True
    assert body["not_for_clinical_diagnosis"] is True
    assert body["hardware_mode"] == "software"


def test_hardware_unavailable():
    r = client.get("/api/hardware/status")
    assert r.status_code == 200
    body = r.json()
    assert body["connection"] == "NOT CONNECTED"
    assert body["hardware_available"] is False


def test_records_and_processing():
    r = client.get("/api/records")
    assert r.status_code == 200
    recs = r.json()["records"]
    assert recs
    rid = recs[0]["id"]
    p = client.post(f"/api/processing/run?record_id={rid}")
    assert p.status_code == 200
    data = p.json()
    assert "r_peaks" in data
    assert data["record"].get("synthetic") is True
    assert "Synthetic demonstration data" in (data.get("synthetic_notice") or "")


def test_forecast_without_model_is_honest():
    rid = store.list_records()[0]["id"]
    r = client.post(
        "/api/forecast/run",
        json={"record_id": rid, "observation_s": 20, "horizon_s": 30, "target_event": "vt"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "MODEL_NOT_TRAINED"
    assert body["model_score"] is None
    assert "not a clinical" in body["disclaimer"].lower() or "Research prototype" in body["disclaimer"]


def test_evaluation_empty_or_real():
    r = client.get("/api/evaluation")
    assert r.status_code == 200
    body = r.json()
    assert "results" in body or "message" in body
