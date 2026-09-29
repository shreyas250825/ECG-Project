# ECG Processing
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.processing.synthetic import generate_synthetic_ecg
import numpy as np
import pandas as pd

out = Path(__file__).resolve().parents[1] / "data" / "sample"
out.mkdir(parents=True, exist_ok=True)
signal, t, meta = generate_synthetic_ecg()
pd.DataFrame({"time": t, "signal": signal}).to_csv(out / "SYNTH-DEMO-001.csv", index=False)
(out / "SYNTH-DEMO-001.meta.json").write_text(
    __import__("json").dumps({k: v for k, v in meta.items() if k != "r_peak_times_s"}, indent=2),
    encoding="utf-8",
)
print("Wrote", out / "SYNTH-DEMO-001.csv")
