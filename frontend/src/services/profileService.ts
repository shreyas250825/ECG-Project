import { supabase, supabaseConfigured } from "../lib/supabase";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  institution: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileUpdate = {
  full_name?: string | null;
  avatar_url?: string | null;
  institution?: string | null;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!supabaseConfigured) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data as Profile;
}

export async function updateProfile(userId: string, updates: ProfileUpdate): Promise<{ error: string | null }> {
  if (!supabaseConfigured) return { error: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return { error: (error as { message?: string } | null)?.message ?? null };
}
