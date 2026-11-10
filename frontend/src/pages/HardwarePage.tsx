import { useMutation, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Disclaimer } from "../components/Disclaimer";
import { Icon, Spinner } from "../components/ui";
import { api } from "../services/api";

function metric(v: number | null | undefined) {
  if (v === null || v === undefined) return "Not measured";
  return v.toFixed(3);
}

const I = {
  fpga: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
  check: "M20 6L9 17l-5-5",
};

function BenchCard({ title, data }: { title: string; data: Record<string, unknown> | undefined }) {
  if (!data) return null;
  const rows = [
    { k: "Latency",      v: `${metric(data.latency_ms as number)} ms` },
    { k: "Throughput",   v: `${metric(data.throughput_samples_per_s as number)} samples/s` },
    { k: "Power",        v: data.power == null ? "Not measured" : String(data.power) },
    { k: "Resources",    v: data.resource_utilization == null ? "Not measured" : JSON.stringify(data.resource_utilization) },
  ];
  const notes = data.notes as string[] | undefined;

  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: "0.75rem", padding: "1.125rem", flex: "1 1 260px" }}>
      <h4 style={{ fontSize: "0.875rem", fontWeight: 700, margin: "0 0 0.875rem" }}>{title}</h4>
      {rows.map(({ k, v }) => (
        <div
          key={k}
          style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", borderBottom: "1px solid var(--color-line)", fontSize: "0.8125rem" }}
        >
          <span style={{ color: "var(--color-muted)" }}>{k}</span>
          <span style={{ fontWeight: 500 }}>{v}</span>
        </div>
      ))}
      {notes && notes.length > 0 && (
        <ul style={{ margin: "0.625rem 0 0", padding: "0 0 0 1rem", fontSize: "0.75rem", color: "var(--color-muted)" }}>
          {notes.map((n: string) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function HardwarePage() {
  const st    = useQuery({ queryKey: ["hw"], queryFn: api.hardware });
  const init  = useMutation({ mutationFn: api.hardwareInit,  onSuccess: () => st.refetch() });
  const modeM = useMutation({ mutationFn: (m: string) => api.hardwareMode(m), onSuccess: () => st.refetch() });
  const bench = useMutation({ mutationFn: api.hardwareBench });

  const s   = st.data;
  const sw  = bench.data?.software;
  const sel = bench.data?.selected_accelerator;

  const chartData = sw
    ? [
        { name: "Software",  value: sw.latency_ms },
        { name: "Accelerator", value: sel?.latency_ms ?? null },
      ].filter((d) => d.value != null)
    : [];

  const connected = s?.connection === "connected";

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0 }}>Hardware / PYNQ</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
          FPGA acceleration is optional. The research pipeline runs in software when the board or bitstream is absent.
        </p>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <Disclaimer compact />
      </div>

      {/* Status */}
      {s && (
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-line)",
            borderRadius: "0.75rem",
            padding: "1.125rem",
            marginBottom: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
            <span
              style={{
                width: 8, height: 8, borderRadius: "50%",
                background: connected ? "#10B981" : "#94A3B8",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
              PYNQ {connected ? "connected" : "not connected"}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.625rem" }}>
            {[
              { k: "Connection",  v: s.connection },
              { k: "Mode",        v: s.mode === "pynq" ? "PYNQ FPGA" : "SOFTWARE" },
              { k: "Board",       v: s.board },
              { k: "Accelerator", v: s.accelerator },
            ].map(({ k, v }) => (
              <div key={k} style={{ background: "var(--color-bg)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem" }}>
                <p style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-muted)", margin: 0 }}>{k}</p>
                <p style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0.125rem 0 0" }}>{v ?? "—"}</p>
              </div>
            ))}
          </div>
          {s.reason && (
            <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "0.625rem" }}>
              Reason: {s.reason}
            </p>
          )}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        <button className="btn-secondary" type="button" onClick={() => modeM.mutate("software")}>Force software</button>
        <button className="btn-secondary" type="button" onClick={() => modeM.mutate("pynq")}>Prefer PYNQ</button>
        <button className="btn-secondary" type="button" onClick={() => modeM.mutate("auto")}>Auto</button>
        <button
          className="btn-primary"
          type="button"
          onClick={() => init.mutate()}
          disabled={init.isPending}
        >
          {init.isPending ? <Spinner size={14} /> : <Icon d={I.fpga} size={14} />}
          Initialize FPGA
        </button>
        <button
          className="btn-secondary"
          type="button"
          onClick={() => bench.mutate()}
          disabled={bench.isPending}
        >
          {bench.isPending ? <Spinner size={14} /> : "Run FIR benchmark"}
        </button>
      </div>

      {/* Benchmark results */}
      {bench.data && (
        <div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <BenchCard title="Software DSP" data={sw} />
            <BenchCard title={`Selected accelerator${sel?.mode ? ` (${sel.mode})` : ""}`} data={sel} />
          </div>

          {chartData.length > 0 && (
            <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: "0.75rem", padding: "1.125rem" }}>
              <h4 style={{ fontSize: "0.875rem", fontWeight: 700, margin: "0 0 0.875rem" }}>Latency comparison (ms)</h4>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: "0.75rem", borderRadius: "0.5rem", border: "1px solid #E2E8F0" }}
                      formatter={(v: number) => [`${v.toFixed(3)} ms`, "Latency"]}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      <Cell fill="#0D9488" />
                      <Cell fill="#3B82F6" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
