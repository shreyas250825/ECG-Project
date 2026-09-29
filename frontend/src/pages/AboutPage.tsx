import { Disclaimer } from "../components/Disclaimer";

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl">About the project</h2>
      <Disclaimer compact />
      <dl className="grid gap-3 text-sm md:grid-cols-2">
        <div><dt className="text-slate-500">Title</dt><dd>Design and Development of a Patient-Specific Predictive Cardiac Digital Twin for Early Ventricular Arrhythmia Risk Forecasting</dd></div>
        <div><dt className="text-slate-500">Technical description</dt><dd>A Real-Time Edge-AI Framework for Personalized Analysis and Short-Term Forecasting of Ventricular Arrhythmia Risk from Continuous ECG Signals</dd></div>
        <div><dt className="text-slate-500">Team</dt><dd>Shreyas Salian, Sai Kiran S C</dd></div>
        <div><dt className="text-slate-500">Institution</dt><dd>M.S. Ramaiah University of Applied Sciences</dd></div>
        <div><dt className="text-slate-500">Supervisor</dt><dd>Mrs. Prafulla Kumari Kannagala Siddaiah</dd></div>
        <div><dt className="text-slate-500">Co-supervisor</dt><dd>Mrs. Deepthi S</dd></div>
        <div><dt className="text-slate-500">Place of work</dt><dd>RTC, Peenya</dd></div>
      </dl>
      <p className="text-sm text-slate-700">
        We are not developing a new ECG acquisition device. ECG is the input signal. The research contribution is the computational
        analysis pipeline: patient-specific modelling, temporal state representation, experimental forecasting, and optional edge acceleration.
      </p>
    </div>
  );
}
