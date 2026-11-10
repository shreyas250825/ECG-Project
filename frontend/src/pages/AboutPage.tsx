import { Disclaimer } from "../components/Disclaimer";

const team = [
  { role: "Researcher",     name: "Shreyas Salian" },
  { role: "Researcher",     name: "Sai Kiran S C" },
  { role: "Supervisor",     name: "Mrs. Prafulla Kumari Kannagala Siddaiah" },
  { role: "Co-supervisor",  name: "Mrs. Deepthi S" },
];

export default function AboutPage() {
  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0 }}>About &amp; People</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
          Project background, contributors, and institutional affiliation.
        </p>
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <Disclaimer compact />
      </div>

      {/* Project info */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
          marginBottom: "1.25rem",
        }}
      >
        <h3 style={{ fontSize: "0.875rem", fontWeight: 700, margin: "0 0 0.875rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-muted)" }}>
          Project
        </h3>
        <p style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0, color: "var(--color-ink)", lineHeight: 1.5 }}>
          Design and Development of a Patient-Specific Predictive Cardiac Digital Twin for Early Ventricular Arrhythmia Risk Forecasting
        </p>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.625rem" }}>
          A Real-Time Edge-AI Framework for Personalized Analysis and Short-Term Forecasting of Ventricular Arrhythmia Risk from Continuous ECG Signals
        </p>
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            background: "var(--color-bg)",
            borderRadius: "0.5rem",
            fontSize: "0.8125rem",
            color: "var(--color-muted)",
          }}
        >
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--color-ink)" }}>Institution:</strong> M.S. Ramaiah University of Applied Sciences
          </p>
          <p style={{ margin: "0.25rem 0 0" }}>
            <strong style={{ color: "var(--color-ink)" }}>Place of work:</strong> Research Technology Centre (RTC), Peenya
          </p>
        </div>
      </div>

      {/* Team */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
          marginBottom: "1.25rem",
        }}
      >
        <h3 style={{ fontSize: "0.875rem", fontWeight: 700, margin: "0 0 0.875rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-muted)" }}>
          Team
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
          {team.map(({ role, name }) => (
            <div
              key={name}
              style={{
                background: "var(--color-bg)",
                borderRadius: "0.625rem",
                padding: "0.875rem 1rem",
                border: "1px solid var(--color-line)",
              }}
            >
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-teal)", margin: 0 }}>
                {role}
              </p>
              <p style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0.25rem 0 0", color: "var(--color-ink)" }}>
                {name}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Scope note */}
      <div
        style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-line)",
          borderRadius: "0.75rem",
          padding: "1rem 1.25rem",
          fontSize: "0.8125rem",
          color: "var(--color-muted)",
          lineHeight: 1.65,
        }}
      >
        We are not developing a new ECG acquisition device. ECG is the input signal. The research contribution is the
        computational analysis pipeline: patient-specific modelling, temporal state representation, experimental forecasting,
        and optional edge acceleration. This is not a clinical device or product.
      </div>
    </div>
  );
}
