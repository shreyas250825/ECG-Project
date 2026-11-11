import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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

function PasswordStrength({ password }: { password: string }) {
  const len   = password.length;
  const hasUpper = /[A-Z]/.test(password);
  const hasNum   = /\d/.test(password);
  const hasSpec  = /[^A-Za-z0-9]/.test(password);
  const score    = (len >= 8 ? 1 : 0) + (len >= 12 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpec ? 1 : 0);
  const labels   = ["", "Weak", "Fair", "Good", "Strong", "Very strong"];
  const colors   = ["#E2E8F0", "#EF4444", "#F59E0B", "#3B82F6", "#10B981", "#059669"];
  if (!password) return null;
  return (
    <div style={{ marginTop: "0.375rem" }}>
      <div style={{ display: "flex", gap: "3px" }}>
        {[1,2,3,4,5].map((i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= score ? colors[score] : "#E2E8F0", transition: "background 0.2s" }} />
        ))}
      </div>
      <p style={{ fontSize: "0.6875rem", color: colors[score], marginTop: "0.25rem" }}>{labels[score]}</p>
    </div>
  );
}

export default function SignupPage() {
  const { signUp, configured } = useAuth();
  const navigate = useNavigate();

  const [fullName,  setFullName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPwd,   setShowPwd]   = useState(false);
  const [agreed,    setAgreed]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [verifyNeeded, setVerifyNeeded] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim())             return setError("Please enter your full name.");
    if (!email)                        return setError("Please enter your email address.");
    if (password.length < 8)           return setError("Password must be at least 8 characters.");
    if (password !== confirm)          return setError("Passwords do not match.");
    if (!agreed)                       return setError("Please accept the terms to continue.");

    setLoading(true);
    const result = await signUp(email, password, fullName.trim());
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (result.needsConfirmation) {
      setVerifyNeeded(true);
    } else {
      navigate("/", { replace: true });
    }
  }

  if (verifyNeeded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8", padding: "1.5rem" }}>
        <div style={{ width: "100%", maxWidth: 440, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(13,148,136,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
            <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth={1.75}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
          </div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0F172A", margin: "0 0 0.75rem" }}>Check your email</h2>
          <p style={{ color: "#64748B", lineHeight: 1.65, margin: "0 0 1.5rem" }}>
            We sent a confirmation link to <strong style={{ color: "#0F172A" }}>{email}</strong>. Click it to activate your account.
          </p>
          <Link to="/login" style={{ display: "inline-block", padding: "0.625rem 1.5rem", background: "#0D9488", color: "#fff", borderRadius: "0.625rem", textDecoration: "none", fontWeight: 600, fontSize: "0.9375rem" }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8", padding: "2rem 1.25rem" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.75rem" }}>
          <div style={{ width: 30, height: 30, borderRadius: "0.4rem", background: "linear-gradient(135deg, #0D9488, #0F766E)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}><path d="M3 12h3l3-9 3 18 3-9 3 0" /></svg>
          </div>
          <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0F172A" }}>Cardiac Digital Twin</span>
        </div>

        <div style={{ background: "#fff", borderRadius: "1rem", border: "1px solid #E2E8F0", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0F172A", margin: "0 0 0.25rem", letterSpacing: "-0.03em" }}>
            Create account
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#64748B", margin: "0 0 1.5rem" }}>
            Start your cardiac research.
          </p>

          {!configured && (
            <div style={{ background: "#FFF8E1", border: "1px solid #FFD54F", borderRadius: "0.5rem", padding: "0.625rem 0.875rem", marginBottom: "1rem", fontSize: "0.8125rem", color: "#7C5C00" }}>
              Supabase not configured — registration will not persist.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "0.375rem" }}>Full name</label>
              <input type="text" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. Jane Smith" style={inp}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0D9488"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(13,148,136,0.12)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none"; }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "0.375rem" }}>Email address</label>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inp}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0D9488"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(13,148,136,0.12)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none"; }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "0.375rem" }}>Password</label>
              <div style={{ position: "relative" }}>
                <input type={showPwd ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" style={{ ...inp, paddingRight: "2.75rem" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#0D9488"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(13,148,136,0.12)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none"; }} />
                <button type="button" onClick={() => setShowPwd((v) => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex", alignItems: "center" }} aria-label={showPwd ? "Hide" : "Show"}>
                  <EyeIcon open={showPwd} />
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "0.375rem" }}>Confirm password</label>
              <input type={showPwd ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" style={{ ...inp, borderColor: confirm && confirm !== password ? "#EF4444" : "#E2E8F0" }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 3px rgba(13,148,136,0.12)"; }}
                onBlur={(e)  => { e.currentTarget.style.boxShadow = "none"; }} />
              {confirm && confirm !== password && <p style={{ fontSize: "0.75rem", color: "#EF4444", marginTop: "0.25rem" }}>Passwords do not match</p>}
            </div>

            <label style={{ display: "flex", gap: "0.625rem", alignItems: "flex-start", cursor: "pointer", fontSize: "0.8125rem", color: "#475569", lineHeight: 1.5 }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ accentColor: "#0D9488", marginTop: "0.125rem", cursor: "pointer", flexShrink: 0, width: 16, height: 16 }} />
              I understand this is a research prototype not intended for clinical use.
            </label>

            {error && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "0.5rem", padding: "0.625rem 0.875rem", fontSize: "0.8125rem", color: "#B91C1C" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ width: "100%", padding: "0.75rem", borderRadius: "0.625rem", background: loading ? "#94A3B8" : "#0D9488", color: "#fff", fontSize: "0.9375rem", fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer", letterSpacing: "-0.01em" }}>
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.875rem", color: "#64748B" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "#0D9488", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
