import { create } from "zustand";

type UIState = {
  cardiologistMode: boolean;
  demoMode: boolean;
  setCardiologistMode: (v: boolean) => void;
  setDemoMode: (v: boolean) => void;
};

/**
 * Demo mode is ON by default in development.
 * In production (VITE_APP_ENV=production) with Supabase configured,
 * demo mode defaults to OFF so users are not shown the demo banner.
 */
function defaultDemoMode(): boolean {
  const isProduction = import.meta.env.VITE_APP_ENV === "production";
  const supabaseConfigured = Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    !(import.meta.env.VITE_SUPABASE_URL as string).includes("placeholder"),
  );
  // In production with real credentials: default OFF
  if (isProduction && supabaseConfigured) return false;
  // Otherwise: default ON (dev / demo mode)
  return true;
}

export const useUI = create<UIState>((set) => ({
  cardiologistMode: false,
  demoMode: defaultDemoMode(),
  setCardiologistMode: (cardiologistMode) => set({ cardiologistMode }),
  setDemoMode: (demoMode) => set({ demoMode }),
}));
