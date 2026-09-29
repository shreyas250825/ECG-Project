import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Disclaimer } from "../components/Disclaimer";
import { api } from "../services/api";

export default function ResultsPage() {
  const evalQ = useQuery({ queryKey: ["evaluation"], queryFn: api.evaluation });
  const runsQ = useQuery({ queryKey: ["modelRuns"], queryFn: api.modelRuns });
  const results = evalQ.data?.results ?? [];
  const runs = runsQ.data?.runs ?? [];
  if (evalQ.data?.message && results.length === 0 && runs.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl">Results and evaluation</h2>
        <Disclaimer compact />
        <p>No experimental result available yet.</p>
      </div>
    );
  }
  const latest = results[results.length - 1] ?? (runs[runs.length - 1] ? { metrics: runs[runs.length - 1].metrics, model_id: runs[runs.length - 1].id } : null);
  const metrics = (latest?.metrics ?? {}) as Record<string, number>;
  const keys = Object.keys(metrics);
  if (keys.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl">Results and evaluation</h2>
        <Disclaimer compact />
        <p>No experimental result available yet.</p>
        <p className="text-sm text-slate-600">Train with a recording-level held-out set that contains both classes to compute metrics. A single synthetic recording does not yield honest test AUROC.</p>
        <ul className="text-sm">
          {runs.map((r: { id: string; model_name: string }) => (
            <li key={r.id}>{r.model_name} · {r.id}</li>
          ))}
        </ul>
      </div>
    );
  }
  const data = keys.map((k) => ({ name: k, value: metrics[k] }));
  return (
    <div className="space-y-6">
      <h2 className="text-2xl">Results and evaluation</h2>
      <Disclaimer compact />
      <p className="text-sm">Metrics below are computed from executed experiments only. No winner is declared in software beyond these numbers.</p>
      <div className="h-72 border bg-white p-3">
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#2a5f8f" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
