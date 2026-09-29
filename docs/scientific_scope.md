# Scientific scope

This repository is a **research prototype**, not a medical device.

## In scope

- Single-lead (or selected-lead) ECG signal processing
- Computational detection categories: sinus-like, ventricular ectopy-like, VT-like, VF candidate only with caution
- Experimental forecasting of **labelled ventricular tachyarrhythmia** when annotations exist
- Patient-specific baseline and a **computational** (not anatomical) digital twin
- Optional PYNQ acceleration of deterministic FIR DSP

## Out of scope

- Diagnosis of myocardial infarction
- Prediction of cardiac arrest as a clinical endpoint
- Guaranteed warning time (including 30 minutes)
- Replacement of ECG machines, Holter/wearables, or cardiologists
- Treatment recommendations

Language: estimated risk, model output, experimental forecasting, target ventricular arrhythmia event, insufficient evidence, not a clinical diagnosis.
