import { HeartScene } from "../heart3d/HeartScene";
import type { CardiacVisualizationState } from "../heart3d/types";

const PIPE_LEFT = ["ECG", "Signal Processing", "Features", "Patient Baseline", "Digital Twin State"];
const PIPE_RIGHT = ["Temporal AI", "Experimental Forecast"];

type Props = {
  lastRPeakMs: number | null;
  viz: CardiacVisualizationState;
};

/**
 * “Explain to Cardiologist” presentation: pipeline with 3D heart between twin and temporal AI.
 */
export function CardiologistPresentation({ viz, lastRPeakMs }: Props) {
  return (
    <section className="border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
      <h3 className="text-lg text-slate-900">Explain to cardiologist — conceptual pipeline</h3>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        The 3D heart sits as a visualization of patient-specific computational state between baseline/twin and temporal
        forecasting. It is not an electrophysiology simulation.
      </p>
      <div className="mt-6 grid items-center gap-4 lg:grid-cols-[1fr_minmax(240px,38%)_1fr]">
        <ol className="space-y-2 text-sm">
          {PIPE_LEFT.map((step, i) => (
            <li key={step} className="border border-slate-200 bg-white px-3 py-2">
              <span className="text-xs text-slate-400">{i + 1}</span>
              <div className="font-medium">{step}</div>
              {i < PIPE_LEFT.length - 1 && <div className="text-xs text-slate-400">↓</div>}
            </li>
          ))}
        </ol>
        <div>
          <p className="mb-2 text-center text-xs uppercase tracking-wide text-teal-800">
            Patient-specific baseline → Cardiac digital twin
          </p>
          <HeartScene viz={viz} lastRPeakMs={lastRPeakMs} compact />
          <p className="mt-2 text-center text-xs uppercase tracking-wide text-teal-800">Temporal AI → Forecast</p>
        </div>
        <ol className="space-y-2 text-sm">
          {PIPE_RIGHT.map((step, i) => (
            <li key={step} className="border border-slate-200 bg-white px-3 py-2">
              <span className="text-xs text-slate-400">{PIPE_LEFT.length + i + 1}</span>
              <div className="font-medium">{step}</div>
              {i < PIPE_RIGHT.length - 1 && <div className="text-xs text-slate-400">↓</div>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
