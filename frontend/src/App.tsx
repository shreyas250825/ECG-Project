import { Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import AboutPage from "./pages/AboutPage";
import AnalysisPage from "./pages/AnalysisPage";
import ArchitecturePage from "./pages/ArchitecturePage";
import DatasetsPage from "./pages/DatasetsPage";
import ExplainPage from "./pages/ExplainPage";
import ForecastPage from "./pages/ForecastPage";
import HardwarePage from "./pages/HardwarePage";
import LandingPage from "./pages/LandingPage";
import LimitationsPage from "./pages/LimitationsPage";
import MethodologyPage from "./pages/MethodologyPage";
import PipelinePage from "./pages/PipelinePage";
import ReplayPage from "./pages/ReplayPage";
import ResultsPage from "./pages/ResultsPage";
import ScopePage from "./pages/ScopePage";
import TwinPage from "./pages/TwinPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/twin" element={<TwinPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/datasets" element={<DatasetsPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/hardware" element={<HardwarePage />} />
        <Route path="/methodology" element={<MethodologyPage />} />
        <Route path="/scope" element={<ScopePage />} />
        <Route path="/limitations" element={<LimitationsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/explain" element={<ExplainPage />} />
        <Route path="/architecture" element={<ArchitecturePage />} />
        <Route path="/replay" element={<ReplayPage />} />
      </Route>
    </Routes>
  );
}
