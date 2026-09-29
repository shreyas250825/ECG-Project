# PYNQ / FPGA integration

This folder is the hardware interface for optional ECG FIR acceleration.

The research application **must run without a PYNQ board**. Default execution is software DSP.

## Configuration

Set in `.env`:

- `PYNQ_ENABLE=false` (default)
- `PYNQ_BOARD_NAME=`
- `PYNQ_BITSTREAM_PATH=`
- `PYNQ_IP=`

## Overlay

Place bitstream (`.bit`) and hardware handoff (`.hwh`) in `overlays/` when available.
Do not claim FPGA metrics until those files are loaded and a kernel is timed on hardware.

Initial accelerator scope: **ECG FIR filtering** only. Do not map the full AI model to FPGA in this phase.

## Comparison

Software DSP vs PYNQ FPGA DSP: latency, throughput, batch size, resource utilisation when the vendor tools report it, power when measurable.

If a value is not measured, the API returns `null` and the UI shows **Not measured**.
