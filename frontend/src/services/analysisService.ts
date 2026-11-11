/**
 * ECG Analysis persistence service.
 * Saves analysis results from the FastAPI backend to Supabase.
 */
import { supabase, supabaseConfigured } from "../lib/supabase";

export type EcgAnalysis = {
  id: string;
  user_id: string;
  recording_id: string;
  analysis_status: string;
  signal_quality: number | null;
  heart_rate: number | null;
  hrv_metrics: unknown;
  r_peak_count: number | null;
  extracted_features: unknown;
  preprocessing_metadata: unknown;
  analysis_summary: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

/* ── Save analysis result ─────────────────────────────────────────── */
export async function saveAnalysis(
  userId: string,
  recordingId: string,
  apiResult: Record<string, unknown>,
): Promise<{ id: string | null; error: string | null }> {
  if (!supabaseConfigured) return { id: null, error: null };

  const sq = apiResult.signal_quality as { score?: number } | undefined;
  const rp = apiResult.r_peaks       as { count?: number } | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("ecg_analyses")
    .insert({
      user_id:               userId,
      recording_id:          recordingId,
      analysis_status:       "completed",
      signal_quality:        sq?.score ?? null,
      heart_rate:            (apiResult.heart_rate_bpm as number | undefined) ?? null,
      hrv_metrics:           (apiResult.hrv ?? null),
      r_peak_count:          rp?.count ?? null,
      extracted_features:    apiResult.features ?? null,
      preprocessing_metadata:apiResult.preprocessing ?? null,
      analysis_summary:      (apiResult.detection as { label?: string } | undefined)?.label ?? null,
      error_message:         null,
      completed_at:          new Date().toISOString(),
    })
    .select("id")
    .single();

  return { id: (data as { id: string } | null)?.id ?? null, error: (error as { message?: string } | null)?.message ?? null };
}

/* ── List analyses for a recording ───────────────────────────────── */
export async function listAnalyses(recordingId: string): Promise<EcgAnalysis[]> {
  if (!supabaseConfigured) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("ecg_analyses")
    .select("*")
    .eq("recording_id", recordingId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as EcgAnalysis[];
}

/* ── Get user's recent analyses ───────────────────────────────────── */
export async function getRecentAnalyses(limit = 10): Promise<EcgAnalysis[]> {
  if (!supabaseConfigured) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("ecg_analyses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as EcgAnalysis[];
}
