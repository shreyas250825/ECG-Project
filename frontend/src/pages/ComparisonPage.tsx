/**
 * ComparisonPage — Normal ECG vs Ventricular Arrhythmia ECG
 *
 * Shows:
 *  1. Side-by-side ECG waveform rendering of two records
 *  2. Feature extraction comparison (15 features, bar chart diff)
 *  3. How the prediction model uses those features (pipeline walkthrough)
 *  4. Score comparison with explanation
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../services/api";
import { Spinner, ErrorBox } from "../components/ui";
import type { ResearchRecord } from "../types/research";

/* ── Palette ────────────────────────────────────────────────────── */
const C_NORMAL   = "#10B981";   // green  — normal
const C_ARRHYTHMIA = "#EF4444"; // red    — arrhythmia
const C_TEAL     = "#0D9488";
const C_AMBER    = "#F59E0B";
const C_INK      = "#0F172A";
const C_MUTED    = "#64748B";
const C_LINE     = "#E2E8F0";
const C_BG       = "#F8FAFC";
const C_SURFACE  = "#FFFFFF";

/* ── Icons ─────────────────────────────────────────────────────── */
const I = {
  compare:  "M9 19V6l3-3 3 3v13M3 19h18",
  load:     "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  info:     "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  warning:  "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  arrow:    "M13 7l5 5m0 0l-5 5m5-5H6",
  peak:     "M22 12h-4l-3 9L9 3l-3 9H2",
  model:    "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
};

/* ── Helpers ────────────────────────────────────────────────────── */
function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999,
      background: `${color}18`, color,
      fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.06em",
      textTransform: "uppercase",
    }}>{text}</span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: "0.8125rem", fontWeight: 700, color: C_INK,
      margin: "0 0 1rem", letterSpacing: "-0.01em" }}>
      {children}
    </h3>
  );
}

/* ── ECG Waveform panel ─────────────────────────────────────────── */
function EcgWaveform({
  waveform,
  rPeaks,
  color,
  label,
  annotations,
  fs,
}: {
  waveform: { t: number; v: number }[];
  rPeaks: number[];
  color: string;
  label: string;
  annotations: { start_time: number; event_type: string }[];
  fs: number;
}) {
  const vtEvents = annotations.filter((a) =>
    ["vt", "vf", "pvc"].includes(a.event_type)
  );

  return (
    <div style={{ background: C_BG, borderRadius: "0.75rem",
      border: `1px solid ${C_LINE}`, padding: "1rem", flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: "0.75rem" }}>
        <div>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: C_INK }}>{label}</span>
          {vtEvents.length > 0 && (
            <span style={{ marginLeft: 8 }}>
              <Badge text={`${vtEvents.length} VT/VF event${vtEvents.length > 1 ? "s" : ""}`}
                color={C_ARRHYTHMIA} />
            </span>
          )}
          {vtEvents.length === 0 && (
            <span style={{ marginLeft: 8 }}>
              <Badge text="No VT annotations" color={C_NORMAL} />
            </span>
          )}
        </div>
        <span style={{ fontSize: "0.6875rem", color: C_MUTED }}>{fs} Hz</span>
      </div>

      {waveform.length === 0 ? (
        <div style={{ height: 160, display: "flex", alignItems: "center",
          justifyContent: "center", color: C_MUTED, fontSize: "0.8125rem" }}>
          No waveform data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={waveform} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={C_LINE} />
            <XAxis dataKey="t" tick={{ fontSize: 9, fill: C_MUTED }} tickLine={false}
              tickFormatter={(v) => `${v.toFixed(0)}s`} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: C_MUTED }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ fontSize: "0.6875rem", borderRadius: "0.375rem",
                border: `1px solid ${C_LINE}`, padding: "4px 8px" }}
              formatter={(v: number) => [v.toFixed(3), "mV"]}
              labelFormatter={(l) => `t = ${Number(l).toFixed(2)} s`}
            />
            {/* VT event reference lines */}
            {vtEvents.map((e, i) => (
              <ReferenceLine key={i} x={e.start_time} stroke={C_ARRHYTHMIA}
                strokeWidth={1.5} strokeDasharray="3 2"
                label={{ value: "VT", position: "top", fontSize: 8, fill: C_ARRHYTHMIA }} />
            ))}
            {/* R-peak reference lines */}
            {rPeaks.slice(0, 20).map((t, i) => (
              <ReferenceLine key={`r${i}`} x={t} stroke={color}
                strokeWidth={0.8} strokeOpacity={0.3} />
            ))}
            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
              dot={false} isAnimationActive={false} name="ECG" />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* R-peak count */}
      <div style={{ marginTop: "0.5rem", display: "flex", gap: "1rem",
        fontSize: "0.6875rem", color: C_MUTED }}>
        <span>R-peaks detected: <strong style={{ color }}>{rPeaks.length}</strong></span>
        {waveform.length > 0 && (
          <span>Shown: first {(waveform[waveform.length - 1]?.t ?? 0).toFixed(0)} s</span>
        )}
      </div>
    </div>
  );
}

/* ── Feature comparison bar ─────────────────────────────────────── */
const FEATURE_LABELS: Record<string, string> = {
  heart_rate_bpm:   "Heart rate (bpm)",
  mean_rr_s:        "Mean RR (s)",
  sdnn_s:           "SDNN (s)",
  rmssd_s:          "RMSSD (s)",
  rr_cv:            "RR variability",
  qrs_width_s:      "QRS width (s)",
  qrs_amplitude:    "QRS amplitude",
  r_peak_amplitude: "R-peak amplitude",
  morphology_std:   "Beat morphology std",
  signal_energy:    "Signal energy",
  skewness:         "Skewness",
  kurtosis:         "Kurtosis",
  std_signal:       "Signal std dev",
  mean_signal:      "Mean signal",
  median_rr_s:      "Median RR (s)",
};

/* Features most diagnostically relevant for VT distinction */
const KEY_FEATURES = [
  "heart_rate_bpm", "mean_rr_s", "sdnn_s", "rmssd_s", "rr_cv",
  "qrs_width_s", "qrs_amplitude", "morphology_std", "r_peak_amplitude", "signal_energy",
];

function FeatureBar({ feature, normalVal, arrVal }: {
  feature: string;
  normalVal: number | null;
  arrVal: number | null;
}) {
  const isNaN_n = normalVal == null || !isFinite(normalVal);
  const isNaN_a = arrVal == null || !isFinite(arrVal);
  if (isNaN_n && isNaN_a) return null;

  const nv = isNaN_n ? 0 : normalVal!;
  const av = isNaN_a ? 0 : arrVal!;
  const maxV = Math.max(Math.abs(nv), Math.abs(av), 0.001);

  const nPct = Math.min(100, (Math.abs(nv) / maxV) * 100);
  const aPct = Math.min(100, (Math.abs(av) / maxV) * 100);

  const diff = av - nv;
  const diffPct = nv !== 0 ? ((diff / Math.abs(nv)) * 100) : 0;
  const diffColor = Math.abs(diffPct) < 10 ? C_MUTED
    : diffPct > 0 ? C_ARRHYTHMIA : C_NORMAL;

  return (
    <div style={{ padding: "0.625rem 0.75rem", borderBottom: `1px solid ${C_LINE}` }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: "0.4rem" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: C_INK }}>
          {FEATURE_LABELS[feature] ?? feature}
        </span>
        {!isNaN_n && !isNaN_a && (
          <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: diffColor }}>
            {diffPct > 0 ? "+" : ""}{diffPct.toFixed(0)}%
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        {/* Normal bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%",
            background: C_NORMAL, flexShrink: 0 }} />
          <div style={{ flex: 1, background: "#E2E8F0", borderRadius: 2, height: 6 }}>
            <div style={{ width: `${nPct}%`, height: "100%",
              background: C_NORMAL, borderRadius: 2, opacity: isNaN_n ? 0.2 : 1 }} />
          </div>
          <span style={{ fontSize: "0.625rem", color: C_MUTED, width: 50, textAlign: "right" }}>
            {isNaN_n ? "—" : nv.toFixed(3)}
          </span>
        </div>
        {/* Arrhythmia bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%",
            background: C_ARRHYTHMIA, flexShrink: 0 }} />
          <div style={{ flex: 1, background: "#E2E8F0", borderRadius: 2, height: 6 }}>
            <div style={{ width: `${aPct}%`, height: "100%",
              background: C_ARRHYTHMIA, borderRadius: 2, opacity: isNaN_a ? 0.2 : 1 }} />
          </div>
          <span style={{ fontSize: "0.625rem", color: C_MUTED, width: 50, textAlign: "right" }}>
            {isNaN_a ? "—" : av.toFixed(3)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Score gauge ────────────────────────────────────────────────── */
function MiniGauge({ score, label, color }: {
  score: number | null; label: string; color: string;
}) {
  const pct = score == null ? 0 : Math.min(Math.max(score, 0), 1);
  const dash = pct * 188;

  return (
    <div style={{ textAlign: "center", padding: "1rem" }}>
      <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: C_MUTED, margin: "0 0 0.5rem" }}>
        {label}
      </p>
      <div style={{ position: "relative", width: 110, height: 64, margin: "0 auto" }}>
        <svg viewBox="0 0 140 80" fill="none" style={{ width: "100%", height: "100%" }}>
          <path d="M10 70 A60 60 0 0 1 130 70"
            stroke="#E2E8F0" strokeWidth="12" strokeLinecap="round" fill="none" />
          <path d="M10 70 A60 60 0 0 1 130 70"
            stroke={color} strokeWidth="12" strokeLinecap="round" fill="none"
            strokeDasharray={`${dash} 188`}
            style={{ transition: "stroke-dasharray 0.6s ease" }} />
        </svg>
        <div style={{ position: "absolute", bottom: 0, left: "50%",
          transform: "translateX(-50%)", textAlign: "center" }}>
          {score == null ? (
            <span style={{ fontSize: "0.75rem", color: C_MUTED }}>n/a</span>
          ) : (
            <>
              <span style={{ fontSize: "1.5rem", fontWeight: 800, color,
                lineHeight: 1, letterSpacing: "-0.04em" }}>
                {(pct * 100).toFixed(0)}
              </span>
              <span style={{ fontSize: "0.5625rem", color: C_MUTED }}>/100</span>
            </>
          )}
        </div>
      </div>
      <p style={{ fontSize: "0.75rem", fontWeight: 600, color, marginTop: "0.25rem" }}>
        {score == null ? "No model score" :
          pct >= 0.65 ? "Elevated signal" :
          pct >= 0.4  ? "Moderate signal" : "Low signal"}
      </p>
    </div>
  );
}

/* ── Pipeline step ──────────────────────────────────────────────── */
function PipelineStep({
  number, title, description, icon, accent,
}: {
  number: string; title: string; description: string; icon: string; accent: string;
}) {
  return (
    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
        background: `${accent}15`, border: `1.5px solid ${accent}40`,
        display: "flex", alignItems: "center", justifyContent: "center", color: accent }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
          <path d={icon} />
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem",
          marginBottom: "0.25rem" }}>
          <span style={{ fontSize: "0.5625rem", fontWeight: 800, color: accent,
            letterSpacing: "0.08em" }}>{number}</span>
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: C_INK }}>{title}</span>
        </div>
        <p style={{ fontSize: "0.75rem", color: C_MUTED, margin: 0, lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
    </div>
  );
}

/* ── Record selector ────────────────────────────────────────────── */
function RecordSelector({
  label, color, records, selected, onSelect, hint,
}: {
  label: string; color: string;
  records: ResearchRecord[]; selected: string;
  onSelect: (id: string) => void; hint: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={{ display: "flex", alignItems: "center", gap: "0.375rem",
        marginBottom: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%",
          background: color, flexShrink: 0 }} />
        {label}
      </label>
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        style={{
          width: "100%", padding: "0.5rem 0.75rem",
          border: `1px solid ${color}50`, borderRadius: "0.5rem",
          fontSize: "0.8125rem", background: C_SURFACE, color: C_INK,
          outline: "none", cursor: "pointer",
        }}
      >
        {records.map((r) => (
          <option key={r.id} value={r.id}>
            {r.record_name} {r.source_dataset ? `(${r.source_dataset})` : ""}
          </option>
        ))}
        {records.length === 0 && <option value="">No recordings loaded</option>}
      </select>
      <p style={{ fontSize: "0.625rem", color: C_MUTED, margin: "0.25rem 0 0" }}>{hint}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════ */
export default function ComparisonPage() {
  const recordsQ = useQuery({ queryKey: ["records"], queryFn: api.records });
  const records: ResearchRecord[] = recordsQ.data?.records ?? [];

  // Default: first two records
  const [normalId,   setNormalId]   = useState<string>("");
  const [arrhythmiaId, setArrhythmiaId] = useState<string>("");

  const normalSel   = normalId   || records[0]?.id || "";
  const arrSel      = arrhythmiaId || records[1]?.id || records[0]?.id || "";

  /* Process both records */
  const normalProc = useMutation({
    mutationFn: () => api.process(normalSel),
  });
  const arrProc = useMutation({
    mutationFn: () => api.process(arrSel),
  });

  /* Run forecasts for both */
  const normalForecast = useMutation({
    mutationFn: () => api.forecast({
      record_id: normalSel, observation_s: 30, horizon_s: 60, target_event: "vt",
    }),
  });
  const arrForecast = useMutation({
    mutationFn: () => api.forecast({
      record_id: arrSel, observation_s: 30, horizon_s: 60, target_event: "vt",
    }),
  });

  const handleRunComparison = async () => {
    await Promise.allSettled([
      normalProc.mutateAsync(),
      arrProc.mutateAsync(),
    ]);
    await Promise.allSettled([
      normalForecast.mutateAsync(),
      arrForecast.mutateAsync(),
    ]);
  };

  /* ── Derive waveform data ──────────────────────────────────────── */
  const normalWaveform = useMemo((): { t: number; v: number }[] => {
    const d = normalProc.data as Record<string, unknown> | undefined;
    if (!d?.waveforms) return [];
    const { indices, cleaned, time_s } = d.waveforms as {
      indices: number[]; cleaned: number[]; raw: number[]; time_s: number[];
    };
    const times = time_s || indices.map((_v, idx) => idx / 250);
    return cleaned.slice(0, 1500).map((v, idx) => ({
      t: parseFloat((times[idx] ?? idx / 250).toFixed(3)),
      v: parseFloat(v.toFixed(4)),
    }));
  }, [normalProc.data]);

  const arrWaveform = useMemo((): { t: number; v: number }[] => {
    const d = arrProc.data as Record<string, unknown> | undefined;
    if (!d?.waveforms) return [];
    const { cleaned, time_s, indices } = d.waveforms as {
      indices: number[]; cleaned: number[]; time_s: number[];
    };
    const times = time_s || indices.map((_v, idx) => idx / 250);
    return cleaned.slice(0, 1500).map((v, idx) => ({
      t: parseFloat((times[idx] ?? idx / 250).toFixed(3)),
      v: parseFloat(v.toFixed(4)),
    }));
  }, [arrProc.data]);

  /* ── Features ─────────────────────────────────────────────────── */
  const normalFeatures = useMemo(() => {
    const d = normalProc.data as Record<string, unknown> | undefined;
    return (d?.features as { values?: Record<string, number> } | undefined)?.values ?? {};
  }, [normalProc.data]);

  const arrFeatures = useMemo(() => {
    const d = arrProc.data as Record<string, unknown> | undefined;
    return (d?.features as { values?: Record<string, number> } | undefined)?.values ?? {};
  }, [arrProc.data]);

  const normalRPeaks = useMemo(() => {
    const d = normalProc.data as Record<string, unknown> | undefined;
    return (d?.r_peaks as { times_s?: number[] } | undefined)?.times_s ?? [];
  }, [normalProc.data]);

  const arrRPeaks = useMemo(() => {
    const d = arrProc.data as Record<string, unknown> | undefined;
    return (d?.r_peaks as { times_s?: number[] } | undefined)?.times_s ?? [];
  }, [arrProc.data]);

  const normalAnnotations = useMemo(() => {
    const d = normalProc.data as Record<string, unknown> | undefined;
    return (d?.annotations as { event_type: string; start_time: number }[] | undefined) ?? [];
  }, [normalProc.data]);

  const arrAnnotations = useMemo(() => {
    const d = arrProc.data as Record<string, unknown> | undefined;
    return (d?.annotations as { event_type: string; start_time: number }[] | undefined) ?? [];
  }, [arrProc.data]);

  const normalFs = useMemo(() => {
    const d = normalProc.data as Record<string, unknown> | undefined;
    return (d?.sampling_rate as number) ?? 360;
  }, [normalProc.data]);

  const arrFs = useMemo(() => {
    const d = arrProc.data as Record<string, unknown> | undefined;
    return (d?.sampling_rate as number) ?? 250;
  }, [arrProc.data]);

  /* Scores */
  const normalScore = (normalForecast.data as Record<string, unknown> | undefined)
    ?.model_score as number | null | undefined;
  const arrScore = (arrForecast.data as Record<string, unknown> | undefined)
    ?.model_score as number | null | undefined;

  const hasData = normalProc.isSuccess && arrProc.isSuccess;
  const isLoading = normalProc.isPending || arrProc.isPending ||
    normalForecast.isPending || arrForecast.isPending;

  const normalRecord = records.find((r) => r.id === normalSel);
  const arrRecord    = records.find((r) => r.id === arrSel);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: C_INK, margin: "0 0 0.25rem" }}>
          ECG Comparison — Normal vs Ventricular Arrhythmia
        </h1>
        <p style={{ fontSize: "0.875rem", color: C_MUTED, margin: 0 }}>
          Side-by-side ECG analysis and prediction pipeline walkthrough.
          Select two recordings and run the comparison to see how the model distinguishes them.
        </p>
      </div>

      {/* ── Disclaimer ───────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start",
        background: "#FFF7ED", border: "1px solid #FED7AA",
        borderRadius: "0.75rem", padding: "0.75rem 1rem",
        fontSize: "0.8125rem", color: "#92400E" }}>
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}>
          <path d={I.warning} />
        </svg>
        Research prototype only. All outputs are experimental estimates derived from ECG signal features.
        Not validated for clinical use. Do not use for medical decisions.
      </div>

      {/* ── Record selection + run ───────────────────────────────── */}
      <div style={{ background: C_SURFACE, border: `1px solid ${C_LINE}`,
        borderRadius: "0.875rem", padding: "1.25rem" }}>
        <SectionTitle>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2} style={{ marginRight: 6, verticalAlign: "middle" }}>
            <path d={I.compare} />
          </svg>
          Select recordings to compare
        </SectionTitle>

        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <RecordSelector
            label="Reference recording (Normal / Baseline)"
            color={C_NORMAL}
            records={records}
            selected={normalSel}
            onSelect={setNormalId}
            hint="Choose a recording with predominantly normal sinus rhythm"
          />

          {/* Arrow between */}
          <div style={{ padding: "0 0.25rem 1.5rem", color: C_MUTED, flexShrink: 0 }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2}>
              <path d={I.arrow} />
            </svg>
          </div>

          <RecordSelector
            label="Comparison recording (Arrhythmia / Target)"
            color={C_ARRHYTHMIA}
            records={records}
            selected={arrSel}
            onSelect={setArrhythmiaId}
            hint="Choose a recording with VT/VF annotations (SDDB or MITDB)"
          />

          <button
            type="button"
            onClick={handleRunComparison}
            disabled={isLoading || !normalSel || !arrSel}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.6rem 1.25rem", borderRadius: "0.5rem",
              background: C_TEAL, color: "#fff", border: "none",
              fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
              opacity: isLoading ? 0.7 : 1, flexShrink: 0,
              marginBottom: "1.5rem",
            }}
          >
            {isLoading ? <Spinner size={14} /> : (
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2}>
                <path d={I.load} />
              </svg>
            )}
            {isLoading ? "Running analysis…" : "Run comparison"}
          </button>
        </div>

        {(normalProc.error || arrProc.error) && (
          <div style={{ marginTop: "0.75rem" }}>
            {normalProc.error && <ErrorBox message={(normalProc.error as Error).message} />}
            {arrProc.error   && <ErrorBox message={(arrProc.error as Error).message} />}
          </div>
        )}
      </div>

      {/* ── Waveforms side-by-side ───────────────────────────────── */}
      {hasData && (
        <div style={{ background: C_SURFACE, border: `1px solid ${C_LINE}`,
          borderRadius: "0.875rem", padding: "1.25rem" }}>
          <SectionTitle>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} style={{ marginRight: 6, verticalAlign: "middle" }}>
              <path d={I.peak} />
            </svg>
            ECG Waveforms — first 4 seconds
          </SectionTitle>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <EcgWaveform
              waveform={normalWaveform}
              rPeaks={normalRPeaks}
              color={C_NORMAL}
              label={normalRecord?.record_name ?? "Reference recording"}
              annotations={normalAnnotations}
              fs={normalFs}
            />
            <EcgWaveform
              waveform={arrWaveform}
              rPeaks={arrRPeaks}
              color={C_ARRHYTHMIA}
              label={arrRecord?.record_name ?? "Arrhythmia recording"}
              annotations={arrAnnotations}
              fs={arrFs}
            />
          </div>

          <div style={{ marginTop: "0.75rem", display: "flex", gap: "1.5rem",
            fontSize: "0.6875rem", color: C_MUTED }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 20, height: 2, background: C_NORMAL,
                display: "inline-block" }} />
              Reference / normal sinus
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 20, height: 2, background: C_ARRHYTHMIA,
                display: "inline-block" }} />
              Arrhythmia recording
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 20, height: 2, background: C_ARRHYTHMIA,
                display: "inline-block", borderTop: `2px dashed ${C_ARRHYTHMIA}` }} />
              VT/VF annotation
            </span>
          </div>
        </div>
      )}

      {/* ── Feature comparison ───────────────────────────────────── */}
      {hasData && (
        <div style={{ background: C_SURFACE, border: `1px solid ${C_LINE}`,
          borderRadius: "0.875rem", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <SectionTitle>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2} style={{ marginRight: 6, verticalAlign: "middle" }}>
                <path d={I.model} />
              </svg>
              ECG Feature Comparison — model inputs
            </SectionTitle>
            <div style={{ display: "flex", gap: "1rem", fontSize: "0.6875rem" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: C_MUTED }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%",
                  background: C_NORMAL, flexShrink: 0 }} />
                {normalRecord?.record_name ?? "Reference"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: C_MUTED }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%",
                  background: C_ARRHYTHMIA, flexShrink: 0 }} />
                {arrRecord?.record_name ?? "Arrhythmia"}
              </span>
              <span style={{ color: C_MUTED }}>% diff = arrhythmia vs reference</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            border: `1px solid ${C_LINE}`, borderRadius: "0.5rem", overflow: "hidden" }}>
            {KEY_FEATURES.map((feat) => (
              <FeatureBar
                key={feat}
                feature={feat}
                normalVal={normalFeatures[feat] ?? null}
                arrVal={arrFeatures[feat] ?? null}
              />
            ))}
          </div>

          <p style={{ fontSize: "0.6875rem", color: C_MUTED, marginTop: "0.75rem" }}>
            These 15 features (HRV-like metrics, QRS morphology, signal statistics) are
            the exact inputs fed to the prediction model — computed from the observation window
            before the prediction time.
          </p>
        </div>
      )}

      {/* ── Prediction scores ────────────────────────────────────── */}
      {hasData && (
        <div style={{ background: C_SURFACE, border: `1px solid ${C_LINE}`,
          borderRadius: "0.875rem", padding: "1.25rem" }}>
          <SectionTitle>Prediction model output — VT risk score (0–100)</SectionTitle>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
            border: `1px solid ${C_LINE}`, borderRadius: "0.5rem", overflow: "hidden" }}>

            {/* Normal score */}
            <div style={{ borderRight: `1px solid ${C_LINE}` }}>
              <MiniGauge
                score={normalScore ?? null}
                label={normalRecord?.record_name ?? "Reference"}
                color={C_NORMAL}
              />
              <div style={{ padding: "0 1rem 1rem", fontSize: "0.75rem", color: C_MUTED }}>
                {normalForecast.isError ? (
                  <span style={{ color: "#DC2626" }}>
                    {(normalForecast.error as Error).message}
                  </span>
                ) : normalForecast.data ? (
                  <>
                    <p style={{ margin: "0 0 0.25rem" }}>
                      Status: <strong style={{ color: C_INK }}>
                        {String((normalForecast.data as Record<string, unknown>).status ?? "—")}
                      </strong>
                    </p>
                    <p style={{ margin: 0 }}>
                      Ground truth in horizon:{" "}
                      <strong style={{
                        color: (normalForecast.data as Record<string, unknown>).ground_truth_in_horizon === 1
                          ? C_ARRHYTHMIA : C_NORMAL,
                      }}>
                        {(normalForecast.data as Record<string, unknown>).ground_truth_in_horizon === 1
                          ? "VT annotated" : "No VT event"}
                      </strong>
                    </p>
                  </>
                ) : (
                  <span style={{ color: C_MUTED }}>Train a model first to see scores</span>
                )}
              </div>
            </div>

            {/* Arrhythmia score */}
            <div>
              <MiniGauge
                score={arrScore ?? null}
                label={arrRecord?.record_name ?? "Arrhythmia"}
                color={C_ARRHYTHMIA}
              />
              <div style={{ padding: "0 1rem 1rem", fontSize: "0.75rem", color: C_MUTED }}>
                {arrForecast.isError ? (
                  <span style={{ color: "#DC2626" }}>
                    {(arrForecast.error as Error).message}
                  </span>
                ) : arrForecast.data ? (
                  <>
                    <p style={{ margin: "0 0 0.25rem" }}>
                      Status: <strong style={{ color: C_INK }}>
                        {String((arrForecast.data as Record<string, unknown>).status ?? "—")}
                      </strong>
                    </p>
                    <p style={{ margin: 0 }}>
                      Ground truth in horizon:{" "}
                      <strong style={{
                        color: (arrForecast.data as Record<string, unknown>).ground_truth_in_horizon === 1
                          ? C_ARRHYTHMIA : C_NORMAL,
                      }}>
                        {(arrForecast.data as Record<string, unknown>).ground_truth_in_horizon === 1
                          ? "VT annotated" : "No VT event"}
                      </strong>
                    </p>
                    {(arrForecast.data as Record<string, unknown>).lead_time_seconds != null && (
                      <p style={{ margin: "0.25rem 0 0", color: C_AMBER, fontWeight: 600 }}>
                        Lead time:{" "}
                        {((arrForecast.data as Record<string, unknown>).lead_time_seconds as number).toFixed(1)} s
                        before event
                      </p>
                    )}
                  </>
                ) : (
                  <span style={{ color: C_MUTED }}>Train a model first to see scores</span>
                )}
              </div>
            </div>
          </div>

          {!normalForecast.data && !arrForecast.data && (
            <div style={{ marginTop: "0.75rem", padding: "0.75rem",
              background: "#F0F9FF", border: "1px solid #BAE6FD",
              borderRadius: "0.5rem", fontSize: "0.8125rem", color: "#0369A1",
              display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2}>
                <path d={I.info} />
              </svg>
              To see prediction scores: go to the{" "}
              <strong>Forecasting</strong> page, train the model, then come back and re-run.
            </div>
          )}
        </div>
      )}

      {/* ── How prediction works ─────────────────────────────────── */}
      <div style={{ background: C_SURFACE, border: `1px solid ${C_LINE}`,
        borderRadius: "0.875rem", padding: "1.25rem" }}>
        <SectionTitle>How the prediction pipeline works</SectionTitle>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <PipelineStep
            number="01"
            title="ECG Signal Input"
            icon="M22 12h-4l-3 9L9 3l-3 9H2"
            accent={C_TEAL}
            description="Raw ECG signal (mV) sampled at 250–360 Hz from MITDB (normal/arrhythmia labeled) or SDDB (sudden cardiac death recordings with VF onset times)."
          />
          <PipelineStep
            number="02"
            title="Preprocessing & R-Peak Detection"
            icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9"
            accent="#8B5CF6"
            description="Butterworth bandpass filter (0.5–40 Hz) removes baseline wander and high-frequency noise. Pan–Tompkins QRS detector finds R-peaks. Each detected peak defines one heartbeat."
          />
          <PipelineStep
            number="03"
            title="Feature Extraction — Observation Window"
            icon="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 7l1 10h14l1-10H4z"
            accent={C_AMBER}
            description="From the observation window [t − 30s, t), 15 features are computed: HRV metrics (mean/SD/RMSSD of RR intervals), QRS morphology (width, amplitude), and signal statistics (energy, skewness, kurtosis). These become the input vector for the ML model."
          />
          <PipelineStep
            number="04"
            title="Labeling — Does VT occur in horizon H?"
            icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            accent={C_ARRHYTHMIA}
            description="Label = 1 if any VT annotation starts in (t, t+H]. Label = 0 otherwise. This is the ground truth the model learns to predict. MITDB records have beat-level labels; SDDB records have VF onset times in their headers."
          />
          <PipelineStep
            number="05"
            title="Model Training — Logistic Regression"
            icon="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            accent="#0D9488"
            description="A logistic regression (with median imputation + z-normalization) is trained on labelled windows from all annotated recordings. Train/test split is at the recording level — no overlapping windows across split. Outputs a probability score in [0, 1]."
          />
          <PipelineStep
            number="06"
            title="Inference — Prediction Score"
            icon="M2 12l3-3 4 4 4-7 4 4 3-3M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12"
            accent={C_AMBER}
            description="At prediction time t, the model receives the 15-feature vector and outputs P(VT in next H seconds). Score < 0.33 → Low evidence. Score 0.33–0.66 → Moderate. Score > 0.66 → Elevated. This is experimental and not a validated clinical probability."
          />
        </div>

        {/* Key differences table */}
        <div style={{ marginTop: "1.25rem", borderTop: `1px solid ${C_LINE}`, paddingTop: "1rem" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 700, color: C_INK,
            margin: "0 0 0.75rem" }}>
            Key ECG differences: Normal Sinus vs Ventricular Arrhythmia
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            border: `1px solid ${C_LINE}`, borderRadius: "0.5rem", overflow: "hidden",
            fontSize: "0.75rem" }}>
            {/* Header */}
            {["Feature", "Normal sinus rhythm", "Ventricular arrhythmia"].map((h) => (
              <div key={h} style={{ padding: "0.5rem 0.75rem",
                background: "#F1F5F9", fontWeight: 700, color: C_INK,
                borderBottom: `1px solid ${C_LINE}` }}>
                {h}
              </div>
            ))}
            {/* Rows */}
            {[
              ["Heart rate",       "60–100 bpm, regular", "> 100 bpm or erratic"],
              ["RR intervals",     "Regular, smooth variation", "Irregular, wide variation"],
              ["QRS width",        "Narrow (< 120 ms)", "Wide (≥ 120 ms) in VT"],
              ["QRS morphology",   "Consistent beat shape", "Variable / bizarre morphology"],
              ["SDNN / RMSSD",     "Moderate HRV (~30–80 ms)", "Very low or very high"],
              ["RR variability",   "Low CV (~0.03–0.12)", "High CV in VT/VF (> 0.15)"],
              ["Signal energy",    "Stable across beats", "Elevated or fluctuating"],
            ].map(([feat, norm, arr]) => (
              <React.Fragment key={feat}>
                <div style={{ padding: "0.5rem 0.75rem",
                  borderBottom: `1px solid ${C_LINE}`, color: C_INK, fontWeight: 600 }}>
                  {feat}
                </div>
                <div style={{ padding: "0.5rem 0.75rem",
                  borderBottom: `1px solid ${C_LINE}`, color: C_NORMAL }}>
                  {norm}
                </div>
                <div style={{ padding: "0.5rem 0.75rem",
                  borderBottom: `1px solid ${C_LINE}`, color: C_ARRHYTHMIA }}>
                  {arr}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ── Empty state ──────────────────────────────────────────── */}
      {!hasData && !isLoading && (
        <div style={{ textAlign: "center", padding: "3rem 1.5rem",
          background: C_SURFACE, border: `1px solid ${C_LINE}`, borderRadius: "0.875rem" }}>
          <svg width={40} height={40} viewBox="0 0 24 24" fill="none"
            stroke={C_LINE} strokeWidth={1.5} style={{ margin: "0 auto 0.75rem", display: "block" }}>
            <path d={I.compare} />
          </svg>
          <p style={{ fontSize: "1rem", fontWeight: 600, color: C_INK, margin: 0 }}>
            Select two recordings and click "Run comparison"
          </p>
          <p style={{ fontSize: "0.875rem", color: C_MUTED, margin: "0.375rem auto 0",
            maxWidth: 400 }}>
            Loads both recordings from the backend, extracts features side-by-side,
            and runs the prediction model on both. Load recordings first from the
            Recordings tab if none appear above.
          </p>
        </div>
      )}
    </div>
  );
}
