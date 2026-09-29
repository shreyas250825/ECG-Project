import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { EcgChart } from "../charts/EcgChart";
import { Disclaimer } from "../components/Disclaimer";
import { api } from "../services/api";
import type { ResearchRecord } from "../types/research";

export default function AnalysisPage() {
  const recordsQ = useQuery({ queryKey: ["records"], queryFn: api.records });
  const records: ResearchRecord[] = recordsQ.data?.records ?? [];
  const [rid, setRid] = useState<string>("");
  const [fs, setFs] = useState(250);
  const [col, setCol] = useState("signal");
  const [tcol, setTcol] = useState("time");
  const [lead, setLead] = useState("II");
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = rid || records[0]?.id || "";

  const proc = useMutation({ mutationFn: () => api.process(selected) });
  const up = useMutation({
    mutationFn: async () => {
      const f = fileRef.current?.files?.[0];
      if (!f) throw new Error("Choose a CSV file.");
      return api.upload(f, fs, col, tcol, lead);
    },
    onSuccess: () => recordsQ.refetch(),
  });

  const data = proc.data;
  const chart = useMemo(() => {
    if (!data?.waveforms) return null;
    return {
      time: data.waveforms.time_s as number[],
      raw: data.waveforms.raw as number[],
      cleaned: data.waveforms.cleaned as number[],
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl">ECG analysis</h2>
      <Disclaimer compact />
      <p className="text-sm text-slate-600">
        Signal processing and detection only. Detection indicates that a rhythm pattern is present in the analysed window — it is not forecasting.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-3 border border-slate-200 bg-white p-4 text-sm">
          <h3 className="font-semibold">Select recording</h3>
          <select className="w-full border border-slate-300 p-2" value={selected} onChange={(e) => setRid(e.target.value)}>
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.record_name} ({r.synthetic ? "synthetic" : r.format})
              </option>
            ))}
          </select>
          <button type="button" className="bg-teal-800 px-3 py-2 text-white" onClick={() => proc.mutate()} disabled={!selected || proc.isPending}>
            {proc.isPending ? "Processing…" : "Run preprocessing + R-peaks + features"}
          </button>
          {proc.error && <p className="text-red-800">{(proc.error as Error).message}</p>}
        </section>
        <section className="space-y-3 border border-slate-200 bg-white p-4 text-sm">
          <h3 className="font-semibold">Upload CSV</h3>
          <input ref={fileRef} type="file" accept=".csv" />
          <label className="block">Sampling rate (Hz) if no time column
            <input className="mt-1 w-full border p-1" type="number" value={fs} onChange={(e) => setFs(Number(e.target.value))} />
          </label>
          <label className="block">Signal column
            <input className="mt-1 w-full border p-1" value={col} onChange={(e) => setCol(e.target.value)} />
          </label>
          <label className="block">Time column (optional)
            <input className="mt-1 w-full border p-1" value={tcol} onChange={(e) => setTcol(e.target.value)} />
          </label>
          <label className="block">Lead
            <input className="mt-1 w-full border p-1" value={lead} onChange={(e) => setLead(e.target.value)} />
          </label>
          <button type="button" className="border border-slate-300 px-3 py-2" onClick={() => up.mutate()}>
            Upload
          </button>
          {up.error && <p className="text-red-800">{(up.error as Error).message}</p>}
        </section>
      </div>
      {data?.synthetic_notice && (
        <p className="border border-slate-300 bg-slate-50 p-3 text-sm">{data.synthetic_notice}</p>
      )}
      {chart && <EcgChart time={chart.time} raw={chart.raw} cleaned={chart.cleaned} title="Raw and cleaned ECG" />}
      {data && (
        <div className="grid gap-4 md:grid-cols-2 text-sm">
          <div className="border border-slate-200 bg-white p-4">
            <h3 className="font-semibold">Measurements</h3>
            <ul className="mt-2 space-y-1">
              <li>R peaks: {data.r_peaks.count}</li>
              <li>Heart rate (from mean RR): {data.heart_rate_bpm?.toFixed?.(1) ?? "n/a"} bpm</li>
              <li>Quality: {data.signal_quality.label} (score {data.signal_quality.score.toFixed(2)})</li>
              <li>Detection label: {data.detection.label}</li>
              <li className="text-slate-600">{data.detection.note}</li>
            </ul>
          </div>
          <div className="border border-slate-200 bg-white p-4">
            <h3 className="font-semibold">Features</h3>
            <p className="text-xs text-slate-500">Each feature has units and limitations in metadata.</p>
            <ul className="mt-2 max-h-56 overflow-auto text-xs">
              {Object.entries(data.features.values as Record<string, number>).map(([k, v]) => (
                <li key={k}>
                  <span className="font-medium">{k}</span>: {Number.isFinite(v) ? v.toFixed(4) : "n/a"} {data.feature_metadata[k]?.units}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
