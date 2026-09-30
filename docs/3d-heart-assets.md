# 3D heart assets

The Research Dashboard uses a **visualization-only** 3D heart. It is **not** a patient-specific anatomical reconstruction from ECG.

## Default model (shipped)

| Field | Value |
| --- | --- |
| Type | Textured FBX anatomical heart |
| Path | `frontend/public/models/realistic-human-heart/Heart.fbx` |
| Textures | `frontend/public/models/realistic-human-heart/textures/` (base color, normal, roughness, metalness) |
| Source package | `realistic-human-heart/` at the repository root (source FBX + original texture names) |
| Runtime component | `frontend/src/components/heart3d/RealisticHeart.tsx` |
| Notes | Illustrative visualization of ECG-derived computational state. **Not** reconstructed from the patient's ECG. Pulse timing is visualization only. |

If the FBX cannot be loaded, the dashboard falls back to the procedural mesh in `HeartModel.tsx`. If WebGL fails entirely, the UI shows: **“3D anatomical model unavailable.”** It does not substitute a fake clinical image.

### Attribution / license

Fill this in from the package you obtained (Sketchfab / vendor page). Do not assume a license.

| Field | Value |
| --- | --- |
| Source | User-supplied `realistic-human-heart` package |
| Author | See original download / Sketchfab listing |
| License | **Must match the terms of the downloaded package** |
| Attribution | Follow the author's required credit line |

Redistribute the mesh only if the original license allows it.

## Optional external GLB / GLTF

An extra GLB at `frontend/public/models/heart.glb` is optional. The dashboard currently prefers the realistic FBX above.

## Compression

The FBX is a mid-poly textured mesh. If it becomes too heavy, convert to Draco-compressed GLB and keep the same texture maps.
