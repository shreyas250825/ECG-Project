import { Link } from "react-router-dom";
import { PrototypeBadges } from "../components/Disclaimer";
import { useUI } from "../stores/ui";

const PIPE = [
  "ECG",
  "Quality Assessment",
  "Preprocessing",
  "Feature Extraction",
  "Patient Baseline",
  "Cardiac Digital Twin",
  "Temporal AI",
  "Experimental Forecast",
];

export default function LandingPage() {
  const { cardiologistMode } = useUI();
  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-3xl text-slate-900">Patient-Specific Predictive Cardiac Digital Twin</h2>
        <p className="mt-3 max-w-3xl text-lg text-slate-600">
          A real-time research framework for personalized ECG analysis and short-term ventricular arrhythmia risk forecasting.
        </p>
        <div className="mt-4">
          <PrototypeBadges />
        </div>
      </section>

      {cardiologistMode && (
        <section className="border border-slate-200 bg-white p-5">
          <h3 className="text-lg">What problem are you investigating?</h3>
          <p className="mt-2 text-slate-700">
            Can patient-specific temporal ECG patterns and deviations from an individual's baseline provide an earlier indication of
            an evolving ventricular-arrhythmia-related risk state?
          </p>
        </section>
      )}

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Research pipeline</h3>
        <ol className="grid gap-2 md:grid-cols-4">
          {PIPE.map((step, i) => (
            <li key={step} className="border border-slate-200 bg-white p-3 text-sm">
              <span className="text-xs text-slate-400">{i + 1}</span>
              <div className="font-medium">{step}</div>
              {i < PIPE.length - 1 && <div className="mt-1 text-xs text-slate-400">↓</div>}
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          "Can patient-specific ECG baselines capture individual electrical characteristics?",
          "Can temporal deviations provide information about evolving ventricular-arrhythmia-related states?",
          "Can selected ECG processing operations be accelerated using PYNQ/FPGA hardware?",
        ].map((q, i) => (
          <article key={q} className="border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase text-teal-800">Research question {i + 1}</p>
            <p className="mt-2 text-slate-800">{q}</p>
          </article>
        ))}
      </section>

      <p className="text-sm text-slate-600">
        Detection is not forecasting. Detection describes the current window. Forecasting is an experimental estimate for a
        configurable horizon H (5, 10, 20, 30 minutes are evaluation settings, not guaranteed warning times).
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="bg-teal-800 px-4 py-2 text-white" to="/dashboard">
          Open research dashboard
        </Link>
        <Link className="border border-slate-300 bg-white px-4 py-2" to="/pipeline">
          Open pipeline
        </Link>
        <Link className="border border-slate-300 bg-white px-4 py-2" to="/analysis">
          Analyse ECG
        </Link>
        <Link className="border border-slate-300 bg-white px-4 py-2" to="/explain">
          Cardiologist walkthrough
        </Link>
      </div>
    </div>
  );
}
