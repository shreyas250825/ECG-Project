import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Disclaimer } from "../components/Disclaimer";
import { Icon, PageHeader, SectionCard, StatCard, ErrorBox, Spinner, FormField } from "../components/ui";
import { api } from "../services/api";
import { saveForecast } from "../services/forecastService";
import { useAuth } from "../contexts/AuthContext";
import type { ResearchRecord } from "../types/research";

const HORIZONS = [5, 10, 20, 30];

const I = {
  forecast: "M2 12l3-3 4 4 4-7 4 4 3-3",
  train:    "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
  run:      "M5 3l14 9-14 9V3z",
  info:     "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  clock:    "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  warning:  "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
};

/* ── Forecast score gauge ──────────────────────────────────────────── */
function ScoreGauge({ score }: { score: number | null }) {
  if (score == null) return null;

  const pct = Math.min(Math.max(score, 0), 1);
  const color = pct >= 0.65 ? "#EF4444" : pct >= 0.4 ? "#F59E0B" : "#10B981";
  const label = pct >= 0.65 ? "Elevated" : pct >= 0.4 ? "Intermediate" : "Low";

  return (
    <div
      style={{
        background: "var(--color-navy)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "0.875rem",
        padding: "1.5rem",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: 0 }}>
        Model output score
      </p>

      {/* Arc gauge */}
      <div style={{ position: "relative", width: 140, height: 80, margin: "1rem auto 0" }}>
        <svg viewBox="0 0 140 80" fill="none" style={{ width: "100%", height: "100%" }}>
          {/* Track */}
          <path
            d="M 10 70 A 60 60 0 0 1 130 70"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
          />
          {/* Fill */}
          <path
            d="M 10 70 A 60 60 0 0 1 130 70"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${pct * 188} 188`}
            style={{ transition: "stroke-dasharray 0.5s ease" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "2rem", fontWeight: 800, color, margin: 0, letterSpacing: "-0.04em", lineHeight: 1 }}>
            {(pct * 100).toFixed(0)}
          </p>
          <p style={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.35)", margin: 0 }}>/ 100</p>
        </div>
      </div>

      <p style={{ fontSize: "0.875rem", fontWeight: 700, color, marginTop: "0.5rem" }}>{label} research signal</p>
      <p style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.3)", marginTop: "0.25rem" }}>
        Experimental estimate — not a clinical probability
      </p>
    </div>
  );
}

/* ── Forecast result breakdown ─────────────────────────────────────── */
function ForecastResult({ d }: { d: Record<string, unknown> }) {
  const score = d.model_score as number | null;
  const groundTruth = d.ground_truth_in_horizon as number | null;
  const leadTime   = d.lead_time_seconds as number | null;
  const obsS = d.observation_window_s as number | null;
  const horizS = d.forecast_horizon_s as number | null;
  const tPred = d.prediction_time_s as number | null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <ScoreGauge score={score} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <StatCard
          label="Observation window"
          value={obsS != null ? `${(obsS / 60).toFixed(1)} min` : "—"}
          sub={obsS != null ? `${obsS} seconds` : ""}
        />
        <StatCard
          label="Forecast horizon"
          value={horizS != null ? `${(horizS / 60).toFixed(1)} min` : "—"}
          sub={horizS != null ? `${horizS} seconds H` : ""}
        />
        <StatCard
          label="Prediction time"
          value={tPred != null ? `t = ${tPred.toFixed(1)} s` : "—"}
        />
        <StatCard
          label="Ground truth in H"
          value={groundTruth == null ? "—" : groundTruth === 1 ? "Event annotated" : "No event"}
          accent={groundTruth === 1 ? "#EF4444" : groundTruth === 0 ? "#059669" : undefined}
        />
      </div>

      {leadTime != null && (
        <div
          style={{
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: "0.5rem",
            padding: "0.625rem 0.875rem",
            fontSize: "0.8125rem",
            color: "#166534",
          }}
        >
          Observed lead time: <strong>{leadTime.toFixed(1)} s</strong>
        </div>
      )}

      <div className="card-sm">
        <p style={{ fontSize: "0.75rem", margin: 0 }}>
          <strong>Status:</strong> {String(d.status ?? "—")}
        </p>
        {d.message != null && (
          <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", margin: "0.25rem 0 0" }}>
            {String(d.message)}
          </p>
        )}
        {d.horizon_note != null && (
          <p style={{ fontSize: "0.6875rem", color: "var(--color-muted)", margin: "0.25rem 0 0" }}>
            {String(d.horizon_note)}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Train result ────────────────────────────────────────────────────── */
function TrainResult({ d }: { d: Record<string, unknown> }) {
  const metrics = d.metrics as Record<string, number> | null | undefined;
  const hasMetrics = metrics && Object.keys(metrics).length > 0;

  return (
    <div className="card-sm">
      <p style={{ fontSize: "0.8125rem", fontWeight: 600, margin: 0, color: "var(--color-ink)" }}>
        ✓ Model trained: {d.model_name as string}
      </p>
      <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", margin: "0.125rem 0 0" }}>
        ID: {d.id as string}
      </p>
      {hasMetrics ? (
        <div style={{ marginTop: "0.75rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.5rem" }}>
          {Object.entries(metrics!).map(([k, v]) => (
            <div key={k} style={{ background: "var(--color-bg)", borderRadius: "0.375rem", padding: "0.5rem 0.625rem" }}>
              <p style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-muted)", margin: 0 }}>{k}</p>
              <p style={{ fontSize: "1rem", fontWeight: 700, margin: "0.125rem 0 0" }}>{typeof v === "number" ? v.toFixed(3) : String(v)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "0.375rem" }}>
          {(d.split_note as string) ?? "No held-out metrics — single-recording demo mode."}
        </p>
      )}
    </div>
  );
}

/* ── Forecast concept illustration ──────────────────────────────────── */
function ForecastConcept({ obsMin, hMin }: { obsMin: number; hMin: number }) {
  // Generate simple illustrative data
  const points: { t: number; value: number; forecast?: number }[] = [];
  const obsEnd = obsMin * 60;
  const total = obsEnd + hMin * 60;
  for (let t = 0; t <= total; t += total / 40) {
    const noise = Math.sin(t * 0.3) * 0.15 + Math.sin(t * 0.7) * 0.08;
    const baseline = 0.3 + noise;
    points.push({
      t: Math.round(t),
      value: t <= obsEnd ? baseline + 0.05 : undefined as unknown as number,
      forecast: t >= obsEnd ? baseline + (t - obsEnd) / (hMin * 60) * 0.25 + noise * 0.5 : undefined as unknown as number,
    });
  }

  return (
    <div style={{ height: 140 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="obsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0D9488" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={[0, 1]} />
          <Tooltip
            contentStyle={{ fontSize: "0.75rem", borderRadius: "0.375rem" }}
            formatter={(v: number) => [v.toFixed(2), ""]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#0D9488"
            fill="url(#obsGrad)"
            strokeWidth={1.5}
            dot={false}
            name="Observation"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="forecast"
            stroke="#F59E0B"
            fill="url(#fcGrad)"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            name="Forecast (illustrative)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────── */
export default function ForecastPage() {
  const { user } = useAuth();
  const recordsQ = useQuery({ queryKey: ["records"], queryFn: api.records });
  const records: ResearchRecord[] = recordsQ.data?.records ?? [];
  const [rid, setRid] = useState("");
  const selected = rid || records[0]?.id || "";
  const [obsMin, setObsMin] = useState(0.5);
  const [hMin, setHMin] = useState(1);

  const train = useMutation({
    mutationFn: () =>
      api.train({
        model_name: "logistic_regression",
        target_event: "vt",
        observation_s: obsMin * 60,
        horizon_s: hMin * 60,
        step_s: 5,
        record_ids: [selected],
      }),
  });

  const run = useMutation({
    mutationFn: () =>
      api.forecast({
        record_id: selected,
        observation_s: obsMin * 60,
        horizon_s: hMin * 60,
        target_event: "vt",
      }),
    onSuccess: async (data) => {
      if (user && selected) {
        await saveForecast(user.id, selected, data as Record<string, unknown>, {
          modelName: "logistic_regression",
          observationWindow: obsMin * 60,
          predictionHorizon: hMin * 60,
        });
      }
    },
  });

  return (
    <div className="fade-in">
      <PageHeader
        title="Forecasting"
        subtitle="Experimental short-term ventricular arrhythmia risk estimation"
        badge={<Disclaimer compact />}
      />

      {/* Warning */}
      <div
        className="disclaimer-strip"
        style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginBottom: "1.25rem" }}
      >
        <Icon d={I.warning} size={14} style={{ flexShrink: 0, marginTop: "0.0625rem" }} />
        Forecasting horizon is an experimental parameter. The system does not assume a fixed clinical warning time.
        Model outputs are not validated probabilities and must not be used for clinical decisions.
      </div>

      {/* Concept + controls */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem", marginBottom: "1.25rem" }}>
        {/* Concept diagram */}
        <SectionCard
          title="Detection vs Forecasting"
          subtitle="Illustrative timeline — not actual patient data"
        >
          <ForecastConcept obsMin={obsMin} hMin={hMin} />
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", fontSize: "0.75rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--color-muted)" }}>
              <span style={{ width: 12, height: 2, background: "#0D9488", display: "inline-block" }} />
              Observation window
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--color-muted)" }}>
              <span style={{ width: 12, height: 2, background: "#F59E0B", display: "inline-block", borderTop: "2px dashed #F59E0B" }} />
              Forecast horizon H
            </span>
          </div>
        </SectionCard>

        {/* Controls */}
        <SectionCard title="Experiment parameters">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <FormField label="Recording">
              <select
                className="field-select"
                value={selected}
                onChange={(e) => setRid(e.target.value)}
              >
                {records.map((r) => (
                  <option key={r.id} value={r.id}>{r.record_name}</option>
                ))}
                {records.length === 0 && <option value="">No recordings loaded</option>}
              </select>
            </FormField>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <FormField label="Observation window (min)" hint="History used for prediction">
                <input
                  className="field-input"
                  type="number"
                  step={0.1}
                  min={0.1}
                  value={obsMin}
                  onChange={(e) => setObsMin(Number(e.target.value))}
                />
              </FormField>

              <FormField label="Forecast horizon H (min)" hint="Target event window">
                <select
                  className="field-select"
                  value={hMin}
                  onChange={(e) => setHMin(Number(e.target.value))}
                >
                  <option value={1}>1 (short demo)</option>
                  {HORIZONS.map((h) => (
                    <option key={h} value={h}>{h} min (experimental)</option>
                  ))}
                </select>
              </FormField>
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => train.mutate()}
                disabled={!selected || train.isPending}
              >
                {train.isPending ? <Spinner size={14} /> : <Icon d={I.train} size={14} />}
                Train model
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => run.mutate()}
                disabled={!selected || run.isPending}
              >
                {run.isPending ? <Spinner size={14} /> : <Icon d={I.run} size={14} />}
                Run experiment
              </button>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Errors */}
      {train.error && <div style={{ marginBottom: "0.875rem" }}><ErrorBox message={(train.error as Error).message} /></div>}
      {run.error   && <div style={{ marginBottom: "0.875rem" }}><ErrorBox message={(run.error as Error).message} /></div>}

      {/* Results */}
      {(train.data || run.data) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}>
          {train.data && (
            <SectionCard title="Training result">
              <TrainResult d={train.data as Record<string, unknown>} />
            </SectionCard>
          )}

          {run.data && (
            <SectionCard title="Forecast result" subtitle="Experimental output — not a clinical diagnosis">
              <ForecastResult d={run.data as Record<string, unknown>} />
            </SectionCard>
          )}
        </div>
      )}

      {!run.data && !train.data && (
        <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
          <Icon d={I.forecast} size={36} style={{ color: "var(--color-line)", margin: "0 auto 0.75rem" }} />
          <p style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>No experiments run yet</p>
          <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.375rem", maxWidth: 360, margin: "0.375rem auto 0" }}>
            Train the model first, then run an experiment to see forecast outputs.
          </p>
        </div>
      )}
    </div>
  );
}
