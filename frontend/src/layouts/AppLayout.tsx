import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useUI } from "../stores/ui";

/* ── Icon primitives (inline SVG, no external dep) ───────────────────── */
function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  overview:    "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  ecg:         "M22 12h-4l-3 9L9 3l-3 9H2",
  twin:        "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 0v20M2 12h20",
  forecast:    "M2 12l3-3 4 4 4-7 4 4 3-3M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12",
  lab:         "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
  settings:    "M12 15a3 3 0 100-6 3 3 0 000 6zm9-3a9 9 0 11-18 0 9 9 0 0118 0z",
  help:        "M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01",
  pulse:       "M3 12h3l3-9 3 18 3-9 3 0",
};

/* ── Nav item ─────────────────────────────────────────────────────────── */
function SideNavItem({
  to,
  icon,
  label,
  end,
}: {
  to: string;
  icon: string;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `sidebar-nav-item${isActive ? " active" : ""}`
      }
    >
      <Icon d={icon} size={15} />
      {label}
    </NavLink>
  );
}

/* ── Demo mode banner ─────────────────────────────────────────────────── */
function DemoModeBanner() {
  return (
    <div
      style={{
        background: "rgba(99,102,241,0.08)",
        borderBottom: "1px solid rgba(99,102,241,0.15)",
        padding: "0.375rem 1.5rem",
        fontSize: "0.6875rem",
        color: "rgba(99,102,241,0.9)",
        fontWeight: 500,
        letterSpacing: "0.02em",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "currentColor",
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      Research Demo Mode — using public / synthetic data
    </div>
  );
}

/* ── Topbar ───────────────────────────────────────────────────────────── */
function Topbar() {
  const { cardiologistMode, demoMode, setCardiologistMode, setDemoMode } = useUI();
  const navigate = useNavigate();

  return (
    <>
      {demoMode && <DemoModeBanner />}
      <div className="topbar">
        {/* breadcrumb / context — kept empty; pages set their own h1 */}
        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Cardiologist explain — now a quiet button */}
          <button
            type="button"
            className="btn-ghost"
            title="Explain to cardiologist"
            onClick={() => navigate("/research/explain")}
            style={{ fontSize: "0.75rem" }}
          >
            <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" size={14} />
            Explain
          </button>

          {/* Demo mode toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.75rem",
              color: "var(--color-muted)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
              style={{ accentColor: "var(--color-teal)", cursor: "pointer" }}
            />
            Demo
          </label>

          {/* Cardiologist mode toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.75rem",
              color: "var(--color-muted)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={cardiologistMode}
              onChange={(e) => setCardiologistMode(e.target.checked)}
              style={{ accentColor: "var(--color-teal)", cursor: "pointer" }}
            />
            Cardiologist view
          </label>
        </div>
      </div>
    </>
  );
}

/* ── App Layout ───────────────────────────────────────────────────────── */
export default function AppLayout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Logo / product identity */}
        <div className="sidebar-logo">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "0.4375rem",
                background: "linear-gradient(135deg, #0D9488 0%, #0F766E 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon d={ICONS.pulse} size={14} />
            </div>
            <div>
              <p
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  color: "#fff",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                Cardiac Digital Twin
              </p>
            </div>
          </div>
          {/* Badges */}
          <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.3125rem", flexWrap: "wrap" }}>
            <span className="badge badge-prototype" style={{ fontSize: "0.5625rem" }}>Research</span>
            <span className="badge badge-warning" style={{ fontSize: "0.5625rem" }}>Non-clinical</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <SideNavItem to="/" icon={ICONS.overview} label="Overview" end />
          <SideNavItem to="/analysis" icon={ICONS.ecg} label="ECG Analysis" />
          <SideNavItem to="/twin" icon={ICONS.twin} label="Digital Twin" />
          <SideNavItem to="/forecast" icon={ICONS.forecast} label="Forecasting" />

          <p className="sidebar-section-label" style={{ marginTop: "0.75rem" }}>
            Research Lab
          </p>
          <SideNavItem to="/research" icon={ICONS.lab} label="Research Lab" />
        </nav>

        <div className="sidebar-footer">
          Personalized cardiac intelligence<br />
          through ECG analysis &amp; modelling
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────────── */}
      <div className="main-area">
        <Topbar />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
