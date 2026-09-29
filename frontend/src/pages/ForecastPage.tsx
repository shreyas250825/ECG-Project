import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Disclaimer } from "../components/Disclaimer";
import { api } from "../services/api";
import type { ResearchRecord } from "../types/research";

const HORIZONS = [5, 10, 20, 30];

export default function ForecastPage() {
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
  });
  const d = run.data;
  return (
    <div className="space-y-6">
      <h2 className="text-2xl">Forecasting experiment</h2>
      <Disclaimer compact />
      <p className="text-sm text-slate-700">
        Forecasting horizon is an experimental parameter. The system does not assume a fixed warning time.
      </p>
      <div className="border border-slate-200 bg-white p-4 text-sm">
        <p className="font-semibold">Detection versus forecasting</p>
        <p className="mt-1">Detection: an event pattern is present in the analysed ECG now.</p>
        <p>Forecasting: recent history is used to estimate whether a labelled target event occurs within horizon H after time t.</p>
        <pre className="mt-3 overflow-auto bg-slate-50 p-3 text-xs">
{`<---------------- ECG ---------------->
                       | target event
<-- observation -->
                       <--- forecast H --->`}
        </pre>
      </div>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label>Record
          <select className="mt-1 block border p-2" value={selected} onChange={(e) => setRid(e.target.value)}>
            {records.map((r) => (
              <option key={r.id} value={r.id}>{r.record_name}</option>
            ))}
          </select>
        </label>
        <label>Observation (min)
          <input className="mt-1 block border p-2" type="number" step={0.1} value={obsMin} onChange={(e) => setObsMin(Number(e.target.value))} />
        </label>
        <label>Horizon H (min)
          <select className="mt-1 block border p-2" value={hMin} onChange={(e) => setHMin(Number(e.target.value))}>
            {HORIZONS.map((h) => (
              <option key={h} value={h}>{h} (experimental)</option>
            ))}
            <option value={1}>1 (short demo recording)</option>
          </select>
        </label>
        <button className="border px-3 py-2" type="button" onClick={() => train.mutate()}>
          Train baseline model
        </button>
        <button className="bg-teal-800 px-3 py-2 text-white" type="button" onClick={() => run.mutate()}>
          Run experiment
        </button>
      </div>
      {train.data && (
        <div className="text-sm">
          <p>Trained: {train.data.model_name} ({train.data.id})</p>
          {train.data.metrics && Object.keys(train.data.metrics).length > 0 ? (
            <pre className="mt-2 bg-slate-50 p-2 text-xs">{JSON.stringify(train.data.metrics, null, 2)}</pre>
          ) : (
            <p className="text-slate-600">{train.data.split_note || "No held-out metrics (single-recording demo)."}</p>
          )}
        </div>
      )}
      {train.error && <p className="text-sm text-red-800">{(train.error as Error).message}</p>}
      {run.error && <p className="text-sm text-red-800">{(run.error as Error).message}</p>}
      {d && (
        <section className="space-y-2 border border-slate-200 bg-white p-4 text-sm">
          <p>Target: ventricular tachyarrhythmia (experimental)</p>
          <p>Observation window: {d.observation_window_s}s · Forecast horizon: {d.forecast_horizon_s}s</p>
          <p>Prediction timestamp t = {d.prediction_time_s?.toFixed?.(1)} s</p>
          <p>Model output (score): {d.model_score == null ? "n/a" : d.model_score.toFixed(3)}</p>
          <p>Status: {d.status}</p>
          <p>{d.message}</p>
          <p>Ground truth in horizon: {d.ground_truth_in_horizon === 1 ? "target event annotated" : "no target event in H"}</p>
          <p>
            Observed lead time:{" "}
            {d.lead_time_seconds == null ? "n/a (no event in horizon or not applicable)" : `${d.lead_time_seconds.toFixed(1)} s`}
          </p>
          <p className="text-slate-600">{d.horizon_note}</p>
        </section>
      )}
    </div>
  );
}
