import type { CardiacVisualizationState } from "../heart3d/types";
import { Disclaimer } from "../Disclaimer";

type Props = {
  viz: CardiacVisualizationState;
};

export function ForecastExperimentPanel({ viz }: Props) {
  return (
    <section className="border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Forecasting experiment</h3>
      <Disclaimer compact />
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Target" value={viz.forecastTarget ? formatTarget(viz.forecastTarget) : "—"} />
        <Field
          label="Observation window"
          value={viz.observationWindowS != null ? `${(viz.observationWindowS / 60).toFixed(2)} min` : "—"}
        />
        <Field
          label="Forecast horizon"
          value={viz.forecastHorizonS != null ? `${(viz.forecastHorizonS / 60).toFixed(2)} min` : "—"}
        />
        <Field label="Model status" value={viz.modelAvailable ? "Trained / available" : "Not trained"} />
        <Field
          label="Model output"
          value={viz.forecastScore == null ? "n/a" : viz.forecastScore.toFixed(3)}
        />
        <Field
          label="Ground truth"
          value={
            viz.groundTruth == null
              ? "—"
              : viz.groundTruth === 1
                ? "Target event annotated in horizon"
                : "No target event in horizon"
          }
        />
        <Field
          label="Observed lead time"
          value={viz.leadTimeSeconds == null ? "n/a" : `${viz.leadTimeSeconds.toFixed(1)} s`}
        />
        <Field label="Status detail" value={viz.forecastStatus} wide />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Research prototype only. Model outputs are experimental estimates and are not clinical diagnoses. Numerical
        forecast fields remain the evidence; the 3D heart is only a visual emphasis.
      </p>
    </section>
  );
}

function formatTarget(t: string) {
  if (t.toLowerCase() === "vt") return "Ventricular tachyarrhythmia / VT";
  return t;
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2 lg:col-span-3" : ""}>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-slate-800">{value}</p>
    </div>
  );
}
