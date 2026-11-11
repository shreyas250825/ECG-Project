import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
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

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email) return setError("Please enter your email address.");
    setLoading(true);
    const result = await sendPasswordReset(email);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8", padding: "2rem 1.25rem" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.75rem" }}>
          <div style={{ width: 30, height: 30, borderRadius: "0.4rem", background: "linear-gradient(135deg, #0D9488, #0F766E)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}><path d="M3 12h3l3-9 3 18 3-9 3 0" /></svg>
          </div>
          <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0F172A" }}>Cardiac Digital Twin</span>
        </div>

        <div style={{ background: "#fff", borderRadius: "1rem", border: "1px solid #E2E8F0", padding: "2rem" }}>
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(13,148,136,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth={1.75}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              </div>
              <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "#0F172A", margin: "0 0 0.625rem" }}>Check your email</h2>
              <p style={{ color: "#64748B", lineHeight: 1.65, margin: "0 0 1.5rem", fontSize: "0.9375rem" }}>
                If an account with that email exists, we have sent a password reset link. Check your inbox and spam folder.
              </p>
              <Link to="/login" style={{ display: "inline-block", padding: "0.625rem 1.5rem", background: "#0D9488", color: "#fff", borderRadius: "0.625rem", textDecoration: "none", fontWeight: 600 }}>
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0F172A", margin: "0 0 0.25rem", letterSpacing: "-0.03em" }}>Reset password</h1>
              <p style={{ fontSize: "0.875rem", color: "#64748B", margin: "0 0 1.5rem" }}>
                Enter your email and we will send you a reset link.
              </p>

              <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "0.375rem" }}>Email address</label>
                  <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inp}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#0D9488"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(13,148,136,0.12)"; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none"; }} />
                </div>

                {error && (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "0.5rem", padding: "0.625rem 0.875rem", fontSize: "0.8125rem", color: "#B91C1C" }}>{error}</div>
                )}

                <button type="submit" disabled={loading} style={{ width: "100%", padding: "0.75rem", borderRadius: "0.625rem", background: loading ? "#94A3B8" : "#0D9488", color: "#fff", fontSize: "0.9375rem", fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer" }}>
                  {loading ? "Sending…" : "Send Reset Link"}
                </button>
              </form>

              <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.875rem", color: "#64748B" }}>
                <Link to="/login" style={{ color: "#0D9488", fontWeight: 600, textDecoration: "none" }}>← Back to Sign In</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
