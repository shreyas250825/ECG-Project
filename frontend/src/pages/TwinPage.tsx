import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Disclaimer } from "../components/Disclaimer";
import { HeartScene } from "../components/heart3d/HeartScene";
import { deriveCardiacVisualizationState } from "../components/heart3d/deriveVisualizationState";
import { Icon, ErrorBox, Spinner, FormField, Collapsible } from "../components/ui";
import { api } from "../services/api";
import type { ResearchRecord } from "../types/research";
import type { CardiacVisualizationState } from "../components/heart3d/types";

/* ── Icons ───────────────────────────────────────────────────────── */
const I = {
  learn:  "M12 6v6l4 2M12 2a10 10 0 110 20A10 10 0 0112 2z",
  update: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  info:   "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  check:  "M20 6L9 17l-5-5",
  twin:   "M12 2a10 10 0 100 20A10 10 0 0012 2zM2 12h20",
  next:   "M5 12h14M12 5l7 7-7 7",
};

/* ── State label & color from deviation score ─────────────────────── */
function stateFromScore(score: number | null | undefined) {
  if (score == null)  return { label: "No baseline yet",    color: "#64748B" };
  if (score < 1)      return { label: "Stable",              color: "#10B981" };
  if (score < 2)      return { label: "Mild deviation",      color: "#F59E0B" };
  return               { label: "Increased deviation",       color: "#EF4444" };
}

/* ── Cardiac state panel (right column top) ─────────────────────── */
function CardiacStatePanel({
  viz,
  deviationScore,
  notes,
  baselineWindows,
  twinPending,
  blPending,
}: {
  viz: CardiacVisualizationState;
  deviationScore: number | null | undefined;
  notes?: string[];
  baselineWindows?: number;
  twinPending: boolean;
  blPending: boolean;
}) {
  const { label, color } = stateFromScore(deviationScore);

  return (
    <div
      style={{
        background: "var(--color-navy)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "0.875rem",
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {/* State headline */}
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontSize: "0.625rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.35)",
            margin: 0,
          }}
        >
          Cardiac state
        </p>
        {(twinPending || blPending) ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
            <Spinner size={16} />
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.875rem" }}>Computing…</span>
          </div>
        ) : (
          <>
            <p
              style={{
                fontSize: "1.75rem",
                fontWeight: 800,
                color,
                margin: "0.375rem 0 0",
                letterSpacing: "-0.04em",
              }}
            >
              {label}
            </p>
            {deviationScore != null && (
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "rgba(255,255,255,0.4)",
                  margin: "0.25rem 0 0",
                }}
              >
                RMS z-score:{" "}
                <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                  {deviationScore.toFixed(3)}
                </span>
              </p>
            )}
          </>
        )}
      </div>

      {/* Measurements grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.5rem",
        }}
      >
        {[
          {
            label: "Heart rate",
            value: viz.heartRate != null ? `${viz.heartRate.toFixed(1)} bpm` : "—",
            color: viz.heartRate != null ? "#14B8A6" : undefined,
          },
          {
            label: "Signal quality",
            value: viz.signalQuality != null ? viz.signalQuality.toFixed(2) : "—",
          },
          {
            label: "RR mean",
            value: viz.rrMeanSeconds != null ? `${viz.rrMeanSeconds.toFixed(3)} s` : "—",
          },
          {
            label: "R-peaks",
            value: viz.rPeakTimesS.length > 0 ? String(viz.rPeakTimesS.length) : "—",
          },
        ].map(({ label, value, color: c }) => (
          <div
            key={label}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "0.5rem",
              padding: "0.5rem 0.625rem",
            }}
          >
            <p
              style={{
                fontSize: "0.5625rem",
                fontWeight: 700,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.3)",
                margin: 0,
              }}
            >
              {label}
            </p>
            <p
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: c ?? "rgba(255,255,255,0.75)",
                margin: "0.125rem 0 0",
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Baseline info */}
      {baselineWindows != null && (
        <div
          style={{
            background: "rgba(13,148,136,0.08)",
            border: "1px solid rgba(13,148,136,0.2)",
            borderRadius: "0.5rem",
            padding: "0.625rem 0.75rem",
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Baseline: <strong style={{ color: "#14B8A6" }}>{baselineWindows}</strong> ECG windows (0–60 s).{" "}
          Deviation = distance from learned baseline, not a clinical label.
        </div>
      )}

      {/* System notes */}
      {notes && notes.length > 0 && (
        <div>
          <p
            style={{
              fontSize: "0.5625rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.25)",
              marginBottom: "0.375rem",
            }}
          >
            System notes
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: "1rem",
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            {notes.map((n: string) => (
              <li key={n} style={{ marginBottom: "0.125rem" }}>
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No state yet */}
      {deviationScore == null && !twinPending && !blPending && (
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px dashed rgba(255,255,255,0.08)",
            borderRadius: "0.625rem",
            padding: "1rem",
            textAlign: "center",
          }}
        >
          <Icon d={I.twin} size={24} style={{ color: "rgba(255,255,255,0.12)", margin: "0 auto 0.5rem" }} />
          <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "rgba(255,255,255,0.4)", margin: 0 }}>
            No twin state yet
          </p>
          <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.25)", margin: "0.25rem 0 0" }}>
            Learn a baseline then update the twin state to see cardiac state information.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Deviation bar chart (right column) ──────────────────────────── */
function DeviationChart({
  data,
}: {
  data: { name: string; deviation: number }[];
}) {
  if (!data.length) return null;
  const maxDev = Math.max(...data.map((d) => Math.abs(d.deviation)), 0.1);

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: "0.875rem",
        padding: "1rem 1rem 0.5rem",
      }}
    >
      <p
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--color-ink)",
          margin: "0 0 0.75rem",
        }}
      >
        Baseline deviation per feature
      </p>
      <div style={{ height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, left: -20, bottom: 54 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fontSize: 7.5, fill: "#94a3b8" }}
              interval={0}
              angle={-40}
              textAnchor="end"
              height={65}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: "1px solid #E2E8F0",
                borderRadius: "0.5rem",
                fontSize: "0.75rem",
              }}
              formatter={(v: number) => [v.toFixed(3), "z-score"]}
            />
            <Bar dataKey="deviation" radius={[3, 3, 0, 0]}>
              {data.map((entry, i) => {
                const abs = Math.abs(entry.deviation) / maxDev;
                const c =
                  abs > 0.8 ? "#EF4444" : abs > 0.5 ? "#F59E0B" : "#0D9488";
                return <Cell key={i} fill={c} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p style={{ fontSize: "0.625rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
        Red &gt; amber &gt; teal by deviation magnitude
      </p>
    </div>
  );
}

/* ── State vector table (expandable) ─────────────────────────────── */
function StateVectorTable({
  state,
  dev,
}: {
  state: Record<string, number>;
  dev?: Record<string, number>;
}) {
  const entries = Object.entries(state).slice(0, 24);
  return (
    <div style={{ maxHeight: 240, overflowY: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Feature</th>
            <th style={{ textAlign: "right" }}>Value</th>
            {dev && (
              <th style={{ textAlign: "right" }}>Deviation (z)</th>
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map(([k, v]) => {
            const d = dev?.[k];
            const absD = d != null ? Math.abs(d) : 0;
            const dc =
              absD > 2 ? "#DC2626" : absD > 1 ? "#D97706" : "var(--color-ink)";
            return (
              <tr key={k}>
                <td
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.6875rem",
                  }}
                >
                  {k}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontSize: "0.75rem",
                  }}
                >
                  {Number.isFinite(v) ? v.toFixed(4) : "n/a"}
                </td>
                {dev && (
                  <td
                    style={{
                      textAlign: "right",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: dc,
                    }}
                  >
                    {d != null ? d.toFixed(3) : "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Anatomy legend sidebar (optional, shows on anatomy mode) ──────── */
const ANATOMY_STRUCTURES = [
  { id: "ra",    name: "Right atrium",     desc: "Receives deoxygenated blood from venae cavae" },
  { id: "la",    name: "Left atrium",      desc: "Receives oxygenated blood from pulmonary veins" },
  { id: "rv",    name: "Right ventricle",  desc: "Pumps deoxygenated blood to lungs via pulmonary artery" },
  { id: "lv",    name: "Left ventricle",   desc: "Pumps oxygenated blood to body via aorta" },
  { id: "aorta", name: "Aorta",            desc: "Main artery distributing oxygenated blood to the body" },
  { id: "pa",    name: "Pulmonary artery", desc: "Carries deoxygenated blood from right ventricle to lungs" },
];

function AnatomyLegend() {
  const [selected, setSelected] = useState<string | null>(null);
  const sel = ANATOMY_STRUCTURES.find((s) => s.id === selected);

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: "0.875rem",
        padding: "1rem",
      }}
    >
      <p
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--color-ink)",
          margin: "0 0 0.75rem",
        }}
      >
        Anatomy reference
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {ANATOMY_STRUCTURES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelected(selected === s.id ? null : s.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.375rem 0.625rem",
              borderRadius: "0.375rem",
              border: "1px solid",
              borderColor:
                selected === s.id
                  ? "rgba(13,148,136,0.4)"
                  : "var(--color-line)",
              background:
                selected === s.id
                  ? "rgba(13,148,136,0.06)"
                  : "transparent",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.12s",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background:
                  selected === s.id ? "var(--color-teal)" : "#CBD5E1",
                flexShrink: 0,
                transition: "background 0.12s",
              }}
            />
            <span
              style={{
                fontSize: "0.8125rem",
                fontWeight: selected === s.id ? 600 : 400,
                color:
                  selected === s.id
                    ? "var(--color-teal-dim)"
                    : "var(--color-ink)",
              }}
            >
              {s.name}
            </span>
          </button>
        ))}
      </div>

      {sel && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.625rem 0.75rem",
            background: "rgba(13,148,136,0.04)",
            border: "1px solid rgba(13,148,136,0.15)",
            borderRadius: "0.5rem",
            fontSize: "0.75rem",
            color: "var(--color-muted)",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "var(--color-ink)" }}>{sel.name}:</strong>{" "}
          {sel.desc}
        </div>
      )}

      <p
        style={{
          fontSize: "0.625rem",
          color: "var(--color-muted)",
          marginTop: "0.75rem",
          lineHeight: 1.5,
        }}
      >
        Illustrative 3D model only — not patient-specific anatomy. Enable
        "Labels" in the visualization toolbar to see annotated positions.
      </p>
    </div>
  );
}

/* ── Forecast readiness indicator ────────────────────────────────── */
function ForecastReadiness({ viz }: { viz: CardiacVisualizationState }) {
  const ready = viz.dataAvailable && viz.baselineDeviation != null;
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: "0.875rem",
        padding: "1rem",
        display: "flex",
        gap: "0.75rem",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: ready
            ? "rgba(13,148,136,0.1)"
            : "rgba(100,116,139,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon
          d={ready ? I.check : I.next}
          size={16}
          style={{ color: ready ? "var(--color-teal)" : "var(--color-muted)" }}
        />
      </div>
      <div>
        <p
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--color-ink)",
            margin: 0,
          }}
        >
          {ready ? "Ready for forecasting" : "Complete twin state first"}
        </p>
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--color-muted)",
            margin: "0.125rem 0 0",
          }}
        >
          {ready
            ? "Run an experimental forecast from the Forecasting page"
            : "ECG analysis + baseline + twin state update required"}
        </p>
      </div>
    </div>
  );
}

/* ── Controls bar ────────────────────────────────────────────────── */
function ControlsBar({
  records,
  selected,
  end,
  onSelect,
  onEnd,
  onBaseline,
  onTwin,
  blPending,
  twPending,
}: {
  records: ResearchRecord[];
  selected: string;
  end: number;
  onSelect: (id: string) => void;
  onEnd: (v: number) => void;
  onBaseline: () => void;
  onTwin: () => void;
  blPending: boolean;
  twPending: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: "0.875rem",
        padding: "0.875rem 1.125rem",
        display: "flex",
        alignItems: "flex-end",
        gap: "0.75rem",
        flexWrap: "wrap",
        marginBottom: "1.25rem",
      }}
    >
      {/* Recording */}
      <div style={{ flex: "1 1 180px", minWidth: 150 }}>
        <label className="field-label">Recording</label>
        <select
          className="field-select"
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
        >
          {records.map((r) => (
            <option key={r.id} value={r.id}>
              {r.record_name}
            </option>
          ))}
          {records.length === 0 && (
            <option value="">No recordings loaded</option>
          )}
        </select>
      </div>

      {/* Baseline */}
      <button
        type="button"
        className="btn-secondary"
        onClick={onBaseline}
        disabled={!selected || blPending}
      >
        {blPending ? <Spinner size={14} /> : <Icon d={I.learn} size={14} />}
        Learn baseline (0–60 s)
      </button>

      {/* Window end + update twin */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
        <FormField label="Window end (s)">
          <input
            className="field-input"
            type="number"
            value={end}
            onChange={(e) => onEnd(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </FormField>
        <button
          type="button"
          className="btn-primary"
          onClick={onTwin}
          disabled={!selected || twPending}
        >
          {twPending ? <Spinner size={14} /> : <Icon d={I.update} size={14} />}
          Update twin state
        </button>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function TwinPage() {
  const recordsQ = useQuery({ queryKey: ["records"], queryFn: api.records });
  const records: ResearchRecord[] = recordsQ.data?.records ?? [];
  const [rid, setRid] = useState("");
  const selected = rid || records[0]?.id || "";
  const [end, setEnd] = useState(60);

  const bl = useMutation({
    mutationFn: () =>
      api.baseline({ record_id: selected, window_start_s: 0, window_end_s: 60 }),
  });
  const tw = useMutation({
    mutationFn: () =>
      api.twin({ record_id: selected, timestamp_s: end, window_s: 20 }),
  });

  const stateVec      = tw.data?.state_vector as Record<string, number> | undefined;
  const devVec        = tw.data?.deviation    as Record<string, number> | undefined;
  const deviationScore = tw.data?.deviation_score as number | undefined | null;

  const chartData = stateVec
    ? Object.keys(stateVec).map((k) => ({
        name: k,
        current: stateVec[k],
        deviation: devVec?.[k] ?? 0,
      }))
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
    <div className="fade-in">
      {/* ── Page header ────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.375rem",
              fontWeight: 700,
              color: "var(--color-ink)",
              margin: 0,
            }}
          >
            Digital Twin
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--color-muted)",
              marginTop: "0.25rem",
            }}
          >
            Patient-specific cardiac state representation from ECG feature vectors
          </p>
        </div>
        <Disclaimer compact />
      </div>

      {/* Research notice */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "flex-start",
          background: "rgba(13,148,136,0.04)",
          border: "1px solid rgba(13,148,136,0.15)",
          borderRadius: "0.75rem",
          padding: "0.75rem 1rem",
          marginBottom: "1.25rem",
          fontSize: "0.8125rem",
          color: "var(--color-muted)",
        }}
      >
        <Icon
          d={I.info}
          size={15}
          style={{ color: "var(--color-teal)", flexShrink: 0, marginTop: "0.0625rem" }}
        />
        Computational representation of cardiac electrical characteristics from ECG features.
        The 3D visualization is illustrative — not an anatomical reconstruction, electrophysiology
        solver, or clinical digital twin.
      </div>

      {/* Controls */}
      <ControlsBar
        records={records}
        selected={selected}
        end={end}
        onSelect={setRid}
        onEnd={setEnd}
        onBaseline={() => bl.mutate()}
        onTwin={() => tw.mutate()}
        blPending={bl.isPending}
        twPending={tw.isPending}
      />

      {/* Errors & success */}
      {bl.error && (
        <div style={{ marginBottom: "0.875rem" }}>
          <ErrorBox message={(bl.error as Error).message} />
        </div>
      )}
      {tw.error && (
        <div style={{ marginBottom: "0.875rem" }}>
          <ErrorBox message={(tw.error as Error).message} />
        </div>
      )}
      {bl.isSuccess && !bl.isPending && (
        <div
          style={{
            marginBottom: "0.875rem",
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: "0.5rem",
            padding: "0.5rem 0.875rem",
            fontSize: "0.8125rem",
            color: "#166534",
          }}
        >
          ✓ Baseline learned from{" "}
          {(bl.data as { n_windows?: number })?.n_windows ?? "?"} windows
        </div>
      )}

      {/* ── Main two-column workspace ─────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.8fr) minmax(0, 1fr)",
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        {/* LEFT — 3D visualization */}
        <HeartScene viz={viz} lastRPeakMs={null} tall />

        {/* RIGHT — state information */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <CardiacStatePanel
            viz={viz}
            deviationScore={deviationScore}
            notes={tw.data?.notes as string[] | undefined}
            baselineWindows={
              (bl.data as { n_windows?: number } | undefined)?.n_windows
            }
            twinPending={tw.isPending}
            blPending={bl.isPending}
          />

          {chartData.length > 0 && <DeviationChart data={chartData} />}

          <AnatomyLegend />

          <ForecastReadiness viz={viz} />
        </div>
      </div>

      {/* ── State vector (collapsible) ─────────────────────────── */}
      {stateVec && (
        <div
          style={{
            marginTop: "1.25rem",
            background: "var(--color-surface)",
            border: "1px solid var(--color-line)",
            borderRadius: "0.875rem",
            padding: "1rem 1.25rem",
          }}
        >
          <Collapsible
            trigger={
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <p
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--color-ink)",
                    margin: 0,
                  }}
                >
                  State vector
                </p>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--color-muted)",
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-line)",
                    borderRadius: "9999px",
                    padding: "0.0625rem 0.5rem",
                  }}
                >
                  {Object.keys(stateVec).length} features
                </span>
              </div>
            }
          >
            <StateVectorTable state={stateVec} dev={devVec} />
            <p
              style={{
                fontSize: "0.6875rem",
                color: "var(--color-muted)",
                marginTop: "0.5rem",
              }}
            >
              ECG feature values and their deviation z-scores from learned
              baseline. Deviation uses the same feature normalization used
              during baseline construction.
            </p>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
