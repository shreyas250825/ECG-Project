"""
Model registry — loads and caches all three XGBoost beat-classification models.

Models are loaded once at startup and served from memory.
Two runtimes are supported:
  - native: xgboost.Booster.inplace_predict  (desktop, requires xgboost package)
  - numpy:  pure-NumPy tree traversal from model_runtime.py  (portable, ARM/PYNQ)

The registry is a singleton; call get_registry() to obtain it.
"""
from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any

import numpy as np

log = logging.getLogger(__name__)

# Package location — discovered at import time relative to this file
_BACKEND_ROOT = Path(__file__).resolve().parents[3]
_PKG_DIR = _BACKEND_ROOT / "cardiac_pynq_direct_jupyter_package_20261124_162613"

# Model specs: (model_key, json_name, runtime_name, task)
_MODEL_SPECS = [
    ("four_class",   "xgb_4class_aami.json",   "xgb_4class_aami.runtime.json",  "multiclass"),
    ("three_class",  "xgb_3class_nsv.json",     "xgb_3class_nsv.runtime.json",   "multiclass"),
    ("binary",       "xgb_binary_nv.json",      "xgb_binary_nv.runtime.json",    "binary"),
]

CLASS_LABELS = {
    "four_class":  {0: "N", 1: "S", 2: "V", 3: "F"},
    "three_class": {0: "N", 1: "S", 2: "V"},
    "binary":      {0: "N", 1: "V"},
}


class ModelEntry:
    """Holds a single loaded model in both runtimes."""

    def __init__(self, key: str, model_json: dict, meta: dict,
                 booster: Any | None, pkg_dir: Path) -> None:
        self.key        = key
        self.model_json = model_json   # raw dict for numpy runtime
        self.meta       = meta
        self.booster    = booster      # xgboost.Booster or None
        self.pkg_dir    = pkg_dir
        self.task       = meta["task"]
        self.classes    = meta["classes"]
        self.base_margin = np.array(meta["base_margin"], dtype=np.float64)
        self.binary_threshold = float(meta.get("binary_threshold") or 0.5)
        self.feature_count = int(meta["feature_count"])
        self.labels     = CLASS_LABELS[key]

    # ── NumPy runtime ────────────────────────────────────────────────────────
    def predict_numpy(self, X: np.ndarray, batch_size: int = 1024) -> tuple[np.ndarray, np.ndarray]:
        """Pure-NumPy inference.  Returns (predictions, probabilities)."""
        import sys
        sys.path.insert(0, str(self.pkg_dir))
        from model_runtime import predict as _predict
        return _predict(self.model_json, self.meta, X, batch_size=batch_size)

    # ── Native XGBoost runtime ───────────────────────────────────────────────
    def predict_native(self, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Native XGBoost inference using xgboost.Booster."""
        if self.booster is None:
            raise RuntimeError("Native XGBoost not available for this model.")
        import xgboost as xgb
        dmat = xgb.DMatrix(X.astype(np.float32))
        raw = self.booster.inplace_predict(X.astype(np.float32))
        # raw is (n, n_classes) for multiclass or (n,) for binary
        if self.task == "binary":
            probs = np.column_stack([1.0 - raw, raw])
            preds = (raw >= self.binary_threshold).astype(np.int64)
        else:
            if raw.ndim == 1:
                # shouldn't happen for multi-class but guard anyway
                raw = raw.reshape(-1, len(self.classes))
            probs = raw
            preds = np.argmax(raw, axis=1).astype(np.int64)
        return preds, probs.astype(np.float32)

    def predict(self, X: np.ndarray, runtime: str = "native",
                batch_size: int = 1024) -> tuple[np.ndarray, np.ndarray]:
        """Dispatch to the requested runtime."""
        X = np.asarray(X, dtype=np.float32)
        if X.ndim != 2 or X.shape[1] != self.feature_count:
            raise ValueError(
                f"Expected shape (n, {self.feature_count}), got {X.shape}"
            )
        if runtime == "native" and self.booster is not None:
            return self.predict_native(X)
        return self.predict_numpy(X, batch_size=batch_size)

    def status(self) -> dict:
        return {
            "key": self.key,
            "task": self.task,
            "classes": self.classes,
            "feature_count": self.feature_count,
            "binary_threshold": self.binary_threshold if self.task == "binary" else None,
            "native_available": self.booster is not None,
            "numpy_available": True,
            "max_validation_margin_error": self.meta.get("max_validation_margin_error"),
        }


class ModelRegistry:
    """Singleton registry of all three beat-classification models."""

    def __init__(self) -> None:
        self._models: dict[str, ModelEntry] = {}
        self._loaded = False
        self._load_time: float | None = None

    def load(self, pkg_dir: Path | None = None) -> None:
        """Load all models. Safe to call multiple times (idempotent)."""
        if self._loaded:
            return
        pkg = pkg_dir or _PKG_DIR
        if not pkg.exists():
            raise FileNotFoundError(
                f"Model package directory not found: {pkg}\n"
                "Expected: cardiac_pynq_direct_jupyter_package_20261124_162613"
            )

        # Try to import xgboost for native inference
        try:
            import xgboost as xgb
            native_ok = True
        except ImportError:
            xgb = None
            native_ok = False
            log.warning("xgboost not installed — native runtime unavailable; using numpy runtime only.")

        t0 = time.perf_counter()
        for key, json_name, runtime_name, task in _MODEL_SPECS:
            json_path = pkg / json_name
            runtime_path = pkg / runtime_name
            if not json_path.exists() or not runtime_path.exists():
                log.error("Missing model file(s): %s / %s", json_path, runtime_path)
                continue

            model_json = json.loads(json_path.read_text())
            meta = json.loads(runtime_path.read_text())

            booster = None
            if native_ok:
                try:
                    booster = xgb.Booster()
                    booster.load_model(str(json_path))
                except Exception as e:
                    log.warning("Failed to load %s as native booster: %s", key, e)
                    booster = None

            self._models[key] = ModelEntry(
                key=key, model_json=model_json, meta=meta,
                booster=booster, pkg_dir=pkg,
            )
            log.info("Loaded model: %s (native=%s)", key, booster is not None)

        self._load_time = time.perf_counter() - t0
        self._loaded = True
        log.info("Model registry loaded %d models in %.3fs", len(self._models), self._load_time)

    def get(self, key: str) -> ModelEntry:
        if not self._loaded:
            self.load()
        if key not in self._models:
            raise KeyError(f"Model '{key}' not in registry. Available: {list(self._models)}")
        return self._models[key]

    def all_keys(self) -> list[str]:
        return list(self._models.keys())

    def status_all(self) -> dict:
        if not self._loaded:
            self.load()
        return {
            "loaded": self._loaded,
            "load_time_s": self._load_time,
            "models": {k: v.status() for k, v in self._models.items()},
        }

    @property
    def loaded(self) -> bool:
        return self._loaded


_registry: ModelRegistry | None = None


def get_registry() -> ModelRegistry:
    """Return the global registry, loading on first call."""
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
        _registry.load()
    return _registry
