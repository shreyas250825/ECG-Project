import type { TwinHistoryPoint } from "../heart3d/types";

type Props = {
  history: TwinHistoryPoint[];
};

export function StateTimeline({ history }: Props) {
  if (!history.length) {
    return (
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: "0.75rem",
          padding: "1.125rem",
          fontSize: "0.8125rem",
          color: "var(--color-muted)",
        }}
      >
        No cardiac-state history available.
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: "0.75rem",
        padding: "1.125rem",
      }}
    >
      <div style={{ marginBottom: "0.875rem" }}>
        <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>Cardiac state timeline</h3>
        <p style={{ fontSize: "0.6875rem", color: "var(--color-muted)", marginTop: "0.125rem" }}>
          From stored digital_twin_states · not synthetic history
        </p>
      </div>

      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          borderLeft: "2px solid var(--color-line)",
          paddingLeft: "1rem",
          marginLeft: "0.4rem",
        }}
      >
        <li style={{ position: "relative", paddingBottom: "0.75rem" }}>
          <span
            style={{
              position: "absolute",
              left: "-1.3rem",
              top: "0.25rem",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#CBD5E1",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Baseline</span>
        </li>

        {history.map((h, i) => {
          const isLatest = i === history.length - 1;
          const deviationColor =
            h.deviation_score == null
              ? "var(--color-muted)"
              : h.deviation_score < 1
                ? "#059669"
                : h.deviation_score < 2
                  ? "#D97706"
                  : "#DC2626";

          return (
            <li
              key={h.id ?? `${h.timestamp}-${i}`}
              style={{
                position: "relative",
                paddingBottom: i < history.length - 1 ? "0.75rem" : 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "-1.375rem",
                  top: "0.3rem",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: isLatest ? "var(--color-teal)" : "#CBD5E1",
                  display: "inline-block",
                  border: isLatest ? "2px solid rgba(13,148,136,0.25)" : "none",
                }}
              />
              <p style={{ fontSize: "0.875rem", fontWeight: 600, margin: 0, color: deviationColor }}>
                {h.label}
              </p>
              <p style={{ fontSize: "0.6875rem", color: "var(--color-muted)", margin: "0.125rem 0 0" }}>
                t = {h.timestamp.toFixed(1)} s
                {h.deviation_score != null ? ` · deviation ${h.deviation_score.toFixed(3)}` : ""}
                {isLatest ? " · Current state" : ""}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
