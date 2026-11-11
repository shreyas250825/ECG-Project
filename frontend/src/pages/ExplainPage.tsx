import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CardiologistPresentation } from "../components/dashboard/CardiologistPresentation";
import { Disclaimer } from "../components/Disclaimer";
import { EMPTY_VISUALIZATION_STATE } from "../components/heart3d/types";

const steps = [
  ["Problem", "Short-term ventricular-arrhythmia-related risk is difficult to characterise from a single snapshot ECG."],
  ["Clinical signal", "Continuous ECG is the measured input."],
  ["Research question", "Do patient-specific temporal patterns and baseline deviations carry earlier information about an evolving VT-related state?"],
  ["Method", "Quality check → filter → R-peaks → features → baseline → computational twin → experimental forecast."],
  ["Data", "Public or synthetic research recordings with provenance. No fabricated clinical patients."],
  ["Patient-specific representation", "Baseline window is explicit; deviations are not automatically 'disease'."],
  ["Forecasting experiment", "Observation window versus horizon H; labels from annotations only."],
  ["Evaluation", "Metrics appear only after an experiment. Empty otherwise."],
  ["Hardware acceleration", "Optional FIR on PYNQ; software fallback is the default."],
  ["Limitations", "See the limitations section. Prototype is not a medical device."],
];

export default function ExplainPage() {
  const [showViz, setShowViz] = useState(true);
  const viz = useMemo(() => ({ ...EMPTY_VISUALIZATION_STATE }), []);

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0 }}>Explain to cardiologist</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
          A conceptual walkthrough of the research pipeline for clinical context.
        </p>
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <Disclaimer compact />
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.875rem",
          color: "var(--color-muted)",
          cursor: "pointer",
          marginBottom: "1.25rem",
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={showViz}
          onChange={(e) => setShowViz(e.target.checked)}
          style={{ accentColor: "var(--color-teal)", cursor: "pointer" }}
        />
        Show 3D conceptual visualization (illustrative — no ECG loaded on this page)
      </label>

      {showViz && <div style={{ marginBottom: "1.25rem" }}><CardiologistPresentation viz={viz} lastRPeakMs={null} /></div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {steps.map(([t, b], i) => (
          <div
            key={t}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              borderRadius: "0.625rem",
              padding: "0.875rem 1rem",
              display: "flex",
              gap: "0.875rem",
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                minWidth: 24,
                height: 24,
                borderRadius: "50%",
                background: "rgba(13,148,136,0.1)",
                color: "var(--color-teal-dim)",
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
            <div>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-teal-dim)", margin: 0 }}>
                {t}
              </p>
              <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", margin: "0.25rem 0 0", lineHeight: 1.6 }}>{b}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Explanatory prose */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {[
          {
            title: "Why this is different from an ECG machine",
            body: "We are not developing a new ECG acquisition device. ECG is the input signal. The research contribution is the computational analysis pipeline above the ECG signal: patient-specific modelling, temporal state representation, experimental forecasting and edge acceleration.",
          },
          {
            title: "Why this is different from simple arrhythmia detection",
            body: "Detection: the event is already happening in the analysed window. Forecasting: estimate future target-event risk from preceding temporal information, for an experimental horizon H.",
          },
          {
            title: "Role of the 3D heart",
            body: "The 3D heart is a visualization layer for ECG-derived computational state. It is not a patient-specific anatomical reconstruction, physiological simulation, or clinical diagnostic model.",
          },
        ].map(({ title, body }) => (
          <div
            key={title}
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-line)",
              borderRadius: "0.625rem",
              padding: "0.875rem 1rem",
            }}
          >
            <h3 style={{ fontSize: "0.875rem", fontWeight: 700, margin: "0 0 0.375rem" }}>{title}</h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", margin: 0, lineHeight: 1.65 }}>{body}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "1.25rem" }}>
        <Link
          to="/app/research/architecture"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.875rem",
            color: "var(--color-teal)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          View interactive architecture →
        </Link>
      </div>
    </div>
  );
}
