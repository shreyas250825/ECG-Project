import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

const inp: React.CSSProperties = {
  width: "100%",
  padding: "0.6875rem 0.875rem",
  border: "1px solid #E2E8F0",
  borderRadius: "0.625rem",
  fontSize: "0.9375rem",
  outline: "none",
  background: "#F8FAFC",
  color: "#0F172A",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {open
        ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
        : <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" /></>
      }
    </svg>
  );
}

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [ready,     setReady]     = useState(false);
  const [invalid,   setInvalid]   = useState(false);
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPwd,   setShowPwd]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);

  /* Supabase sends a recovery event when the user clicks the email link */
  useEffect(() => {
    // Check URL hash immediately — Supabase v2 delivers token via hash fragment
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setReady(true);
      return;
    }

    // Also listen for the PASSWORD_RECOVERY auth event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // If neither the hash nor the event fires within 10 s, the link is invalid/expired
    const timer = setTimeout(() => {
      setInvalid(true);
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8)   return setError("Password must be at least 8 characters.");
    if (password !== confirm)   return setError("Passwords do not match.");
    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    }
  }

  if (invalid) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8", padding: "2rem 1.25rem" }}>
        <div style={{ maxWidth: 420, width: "100%", background: "#fff", borderRadius: "1rem", border: "1px solid #E2E8F0", padding: "2rem", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={1.75}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          </div>
          <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "#0F172A", margin: "0 0 0.625rem" }}>Link expired or invalid</h2>
          <p style={{ color: "#64748B", margin: "0 0 1.5rem", lineHeight: 1.65 }}>
            This password reset link has expired or is not valid. Request a new one.
          </p>
          <Link to="/forgot-password" style={{ display: "inline-block", padding: "0.625rem 1.5rem", background: "#0D9488", color: "#fff", borderRadius: "0.625rem", textDecoration: "none", fontWeight: 600 }}>
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8", padding: "2rem 1.25rem" }}>
        <div style={{ maxWidth: 420, width: "100%", background: "#fff", borderRadius: "1rem", border: "1px solid #E2E8F0", padding: "2rem", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(13,148,136,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth={2}><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "#0F172A", margin: "0 0 0.5rem" }}>Password updated</h2>
          <p style={{ color: "#64748B" }}>Redirecting you to sign in…</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", color: "#64748B" }}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: "spin 0.8s linear infinite" }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <circle cx="12" cy="12" r="9" strokeOpacity={0.2} /><path d="M21 12a9 9 0 00-9-9" />
          </svg>
          <span style={{ fontSize: "0.875rem" }}>Validating reset link…</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8", padding: "2rem 1.25rem" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.75rem" }}>
          <div style={{ width: 30, height: 30, borderRadius: "0.4rem", background: "linear-gradient(135deg, #0D9488, #0F766E)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}><path d="M3 12h3l3-9 3 18 3-9 3 0" /></svg>
          </div>
          <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0F172A" }}>Cardiac Digital Twin</span>
        </div>

        <div style={{ background: "#fff", borderRadius: "1rem", border: "1px solid #E2E8F0", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0F172A", margin: "0 0 0.25rem", letterSpacing: "-0.03em" }}>Set new password</h1>
          <p style={{ fontSize: "0.875rem", color: "#64748B", margin: "0 0 1.5rem" }}>Choose a strong password for your account.</p>

          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "0.375rem" }}>New password</label>
              <div style={{ position: "relative" }}>
                <input type={showPwd ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" style={{ ...inp, paddingRight: "2.75rem" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#0D9488"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(13,148,136,0.12)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none"; }} />
                <button type="button" onClick={() => setShowPwd((v) => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex" }}>
                  <EyeIcon open={showPwd} />
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "0.375rem" }}>Confirm password</label>
              <input type={showPwd ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" style={{ ...inp, borderColor: confirm && confirm !== password ? "#EF4444" : "#E2E8F0" }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 3px rgba(13,148,136,0.12)"; }}
                onBlur={(e)  => { e.currentTarget.style.boxShadow = "none"; }} />
            </div>

            {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "0.5rem", padding: "0.625rem 0.875rem", fontSize: "0.8125rem", color: "#B91C1C" }}>{error}</div>}

            <button type="submit" disabled={loading} style={{ width: "100%", padding: "0.75rem", borderRadius: "0.625rem", background: loading ? "#94A3B8" : "#0D9488", color: "#fff", fontSize: "0.9375rem", fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
