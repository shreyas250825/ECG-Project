import type { CardiacVisualizationState } from "../heart3d/types";

type Props = {
  viz: CardiacVisualizationState;
};

export function CardiacStatePanel({ viz }: Props) {
  const deviationColor =
    viz.baselineDeviation == null
      ? "var(--color-muted)"
      : viz.baselineDeviation < 1
        ? "#059669"
        : viz.baselineDeviation < 2
          ? "#D97706"
          : "#DC2626";

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
          Patient-specific cardiac state
        </p>
        <p style={{ fontSize: "0.6875rem", color: "var(--color-muted)", marginTop: "0.125rem" }}>
          Computational representation from ECG features — not a health score or anatomical replica
        </p>
      </div>

      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "0.875rem",
          margin: 0,
        }}
      >
        <div
          style={{
            background: "var(--color-bg)",
            border: "1px solid var(--color-line)",
            borderRadius: "0.5rem",
            padding: "0.75rem 0.875rem",
          }}
        >
          <dt style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-muted)" }}>
            Baseline
          </dt>
          <dd style={{ fontSize: "0.875rem", fontWeight: 500, margin: "0.25rem 0 0", color: "var(--color-ink)" }}>
            {viz.baselineWindowLabel ?? "No baseline learned yet"}
          </dd>
        </div>

        <div
          style={{
            background: "var(--color-bg)",
            border: "1px solid var(--color-line)",
            borderRadius: "0.5rem",
            padding: "0.75rem 0.875rem",
          }}
        >
          <dt style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-muted)" }}>
            Current state
          </dt>
          <dd style={{ fontSize: "0.875rem", fontWeight: 500, margin: "0.25rem 0 0", color: "var(--color-ink)" }}>
            {viz.currentState}
          </dd>
          <dd style={{ fontSize: "0.6875rem", color: "var(--color-muted)", margin: "0.125rem 0 0" }}>
            {viz.currentStateUpdatedAt ?? ""}
          </dd>
        </div>

        <div
          style={{
            background: "var(--color-bg)",
            border: "1px solid var(--color-line)",
            borderRadius: "0.5rem",
            padding: "0.75rem 0.875rem",
          }}
        >
          <dt style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-muted)" }}>
            Deviation
          </dt>
          <dd
            style={{
              fontSize: viz.baselineDeviation != null ? "1.375rem" : "0.875rem",
              fontWeight: 700,
              margin: "0.25rem 0 0",
              color: deviationColor,
              letterSpacing: "-0.02em",
            }}
          >
            {viz.baselineDeviation == null
              ? "Not calculated"
              : viz.baselineDeviation.toFixed(3)}
          </dd>
          {viz.baselineDeviation != null && (
            <dd style={{ fontSize: "0.6875rem", color: "var(--color-muted)", margin: "0.125rem 0 0" }}>
              RMS z-score
            </dd>
          )}
        </div>
      </dl>

      <p style={{ fontSize: "0.6875rem", color: "var(--color-muted)", marginTop: "0.75rem" }}>
        Baseline → Current State → Temporal Trajectory
      </p>
    </section>
  );
}
