import { Disclaimer } from "../components/Disclaimer";

const items = [
  "Limited size and diversity of available annotated datasets.",
  "Arrhythmias do not always have a predictable ECG precursor.",
  "Model performance may differ across patients.",
  "Forecasting horizon is an experimental result, not an assumption.",
  "Clinical deployment requires external/prospective validation.",
  "This research prototype is not a medical device.",
  "Patient-specific modelling depends on sufficient baseline ECG.",
  "FPGA acceleration does not itself improve medical prediction accuracy.",
];

export default function LimitationsPage() {
  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0 }}>Research limitations</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
          These constraints are part of the scientific record, not small print.
        </p>
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <Disclaimer compact />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {items.map((t, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: "0.875rem",
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              borderRadius: "0.625rem",
              padding: "0.875rem 1rem",
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                minWidth: 24,
                height: 24,
                borderRadius: "50%",
                background: "rgba(217,119,6,0.1)",
                color: "#B45309",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.6875rem",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <p style={{ fontSize: "0.875rem", margin: 0, lineHeight: 1.6, color: "var(--color-ink)" }}>{t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
