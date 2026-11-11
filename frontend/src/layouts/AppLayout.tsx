import { useState, useCallback } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useUI } from "../stores/ui";
import { useAuth } from "../contexts/AuthContext";

/* ── Inline icon helper ───────────────────────────────────────────── */
function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const IC = {
  overview: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  ecg:      "M22 12h-4l-3 9L9 3l-3 9H2",
  twin:     "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 0v20M2 12h20",
  forecast: "M2 12l3-3 4 4 4-7 4 4 3-3M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12",
  lab:      "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
  more:     "M4 6h16M4 12h16M4 18h16",
  close:    "M18 6L6 18M6 6l12 12",
  pulse:    "M3 12h3l3-9 3 18 3-9 3 0",
  logout:   "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  user:     "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  explain:  "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
};

/* ── Sidebar desktop nav item ─────────────────────────────────────── */
function SideNavItem({ to, icon, label, end }: { to: string; icon: string; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => `sidebar-nav-item${isActive ? " active" : ""}`}>
      <Icon d={icon} size={15} />
      {label}
    </NavLink>
  );
}

/* ── Mobile bottom nav item ───────────────────────────────────────── */
function BottomNavItem({ to, icon, label, end, onClick }: {
  to?: string; icon: string; label: string; end?: boolean; onClick?: () => void;
}) {
  if (!to) {
    return (
      <button type="button" onClick={onClick} className="bottom-nav-item">
        <Icon d={icon} size={20} />
        <span>{label}</span>
      </button>
    );
  }
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => `bottom-nav-item${isActive ? " active" : ""}`}>
      <Icon d={icon} size={20} />
      <span>{label}</span>
    </NavLink>
  );
}

/* ── Mobile drawer (slide-in) ────────────────────────────────────── */
function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signOut, user, configured } = useAuth();
  const navigate = useNavigate();

  const LAB_TABS = [
    { to: "/app/research/pipeline",    label: "Pipeline" },
    { to: "/app/research/recordings",  label: "Recordings" },
    { to: "/app/research/results",     label: "Results" },
    { to: "/app/research/replay",      label: "Replay" },
    { to: "/app/research/hardware",    label: "Hardware" },
    { to: "/app/research/methodology", label: "Methodology" },
    { to: "/app/research/scope",       label: "Scope & Limitations" },
    { to: "/app/research/about",       label: "About & People" },
    { to: "/app/research/explain",     label: "Explain" },
    { to: "/app/research/architecture",label: "Architecture" },
  ];

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: 59,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(2px)",
          }}
        />
      )}
      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(300px, 85vw)",
          background: "#0C1525",
          zIndex: 60,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Drawer header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.125rem", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: 26, height: 26, borderRadius: "0.4rem", background: "linear-gradient(135deg, #0D9488, #0F766E)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon d={IC.pulse} size={13} />
            </div>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#fff" }}>Cardiac Digital Twin</span>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 4 }}>
            <Icon d={IC.close} size={18} />
          </button>
        </div>

        {/* User info */}
        {configured && user && (
          <div style={{ padding: "0.875rem 1.125rem", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: "0.625rem", alignItems: "center" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(13,148,136,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon d={IC.user} size={15} />
            </div>
            <div style={{ overflow: "hidden" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#fff", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Researcher"}
              </p>
              <p style={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.35)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.email}
              </p>
            </div>
          </div>
        )}

        {/* Research Lab section */}
        <div style={{ padding: "0.75rem 0.75rem 0.5rem" }}>
          <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", padding: "0 0.375rem 0.375rem" }}>Research Lab</p>
          {LAB_TABS.map((t) => (
            <NavLink key={t.to} to={t.to} onClick={onClose}
              className={({ isActive }) => `sidebar-nav-item${isActive ? " active" : ""}`}
              style={{ marginBottom: 2 }}>
              {t.label}
            </NavLink>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Explain link */}
        <div style={{ padding: "0.5rem 0.75rem", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <NavLink to="/app/research/explain" onClick={onClose} className="sidebar-nav-item">
            <Icon d={IC.explain} size={14} />
            Explain to cardiologist
          </NavLink>
        </div>

        {/* Logout */}
        {configured && (
          <div style={{ padding: "0.5rem 0.75rem 1.5rem", paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
            <button type="button" onClick={handleLogout}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.5rem 0.625rem", borderRadius: "0.5rem", border: "none", background: "rgba(239,68,68,0.1)", color: "#F87171", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 500 }}>
              <Icon d={IC.logout} size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Demo mode banner ─────────────────────────────────────────────── */
function DemoModeBanner() {
  return (
    <div style={{ background: "rgba(99,102,241,0.08)", borderBottom: "1px solid rgba(99,102,241,0.15)", padding: "0.3125rem 1.25rem", fontSize: "0.6875rem", color: "rgba(99,102,241,0.9)", fontWeight: 500, letterSpacing: "0.02em", display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block", flexShrink: 0 }} />
      Research Demo Mode — public / synthetic data
    </div>
  );
}

/* ── Topbar ───────────────────────────────────────────────────────── */
function Topbar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const { cardiologistMode, demoMode, setCardiologistMode, setDemoMode } = useUI();
  const { signOut, user, configured } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <>
      {demoMode && <DemoModeBanner />}
      <div className="topbar">
        {/* Mobile: hamburger */}
        <button type="button" onClick={onMenuOpen} className="topbar-menu-btn" aria-label="Open menu">
          <Icon d={IC.more} size={20} />
        </button>

        <div style={{ flex: 1 }} />

        {/* Desktop controls */}
        <div className="topbar-desktop-controls">
          <button type="button" className="btn-ghost" title="Explain to cardiologist"
            onClick={() => navigate("/app/research/explain")} style={{ fontSize: "0.75rem" }}>
            <Icon d={IC.explain} size={14} />
            Explain
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--color-muted)", cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} style={{ accentColor: "var(--color-teal)", cursor: "pointer" }} />
            Demo
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--color-muted)", cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={cardiologistMode} onChange={(e) => setCardiologistMode(e.target.checked)} style={{ accentColor: "var(--color-teal)", cursor: "pointer" }} />
            Cardiologist
          </label>
        </div>

        {/* User avatar / logout (desktop) */}
        {configured && user && (
          <div className="topbar-user">
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(13,148,136,0.1)", border: "1px solid rgba(13,148,136,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon d={IC.user} size={13} />
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.user_metadata?.full_name ?? user.email?.split("@")[0]}
            </span>
            <button type="button" onClick={handleLogout} className="btn-ghost" style={{ fontSize: "0.75rem", color: "#EF4444" }} title="Sign out">
              <Icon d={IC.logout} size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Sidebar (desktop) ────────────────────────────────────────────── */
function Sidebar() {
  const { signOut, user, configured } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ width: 28, height: 28, borderRadius: "0.4375rem", background: "linear-gradient(135deg, #0D9488 0%, #0F766E 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon d={IC.pulse} size={14} />
          </div>
          <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2, margin: 0 }}>
            Cardiac Digital Twin
          </p>
        </div>
        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.3125rem", flexWrap: "wrap" }}>
          <span className="badge badge-prototype" style={{ fontSize: "0.5625rem" }}>Research</span>
          <span className="badge badge-warning"   style={{ fontSize: "0.5625rem" }}>Non-clinical</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <SideNavItem to="/app"          icon={IC.overview} label="Overview"     end />
        <SideNavItem to="/app/ecg"      icon={IC.ecg}      label="ECG Analysis"    />
        <SideNavItem to="/app/twin"     icon={IC.twin}     label="Digital Twin"    />
        <SideNavItem to="/app/forecast" icon={IC.forecast} label="Forecasting"     />
        <p className="sidebar-section-label" style={{ marginTop: "0.75rem" }}>Research Lab</p>
        <SideNavItem to="/app/research" icon={IC.lab}      label="Research Lab"    />
      </nav>

      {/* User info at bottom */}
      {configured && user && (
        <div style={{ padding: "0.75rem 0.875rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(13,148,136,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon d={IC.user} size={12} />
            </div>
            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              {user.user_metadata?.full_name ?? user.email?.split("@")[0]}
            </span>
          </div>
          <button type="button" onClick={handleLogout}
            style={{ display: "flex", alignItems: "center", gap: "0.375rem", width: "100%", padding: "0.375rem 0.5rem", borderRadius: "0.375rem", border: "none", background: "rgba(239,68,68,0.08)", color: "#F87171", cursor: "pointer", fontSize: "0.75rem", fontWeight: 500 }}>
            <Icon d={IC.logout} size={12} />
            Sign out
          </button>
        </div>
      )}

      <div className="sidebar-footer">
        Personalized cardiac intelligence<br />
        through ECG analysis &amp; modelling
      </div>
    </aside>
  );
}

/* ── Bottom navigation bar (mobile) ──────────────────────────────── */
function BottomNav({ onMoreClick }: { onMoreClick: () => void }) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <BottomNavItem to="/app"          icon={IC.overview} label="Overview"  end />
      <BottomNavItem to="/app/ecg"      icon={IC.ecg}      label="ECG"            />
      <BottomNavItem to="/app/twin"     icon={IC.twin}     label="Twin"           />
      <BottomNavItem to="/app/forecast" icon={IC.forecast} label="Forecast"       />
      <BottomNavItem               icon={IC.more}     label="More"  onClick={onMoreClick} />
    </nav>
  );
}

/* ── App Layout ───────────────────────────────────────────────────── */
export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer  = useCallback(() => setDrawerOpen(true),  []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="app-shell-layout">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile slide-in drawer */}
      <MobileDrawer open={drawerOpen} onClose={closeDrawer} />

      {/* Main content area */}
      <div className="main-area">
        <Topbar onMenuOpen={openDrawer} />
        <main className="page-content">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav onMoreClick={openDrawer} />
    </div>
  );
}
