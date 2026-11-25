#!/usr/bin/env python
"""
run_classification_inference.py
--------------------------------
Runs the three XGBoost beat classifiers on the full DS2 test set
and reports actual computed metrics.

Usage:
    cd backend
    python scripts/run_classification_inference.py [--runtime native|numpy]
"""
import argparse, sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

parser = argparse.ArgumentParser()
parser.add_argument("--runtime", default="native", choices=["native","numpy"])
args = parser.parse_args()

# delegate to the full verification script
import runpy, importlib.util
spec = importlib.util.spec_from_file_location(
    "_run_inference",
    BACKEND / "scripts" / "_run_inference.py"
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
