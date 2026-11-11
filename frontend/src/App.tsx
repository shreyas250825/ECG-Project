import { Route, Routes, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Primary sections
import OverviewPage    from "./pages/OverviewPage";
import AnalysisPage    from "./pages/AnalysisPage";
import TwinPage        from "./pages/TwinPage";
import ForecastPage    from "./pages/ForecastPage";
import ResearchLabPage from "./pages/ResearchLabPage";
import type { LabTab } from "./pages/ResearchLabPage";

// Auth pages (public)
import LoginPage         from "./pages/auth/LoginPage";
import SignupPage        from "./pages/auth/SignupPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage  from "./pages/auth/ResetPasswordPage";
import AuthCallbackPage   from "./pages/auth/AuthCallbackPage";

export default function App() {
  return (
    <Routes>
      {/* ── Public auth routes ───────────────────────────── */}
      <Route path="/login"           element={<LoginPage />} />
      <Route path="/signup"          element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password"  element={<ResetPasswordPage />} />
      <Route path="/auth/callback"   element={<AuthCallbackPage />} />

      {/* ── Protected app routes ─────────────────────────── */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<OverviewPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/twin"     element={<TwinPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/research" element={<ResearchLabPage />} />

        {/* Research Lab deep-links */}
        <Route path="/research/pipeline"     element={<ResearchLabPage tab={"pipeline"     as LabTab} />} />
        <Route path="/research/recordings"   element={<ResearchLabPage tab={"recordings"   as LabTab} />} />
        <Route path="/research/results"      element={<ResearchLabPage tab={"results"      as LabTab} />} />
        <Route path="/research/replay"       element={<ResearchLabPage tab={"replay"       as LabTab} />} />
        <Route path="/research/hardware"     element={<ResearchLabPage tab={"hardware"     as LabTab} />} />
        <Route path="/research/methodology"  element={<ResearchLabPage tab={"methodology"  as LabTab} />} />
        <Route path="/research/scope"        element={<ResearchLabPage tab={"scope"        as LabTab} />} />
        <Route path="/research/limitations"  element={<ResearchLabPage tab={"limitations"  as LabTab} />} />
        <Route path="/research/about"        element={<ResearchLabPage tab={"about"        as LabTab} />} />
        <Route path="/research/explain"      element={<ResearchLabPage tab={"explain"      as LabTab} />} />
        <Route path="/research/architecture" element={<ResearchLabPage tab={"architecture" as LabTab} />} />

        {/* Legacy redirects */}
        <Route path="/dashboard"    element={<Navigate to="/"                        replace />} />
        <Route path="/datasets"     element={<Navigate to="/research/recordings"     replace />} />
        <Route path="/results"      element={<Navigate to="/research/results"        replace />} />
        <Route path="/hardware"     element={<Navigate to="/research/hardware"       replace />} />
        <Route path="/methodology"  element={<Navigate to="/research/methodology"   replace />} />
        <Route path="/scope"        element={<Navigate to="/research/scope"          replace />} />
        <Route path="/limitations"  element={<Navigate to="/research/limitations"   replace />} />
        <Route path="/about"        element={<Navigate to="/research/about"          replace />} />
        <Route path="/explain"      element={<Navigate to="/research/explain"        replace />} />
        <Route path="/pipeline"     element={<Navigate to="/research/pipeline"       replace />} />
        <Route path="/replay"       element={<Navigate to="/research/replay"         replace />} />
        <Route path="/architecture" element={<Navigate to="/research/architecture"   replace />} />
      </Route>
    </Routes>
  );
}
