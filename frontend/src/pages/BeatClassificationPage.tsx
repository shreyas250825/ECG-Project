/**
 * Beat Classification Page — Track A
 *
 * Displays actual results from the three trained XGBoost beat classifiers:
 *   - Four-class AAMI (N/S/V/F)
 *   - Three-class NSV (F excluded)
 *   - Binary N/V (S and F excluded)
 *
 * Fetches from /api/classification/* endpoints.
 * Data comes from actual model inference, not hardcoded values.
 *
 * SCOPE NOTE: These classify observed beat morphology in the MIT-BIH database.
 * They do NOT forecast future VF/VT events (Track B).
 */
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid,
} from "recharts";
import { api } from "../services/api";
import { Spinner, ErrorBox } from "../components/ui";
import { Disclaimer } from "../components/Disclaimer";

type ModelKey = "four_class" | "three_class" | "binary";

const MODEL_LABELS: Record<ModelKey, string> = {
  four_class:  "Four-Class AAMI (N/S/V/F)",
  three_class: "Three-Class NSV (N/S/V)",
  binary:      "Binary N/V",
};

const REFERENCE: Record<ModelKey, { accuracy: number; balanced: number; f1?: number; scope: string }> = {
  four_class:  { accuracy: 0.905936, balanced: 0.607057, f1: 0.5533, scope: "All 45,756 DS2 test beats" },
  three_class: { accuracy: 0.939254, balanced: 0.687057, f1: 0.6885, scope: "45,369 beats (F excluded)" },
  binary:      { accuracy: 0.992728, balanced: 0.955230, f1: 0.9723, scope: "43,593 N+V beats (S,F excluded)" },
};

const CLASS_COLORS: Record<string, string> = {
  N: "#10B981", S: "#F59E0B", V: "#EF4444", F: "#8B5CF6",
};

function MetricCard({ label, value, reference, unit = "%" }: {
  label: string; value: number | null; reference?: number; unit?: string;
}) {
  const disp = value == null ? "—" : unit === "%" ? `${(value * 100).toFixed(2)}%` : value.toFixed(4);
  const ref  = reference == null ? null : unit === "%" ? `${(reference * 100).toFixed(2)}%` : reference.toFixed(4);
  const delta = value != null && reference != null ? value - reference : null;
  return (
    <div style={{ background: "var(--color-bg)", border: "1px solid var(--color-line)",
      borderRadius: "0.5rem", padding: "0.75rem 1rem" }}>
      <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.07em",
        textTransform: "uppercase", color: "var(--color-muted)", margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-ink)",
        margin: "0.25rem 0 0", letterSpacing: "-0.02em" }}>
        {disp}
      </p>
      {ref && (
        <p style={{ fontSize: "0.6875rem", color: "var(--color-muted)", margin: "0.125rem 0 0" }}>
          ref {ref}
          {delta != null && (
            <span style={{ color: Math.abs(delta) < 0.002 ? "#10B981" : "#F59E0B",
              marginLeft: "0.375rem", fontWeight: 600 }}>
              ({delta > 0 ? "+" : ""}{unit === "%" ? (delta*100).toFixed(3) : delta.toFixed(4)})
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function ConfusionMatrix({ cm, labels }: {
  cm: number[][] | { tn: number; fp: number; fn: number; tp: number };
  labels: string[];
}) {
  // Normalize both CM formats
  const matrix: number[][] = Array.isArray(cm)
    ? cm as number[][]
    : [[cm.tn, cm.fp], [cm.fn, cm.tp]];

  const maxVal = Math.max(...matrix.flat());

  return (
    <div>
      <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-ink)", marginBottom: "0.5rem" }}>
        Confusion Matrix
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead>
            <tr>
              <th style={{ padding: "4px 8px", color: "var(--color-muted)", textAlign: "left",
                fontSize: "0.625rem", fontWeight: 700 }}>True↓ / Pred→</th>
              {labels.map((l) => (
                <th key={l} style={{ padding: "4px 8px", color: "var(--color-ink)", fontWeight: 700,
                  borderBottom: "2px solid var(--color-line)" }}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <td style={{ padding: "4px 8px", fontWeight: 700, color: "var(--color-ink)",
                  borderRight: "2px solid var(--color-line)" }}>
                  {labels[i]}
                </td>
                {row.map((val, j) => {
                  const intensity = maxVal > 0 ? val / maxVal : 0;
                  const isCorrect = i === j;
                  const bg = isCorrect
                    ? `rgba(16,185,129,${0.1 + intensity * 0.5})`
                    : val > 0 ? `rgba(239,68,68,${0.05 + intensity * 0.3})` : "transparent";
                  return (
                    <td key={j} style={{
                      padding: "6px 12px", textAlign: "right",
                      background: bg, color: "var(--color-ink)", fontWeight: isCorrect ? 700 : 400,
                      borderBottom: "1px solid var(--color-line)",
                    }}>
                      {val.toLocaleString()}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BeatClassificationPage() {
  const [selectedModel, setSelectedModel] = useState<ModelKey>("four_class");
  const [runtime, setRuntime] = useState<"native" | "numpy">("native");

  // Model status
  const modelsQ = useQuery({
    queryKey: ["classification", "models"],
    queryFn: () => api.classificationModels(),
  });

  // Latest saved results (from scripts/_run_inference.py)
  const latestQ = useQuery({
    queryKey: ["classification", "latest"],
    queryFn: () => api.classificationLatest(),
  });

  // On-demand DS2 evaluation (up to 2000 beats for fast UI response)
  const evalMut = useMutation({
    mutationFn: (params: { model?: string; maxBeats?: number; runtime?: string }) =>
      api.classificationEvaluateDs2(params.maxBeats ?? 2000, params.runtime ?? runtime),
  });

  const models = (modelsQ.data as Record<string, unknown> | undefined)?.models as Record<string, unknown> | undefined;
  const latest = latestQ.data as Record<string, unknown> | undefined;

  // Pull results from latest saved run
  const savedResult = latest
    ? (latest[`${selectedModel}_numpy`] ?? latest[`${selectedModel}_native`]) as Record<string, unknown> | undefined
    : undefined;

  // Pull from on-demand evaluation
  const evalResult = evalMut.data
    ? ((evalMut.data as Record<string, unknown>).results as Record<string, unknown> | undefined)?.[selectedModel] as Record<string, unknown> | undefined
    : undefined;

  const result = evalResult ?? savedResult;
  const ref = REFERENCE[selectedModel];

  // Class labels per model
  const classLabels: Record<ModelKey, string[]> = {
    four_class:  ["N", "S", "V", "F"],
    three_class: ["N", "S", "V"],
    binary:      ["N", "V"],
  };

  // f1ChartData computed inside results block


  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-ink)", margin: "0 0 0.25rem" }}>
          Beat Classification — Track A
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--color-muted)", margin: 0 }}>
          MIT-BIH Arrhythmia Database · XGBoost beat morphology classifiers · DS2 independent test partition
        </p>
      </div>

      <Disclaimer compact />

      {/* Scope warning */}
      <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: "0.75rem",
        padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "#92400E",
        display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>
          <strong>Track A scope:</strong> These classifiers detect observed beat morphology (N/S/V/F) in recorded ECG.
          A "V" (ventricular ectopic) beat is <strong>not</strong> equivalent to ventricular tachycardia or fibrillation.
          Binary accuracy of 99.27% applies only to N+V beats and must <strong>never</strong> be reported as VF forecasting accuracy.
          VF forecasting is Track B (see Forecasting page).
        </span>
      </div>

      {/* Model selector + run */}
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)",
        borderRadius: "0.875rem", padding: "1.25rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>

          {/* Model tabs */}
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-muted)", margin: "0 0 0.5rem" }}>
              Classifier
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(["four_class", "three_class", "binary"] as ModelKey[]).map((mk) => {
                const loaded = models?.[mk] != null;
                return (
                  <button key={mk} type="button" onClick={() => setSelectedModel(mk)}
                    style={{
                      padding: "0.5rem 1rem", borderRadius: "0.5rem",
                      fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
                      border: selectedModel === mk
                        ? "1px solid var(--color-teal)"
                        : "1px solid var(--color-line)",
                      background: selectedModel === mk
                        ? "rgba(13,148,136,0.08)"
                        : "var(--color-bg)",
                      color: selectedModel === mk ? "var(--color-teal)" : "var(--color-ink)",
                    }}>
                    {MODEL_LABELS[mk]}
                    {loaded && <span style={{ marginLeft: 4, color: "#10B981", fontWeight: 700 }}>●</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Runtime toggle */}
          <div>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-muted)", margin: "0 0 0.5rem" }}>
              Runtime
            </p>
            <div style={{ display: "flex", gap: "0.375rem" }}>
              {(["native", "numpy"] as const).map((rt) => (
                <button key={rt} type="button" onClick={() => setRuntime(rt)}
                  style={{
                    padding: "0.375rem 0.75rem", borderRadius: "0.375rem",
                    fontSize: "0.75rem", fontWeight: 500, cursor: "pointer",
                    border: runtime === rt ? "1px solid var(--color-teal)" : "1px solid var(--color-line)",
                    background: runtime === rt ? "rgba(13,148,136,0.1)" : "var(--color-bg)",
                    color: runtime === rt ? "var(--color-teal)" : "var(--color-muted)",
                  }}>
                  {rt === "native" ? "Native XGBoost" : "NumPy (portable)"}
                </button>
              ))}
            </div>
          </div>

          {/* Run button */}
          <button type="button" className="btn-primary"
            onClick={() => evalMut.mutate({ runtime })}
            disabled={evalMut.isPending}>
            {evalMut.isPending ? <Spinner size={14} /> : (
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2}>
                <path d="M5 3l14 9-14 9V3z" />
              </svg>
            )}
            Run DS2 Evaluation (2000 beats)
          </button>
        </div>

        {evalMut.error && (
          <div style={{ marginTop: "0.75rem" }}>
            <ErrorBox message={(evalMut.error as Error).message} />
          </div>
        )}
      </div>

      {/* Results */}
      {result ? (() => {
        // Cast to typed record for safe property access
        const r = result as Record<string, number | string | null | undefined | unknown>;
        const n_samples = typeof r.n_samples === "number" ? r.n_samples : 0;
        const accuracy = typeof r.accuracy === "number" ? r.accuracy : null;
        const balanced_accuracy = typeof r.balanced_accuracy === "number" ? r.balanced_accuracy : null;
        const macro_f1 = typeof r.macro_f1 === "number" ? r.macro_f1 : null;
        const sensitivity_V = typeof r.sensitivity_V === "number" ? r.sensitivity_V : null;
        const specificity_N = typeof r.specificity_N === "number" ? r.specificity_N : null;
        const precision_V = typeof r.precision_V === "number" ? r.precision_V : null;
        const inference_time_ms = typeof r.inference_time_ms === "number" ? r.inference_time_ms : null;
        const reference_agreement = typeof r.reference_agreement === "number" ? r.reference_agreement : null;
        const scope_str = r.scope != null ? String(r.scope) : ref.scope;
        const cm = r.confusion_matrix;
        const per_class_f1 = r.per_class_f1 as Record<string, number> | undefined;
        const f1Data = per_class_f1
          ? Object.entries(per_class_f1).map(([cls, f1val]) => ({
              class: classLabels[selectedModel][Number(cls)] ?? cls,
              f1: Number(f1val),
            }))
          : [] as { class: string; f1: number }[];
        return (
        <>
          {/* Source tag */}
          <div style={{ fontSize: "0.6875rem", color: "var(--color-muted)",
            display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%",
              background: evalResult ? "#10B981" : "#F59E0B", display: "inline-block" }} />
            {evalResult
              ? `Live computation — ${runtime} runtime — ${n_samples.toLocaleString()} samples`
              : `Saved results from full DS2 run (NumPy) — ${n_samples.toLocaleString()} samples`}
          </div>

          {/* Scope notice for selected model */}
          {selectedModel === "binary" && (
            <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA",
              borderRadius: "0.5rem", padding: "0.5rem 0.75rem",
              fontSize: "0.75rem", color: "#92400E" }}>
              {scope_str}
            </div>
          )}

          {/* Metrics grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
            <MetricCard label="Accuracy" value={accuracy} reference={ref.accuracy} />
            <MetricCard label="Balanced Accuracy" value={balanced_accuracy} reference={ref.balanced} />
            {macro_f1 != null && <MetricCard label="Macro F1" value={macro_f1} reference={ref.f1} unit="" />}
            {selectedModel === "binary" && (<>
              <MetricCard label="Sensitivity (V)" value={sensitivity_V} reference={0.9113} />
              <MetricCard label="Specificity (N)" value={specificity_N} reference={0.9992} />
              <MetricCard label="Precision (V)"   value={precision_V}   reference={0.9888} />
            </>)}
            {inference_time_ms != null && <MetricCard label="Inference time" value={inference_time_ms} unit="ms" />}
          </div>

          {/* Two columns: confusion matrix + F1 chart */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem",
            background: "var(--color-surface)", border: "1px solid var(--color-line)",
            borderRadius: "0.875rem", padding: "1.25rem" }}>
            {cm != null && (
              <ConfusionMatrix
                cm={(cm as number[][] | { tn: number; fp: number; fn: number; tp: number })}
                labels={classLabels[selectedModel]}
              />
            )}
            {f1Data.length > 0 && (
              <div>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-ink)", marginBottom: "0.5rem" }}>
                  Per-class F1 score
                </p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={f1Data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--color-line)" />
                    <XAxis dataKey="class" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 1]} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v: number) => [v.toFixed(4), "F1"]} />
                    <Bar dataKey="f1" radius={[3, 3, 0, 0]}>
                      {f1Data.map((entry) => (
                        <Cell key={entry.class} fill={CLASS_COLORS[entry.class] ?? "#0D9488"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {reference_agreement != null && (
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0",
              borderRadius: "0.5rem", padding: "0.625rem 0.875rem",
              fontSize: "0.8125rem", color: "#166534" }}>
              Reference prediction agreement:{" "}
              <strong>{(reference_agreement * 100).toFixed(4)}%</strong>
              {" "}— NumPy runtime vs saved reference predictions
            </div>
          )}
        </>
        );
      })() : (
        <div style={{ textAlign: "center", padding: "3rem 1.5rem",
          background: "var(--color-surface)", border: "1px solid var(--color-line)",
          borderRadius: "0.875rem" }}>
          {latestQ.isLoading || modelsQ.isLoading ? (
            <Spinner size={32} />
          ) : (
            <>
              <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                Ready to evaluate
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--color-muted)", margin: "0.5rem auto 0", maxWidth: 400 }}>
                All three XGBoost models are loaded. Click "Run DS2 Evaluation" to compute live metrics,
                or the saved full-dataset results will appear automatically.
              </p>
            </>
          )}
        </div>
      )}

      {/* Historical reference */}
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)",
        borderRadius: "0.875rem", padding: "1.25rem" }}>
        <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-ink)", margin: "0 0 0.75rem" }}>
          Historical Reference Results (DS2 partition, run_id: 20261124_162613)
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--color-line)" }}>
                {["Model", "Accuracy", "Balanced Acc.", "Macro F1", "ROC-AUC", "AP", "Scope"].map((h) => (
                  <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left",
                    fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.07em",
                    textTransform: "uppercase", color: "var(--color-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { model: "Four-class", acc: "90.59%", bal: "60.71%", f1: "0.5533", auc: "0.8671", ap: "0.5503", scope: "45,756 beats" },
                { model: "Three-class", acc: "93.93%", bal: "68.71%", f1: "0.6885", auc: "0.8781", ap: "0.6907", scope: "45,369 (F excl.)" },
                { model: "Binary N/V", acc: "99.27%", bal: "95.52%", f1: "0.9723", auc: "0.9950", ap: "0.9762", scope: "43,593 N+V only" },
              ].map((row) => (
                <tr key={row.model} style={{ borderBottom: "1px solid var(--color-line)" }}>
                  <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "var(--color-ink)" }}>{row.model}</td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>{row.acc}</td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>{row.bal}</td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>{row.f1}</td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>{row.auc}</td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>{row.ap}</td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.6875rem", color: "var(--color-muted)" }}>{row.scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "0.6875rem", color: "var(--color-muted)", marginTop: "0.75rem" }}>
          Source: experiment_results/experiment_summary.json.
          DS2 partition is record-disjoint from training but was used during development —
          not an independent external validation cohort.
        </p>
      </div>
    </div>
  );
}
