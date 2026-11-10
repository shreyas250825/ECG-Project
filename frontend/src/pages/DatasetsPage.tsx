import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../services/api";
import type { ResearchRecord } from "../types/research";
import { Spinner } from "../components/ui";

type DiskRecord = {
  record_name: string;
  dataset: string;
  sampling_rate_hz?: number;
  duration_seconds?: number;
  n_signals?: number;
  lead_names?: string[];
  has_atr?: boolean;
  has_ari?: boolean;
  vfon_present?: boolean;
  loaded?: boolean;
  error?: string;
};

type DatasetInfo = {
  dataset: string;
  record_count: number;
  records: DiskRecord[];
};

function fmtDuration(s?: number) {
  if (!s) return "—";
  if (s >= 3600) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 60).toFixed(1)} min`;
}

export default function DatasetsPage() {
  const recordsQ   = useQuery({ queryKey: ["records"],   queryFn: api.records });
  const datasetsQ  = useQuery({ queryKey: ["datasets"],  queryFn: api.datasets });

  const records: ResearchRecord[] = recordsQ.data?.records  ?? [];
  const datasets: DatasetInfo[]   = datasetsQ.data?.datasets ?? [];

  const [activeTab, setActiveTab]   = useState<"browser" | "loaded">("browser");
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const loadMut = useMutation({
    mutationFn: (body: { dataset: string; record_name: string; max_samples?: number }) =>
      api.loadDatasetRecord(body),
    onSuccess: () => {
      recordsQ.refetch();
      datasetsQ.refetch();
    },
  });

  function handleLoad(dataset: string, record_name: string, e: React.MouseEvent) {
    e.preventDefault();
    const key = `${dataset}/${record_name}`;
    setLoadingKey(key);
    loadMut.mutate({ dataset, record_name }, { onSettled: () => setLoadingKey(null) });
  }

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0 }}>Recordings</h2>
        <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
          Identifiers are research record names only. No patient-identifiable data is stored.
        </p>
      </div>

      {/* Tab bar */}
      <div className="tab-bar" style={{ marginBottom: "1rem" }}>
        {(["browser", "loaded"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`tab-item${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "browser" ? "Dataset browser" : `Loaded records (${records.length})`}
          </button>
        ))}
      </div>

      {/* ── Dataset browser ──────────────────────────────────────────── */}
      {activeTab === "browser" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {datasetsQ.isLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-muted)", fontSize: "0.875rem" }}>
              <Spinner size={16} />
              Scanning disk for available records…
            </div>
          )}
          {datasetsQ.isError && (
            <p style={{ fontSize: "0.875rem", color: "#B91C1C" }}>Could not load dataset listing. Is the backend running?</p>
          )}

          {datasets.map((ds) => (
            <div key={ds.dataset}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-ink)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {ds.dataset}
                </h3>
                <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
                  {ds.record_count} record{ds.record_count !== 1 ? "s" : ""} on disk
                </span>
              </div>

              {ds.record_count === 0 ? (
                <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", fontStyle: "italic" }}>
                  No files found. Download may still be in progress — check your terminal.
                </p>
              ) : (
                <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: "0.625rem", overflow: "hidden" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Record</th>
                        <th>fs (Hz)</th>
                        <th>Duration</th>
                        <th>Leads</th>
                        <th>.atr</th>
                        <th>vfon</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ds.records.map((r) => {
                        const key = `${ds.dataset}/${r.record_name}`;
                        const isLoading = loadingKey === key;
                        return (
                          <tr key={r.record_name}>
                            <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "0.8125rem" }}>{r.record_name}</td>
                            <td>{r.sampling_rate_hz ?? "—"}</td>
                            <td>{fmtDuration(r.duration_seconds)}</td>
                            <td style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{r.lead_names?.join(", ") ?? "—"}</td>
                            <td>{r.has_atr ? "✓" : r.has_ari ? "ari" : "—"}</td>
                            <td>{r.vfon_present ? "✓" : "—"}</td>
                            <td>
                              {r.error ? (
                                <span style={{ color: "#B91C1C", fontSize: "0.75rem" }}>error</span>
                              ) : r.loaded ? (
                                <span style={{ color: "#059669", fontWeight: 600, fontSize: "0.75rem" }}>loaded</span>
                              ) : (
                                <span style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>not loaded</span>
                              )}
                            </td>
                            <td>
                              {!r.loaded && !r.error && (
                                <button
                                  type="button"
                                  onClick={(e) => handleLoad(ds.dataset, r.record_name, e)}
                                  disabled={isLoading || loadMut.isPending}
                                  className="btn-primary"
                                  style={{ padding: "0.25rem 0.625rem", fontSize: "0.6875rem" }}
                                >
                                  {isLoading ? <Spinner size={12} /> : "Load"}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {loadMut.isError && (
                <p style={{ fontSize: "0.8125rem", color: "#B91C1C", marginTop: "0.5rem" }}>
                  {(loadMut.error as Error).message}
                </p>
              )}
            </div>
          ))}

          <p style={{ fontSize: "0.6875rem", color: "var(--color-muted)" }}>
            "Load" reads signal and annotations from disk into memory. Long SDDB recordings are bounded to 1 hour by default.
          </p>
        </div>
      )}

      {/* ── Loaded records ───────────────────────────────────────────── */}
      {activeTab === "loaded" && (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: "0.625rem", overflow: "hidden" }}>
          {records.length === 0 ? (
            <p style={{ padding: "1.5rem", fontSize: "0.875rem", color: "var(--color-muted)" }}>
              No records loaded yet. Use the Dataset browser to load a record.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Duration</th>
                  <th>fs (Hz)</th>
                  <th>Lead</th>
                  <th>Annotations</th>
                  <th>Privacy</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "0.8125rem" }}>{r.record_name}</td>
                    <td style={{ color: "var(--color-muted)" }}>{r.source_dataset ?? "—"}</td>
                    <td>
                      <span
                        className="badge"
                        style={
                          r.synthetic
                            ? { background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" }
                            : { background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0" }
                        }
                      >
                        {r.synthetic ? "synthetic" : "real"}
                      </span>
                    </td>
                    <td>{fmtDuration(r.duration_seconds)}</td>
                    <td>{r.sampling_rate ?? "—"}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>{r.lead ?? "—"}</td>
                    <td>{r.has_annotations ? "yes" : "no"}</td>
                    <td style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>{r.privacy_status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
