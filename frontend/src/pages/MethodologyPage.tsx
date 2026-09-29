import { Disclaimer } from "../components/Disclaimer";

const sections = [
  ["What is ECG?", "The electrocardiogram is a time series of electrical potential differences produced by cardiac depolarisation and repolarisation, sampled at fs hertz. It is the input to this software, not a device we manufacture."],
  ["What does the system measure?", "After filtering, it estimates R-peak times, RR intervals, simple HRV-like summaries, and QRS morphology descriptors. These are computational features, not a 12-lead diagnostic report."],
  ["What is patient-specific modelling?", "A baseline feature distribution is estimated from an explicit early window of the same recording (or the same de-identified subject, when such linkage exists). Later windows are compared as deviation from that baseline, not as generic ‘abnormality’."],
  ["What do we mean by cardiac digital twin?", "A compact state vector of electrical features and their trajectory. Not a 3D anatomy model and not a clinical digital twin product."],
  ["What is detection?", "A label for the rhythm pattern in the current analysis window (now). Detection indicates that the target rhythm is present in the analysed ECG according to rules or a detector trained for that task."],
  ["What is forecasting?", "Given history up to time t, estimate whether a labelled ventricular tachyarrhythmia starts within (t, t+H]. H is chosen by the experimenter."],
  ["What is ventricular arrhythmia?", "Ventricular ectopy and ventricular tachyarrhythmias arise from ventricular myocardium. This project’s primary forecast target is VT/ventricular tachyarrhythmia when annotations exist. VF is optional. AF is not a primary target."],
  ["How is forecasting evaluated?", "Sensitivity, specificity, precision, F1, AUROC, AUPRC, false-alarm rate, observed lead time — only after a patient/recording-level split and labelled events. No metric is shown until an experiment is run."],
  ["Why use PYNQ/FPGA?", "To test whether deterministic DSP (initially FIR filtering) can be accelerated at the edge. Acceleration does not by itself improve medical prediction accuracy."],
  ["What the system does not claim", "It does not diagnose myocardial infarction, predict every arrhythmia, guarantee VT or arrest, provide a fixed 30-minute warning, replace ECG machines, wearables, or cardiologists, or issue treatment advice."],
];

export default function MethodologyPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl">Methodology</h2>
      <Disclaimer compact />
      <ol className="space-y-1 border border-slate-200 bg-white p-4 text-sm">
        {["Continuous ECG", "Signal processing", "Feature extraction", "Patient baseline", "Digital twin state", "Temporal analysis", "Experimental forecast"].map((s, i) => (
          <li key={s}>{i + 1}. {s} {i < 6 ? "→" : ""}</li>
        ))}
      </ol>
      {sections.map(([t, b]) => (
        <section key={t} className="border-t border-slate-200 pt-4">
          <h3 className="text-lg">{t}</h3>
          <p className="mt-2 text-slate-700">{b}</p>
        </section>
      ))}
    </div>
  );
}
