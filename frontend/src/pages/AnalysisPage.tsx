import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { EcgChart } from "../charts/EcgChart";
import { Disclaimer } from "../components/Disclaimer";
import { Icon, PageHeader, SectionCard, StatCard, FormField, ErrorBox, Spinner, Collapsible } from "../components/ui";
import { api } from "../services/api";
import { saveAnalysis } from "../services/analysisService";
import { useAuth } from "../contexts/AuthContext";
import type { ResearchRecord } from "../types/research";

const I = {
  ecg:      "M22 12h-4l-3 9L9 3l-3 9H2",
  upload:   "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  run:      "M5 3l14 9-14 9V3z",
  refresh:  "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  info:     "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  expand:   "M19 9l-7 7-7-7",
};

/* ── Quality badge ──────────────────────────────────────────────────── */
function QualityBadge({ label, score }: { label?: string; score?: number }) {
  if (!label) return <span style={{ color: "var(--color-muted)" }}>—</span>;
  const color = label.toLowerCase().includes("good") || (score ?? 0) > 0.7
    ? "#065F46" : label.toLowerCase().includes("poor") || (score ?? 1) < 0.4
      ? "#B91C1C" : "#92400E";
  const bg = label.toLowerCase().includes("good") || (score ?? 0) > 0.7
    ? "#ECFDF5" : label.toLowerCase().includes("poor") || (score ?? 1) < 0.4
      ? "#FEF2F2" : "#FFFBEB";

  return (
    <span style={{ background: bg, color, border: `1px solid ${bg}`, borderRadius: "9999px", padding: "0.1875rem 0.625rem", fontSize: "0.75rem", fontWeight: 600 }}>
      {label}
    </span>
  );
}

/* ── Recording selector panel ───────────────────────────────────────── */
function RecordingSelector({
  records,
  selected,
  onSelect,
  onRun,
  running,
}: {
  records: ResearchRecord[];
  selected: string;
  onSelect: (id: string) => void;
  onRun: () => void;
  running: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "0.75rem",
        flexWrap: "wrap",
        padding: "1rem 1.25rem",
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: "0.75rem",
        marginBottom: "1.25rem",
      }}
    >
      <div style={{ flex: "1 1 220px" }}>
        <label className="field-label">Recording</label>
        <select
          className="field-select"
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
        >
          {records.map((r) => (
            <option key={r.id} value={r.id}>
              {r.record_name}
              {r.synthetic ? " (synthetic)" : r.source_dataset ? ` — ${r.source_dataset}` : ""}
            </option>
          ))}
          {records.length === 0 && <option value="">No recordings — load one first</option>}
        </select>
      </div>

      <button
        type="button"
        className="btn-primary"
        disabled={!selected || running}
        onClick={onRun}
        style={{ whiteSpace: "nowrap" }}
      >
        {running ? (
          <>
            <Spinner size={14} />
            Processing…
          </>
        ) : (
          <>
            <Icon d={I.run} size={14} />
            Run ECG Analysis
          </>
        )}
      </button>

      <p style={{ fontSize: "0.6875rem", color: "var(--color-muted)", width: "100%", margin: "0.125rem 0 0" }}>
        Runs preprocessing, R-peak detection, and feature extraction.
      </p>
    </div>
  );
}

/* ── Upload panel ───────────────────────────────────────────────────── */
function UploadPanel({
  fileRef,
  fs, setFs,
  col, setCol,
  tcol, setTcol,
  lead, setLead,
  onUpload,
  uploading,
  uploadError,
  uploadOk,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  fs: number; setFs: (v: number) => void;
  col: string; setCol: (v: string) => void;
  tcol: string; setTcol: (v: string) => void;
  lead: string; setLead: (v: string) => void;
  onUpload: () => void;
  uploading: boolean;
  uploadError?: string;
  uploadOk?: boolean;
}) {
  return (
    <SectionCard title="Upload CSV recording" subtitle="Import a custom ECG file in CSV format">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "0.875rem" }}>
        <FormField label="Signal column" hint="Column name containing the ECG values">
          <input className="field-input" value={col} onChange={(e) => setCol(e.target.value)} placeholder="signal" />
        </FormField>
        <FormField label="Time column (optional)">
          <input className="field-input" value={tcol} onChange={(e) => setTcol(e.target.value)} placeholder="time" />
        </FormField>
        <FormField label="Sampling rate (Hz)" hint="Used if no time column">
          <input className="field-input" type="number" value={fs} onChange={(e) => setFs(Number(e.target.value))} />
        </FormField>
        <FormField label="Lead label">
          <input className="field-input" value={lead} onChange={(e) => setLead(e.target.value)} placeholder="II" />
        </FormField>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          style={{
            fontSize: "0.8125rem",
            color: "var(--color-muted)",
            border: "1px dashed var(--color-line)",
            borderRadius: "0.5rem",
            padding: "0.5rem 0.75rem",
            background: "var(--color-bg)",
            cursor: "pointer",
            flex: "1 1 200px",
          }}
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={onUpload}
          disabled={uploading}
        >
          {uploading ? <Spinner size={14} /> : <Icon d={I.upload} size={14} />}
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>

      {uploadError && <div style={{ marginTop: "0.75rem" }}><ErrorBox message={uploadError} /></div>}
      {uploadOk && !uploadError && (
        <p style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "#166534" }}>✓ Recording imported successfully.</p>
      )}
    </SectionCard>
  );
}

/* ── Waveform panel (dark ECG viewer) ───────────────────────────────── */
function WaveformPanel({
  chart,
  rPeaks,
  syntheticNotice,
}: {
  chart: { time: number[]; raw: number[]; cleaned: number[] } | null;
  rPeaks: number[];
  syntheticNotice?: string | null;
}) {
  return (
    <div className="ecg-panel" style={{ marginBottom: "1.25rem" }}>
      {/* Panel header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.875rem 1.25rem",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div>
          <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#fff", margin: 0 }}>ECG Waveform</p>
          <p style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.4)", margin: 0 }}>
            Raw (grey) · Cleaned (teal) · R-peaks (blue) — use brush to zoom
          </p>
        </div>
        {syntheticNotice && (
          <span
            className="badge"
            style={{ background: "rgba(251,191,36,0.15)", color: "#FCD34D", border: "1px solid rgba(252,211,77,0.3)" }}
          >
            Synthetic demo
          </span>
        )}
        {rPeaks.length > 0 && (
          <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
            {rPeaks.length} R-peaks detected
          </span>
        )}
      </div>

      {/* Waveform */}
      <div style={{ padding: "1rem 0.5rem 0.25rem" }}>
        {chart ? (
          <EcgChart
            time={chart.time}
            raw={chart.raw}
            cleaned={chart.cleaned}
            rPeakTimes={rPeaks}
            dark
          />
        ) : (
          <div
            style={{
              height: 220,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              color: "rgba(255,255,255,0.25)",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} opacity={0.4}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <p style={{ fontSize: "0.875rem", margin: 0 }}>No ECG data — run analysis on a recording</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Measurements + Features ────────────────────────────────────────── */
function ResultsPanel({ data }: { data: Record<string, unknown> }) {
  const det = data.detection as { label?: string; note?: string } | undefined;
  const sq  = data.signal_quality as { label?: string; score?: number } | undefined;
  const hr  = data.heart_rate_bpm as number | undefined;
  const peaks = data.r_peaks as { count?: number } | undefined;
  const feats = data.features as { values?: Record<string, number> } | undefined;
  const meta  = data.feature_metadata as Record<string, { units?: string }> | undefined;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem", marginTop: "1.25rem" }}>
      {/* Measurements */}
      <SectionCard title="Signal measurements" subtitle="From preprocessing and R-peak detection">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
          <StatCard
            label="Heart rate"
            value={hr != null ? `${hr.toFixed(1)}` : "—"}
            sub="bpm (from mean RR)"
          />
          <StatCard
            label="R-peaks"
            value={peaks?.count != null ? String(peaks.count) : "—"}
            sub="detected"
          />
        </div>

        <div style={{ borderTop: "1px solid var(--color-line)", paddingTop: "0.75rem" }}>
          <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-muted)", margin: "0 0 0.5rem" }}>
            Signal quality
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <QualityBadge label={sq?.label} score={sq?.score} />
            {sq?.score != null && (
              <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{sq.score.toFixed(2)}</span>
            )}
          </div>

          {det && (
            <div style={{ marginTop: "0.75rem", padding: "0.625rem 0.75rem", background: "var(--color-bg)", borderRadius: "0.5rem" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                Detection: {det.label ?? "—"}
              </p>
              {det.note && (
                <p style={{ fontSize: "0.6875rem", color: "var(--color-muted)", margin: "0.25rem 0 0" }}>{det.note}</p>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Features */}
      {feats?.values && (
        <SectionCard title="Extracted features" subtitle="ECG features used in baseline and twin computation">
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {Object.entries(feats.values).map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "0.3125rem 0",
                  borderBottom: "1px solid var(--color-line)",
                  fontSize: "0.8125rem",
                  gap: "0.5rem",
                }}
              >
                <span style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>{k}</span>
                <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                  {Number.isFinite(v) ? v.toFixed(4) : "n/a"}
                  {meta?.[k]?.units && (
                    <span style={{ color: "var(--color-muted)", fontWeight: 400, marginLeft: "0.25rem", fontSize: "0.6875rem" }}>
                      {meta[k].units}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────── */
export default function AnalysisPage() {
  const { user } = useAuth();
  const recordsQ = useQuery({ queryKey: ["records"], queryFn: api.records });
  const records: ResearchRecord[] = recordsQ.data?.records ?? [];
  const [rid, setRid] = useState<string>("");
  const [fs, setFs] = useState(250);
  const [col, setCol] = useState("signal");
  const [tcol, setTcol] = useState("time");
  const [lead, setLead] = useState("II");
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = rid || records[0]?.id || "";

  const proc = useMutation({
    mutationFn: () => api.process(selected),
    onSuccess: async (data) => {
      // Persist analysis to Supabase (best-effort — does not block UI)
      if (user && selected) {
        await saveAnalysis(user.id, selected, data as Record<string, unknown>);
      }
    },
  });
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

  const rPeaks = useMemo(
    () => (data?.r_peaks as { times_s?: number[] } | undefined)?.times_s ?? [],
    [data],
  );

  return (
    <div className="fade-in">
      <PageHeader
        title="ECG Analysis"
        subtitle="Signal processing, R-peak detection, and feature extraction workstation"
        badge={<Disclaimer compact />}
      />

      <RecordingSelector
        records={records}
        selected={selected}
        onSelect={setRid}
        onRun={() => proc.mutate()}
        running={proc.isPending}
      />

      {proc.error && <div style={{ marginBottom: "1rem" }}><ErrorBox message={(proc.error as Error).message} /></div>}

      {/* ECG waveform dark panel */}
      <WaveformPanel
        chart={chart}
        rPeaks={rPeaks}
        syntheticNotice={(data as { synthetic_notice?: string } | null)?.synthetic_notice}
      />

      {/* Results */}
      {data && <ResultsPanel data={data as Record<string, unknown>} />}

      {/* Upload panel — collapsible by default */}
      <div style={{ marginTop: "1.5rem" }}>
        <Collapsible
          trigger={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--color-ink)",
                padding: "0.75rem 1.25rem",
                background: "var(--color-surface)",
                border: "1px solid var(--color-line)",
                borderRadius: "0.75rem",
              }}
            >
              <Icon d={I.upload} size={15} />
              Upload CSV recording
            </div>
          }
        >
          <div style={{ marginTop: "0.5rem" }}>
            <UploadPanel
              fileRef={fileRef}
              fs={fs} setFs={setFs}
              col={col} setCol={setCol}
              tcol={tcol} setTcol={setTcol}
              lead={lead} setLead={setLead}
              onUpload={() => up.mutate()}
              uploading={up.isPending}
              uploadError={up.isError ? (up.error as Error).message : undefined}
              uploadOk={up.isSuccess}
            />
          </div>
        </Collapsible>
      </div>

      {/* Methodology note */}
      <div className="disclaimer-strip" style={{ marginTop: "1.25rem", fontSize: "0.6875rem" }}>
        <strong>Note:</strong> Detection indicates a rhythm pattern is present in the analysed window — it is not
        forecasting. Forecasting is an experimental estimate of a future target event within horizon H.
      </div>
    </div>
  );
}
