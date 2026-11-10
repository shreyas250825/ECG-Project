import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../services/api";
import type { PipelineStage } from "../types/research";

export default function PipelinePage() {
  const q = useQuery({ queryKey: ["pipeline"], queryFn: api.pipeline });
  const [id, setId] = useState<string | null>(null);
  const stages: PipelineStage[] = q.data?.stages ?? [];
  const selected = stages.find((s) => s.id === id) ?? stages[0];

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0 }}>Research pipeline</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
          Click a stage to explore methods. This documents process, not experimental accuracy.
        </p>
      </div>

      {q.isError && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "0.5rem", padding: "0.625rem 0.875rem", fontSize: "0.8125rem", color: "#B91C1C", marginBottom: "1rem" }}>
          Backend unavailable. Start the FastAPI server to see pipeline stages.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "1rem" }}>
        {/* Stage list */}
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {stages.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setId(s.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${selected?.id === s.id ? "var(--color-teal)" : "var(--color-line)"}`,
                  background: selected?.id === s.id ? "rgba(13,148,136,0.06)" : "var(--color-surface)",
                  color: selected?.id === s.id ? "var(--color-teal-dim)" : "var(--color-ink)",
                  cursor: "pointer",
                  fontSize: "0.8125rem",
                  fontWeight: selected?.id === s.id ? 600 : 400,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    color: selected?.id === s.id ? "var(--color-teal)" : "var(--color-muted)",
                    minWidth: "14px",
                  }}
                >
                  {i + 1}
                </span>
                {s.title}
              </button>
            </li>
          ))}
        </ol>

        {/* Detail panel */}
        {selected && (
          <article
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-line)",
              borderRadius: "0.75rem",
              padding: "1.25rem",
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem" }}>{selected.title}</h3>
            <dl style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "0.5rem 0.75rem", fontSize: "0.8125rem" }}>
              {[
                ["What it does", selected.does],
                ["Input",        selected.input],
                ["Output",       selected.output],
                ["Algorithm",    selected.algorithm],
                ["Why",          selected.reason],
                ["Limitations",  selected.limitations],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt style={{ fontWeight: 600, color: "var(--color-muted)", fontSize: "0.75rem" }}>{k}</dt>
                  <dd style={{ margin: 0, color: "var(--color-ink)" }}>{v}</dd>
                </div>
              ))}
            </dl>
          </article>
        )}
      </div>
    </div>
  );
}
