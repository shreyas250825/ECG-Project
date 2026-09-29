import { Link } from "react-router-dom";
import { Disclaimer } from "../components/Disclaimer";

const steps = [
  ["Problem", "Short-term ventricular-arrhythmia-related risk is difficult to characterise from a single snapshot ECG."],
  ["Clinical signal", "Continuous ECG is the measured input."],
  ["Research question", "Do patient-specific temporal patterns and baseline deviations carry earlier information about an evolving VT-related state?"],
  ["Method", "Quality check → filter → R-peaks → features → baseline → computational twin → experimental forecast."],
  ["Data", "Public or synthetic research recordings with provenance. No fabricated clinical patients."],
  ["Patient-specific representation", "Baseline window is explicit; deviations are not automatically ‘disease’."],
  ["Forecasting experiment", "Observation window versus horizon H; labels from annotations only."],
  ["Evaluation", "Metrics appear only after an experiment. Empty otherwise."],
  ["Hardware acceleration", "Optional FIR on PYNQ; software fallback is the default."],
  ["Limitations", "See the limitations page. Prototype is not a medical device."],
];

export default function ExplainPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl">Explain to cardiologist</h2>
      <Disclaimer compact />
      <ol className="space-y-3">
        {steps.map(([t, b], i) => (
          <li key={t} className="border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase text-teal-800">{i + 1}. {t}</p>
            <p className="mt-1">{b}</p>
          </li>
        ))}
      </ol>
      <section className="space-y-2 text-sm">
        <h3 className="text-lg">Why this is different from an ECG machine</h3>
        <p>
          We are not developing a new ECG acquisition device. ECG is the input signal. The research contribution is the
          computational analysis pipeline above the ECG signal: patient-specific modelling, temporal state representation,
          experimental forecasting and edge acceleration.
        </p>
        <h3 className="text-lg">Why this is different from simple arrhythmia detection</h3>
        <p>Detection: the event is already happening in the analysed window.</p>
        <p>Forecasting: estimate future target-event risk from preceding temporal information, for an experimental horizon H.</p>
      </section>
      <Link className="inline-block bg-teal-800 px-4 py-2 text-sm text-white" to="/architecture">
        Interactive architecture
      </Link>
    </div>
  );
}
