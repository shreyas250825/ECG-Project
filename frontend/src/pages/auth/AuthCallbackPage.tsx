/**
 * Auth callback handler.
 * Supabase redirects here after:
 *  - Email confirmation
 *  - Magic link sign-in
 *  - OAuth flows (if used)
 *
 * The Supabase JS client automatically exchanges the token in the URL hash.
 * This page just waits for the session to be established then redirects.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error,  setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error: err }) => {
      if (err) {
        setError(err.message);
        return;
      }
      if (data.session) {
        navigate("/", { replace: true });
      } else {
        /* Wait briefly for the hash exchange */
        const timer = setTimeout(() => {
          supabase.auth.getSession().then(({ data: d2 }) => {
            if (d2.session) {
              navigate("/", { replace: true });
            } else {
              navigate("/login", { replace: true });
            }
          });
        }, 1500);
        return () => clearTimeout(timer);
      }
    });
  }, [navigate]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
        {error ? (
          <>
            <p style={{ color: "#EF4444", fontSize: "0.9375rem" }}>{error}</p>
            <a href="/login" style={{ color: "#0D9488", fontWeight: 600 }}>Back to sign in</a>
          </>
        ) : (
          <>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth={2} style={{ animation: "spin 0.8s linear infinite" }}>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <circle cx="12" cy="12" r="9" strokeOpacity={0.2} />
              <path d="M21 12a9 9 0 00-9-9" />
            </svg>
            <p style={{ color: "#64748B", fontSize: "0.9375rem" }}>Completing sign in…</p>
          </>
        )}
      </div>
    </div>
  );
}
