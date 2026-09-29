import numpy as np
import pytest

from app.forecasting.labels import make_forecast_labels, recording_level_split
from app.hardware.software import SoftwareECGAccelerator
from app.processing.features import extract_features
from app.processing.preprocess import PreprocessParams, preprocess_ecg
from app.processing.rpeaks import compute_hr, compute_rr_intervals, detect_r_peaks
from app.processing.synthetic import generate_synthetic_ecg
from app.digital_twin.baseline import create_baseline


def test_preprocess_finite():
    x, _, _ = generate_synthetic_ecg(duration_s=10, insert_vt_at_s=None)
    y = preprocess_ecg(x, PreprocessParams(fs=250))
    assert np.all(np.isfinite(y))
    assert len(y) == len(x)


def test_rpeak_reasonable_count():
    x, _, meta = generate_synthetic_ecg(duration_s=20, insert_vt_at_s=None, seed=1)
    fs = meta["sampling_rate"]
    y = preprocess_ecg(x, PreprocessParams(fs=fs))
    peaks = detect_r_peaks(y, fs)
    expected = 20 * 72 / 60
    assert 0.5 * expected < len(peaks) < 1.8 * expected


def test_rr_and_hr():
    peaks = np.array([0, 250, 500, 750])
    rr = compute_rr_intervals(peaks, 250)
    assert np.allclose(rr, [1, 1, 1])
    assert compute_hr(rr) == pytest.approx(60.0)


def test_features_have_keys():
    x, _, meta = generate_synthetic_ecg(duration_s=30, insert_vt_at_s=None)
    fs = meta["sampling_rate"]
    y = preprocess_ecg(x, PreprocessParams(fs=fs))
    peaks = detect_r_peaks(y, fs)
    fv = extract_features(y, fs, peaks)
    assert "heart_rate_bpm" in fv.values
    assert fv.n_beats == len(peaks)


def test_baseline_no_future():
    x, _, meta = generate_synthetic_ecg(duration_s=80, insert_vt_at_s=None)
    fs = meta["sampling_rate"]
    bl = create_baseline(x, fs, "r", 0.0, 40.0, 15.0, 10.0)
    assert bl.window_end_s == 40.0
    assert bl.n_windows >= 2


def test_forecast_labels_no_leakage_definition():
    anns = [{"event_type": "vt", "start_time": 100.0, "end_time": 110.0}]
    ex = make_forecast_labels("r", 180.0, anns, "vt", observation_s=20.0, horizon_s=30.0, step_s=10.0)
    pos = [e for e in ex if e.label == 1]
    assert pos
    for e in pos:
        assert e.observation_end_s == e.prediction_time_s
        assert e.lead_time_s is not None
        assert 0 < e.lead_time_s <= 30.0
        # event is after prediction time
        assert e.prediction_time_s < 100.0 <= e.prediction_time_s + 30.0


def test_recording_level_split():
    train, test = recording_level_split(["a", "b", "c", "d"], 0.5, seed=0)
    assert set(train).isdisjoint(test)
    assert set(train + test) == {"a", "b", "c", "d"}


def test_hardware_software_fallback():
    acc = SoftwareECGAccelerator()
    st = acc.status()
    assert st.mode == "software"
    assert st.hardware_available is False
    x = np.random.randn(1000)
    y = acc.preprocess_ecg(x, 250.0)
    assert len(y) == len(x)
    b = acc.benchmark(x, 250.0, repeats=2)
    assert b.latency_ms is not None and b.latency_ms > 0
    assert b.resource_utilization is None
    assert b.power is None
