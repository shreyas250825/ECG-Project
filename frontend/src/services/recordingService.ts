/**
 * Recording service — Supabase-backed with graceful fallback.
 * Files go to the private `ecg-recordings` bucket.
 * Metadata goes to the `recordings` table with RLS.
 */
import { supabase, supabaseConfigured } from "../lib/supabase";

export type Recording = {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  storage_path: string | null;
  file_type: string | null;
  file_size: number | null;
  recording_source: string | null;
  dataset_name: string | null;
  duration_seconds: number | null;
  sampling_rate: number | null;
  lead_information: string | null;
  is_synthetic: boolean;
  recording_metadata: unknown;
  created_at: string;
  updated_at: string;
};

const BUCKET = "ecg-recordings";

/* ── Typed helper: bypass Supabase TS inference for custom types ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/* ── List user recordings ─────────────────────────────────────────── */
export async function listRecordings(): Promise<Recording[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await db
    .from("recordings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[recordingService] listRecordings:", error.message);
    return [];
  }
  return (data ?? []) as Recording[];
}

/* ── Get single recording ─────────────────────────────────────────── */
export async function getRecording(id: string): Promise<Recording | null> {
  if (!supabaseConfigured) return null;
  const { data, error } = await db
    .from("recordings")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Recording;
}

/* ── Upload ECG file + create metadata row ────────────────────────── */
export async function uploadRecording(
  userId: string,
  file: File,
  meta: Partial<Omit<Recording, "id" | "user_id" | "created_at" | "updated_at">> = {},
): Promise<{ recording: Recording | null; error: string | null }> {
  if (!supabaseConfigured) return { recording: null, error: "Supabase not configured" };

  const recordingId = crypto.randomUUID();
  const storagePath = `${userId}/${recordingId}/${file.name}`;

  /* 1. Upload file to private bucket */
  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: false });

  if (storageErr) {
    return { recording: null, error: `Storage upload failed: ${storageErr.message}` };
  }

  /* 2. Insert metadata */
  const { data, error: dbErr } = await db
    .from("recordings")
    .insert({
      id: recordingId,
      user_id: userId,
      title: meta.title ?? file.name,
      file_name: file.name,
      storage_path: storagePath,
      file_type: (file.type || file.name.split(".").pop()) ?? null,
      file_size: file.size,
      is_synthetic: meta.is_synthetic ?? false,
      recording_source: meta.recording_source ?? "upload",
      dataset_name: meta.dataset_name ?? null,
      duration_seconds: meta.duration_seconds ?? null,
      sampling_rate: meta.sampling_rate ?? null,
      lead_information: meta.lead_information ?? null,
      recording_metadata: meta.recording_metadata ?? null,
    })
    .select()
    .single();

  if (dbErr) {
    /* Cleanup orphaned storage file on DB failure */
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { recording: null, error: `Database insert failed: ${dbErr.message}` };
  }

  return { recording: data as Recording, error: null };
}

/* ── Create metadata-only recording (from backend-loaded dataset) ── */
export async function createRecordingMetadata(
  userId: string,
  meta: Record<string, unknown>,
): Promise<{ recording: Recording | null; error: string | null }> {
  if (!supabaseConfigured) return { recording: null, error: null };
  const { data, error } = await db
    .from("recordings")
    .upsert({ ...meta, user_id: userId }, { onConflict: "id", ignoreDuplicates: true })
    .select()
    .single();
  if (error) return { recording: null, error: error.message };
  return { recording: data as Recording, error: null };
}

/* ── Delete recording + storage file ─────────────────────────────── */
export async function deleteRecording(id: string): Promise<{ error: string | null }> {
  if (!supabaseConfigured) return { error: null };

  const rec = await getRecording(id);
  if (rec?.storage_path) {
    await supabase.storage.from(BUCKET).remove([rec.storage_path]);
  }

  const { error } = await db.from("recordings").delete().eq("id", id);
  return { error: (error as { message?: string } | null)?.message ?? null };
}

/* ── Generate signed download URL ─────────────────────────────────── */
export async function getSignedUrl(
  storagePath: string,
  expiresIn = 3600,
): Promise<string | null> {
  if (!supabaseConfigured || !storagePath) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error) return null;
  return data.signedUrl;
}
