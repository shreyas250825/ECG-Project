import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  console.warn(
    "[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. " +
    "Authentication and persistent storage are disabled. " +
    "Copy .env.example to .env and fill in your project credentials.",
  );
}

/** Supabase browser client. Safe to import even when credentials are absent —
 *  all calls will return an error that is handled gracefully by each service. */
export const supabase = createClient<Database>(
  url  ?? "https://placeholder.supabase.co",
  key  ?? "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

/** True when real Supabase credentials are present. */
export const supabaseConfigured = Boolean(url && key && !url.includes("placeholder"));
