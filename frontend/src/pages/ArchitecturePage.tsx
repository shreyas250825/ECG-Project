import { Disclaimer } from "../components/Disclaimer";

const nodes = [
  { id: "ecg", label: "ECG INPUT", tag: "SIGNAL" },
  { id: "sq", label: "Signal quality check", tag: "DSP" },
  { id: "pre", label: "Preprocessing", tag: "DSP" },
  { id: "sw", label: "SOFTWARE DSP", tag: "SOFTWARE" },
  { id: "fpga", label: "PYNQ FPGA DSP", tag: "PYNQ / FPGA" },
  { id: "feat", label: "Feature extraction", tag: "DSP" },
  { id: "base", label: "Patient-specific baseline", tag: "TWIN" },
  { id: "twin", label: "Digital twin state", tag: "TWIN" },
  { id: "hist", label: "Temporal state history", tag: "AI" },
  { id: "ai", label: "Temporal AI / baseline ML", tag: "AI" },
  { id: "fc", label: "Experimental VA risk forecast", tag: "AI" },
  { id: "ui", label: "Dashboard", tag: "FRONTEND" },
];

export default function ArchitecturePage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl">System architecture</h2>
      <Disclaimer compact />
      <p className="text-sm text-slate-600">Layers: FRONTEND · DATABASE (optional Supabase) · AI · SOFTWARE DSP · PYNQ/FPGA (optional).</p>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-1 text-center text-sm">
        {nodes.map((n, i) => (
          <div key={n.id} className="w-full">
            <div className="border border-slate-300 bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-teal-800">{n.tag}</div>
              <div>{n.label}</div>
            </div>
            {i === 2 && (
              <div className="my-2 grid grid-cols-2 gap-2">
                <div className="border border-dashed border-slate-400 bg-slate-50 px-2 py-3">SOFTWARE DSP</div>
                <div className="border border-dashed border-slate-400 bg-slate-50 px-2 py-3">PYNQ FPGA DSP</div>
              </div>
            )}
            {n.id !== "sw" && n.id !== "fpga" && i < nodes.length - 1 && n.id !== "pre" && <div className="py-0.5 text-slate-400">↓</div>}
            {n.id === "pre" && <div className="py-0.5 text-slate-400">↓ splits ↓</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
