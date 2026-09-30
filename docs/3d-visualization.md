# 3D cardiac visualization

The Research Dashboard (`/dashboard`) adds an interactive WebGL heart as a **visualization layer** on top of existing ECG → digital twin → forecast pipelines.

## Stack

- React + Vite + TypeScript
- Three.js via `@react-three/fiber` and `@react-three/drei`
- Modular components under `frontend/src/components/heart3d/`

## Data flow

```
ECG processor (FastAPI)
    → analysis / twin / forecast JSON
    → React state
    → CardiacVisualizationState (derived; never invented)
    → HeartScene
```

The 3D layer **consumes** metrics. It does not compute HR, risk, or diagnoses.

## Modes

1. **Anatomical visualization** — educational labels; explicitly not patient-specific.
2. **ECG-derived computational state visualization** — material/pulse emphasis from research visualization states (`STABLE`, `DEVIATION`, …).

## Pulse / R-peak sync

- Pulse interval = `60 / heartRate` only when ECG-derived HR is available.
- Dashboard “Sync replay” walks real `r_peaks.times_s` and triggers a brief visual boost — not a physiological contraction simulation.

## Demo

1. Start backend and frontend (see root README).
2. Open http://localhost:5173/dashboard
3. Select `SYNTH-DEMO-001` → **Run ECG analysis**.
4. **Learn baseline** → **Update twin state**.
5. Optionally train + run forecast.
6. **Sync replay** to see ECG cursor and heart pulse on measured R-peaks.
7. Toggle Anatomy vs Cardiac State; orbit/zoom/pan; reset camera.

Enable **Explain to cardiologist** in the header for the conceptual pipeline layout with the heart between twin and temporal AI.

## Asset

Primary mesh: textured FBX at `frontend/public/models/realistic-human-heart/`. If it fails to load, a procedural mesh is used.

Licensing: `docs/3d-heart-assets.md`.
