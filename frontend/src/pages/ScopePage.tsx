import { useQuery } from "@tanstack/react-query";
import { Disclaimer } from "../components/Disclaimer";
import { api } from "../services/api";

export default function ScopePage() {
  const q = useQuery({ queryKey: ["scope"], queryFn: api.scope });
  const rows = q.data?.rows ?? [];

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0 }}>Research scope</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
          What this prototype addresses and what it does not.
        </p>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <Disclaimer compact />
      </div>

      {rows.length > 0 ? (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: "0.75rem", overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Role in this prototype</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: { entity: string; role: string }) => (
                <tr key={r.entity}>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{r.entity}</td>
                  <td style={{ color: "var(--color-muted)" }}>{r.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ fontSize: "0.875rem", color: "var(--color-muted)" }}>
          {q.isLoading ? "Loading scope data…" : "Scope data not available. Ensure the backend is running."}
        </p>
      )}

      {q.data?.note && (
        <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "1rem", maxWidth: 680, lineHeight: 1.65 }}>
          {q.data.note}
        </p>
      )}
    </div>
  );
}
