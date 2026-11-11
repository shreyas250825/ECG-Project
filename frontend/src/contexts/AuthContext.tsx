import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "../lib/supabase";

/* ── Types ────────────────────────────────────────────────────────────── */
export type AuthStatus =
  | "loading"       // initial hydration
  | "authenticated" // has valid session
  | "unauthenticated"; // no session

export type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** Sign in with email + password */
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Create a new account */
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  /** Sign out */
  signOut: () => Promise<void>;
  /** Send a password-reset email */
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  /** Set a new password (after a recovery token is active in the session) */
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  /** Whether Supabase credentials are configured */
  configured: boolean;
};

/* ── Context ──────────────────────────────────────────────────────────── */
const AuthContext = createContext<AuthContextValue | null>(null);

/* ── Provider ─────────────────────────────────────────────────────────── */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus]   = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const listenerRef           = useRef(false);

  /* Derive user from session */
  const user = session?.user ?? null;

  /* ── Initialise: restore session and subscribe to auth events ─── */
  useEffect(() => {
    if (listenerRef.current) return;
    listenerRef.current = true;

    /* Get current session on mount */
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? "authenticated" : "unauthenticated");
    });

    /* Subscribe to auth state changes */
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setStatus(newSession ? "authenticated" : "unauthenticated");
      },
    );

    return () => { subscription.unsubscribe(); };
  }, []);

  /* ── Actions ──────────────────────────────────────────────────── */
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { full_name: fullName },
      },
    });
    if (error) return { error: error.message, needsConfirmation: false };

    /* Create profile row (best-effort — the trigger handles it if the SQL trigger exists) */
    if (data.user && !error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName,
        role: "researcher",
      } as any, { onConflict: "id", ignoreDuplicates: true });
    }

    const needsConfirmation =
      data.user != null &&
      data.user.identities?.length === 0;

    return { error: null, needsConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error?.message ?? null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  }, []);

  /* ── Context value ────────────────────────────────────────────── */
  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    user,
    signIn,
    signUp,
    signOut,
    sendPasswordReset,
    updatePassword,
    configured: supabaseConfigured,
  }), [status, session, user, signIn, signUp, signOut, sendPasswordReset, updatePassword]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/* ── Hook ─────────────────────────────────────────────────────────────── */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
