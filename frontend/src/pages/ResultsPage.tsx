import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Disclaimer } from "../components/Disclaimer";
import { api } from "../services/api";

const METRIC_COLORS: Record<string, string> = {
  auroc: "#0D9488",
  auprc: "#14B8A6",
  sensitivity: "#3B82F6",
  specificity: "#8B5CF6",
  precision: "#F59E0B",
  f1: "#EF4444",
};

export default function ResultsPage() {
  const evalQ = useQuery({ queryKey: ["evaluation"], queryFn: api.evaluation });
  const runsQ = useQuery({ queryKey: ["modelRuns"],   queryFn: api.modelRuns });

  const results = evalQ.data?.results ?? [];
  const runs    = runsQ.data?.runs    ?? [];

  const lastEval = results.length > 0 ? results[results.length - 1] : undefined;
  const lastRun  = runs.length > 0 ? runs[runs.length - 1] : undefined;
  const latest   = lastEval ?? (lastRun ? { metrics: lastRun.metrics, model_id: lastRun.id } : null);
  const metrics  = (latest?.metrics ?? {}) as Record<string, number>;
  const keys     = Object.keys(metrics);

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0 }}>Results & Evaluation</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
          Metrics computed from executed experiments only. No winner is declared beyond these numbers.
        </p>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <Disclaimer compact />
      </div>

      {keys.length === 0 ? (
        <div>
          <div
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-line)",
              borderRadius: "0.75rem",
              padding: "2rem",
              textAlign: "center",
              marginBottom: "1rem",
            }}
          >
            <p style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>No experimental results yet</p>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.375rem", maxWidth: 400, margin: "0.375rem auto 0" }}>
              Train with a recording-level held-out set that contains both classes to compute metrics. A single synthetic
              recording does not yield honest test AUROC.
            </p>
          </div>

          {runs.length > 0 && (
            <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: "0.625rem", padding: "1rem" }}>
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>Completed model runs</p>
              {runs.map((r: { id: string; model_name: string }) => (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.375rem 0",
                    borderBottom: "1px solid var(--color-line)",
                    fontSize: "0.8125rem",
                  }}
                >
                  <span>{r.model_name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted)", fontSize: "0.75rem" }}>{r.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1rem" }}>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={keys.map((k) => ({ name: k, value: metrics[k] }))} margin={{ top: 8, right: 12, left: 0, bottom: 60 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} domain={[0, 1]} />
                  <Tooltip
                    contentStyle={{ fontSize: "0.75rem", borderRadius: "0.5rem", border: "1px solid #E2E8F0" }}
                    formatter={(v: number) => [v.toFixed(3), "Score"]}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {keys.map((k, i) => (
                      <Cell key={i} fill={METRIC_COLORS[k.toLowerCase()] ?? "#0D9488"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.625rem" }}>
            {keys.map((k) => (
              <div
                key={k}
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-line)",
                  borderRadius: "0.5rem",
                  padding: "0.75rem 0.875rem",
                  borderTop: `3px solid ${METRIC_COLORS[k.toLowerCase()] ?? "#0D9488"}`,
                }}
              >
                <p style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-muted)", margin: 0 }}>{k}</p>
                <p style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0.125rem 0 0", letterSpacing: "-0.02em" }}>
                  {typeof metrics[k] === "number" ? metrics[k].toFixed(3) : "—"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
