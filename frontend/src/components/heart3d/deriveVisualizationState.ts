import type { CardiacVisualizationState, ResearchVizState, TwinHistoryPoint } from "./types";
import { EMPTY_VISUALIZATION_STATE } from "./types";

type AnalysisLike = {
  heart_rate_bpm?: number | null;
  signal_quality?: { score?: number; label?: string };
  rr_intervals_s?: number[];
  r_peaks?: { times_s?: number[] };
  synthetic_notice?: string | null;
} | null;

type TwinLike = {
  deviation_score?: number | null;
  timestamp?: number;
  baseline?: { baseline_window?: { start_s?: number; end_s?: number }; n_windows?: number } | null;
  notes?: string[];
} | null;

type ForecastLike = {
  status?: string;
  model_score?: number | null;
  message?: string;
  target_event?: string;
  observation_window_s?: number;
  forecast_horizon_s?: number;
  ground_truth_in_horizon?: number | null;
  lead_time_seconds?: number | null;
} | null;

type ModelRunLike = { id?: string } | null;

function mean(xs: number[]): number | null {
  const ok = xs.filter((x) => Number.isFinite(x));
  if (!ok.length) return null;
  return ok.reduce((a, b) => a + b, 0) / ok.length;
}

function classifyVizState(args: {
  dataAvailable: boolean;
  deviation: number | null;
  forecastScore: number | null;
  modelAvailable: boolean;
}): ResearchVizState {
  if (!args.dataAvailable) return "NO_DATA";
  if (args.deviation == null && !args.modelAvailable) return "INSUFFICIENT_EVIDENCE";
  if (args.forecastScore != null && args.forecastScore >= 0.65) return "ELEVATED_RESEARCH_RISK";
  if (args.deviation != null && args.deviation >= 2.0) return "ELEVATED_RESEARCH_RISK";
  if (args.deviation != null && args.deviation >= 1.0) return "DEVIATION";
  if (args.dataAvailable) return "STABLE";
  return "INSUFFICIENT_EVIDENCE";
}

function labelFromDeviation(score: number | null): string {
  if (score == null) return "Insufficient evidence";
  if (score < 1) return "Stable";
  if (score < 2) return "Mild deviation";
  return "Increased deviation";
}

export function twinHistoryFromStates(states: Array<Record<string, unknown>>): TwinHistoryPoint[] {
  return states.map((s, i) => {
    const score = typeof s.deviation_score === "number" ? s.deviation_score : null;
    return {
      id: typeof s.id === "string" ? s.id : `s-${i}`,
      timestamp: Number(s.timestamp ?? 0),
      deviation_score: score,
      label: labelFromDeviation(score),
    };
  });
}

export function deriveCardiacVisualizationState(input: {
  analysis: AnalysisLike;
  twin: TwinLike;
  forecast: ForecastLike;
  modelTrained: boolean;
  latestModel?: ModelRunLike;
}): CardiacVisualizationState {
  const { analysis, twin, forecast, modelTrained } = input;
  const dataAvailable = Boolean(analysis && (analysis.heart_rate_bpm != null || (analysis.r_peaks?.times_s?.length ?? 0) > 0));

  if (!dataAvailable && !twin && !forecast) {
    return { ...EMPTY_VISUALIZATION_STATE };
  }

  const hr = analysis?.heart_rate_bpm ?? null;
  const quality = analysis?.signal_quality?.score ?? null;
  const deviation = twin?.deviation_score ?? null;
  const forecastScore = forecast?.model_score ?? null;
  const modelAvailable = modelTrained || forecast?.status === "ok" || forecast?.model_score != null;

  const vizState = classifyVizState({ dataAvailable, deviation, forecastScore, modelAvailable });

  let currentState = "Waiting for ECG data";
  if (dataAvailable && twin?.deviation_score == null && !twin) {
    currentState = "ECG processed — twin state not yet updated";
  } else if (twin) {
    currentState = labelFromDeviation(deviation);
  } else if (dataAvailable) {
    currentState = "ECG measurements available";
  }

  let forecastStatus = "Forecast unavailable — model not trained.";
  if (modelAvailable && forecast) {
    forecastStatus = forecast.status === "ok" || forecast.model_score != null
      ? `Experiment status: ${forecast.status ?? "completed"}`
      : forecast.message || forecastStatus;
  } else if (modelAvailable && !forecast) {
    forecastStatus = "Model trained — run a forecasting experiment to see outputs.";
  } else if (forecast?.message) {
    forecastStatus = forecast.message;
  }

  const win = twin?.baseline?.baseline_window;
  const baselineWindowLabel =
    win && win.start_s != null && win.end_s != null
      ? `Learned from ${((win.end_s - win.start_s) / 60).toFixed(1)} min ECG`
      : twin?.baseline
        ? "Baseline present"
        : null;

  const updatedAt =
    twin?.timestamp != null
      ? `Updated at t = ${Number(twin.timestamp).toFixed(1)} s`
      : null;

  return {
    heartRate: hr != null && Number.isFinite(hr) ? hr : null,
    signalQuality: quality != null && Number.isFinite(quality) ? quality : null,
    baselineDeviation: deviation != null && Number.isFinite(deviation) ? deviation : null,
    currentState,
    forecastStatus,
    modelAvailable,
    dataAvailable,
    vizState,
    rrMeanSeconds: analysis?.rr_intervals_s ? mean(analysis.rr_intervals_s) : null,
    rPeakTimesS: analysis?.r_peaks?.times_s ?? [],
    baselineWindowLabel,
    currentStateUpdatedAt: updatedAt,
    forecastScore: forecastScore != null && Number.isFinite(forecastScore) ? forecastScore : null,
    forecastTarget: forecast?.target_event ?? (modelAvailable ? "vt" : null),
    observationWindowS: forecast?.observation_window_s ?? null,
    forecastHorizonS: forecast?.forecast_horizon_s ?? null,
    groundTruth: forecast?.ground_truth_in_horizon ?? null,
    leadTimeSeconds: forecast?.lead_time_seconds ?? null,
    syntheticNotice: analysis?.synthetic_notice ?? null,
  };
}
