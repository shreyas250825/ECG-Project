import { supabase, supabaseConfigured } from "../lib/supabase";

export type Forecast = {
  id: string;
  user_id: string;
  recording_id: string;
  analysis_id: string | null;
  digital_twin_state_id: string | null;
  model_name: string | null;
  model_version: string | null;
  observation_window: number | null;
  prediction_horizon: number | null;
  forecast_output: unknown;
  uncertainty_data: unknown;
  experimental_risk_estimate: number | null;
  forecast_status: string;
  created_at: string;
};

export async function saveForecast(
  userId: string,
  recordingId: string,
  apiResult: Record<string, unknown>,
  opts: {
    modelName?: string;
    modelVersion?: string;
    observationWindow?: number;
    predictionHorizon?: number;
    twinStateId?: string | null;
    analysisId?: string | null;
  } = {},
): Promise<{ id: string | null; error: string | null }> {
  if (!supabaseConfigured) return { id: null, error: null };

  // Guard: skip if recording not in Supabase (avoids FK violation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recCheck } = await (supabase as any)
    .from("recordings").select("id").eq("id", recordingId).maybeSingle();
  if (!recCheck) return { id: null, error: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("forecasts")
    .insert({
      user_id:                   userId,
      recording_id:              recordingId,
      analysis_id:               opts.analysisId ?? null,
      digital_twin_state_id:     opts.twinStateId ?? null,
      model_name:                opts.modelName ?? (apiResult.model_name as string | undefined) ?? null,
      model_version:             opts.modelVersion ?? null,
      observation_window:        opts.observationWindow ?? (apiResult.observation_window_s as number | undefined) ?? null,
      prediction_horizon:        opts.predictionHorizon ?? (apiResult.forecast_horizon_s as number | undefined) ?? null,
      forecast_output:           apiResult,
      uncertainty_data:          null,
      experimental_risk_estimate:(apiResult.model_score as number | undefined) ?? null,
      forecast_status:           (apiResult.status as string | undefined) ?? "completed",
    })
    .select("id")
    .single();

  return {
    id:    (data as { id: string } | null)?.id ?? null,
    error: (error as { message?: string } | null)?.message ?? null,
  };
}

export async function listForecasts(recordingId: string): Promise<Forecast[]> {
  if (!supabaseConfigured) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("forecasts")
    .select("*")
    .eq("recording_id", recordingId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as Forecast[];
}

export async function getRecentForecasts(limit = 5): Promise<Forecast[]> {
  if (!supabaseConfigured) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("forecasts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as Forecast[];
}
