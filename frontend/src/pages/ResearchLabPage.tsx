import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, PageHeader } from "../components/ui";

// Sub-page components
import PipelinePage       from "./PipelinePage";
import DatasetsPage       from "./DatasetsPage";
import ResultsPage        from "./ResultsPage";
import ReplayPage         from "./ReplayPage";
import HardwarePage       from "./HardwarePage";
import MethodologyPage    from "./MethodologyPage";
import ScopePage          from "./ScopePage";
import LimitationsPage    from "./LimitationsPage";
import AboutPage          from "./AboutPage";
import ExplainPage        from "./ExplainPage";
import ArchitecturePage   from "./ArchitecturePage";

export type LabTab =
  | "pipeline"
  | "recordings"
  | "results"
  | "replay"
  | "hardware"
  | "methodology"
  | "scope"
  | "limitations"
  | "about"
  | "explain"
  | "architecture";

const TABS: { id: LabTab; label: string; icon: string }[] = [
  { id: "pipeline",     label: "Pipeline",          icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" },
  { id: "recordings",   label: "Recordings",         icon: "M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V9l-5-5H7c-2 0-3 1-3 3zm9-5v5h5" },
  { id: "results",      label: "Results",            icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" },
  { id: "replay",       label: "Replay",             icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { id: "hardware",     label: "Hardware",           icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" },
  { id: "methodology",  label: "Methodology",        icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { id: "scope",        label: "Scope",              icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { id: "limitations",  label: "Limitations",        icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
  { id: "about",        label: "About & People",     icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { id: "explain",      label: "Explain",            icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { id: "architecture", label: "Architecture",       icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" },
];

function TabContent({ tab }: { tab: LabTab }) {
  switch (tab) {
    case "pipeline":     return <PipelinePage />;
    case "recordings":   return <DatasetsPage />;
    case "results":      return <ResultsPage />;
    case "replay":       return <ReplayPage />;
    case "hardware":     return <HardwarePage />;
    case "methodology":  return <MethodologyPage />;
    case "scope":        return <ScopePage />;
    case "limitations":  return <LimitationsPage />;
    case "about":        return <AboutPage />;
    case "explain":      return <ExplainPage />;
    case "architecture": return <ArchitecturePage />;
    default:             return <PipelinePage />;
  }
}

export default function ResearchLabPage({ tab: tabProp }: { tab?: LabTab }) {
  const [activeTab, setActiveTab] = useState<LabTab>(tabProp ?? "pipeline");
  const navigate = useNavigate();

  // Sync when tab prop changes (from route)
  useEffect(() => {
    if (tabProp) setActiveTab(tabProp);
  }, [tabProp]);

  const handleTab = (id: LabTab) => {
    setActiveTab(id);
    navigate(`/app/research/${id}`, { replace: true });
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Research Lab"
        subtitle="Advanced pipeline, recordings, experiments, hardware, and methodology"
      />

      {/* Tab navigation */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: "0.75rem",
          marginBottom: "1.25rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.25rem",
            padding: "0.625rem 0.75rem",
            borderBottom: "1px solid var(--color-line)",
            background: "var(--color-bg)",
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTab(t.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.375rem 0.75rem",
                borderRadius: "0.375rem",
                fontSize: "0.8125rem",
                fontWeight: activeTab === t.id ? 600 : 400,
                color: activeTab === t.id ? "#fff" : "var(--color-muted)",
                background: activeTab === t.id ? "var(--color-navy)" : "transparent",
                border: activeTab === t.id ? "none" : "none",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <Icon d={t.icon} size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: "1.5rem" }}>
          <TabContent tab={activeTab} />
        </div>
      </div>
    </div>
  );
}
