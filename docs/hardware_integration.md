# Hardware integration

See also `hardware/pynq/README.md`.

Environment:

```
PYNQ_ENABLE=false
PYNQ_BOARD_NAME=
PYNQ_BITSTREAM_PATH=
PYNQ_IP=
```

`ECGAccelerator` implementations:

- `SoftwareECGAccelerator` — CPU FIR (`scipy.signal.lfilter`)
- `PYNQECGAccelerator` — loads Overlay only if bitstream exists; otherwise reports software mode

Do not display 0 for unmeasured FPGA utilisation or power; the API uses `null` and the UI shows **Not measured**.
