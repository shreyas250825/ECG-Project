import { HeartScene } from "../heart3d/HeartScene";
import type { CardiacVisualizationState } from "../heart3d/types";

const PIPE_LEFT  = ["ECG", "Signal Processing", "Features", "Patient Baseline", "Digital Twin State"];
const PIPE_RIGHT = ["Temporal AI", "Experimental Forecast"];

type Props = {
  lastRPeakMs: number | null;
  viz: CardiacVisualizationState;
};

export function CardiologistPresentation({ viz, lastRPeakMs }: Props) {
  return (
    <section
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: "0.75rem",
        padding: "1.25rem",
      }}
    >
      <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
        Conceptual pipeline
      </h3>
      <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", margin: "0 0 1.25rem" }}>
        The 3D heart sits as a visualization of patient-specific computational state between baseline/twin and temporal
        forecasting. It is not an electrophysiology simulation.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr minmax(240px, 38%) 1fr",
          gap: "1rem",
          alignItems: "center",
        }}
      >
        {/* Left pipeline */}
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {PIPE_LEFT.map((step, i) => (
            <li
              key={step}
              style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-line)",
                borderRadius: "0.5rem",
                padding: "0.5rem 0.75rem",
                fontSize: "0.8125rem",
              }}
            >
              <span style={{ fontSize: "0.625rem", color: "var(--color-muted)", marginRight: "0.375rem" }}>{i + 1}</span>
              <span style={{ fontWeight: 500 }}>{step}</span>
              {i < PIPE_LEFT.length - 1 && (
                <div style={{ fontSize: "0.6875rem", color: "var(--color-muted)", marginTop: "0.125rem", paddingLeft: "1rem" }}>↓</div>
              )}
            </li>
          ))}
        </ol>

        {/* 3D heart */}
        <div>
          <p
            style={{
              textAlign: "center",
              fontSize: "0.625rem",
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--color-teal-dim)",
              marginBottom: "0.5rem",
            }}
          >
            Patient-specific baseline → Cardiac digital twin
          </p>
          <HeartScene viz={viz} lastRPeakMs={lastRPeakMs} compact />
          <p
            style={{
              textAlign: "center",
              fontSize: "0.625rem",
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--color-teal-dim)",
              marginTop: "0.5rem",
            }}
          >
            Temporal AI → Forecast
          </p>
        </div>

        {/* Right pipeline */}
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {PIPE_RIGHT.map((step, i) => (
            <li
              key={step}
              style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-line)",
                borderRadius: "0.5rem",
                padding: "0.5rem 0.75rem",
                fontSize: "0.8125rem",
              }}
            >
              <span style={{ fontSize: "0.625rem", color: "var(--color-muted)", marginRight: "0.375rem" }}>
                {PIPE_LEFT.length + i + 1}
              </span>
              <span style={{ fontWeight: 500 }}>{step}</span>
              {i < PIPE_RIGHT.length - 1 && (
                <div style={{ fontSize: "0.6875rem", color: "var(--color-muted)", marginTop: "0.125rem", paddingLeft: "1rem" }}>↓</div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
