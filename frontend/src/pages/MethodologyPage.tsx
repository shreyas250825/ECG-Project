import { Disclaimer } from "../components/Disclaimer";

const sections = [
  ["What is ECG?", "The electrocardiogram is a time series of electrical potential differences produced by cardiac depolarisation and repolarisation, sampled at fs hertz. It is the input to this software, not a device we manufacture."],
  ["What does the system measure?", "After filtering, it estimates R-peak times, RR intervals, simple HRV-like summaries, and QRS morphology descriptors. These are computational features, not a 12-lead diagnostic report."],
  ["What is patient-specific modelling?", "A baseline feature distribution is estimated from an explicit early window of the same recording (or the same de-identified subject, when such linkage exists). Later windows are compared as deviation from that baseline, not as generic 'abnormality'."],
  ["What do we mean by cardiac digital twin?", "A compact state vector of electrical features and their trajectory. Not a 3D anatomy model and not a clinical digital twin product."],
  ["What is detection?", "A label for the rhythm pattern in the current analysis window (now). Detection indicates that the target rhythm is present in the analysed ECG according to rules or a detector trained for that task."],
  ["What is forecasting?", "Given history up to time t, estimate whether a labelled ventricular tachyarrhythmia starts within (t, t+H]. H is chosen by the experimenter."],
  ["What is ventricular arrhythmia?", "Ventricular ectopy and ventricular tachyarrhythmias arise from ventricular myocardium. This project's primary forecast target is VT/ventricular tachyarrhythmia when annotations exist. VF is optional. AF is not a primary target."],
  ["How is forecasting evaluated?", "Sensitivity, specificity, precision, F1, AUROC, AUPRC, false-alarm rate, observed lead time — only after a patient/recording-level split and labelled events. No metric is shown until an experiment is run."],
  ["Why use PYNQ/FPGA?", "To test whether deterministic DSP (initially FIR filtering) can be accelerated at the edge. Acceleration does not by itself improve medical prediction accuracy."],
  ["What the system does not claim", "It does not diagnose myocardial infarction, predict every arrhythmia, guarantee VT or arrest, provide a fixed 30-minute warning, replace ECG machines, wearables, or cardiologists, or issue treatment advice."],
];

export default function MethodologyPage() {
  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0 }}>Methodology</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
          Technical approach and scope of the research framework.
        </p>
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <Disclaimer compact />
      </div>

      {/* Pipeline summary */}
      <div
        style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-line)",
          borderRadius: "0.75rem",
          padding: "1rem 1.25rem",
          marginBottom: "1.25rem",
        }}
      >
        <p style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-muted)", margin: "0 0 0.625rem" }}>
          Research pipeline
        </p>
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", alignItems: "center" }}>
          {["Continuous ECG", "Signal processing", "Feature extraction", "Patient baseline", "Digital twin state", "Temporal analysis", "Experimental forecast"].map((s, i, arr) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <span
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-line)",
                  borderRadius: "0.375rem",
                  padding: "0.25rem 0.625rem",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                }}
              >
                {s}
              </span>
              {i < arr.length - 1 && (
                <span style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Q&A sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
        {sections.map(([t, b], i) => (
          <div
            key={t}
            style={{
              borderTop: i > 0 ? "1px solid var(--color-line)" : "none",
              padding: "1rem 0",
            }}
          >
            <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.375rem", color: "var(--color-ink)" }}>
              {t}
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", margin: 0, lineHeight: 1.65 }}>{b}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
