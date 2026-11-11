import { supabase, supabaseConfigured } from "../lib/supabase";

export type DigitalTwinState = {
  id: string;
  user_id: string;
  recording_id: string;
  analysis_id: string | null;
  baseline_data: unknown;
  state_vector: unknown;
  physiological_features: unknown;
  deviation_metrics: unknown;
  state_metadata: unknown;
  created_at: string;
};

export async function saveTwinState(
  userId: string,
  recordingId: string,
  apiResult: Record<string, unknown>,
  analysisId?: string | null,
): Promise<{ id: string | null; error: string | null }> {
  if (!supabaseConfigured) return { id: null, error: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("digital_twin_states")
    .insert({
      user_id:               userId,
      recording_id:          recordingId,
      analysis_id:           analysisId ?? null,
      baseline_data:         apiResult.baseline ?? null,
      state_vector:          apiResult.state_vector ?? null,
      physiological_features:apiResult.features ?? null,
      deviation_metrics:     apiResult.deviation ?? null,
      state_metadata: {
        deviation_score: apiResult.deviation_score ?? null,
        timestamp_s:     apiResult.timestamp_s ?? null,
        notes:           apiResult.notes ?? [],
      },
    })
    .select("id")
    .single();

  return {
    id:    (data as { id: string } | null)?.id ?? null,
    error: (error as { message?: string } | null)?.message ?? null,
  };
}

export async function listTwinStates(recordingId: string): Promise<DigitalTwinState[]> {
  if (!supabaseConfigured) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("digital_twin_states")
    .select("*")
    .eq("recording_id", recordingId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as DigitalTwinState[];
}

export async function getLatestTwinState(recordingId: string): Promise<DigitalTwinState | null> {
  if (!supabaseConfigured) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("digital_twin_states")
    .select("*")
    .eq("recording_id", recordingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data as DigitalTwinState;
}
