"""Training utilities. Prefer sklearn baselines before temporal nets."""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

# Scripts import FastAPI services when run from repo root:
#   python -m ml.training.train_baselines
