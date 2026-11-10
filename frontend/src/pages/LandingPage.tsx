// Legacy LandingPage — redirected to OverviewPage via router.
// Kept for compatibility.
import { Navigate } from "react-router-dom";
export default function LandingPage() {
  return <Navigate to="/" replace />;
}
