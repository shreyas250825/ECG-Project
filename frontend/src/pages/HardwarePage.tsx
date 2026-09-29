import { useMutation, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Disclaimer } from "../components/Disclaimer";
import { api } from "../services/api";

function metric(v: number | null | undefined) {
  if (v === null || v === undefined) return "Not measured";
  return v.toFixed(3);
}

export default function HardwarePage() {
  const st = useQuery({ queryKey: ["hw"], queryFn: api.hardware });
  const init = useMutation({ mutationFn: api.hardwareInit, onSuccess: () => st.refetch() });
  const mode = useMutation({ mutationFn: (m: string) => api.hardwareMode(m), onSuccess: () => st.refetch() });
  const bench = useMutation({ mutationFn: api.hardwareBench });
  const s = st.data;
  const sw = bench.data?.software;
  const sel = bench.data?.selected_accelerator;
  const chart = sw
    ? [
        { name: "Software latency (ms)", value: sw.latency_ms },
        { name: "Selected latency (ms)", value: sel?.latency_ms ?? null },
      ].filter((d) => d.value != null)
    : [];
  return (
    <div className="space-y-6">
      <h2 className="text-2xl">Hardware / PYNQ</h2>
      <Disclaimer compact />
      <p className="text-sm text-slate-700">
        FPGA acceleration is optional. The research pipeline runs in software when the board or bitstream is absent.
      </p>
      {s && (
        <dl className="grid gap-3 border border-slate-200 bg-white p-4 text-sm md:grid-cols-2">
          <div><dt className="text-slate-500">PYNQ status</dt><dd className="font-medium">{s.connection}</dd></div>
          <div><dt className="text-slate-500">Execution mode</dt><dd className="font-medium">{s.mode === "pynq" ? "PYNQ FPGA" : "SOFTWARE"}</dd></div>
          <div><dt className="text-slate-500">Board</dt><dd>{s.board}</dd></div>
          <div><dt className="text-slate-500">Accelerator</dt><dd>{s.accelerator}</dd></div>
          <div className="md:col-span-2"><dt className="text-slate-500">Reason</dt><dd>{s.reason || "—"}</dd></div>
        </dl>
      )}
      <div className="flex flex-wrap gap-2 text-sm">
        <button className="border px-3 py-2" type="button" onClick={() => mode.mutate("software")}>Force software</button>
        <button className="border px-3 py-2" type="button" onClick={() => mode.mutate("pynq")}>Prefer PYNQ</button>
        <button className="border px-3 py-2" type="button" onClick={() => mode.mutate("auto")}>Auto</button>
        <button className="bg-teal-800 px-3 py-2 text-white" type="button" onClick={() => init.mutate()}>Initialize FPGA</button>
        <button className="border px-3 py-2" type="button" onClick={() => bench.mutate()}>Run FIR benchmark</button>
      </div>
      {bench.data && (
        <div className="grid gap-4 md:grid-cols-2 text-sm">
          <div className="border bg-white p-4">
            <h3 className="font-semibold">Software</h3>
            <p>Latency: {metric(sw?.latency_ms)} ms</p>
            <p>Throughput: {metric(sw?.throughput_samples_per_s)} samples/s</p>
            <p>Resource utilisation: {sw?.resource_utilization == null ? "Not measured" : JSON.stringify(sw.resource_utilization)}</p>
            <p>Power: {sw?.power == null ? "Not measured" : sw.power}</p>
          </div>
          <div className="border bg-white p-4">
            <h3 className="font-semibold">Selected accelerator</h3>
            <p>Mode: {sel?.mode}</p>
            <p>Latency: {metric(sel?.latency_ms)} ms</p>
            <p>Throughput: {metric(sel?.throughput_samples_per_s)} samples/s</p>
            <p>Resource utilisation: {sel?.resource_utilization == null ? "Not measured" : JSON.stringify(sel.resource_utilization)}</p>
            <p>Power: {sel?.power == null ? "Not measured" : sel.power}</p>
            <ul className="mt-2 text-xs text-slate-600">
              {sel?.notes?.map((n: string) => <li key={n}>{n}</li>)}
            </ul>
          </div>
        </div>
      )}
      {chart.length > 0 && (
        <div className="h-56 border bg-white p-2">
          <ResponsiveContainer>
            <BarChart data={chart}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#1f6f7a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
