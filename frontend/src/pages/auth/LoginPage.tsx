import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

/* ── Shared form styles ───────────────────────────────────────────── */
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

function PulseECG() {
  return (
    <svg viewBox="0 0 400 100" fill="none" style={{ width: "100%", opacity: 0.15 }}>
      <polyline
        points="0,50 50,50 70,10 90,90 110,50 160,50 180,30 200,70 220,50 270,50 290,42 310,58 330,50 400,50"
        stroke="white" strokeWidth="2.5" fill="none"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { signIn, configured } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = (location.state as { from?: string } | null)?.from ?? "/";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      navigate(from, { replace: true });
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#F0F4F8" }}>
      {/* ── Left panel (desktop only) ─────────────────────────── */}
      <div
        style={{
          flex: "0 0 44%",
          background: "linear-gradient(150deg, #0C1525 0%, #0E2240 60%, #0C2A3A 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "3rem 2.5rem",
          position: "relative",
          overflow: "hidden",
        }}
        className="auth-left-panel"
      >
        {/* Decorative ECG */}
        <div style={{ position: "absolute", bottom: "10%", left: 0, right: 0, pointerEvents: "none" }}>
          <PulseECG />
        </div>

        <div style={{ position: "relative" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "2.5rem" }}>
            <div style={{ width: 36, height: 36, borderRadius: "0.5rem", background: "linear-gradient(135deg, #0D9488, #0F766E)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}><path d="M3 12h3l3-9 3 18 3-9 3 0" /></svg>
            </div>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Cardiac Digital Twin</span>
          </div>

          <h2 style={{ fontSize: "clamp(1.5rem, 2.5vw, 2.25rem)", fontWeight: 800, color: "#fff", margin: "0 0 1rem", lineHeight: 1.2 }}>
            Personalized cardiac intelligence
          </h2>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.58)", lineHeight: 1.7, maxWidth: 380 }}>
            ECG analysis, physiological modelling, and experimental short-term arrhythmia risk forecasting.
          </p>

          <div style={{ marginTop: "2rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {["Research Prototype", "Non-clinical"].map((t) => (
              <span key={t} style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.25rem 0.75rem", borderRadius: "9999px", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.1)", letterSpacing: "0.03em" }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — form ────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1.25rem" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          {/* Mobile logo */}
          <div style={{ display: "none", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }} className="auth-mobile-logo">
            <div style={{ width: 30, height: 30, borderRadius: "0.4rem", background: "linear-gradient(135deg, #0D9488, #0F766E)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}><path d="M3 12h3l3-9 3 18 3-9 3 0" /></svg>
            </div>
            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0F172A" }}>Cardiac Digital Twin</span>
          </div>

          <h1 style={{ fontSize: "1.625rem", fontWeight: 800, color: "#0F172A", margin: "0 0 0.375rem", letterSpacing: "-0.03em" }}>
            Welcome back
          </h1>
          <p style={{ fontSize: "0.9375rem", color: "#64748B", margin: "0 0 2rem" }}>
            Sign in to continue your research.
          </p>

          {!configured && (
            <div style={{ background: "#FFF8E1", border: "1px solid #FFD54F", borderRadius: "0.625rem", padding: "0.75rem 1rem", marginBottom: "1.25rem", fontSize: "0.8125rem", color: "#7C5C00" }}>
              <strong>Demo mode:</strong> Supabase credentials are not configured. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your <code>.env</code> file to enable authentication.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "0.375rem" }}>
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inp}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0D9488"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(13,148,136,0.12)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            {/* Password */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#334155" }}>Password</label>
                <Link to="/forgot-password" style={{ fontSize: "0.8125rem", color: "#0D9488", textDecoration: "none", fontWeight: 500 }}>
                  Forgot password?
                </Link>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  style={{ ...inp, paddingRight: "2.75rem" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#0D9488"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(13,148,136,0.12)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex", alignItems: "center" }}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPwd} />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "0.5rem", padding: "0.625rem 0.875rem", fontSize: "0.8125rem", color: "#B91C1C" }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", padding: "0.75rem", borderRadius: "0.625rem", background: loading ? "#94A3B8" : "#0D9488", color: "#fff", fontSize: "0.9375rem", fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer", transition: "background 0.15s", letterSpacing: "-0.01em" }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem", color: "#64748B" }}>
            Don&apos;t have an account?{" "}
            <Link to="/signup" style={{ color: "#0D9488", fontWeight: 600, textDecoration: "none" }}>
              Create account
            </Link>
          </p>

          <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.6875rem", color: "#CBD5E1" }}>
            Research prototype · Not for clinical diagnosis
          </p>
        </div>
      </div>
    </div>
  );
}
