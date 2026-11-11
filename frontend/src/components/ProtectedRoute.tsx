/**
 * ProtectedRoute — wraps any route that requires authentication.
 *
 * Behaviour:
 * - While session is loading: show a full-page spinner.
 * - If Supabase is not configured: allow access (demo mode).
 * - If authenticated: render children.
 * - If unauthenticated: redirect to /login, preserving the intended path.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status, configured } = useAuth();
  const location = useLocation();

  /* Allow through in demo mode (no Supabase) */
  if (!configured) return <>{children}</>;

  if (status === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F0F4F8",
        }}
      >
        <svg
          width={32}
          height={32}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0D9488"
          strokeWidth={2}
          style={{ animation: "spin 0.8s linear infinite" }}
        >
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <circle cx="12" cy="12" r="9" strokeOpacity={0.2} />
          <path d="M21 12a9 9 0 00-9-9" />
        </svg>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  return <>{children}</>;
}
