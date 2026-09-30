import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EcgChart } from "../charts/EcgChart";
import { CardiacStatePanel } from "../components/dashboard/CardiacStatePanel";
import { CardiologistPresentation } from "../components/dashboard/CardiologistPresentation";
import { ForecastExperimentPanel } from "../components/dashboard/ForecastExperimentPanel";
import { StateTimeline } from "../components/dashboard/StateTimeline";
import { HeartScene } from "../components/heart3d/HeartScene";
import { deriveCardiacVisualizationState, twinHistoryFromStates } from "../components/heart3d/deriveVisualizationState";
import type { CardiacVisualizationState } from "../components/heart3d/types";
import { EMPTY_VISUALIZATION_STATE } from "../components/heart3d/types";
import { Disclaimer, PrototypeBadges } from "../components/Disclaimer";
import { api } from "../services/api";
import { useUI } from "../stores/ui";
import type { ResearchRecord } from "../types/research";

/**
 * Main research dashboard: ECG (primary) + 3D visualization layer + twin + forecast.
 */
export default function DashboardPage() {
  const { cardiologistMode } = useUI();
  const recordsQ = useQuery({ queryKey: ["records"], queryFn: api.records });
  const records: ResearchRecord[] = recordsQ.data?.records ?? [];
  const [rid, setRid] = useState("");
  const selected = rid || records[0]?.id || "";
  const [twinEnd, setTwinEnd] = useState(60);
  const [obsMin, setObsMin] = useState(0.5);
  const [hMin, setHMin] = useState(1);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [twin, setTwin] = useState<Record<string, unknown> | null>(null);
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null);
  const [replayOn, setReplayOn] = useState(false);
  const [replayT, setReplayT] = useState(0);
  const [lastRPeakMs, setLastRPeakMs] = useState<number | null>(null);
  const lastFiredPeak = useRef<number | null>(null);

  const modelsQ = useQuery({ queryKey: ["model-runs"], queryFn: api.modelRuns });
  const twinHistQ = useQuery({
    queryKey: ["twin-states", selected],
    queryFn: () => api.twinStates(selected),
    enabled: Boolean(selected),
  });

  const proc = useMutation({
    mutationFn: () => api.process(selected),
    onSuccess: (data) => setAnalysis(data),
  });
  const bl = useMutation({
    mutationFn: () => api.baseline({ record_id: selected, window_start_s: 0, window_end_s: 60 }),
  });
  const tw = useMutation({
    mutationFn: () => api.twin({ record_id: selected, timestamp_s: twinEnd, window_s: 20 }),
    onSuccess: (data) => {
      setTwin(data);
      twinHistQ.refetch();
    },
  });
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
    onSuccess: () => modelsQ.refetch(),
  });
  const runForecast = useMutation({
    mutationFn: () =>
      api.forecast({
        record_id: selected,
        observation_s: obsMin * 60,
        horizon_s: hMin * 60,
        target_event: "vt",
      }),
    onSuccess: (data) => setForecast(data),
  });

  const modelTrained = (modelsQ.data?.runs?.length ?? 0) > 0 || Boolean(train.data);

  const viz: CardiacVisualizationState = useMemo(
    () =>
      deriveCardiacVisualizationState({
        analysis: analysis as Parameters<typeof deriveCardiacVisualizationState>[0]["analysis"],
        twin: twin as Parameters<typeof deriveCardiacVisualizationState>[0]["twin"],
        forecast: forecast as Parameters<typeof deriveCardiacVisualizationState>[0]["forecast"],
        modelTrained,
      }),
    [analysis, twin, forecast, modelTrained],
  );

  const history = useMemo(
    () => twinHistoryFromStates((twinHistQ.data?.states as Array<Record<string, unknown>>) ?? []),
    [twinHistQ.data],
  );

  const chart = useMemo(() => {
    const w = analysis?.waveforms as { time_s?: number[]; raw?: number[]; cleaned?: number[] } | undefined;
    if (!w?.time_s || !w.raw) return null;
    return { time: w.time_s, raw: w.raw, cleaned: w.cleaned };
  }, [analysis]);

  const rPeaks = useMemo(
    () => (analysis?.r_peaks as { times_s?: number[] } | undefined)?.times_s ?? [],
    [analysis],
  );
  const duration = Number(analysis?.duration_seconds ?? 0);

  // ECG replay → R-peak → visual pulse (driven by pipeline timestamps only)
  useEffect(() => {
    if (!replayOn || !rPeaks.length || !duration) return;
    let raf = 0;
    const start = performance.now();
    lastFiredPeak.current = null;
    const tick = (now: number) => {
      const t = ((now - start) / 1000);
      if (t >= duration) {
        setReplayOn(false);
        setReplayT(0);
        lastFiredPeak.current = null;
        return;
      }
      setReplayT(t);
      for (const peak of rPeaks) {
        if (peak <= t && (lastFiredPeak.current == null || peak > lastFiredPeak.current)) {
          lastFiredPeak.current = peak;
          setLastRPeakMs(performance.now());
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [replayOn, rPeaks, duration]);

  const startReplay = useCallback(() => {
    lastFiredPeak.current = null;
    setReplayT(0);
    setReplayOn(true);
  }, []);

  return (
    <div className="space-y-6">
      <header className="border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-5">
        <p className="text-xs uppercase tracking-wider text-teal-800">Cardiac visualization mode</p>
        <h2 className="mt-1 text-2xl text-slate-900">Patient-Specific Predictive Cardiac Digital Twin</h2>
        <p className="mt-1 text-sm text-slate-600">RESEARCH PROTOTYPE</p>
        <div className="mt-3">
          <PrototypeBadges />
        </div>
        <Disclaimer compact />
      </header>

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label>
          Recording
          <select className="mt-1 block border border-slate-300 p-2" value={selected} onChange={(e) => setRid(e.target.value)}>
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.record_name} {r.synthetic ? "(synthetic demonstration data)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="bg-teal-800 px-3 py-2 text-white disabled:opacity-50"
          disabled={!selected || proc.isPending}
          onClick={() => proc.mutate()}
        >
          {proc.isPending ? "Processing…" : "Run ECG analysis"}
        </button>
        <button type="button" className="border px-3 py-2" onClick={() => bl.mutate()} disabled={!selected}>
          Learn baseline (0–60 s)
        </button>
        <label>
          Twin window end (s)
          <input
            className="mt-1 block border p-2"
            type="number"
            value={twinEnd}
            onChange={(e) => setTwinEnd(Number(e.target.value))}
          />
        </label>
        <button type="button" className="border px-3 py-2" onClick={() => tw.mutate()} disabled={!selected}>
          Update twin state
        </button>
        <label>
          Observation (min)
          <input
            className="mt-1 block border p-2"
            type="number"
            step={0.1}
            value={obsMin}
            onChange={(e) => setObsMin(Number(e.target.value))}
          />
        </label>
        <label>
          Horizon H (min)
          <input
            className="mt-1 block border p-2"
            type="number"
            step={0.1}
            value={hMin}
            onChange={(e) => setHMin(Number(e.target.value))}
          />
        </label>
        <button type="button" className="border px-3 py-2" onClick={() => train.mutate()} disabled={!selected}>
          Train forecast model
        </button>
        <button
          type="button"
          className="border px-3 py-2"
          onClick={() => runForecast.mutate()}
          disabled={!selected}
        >
          Run forecast experiment
        </button>
        <button
          type="button"
          className="border px-3 py-2"
          onClick={replayOn ? () => setReplayOn(false) : startReplay}
          disabled={!rPeaks.length}
        >
          {replayOn ? `Replay t=${replayT.toFixed(1)}s (stop)` : "Sync replay (ECG → R-peak → pulse)"}
        </button>
      </div>

      {(analysis as { synthetic_notice?: string } | null)?.synthetic_notice && (
        <p className="border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
          Synthetic demonstration data — {(analysis as { synthetic_notice: string }).synthetic_notice}
        </p>
      )}

      {/* Primary row: ECG (~55–65%) + 3D heart (~35–45%) */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">ECG waveform</h3>
          {chart ? (
            <EcgChart
              time={chart.time}
              raw={chart.raw}
              cleaned={chart.cleaned}
              title="Raw and cleaned ECG (primary evidence)"
              rPeakTimes={rPeaks}
              cursorTime={replayOn ? replayT : null}
            />
          ) : (
            <div className="flex h-64 items-center justify-center border border-slate-200 bg-white text-sm text-slate-500">
              Waiting for ECG data — run analysis on a recording.
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Stat label="HR" value={viz.heartRate == null ? "—" : `${viz.heartRate.toFixed(1)} bpm`} />
            <Stat label="Signal quality" value={viz.signalQuality == null ? "—" : viz.signalQuality.toFixed(2)} />
            <Stat label="R-peaks" value={rPeaks.length ? String(rPeaks.length) : "—"} />
            <Stat label="RR mean" value={viz.rrMeanSeconds == null ? "—" : `${viz.rrMeanSeconds.toFixed(3)} s`} />
          </div>
          {proc.error && <p className="text-sm text-red-800">{(proc.error as Error).message}</p>}
        </div>
        <HeartScene viz={analysis || twin || forecast ? viz : EMPTY_VISUALIZATION_STATE} lastRPeakMs={lastRPeakMs} />
      </div>

      <CardiacStatePanel viz={viz} />
      <StateTimeline history={history} />
      <ForecastExperimentPanel viz={viz} />

      {cardiologistMode && <CardiologistPresentation viz={viz} lastRPeakMs={lastRPeakMs} />}

      <p className="text-xs text-slate-500">
        Desktop: ECG and 3D side by side. Narrow viewports stack with ECG first. The computational twin remains an
        ECG-feature representation; the heart is visualization only.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white px-2 py-1.5">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="text-slate-800">{value}</p>
    </div>
  );
}
