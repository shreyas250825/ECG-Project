import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Disclaimer } from "../components/Disclaimer";
import { HeartScene } from "../components/heart3d/HeartScene";
import { deriveCardiacVisualizationState } from "../components/heart3d/deriveVisualizationState";
import { api } from "../services/api";
import type { ResearchRecord } from "../types/research";

export default function TwinPage() {
  const recordsQ = useQuery({ queryKey: ["records"], queryFn: api.records });
  const records: ResearchRecord[] = recordsQ.data?.records ?? [];
  const [rid, setRid] = useState("");
  const selected = rid || records[0]?.id || "";
  const [end, setEnd] = useState(60);
  const bl = useMutation({
    mutationFn: () => api.baseline({ record_id: selected, window_start_s: 0, window_end_s: 60 }),
  });
  const tw = useMutation({
    mutationFn: () => api.twin({ record_id: selected, timestamp_s: end, window_s: 20 }),
  });
  const state = tw.data?.state_vector as Record<string, number> | undefined;
  const dev = tw.data?.deviation as Record<string, number> | undefined;
  const chart = state
    ? Object.keys(state).map((k) => ({ name: k, current: state[k], deviation: dev?.[k] ?? 0 }))
    : [];

  const viz = useMemo(
    () =>
      deriveCardiacVisualizationState({
        analysis: tw.data
          ? {
              heart_rate_bpm:
                typeof tw.data.state_vector?.heart_rate_bpm === "number"
                  ? tw.data.state_vector.heart_rate_bpm
                  : null,
            }
          : null,
        twin: tw.data ?? null,
        forecast: null,
        modelTrained: false,
      }),
    [tw.data],
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl">Patient-specific computational digital twin</h2>
      <Disclaimer compact />
      <p className="max-w-3xl text-sm text-slate-700">
        A patient-specific computational representation of cardiac electrical characteristics derived from ECG features and their
        temporal evolution. This is not an anatomical 3D heart, electrophysiology solver, or clinical digital twin. The optional
        visualization on the{" "}
        <Link className="text-teal-800 underline" to="/dashboard">
          Research Dashboard
        </Link>{" "}
        is illustrative only.
      </p>
      <select className="border p-2 text-sm" value={selected} onChange={(e) => setRid(e.target.value)}>
        {records.map((r) => (
          <option key={r.id} value={r.id}>
            {r.record_name}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <button className="bg-teal-800 px-3 py-2 text-sm text-white" type="button" onClick={() => bl.mutate()}>
          Learn baseline (0–60 s)
        </button>
        <label className="text-sm">
          Current window end (s)
          <input className="ml-2 border p-1" type="number" value={end} onChange={(e) => setEnd(Number(e.target.value))} />
        </label>
        <button className="border px-3 py-2 text-sm" type="button" onClick={() => tw.mutate()}>
          Update twin state
        </button>
      </div>
      {bl.error && <p className="text-sm text-red-800">{(bl.error as Error).message}</p>}
      {tw.error && <p className="text-sm text-red-800">{(tw.error as Error).message}</p>}
      {bl.data && (
        <p className="text-sm text-slate-600">
          Baseline windows used: {bl.data.n_windows}. Language: deviation from learned baseline — not “pathology”.
        </p>
      )}
      {tw.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="border bg-white p-4 text-sm">
              <p>Deviation score (RMS of z-scores): {tw.data.deviation_score ?? "n/a (no baseline)"}</p>
              <ul className="mt-2 text-xs">
                {tw.data.notes?.map((n: string) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
            <div className="h-64 border bg-white p-2">
              <ResponsiveContainer>
                <BarChart data={chart}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="deviation" fill="#1f6f7a" name="Baseline deviation (z)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <HeartScene viz={viz} lastRPeakMs={null} compact />
        </div>
      )}
    </div>
  );
}
