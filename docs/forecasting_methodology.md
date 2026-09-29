# Forecasting methodology

## Detection vs forecasting

- **Detection**: pattern present in the analysed window.
- **Forecasting**: using only data before time `t`, estimate whether a target event starts in `(t, t+H]`.

## Windows

- Observation window: `[t − T_obs, t)`
- Horizon H: experimental (UI suggests 5, 10, 20, 30 min). These are not guaranteed warning times.

## Labels

Positive: at least one target annotation start in the horizon. Negative: none.

## Splits

Recording-level (or patient-level when IDs exist). Overlapping windows from the same recording must not appear in both train and test.

## Outputs

Never “VT will occur.” Report model score if a model exists, evidence status from configured thresholds, ground truth if labelled, observed lead time if an event is in H. If untrained: “Model not trained on this dataset.” If features are poor: “Insufficient evidence for reliable forecasting.”
