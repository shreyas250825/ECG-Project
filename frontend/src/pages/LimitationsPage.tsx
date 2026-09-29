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
    <div className="space-y-6">
      <h2 className="text-2xl">Research limitations</h2>
      <Disclaimer compact />
      <p className="text-sm text-slate-700">These constraints are part of the scientific record, not small print.</p>
      <ol className="list-decimal space-y-3 pl-5">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
    </div>
  );
}
