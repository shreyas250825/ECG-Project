"""CLI: train sklearn forecast baselines via the running store is not used.

Use POST /api/model/train while the API is up (in-memory store), or extend this
script to load WFDB/CSV on disk.
"""

print("Use the API: POST /api/model/train with an annotated record loaded.")
print("Temporal models live in ml/models/temporal.py and are not pretrained.")
