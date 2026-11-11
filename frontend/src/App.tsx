import { lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Public landing page (eager — it's the entry point)
import LandingPage from "./pages/LandingPage";

// Auth pages (public, eager)
import LoginPage           from "./pages/auth/LoginPage";
import SignupPage          from "./pages/auth/SignupPage";
import ForgotPasswordPage  from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage   from "./pages/auth/ResetPasswordPage";
import AuthCallbackPage    from "./pages/auth/AuthCallbackPage";

// App pages — lazy-loaded (keeps landing page bundle tiny)
const OverviewPage    = lazy(() => import("./pages/OverviewPage"));
const AnalysisPage    = lazy(() => import("./pages/AnalysisPage"));
const TwinPage        = lazy(() => import("./pages/TwinPage"));
const ForecastPage    = lazy(() => import("./pages/ForecastPage"));
const ResearchLabPage = lazy(() => import("./pages/ResearchLabPage"));

import type { LabTab } from "./pages/ResearchLabPage";

function AppLoader() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#F0F4F8",
    }}>
      <svg width={32} height={32} viewBox="0 0 24 24" fill="none"
        stroke="#0D9488" strokeWidth={2}
        style={{ animation: "spin 0.8s linear infinite" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <circle cx="12" cy="12" r="9" strokeOpacity={0.2} />
        <path d="M21 12a9 9 0 00-9-9" />
      </svg>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* ── Public landing page ──────────────────────────── */}
      <Route path="/" element={<LandingPage />} />

      {/* ── Public auth routes ───────────────────────────── */}
      <Route path="/login"           element={<LoginPage />} />
      <Route path="/signup"          element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password"  element={<ResetPasswordPage />} />
      <Route path="/auth/callback"   element={<AuthCallbackPage />} />

      {/* ── Protected app routes under /app ──────────────── */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/app" element={
          <Suspense fallback={<AppLoader />}><OverviewPage /></Suspense>
        } />
        <Route path="/app/ecg" element={
          <Suspense fallback={<AppLoader />}><AnalysisPage /></Suspense>
        } />
        <Route path="/app/twin" element={
          <Suspense fallback={<AppLoader />}><TwinPage /></Suspense>
        } />
        <Route path="/app/forecast" element={
          <Suspense fallback={<AppLoader />}><ForecastPage /></Suspense>
        } />
        <Route path="/app/research" element={
          <Suspense fallback={<AppLoader />}><ResearchLabPage /></Suspense>
        } />

        {/* Research Lab deep-links */}
        {(["pipeline","recordings","results","replay","hardware",
           "methodology","scope","limitations","about","explain","architecture"] as LabTab[])
          .map((tab) => (
            <Route key={tab} path={`/app/research/${tab}`} element={
              <Suspense fallback={<AppLoader />}>
                <ResearchLabPage tab={tab} />
              </Suspense>
            } />
          ))}

        {/* Legacy /app/* redirects for old bookmarks */}
        <Route path="/app/analysis"   element={<Navigate to="/app/ecg"      replace />} />
        <Route path="/app/dashboard"  element={<Navigate to="/app"           replace />} />
        <Route path="/app/datasets"   element={<Navigate to="/app/research/recordings" replace />} />
      </Route>

      {/* ── Legacy flat routes → new /app/* ──────────────── */}
      <Route path="/dashboard"    element={<Navigate to="/app"                       replace />} />
      <Route path="/analysis"     element={<Navigate to="/app/ecg"                   replace />} />
      <Route path="/twin"         element={<Navigate to="/app/twin"                  replace />} />
      <Route path="/forecast"     element={<Navigate to="/app/forecast"              replace />} />
      <Route path="/research"     element={<Navigate to="/app/research"              replace />} />
      <Route path="/datasets"     element={<Navigate to="/app/research/recordings"   replace />} />
      <Route path="/results"      element={<Navigate to="/app/research/results"      replace />} />
      <Route path="/hardware"     element={<Navigate to="/app/research/hardware"     replace />} />
      <Route path="/methodology"  element={<Navigate to="/app/research/methodology"  replace />} />
      <Route path="/scope"        element={<Navigate to="/app/research/scope"        replace />} />
      <Route path="/limitations"  element={<Navigate to="/app/research/limitations"  replace />} />
      <Route path="/about"        element={<Navigate to="/app/research/about"        replace />} />
      <Route path="/explain"      element={<Navigate to="/app/research/explain"      replace />} />
      <Route path="/pipeline"     element={<Navigate to="/app/research/pipeline"     replace />} />
      <Route path="/replay"       element={<Navigate to="/app/research/replay"       replace />} />
      <Route path="/architecture" element={<Navigate to="/app/research/architecture" replace />} />
    </Routes>
  );
}
