import type { CardiacVisualizationState } from "./types";

type Props = {
  viz: CardiacVisualizationState;
};

export function HeartState({ viz }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
      <Metric label="Heart rate" value={viz.heartRate == null ? "Waiting for ECG data" : `${viz.heartRate.toFixed(1)} bpm`} />
      <Metric
        label="Signal quality"
        value={viz.signalQuality == null ? "Waiting for ECG data" : viz.signalQuality.toFixed(2)}
      />
      <Metric
        label="Baseline deviation"
        value={viz.baselineDeviation == null ? "n/a (no baseline)" : viz.baselineDeviation.toFixed(3)}
      />
      <Metric label="Current state" value={viz.currentState} />
      <Metric label="Forecast status" value={viz.forecastStatus} wide />
      <Metric label="Research viz state" value={viz.vizState.replaceAll("_", " ")} />
    </div>
  );
}

function Metric({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`border border-slate-200/80 bg-white/70 px-2 py-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-slate-800">{value}</p>
    </div>
  );
}
