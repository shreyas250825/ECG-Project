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
  ["Patient-specific representation", "Baseline window is explicit; deviations are not automatically ‘disease’."],
  ["Forecasting experiment", "Observation window versus horizon H; labels from annotations only."],
  ["Evaluation", "Metrics appear only after an experiment. Empty otherwise."],
  ["Hardware acceleration", "Optional FIR on PYNQ; software fallback is the default."],
  ["Limitations", "See the limitations page. Prototype is not a medical device."],
];

export default function ExplainPage() {
  const [showViz, setShowViz] = useState(true);
  const viz = useMemo(() => ({ ...EMPTY_VISUALIZATION_STATE }), []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl">Explain to cardiologist</h2>
      <Disclaimer compact />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showViz} onChange={(e) => setShowViz(e.target.checked)} />
        Show 3D conceptual visualization (illustrative; no ECG loaded on this page)
      </label>
      {showViz && <CardiologistPresentation viz={viz} lastRPeakMs={null} />}
      <ol className="space-y-3">
        {steps.map(([t, b], i) => (
          <li key={t} className="border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase text-teal-800">
              {i + 1}. {t}
            </p>
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
        <h3 className="text-lg">Role of the 3D heart</h3>
        <p>
          The 3D heart is a visualization layer for ECG-derived computational state. It is not a patient-specific anatomical
          reconstruction, physiological simulation, or clinical diagnostic model. Live synchronized demo:{" "}
          <Link className="text-teal-800 underline" to="/dashboard">
            Research Dashboard
          </Link>
          .
        </p>
      </section>
      <Link className="inline-block bg-teal-800 px-4 py-2 text-sm text-white" to="/architecture">
        Interactive architecture
      </Link>
    </div>
  );
}
