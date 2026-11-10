import type { CardiacVisualizationState } from "../heart3d/types";
import { Disclaimer } from "../Disclaimer";

type Props = {
  viz: CardiacVisualizationState;
};

function formatTarget(t: string) {
  if (t.toLowerCase() === "vt") return "Ventricular tachyarrhythmia / VT";
  return t;
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div
      style={{
        gridColumn: wide ? "1 / -1" : undefined,
        background: "var(--color-bg)",
        border: "1px solid var(--color-line)",
        borderRadius: "0.5rem",
        padding: "0.625rem 0.75rem",
      }}
    >
      <p style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-muted)", margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: "0.875rem", fontWeight: 500, margin: "0.25rem 0 0", color: "var(--color-ink)" }}>{value}</p>
    </div>
  );
}

export function ForecastExperimentPanel({ viz }: Props) {
  return (
    <section
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: "0.75rem",
        padding: "1.125rem",
      }}
    >
      <div style={{ marginBottom: "0.875rem" }}>
        <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-muted)", margin: 0 }}>
          Forecasting experiment
        </p>
      </div>

      <div style={{ marginBottom: "0.875rem" }}>
        <Disclaimer compact />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "0.625rem",
        }}
      >
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

      <p style={{ fontSize: "0.6875rem", color: "var(--color-muted)", marginTop: "0.75rem" }}>
        Research prototype only. Model outputs are experimental estimates. Numerical forecast fields remain the evidence;
        the 3D heart is only a visual emphasis.
      </p>
    </section>
  );
}
