import { NavLink, Outlet } from "react-router-dom";
import { useUI } from "../stores/ui";
import { PrototypeBadges } from "../components/Disclaimer";

const links: [string, string][] = [
  ["/", "Overview"],
  ["/dashboard", "Research Dashboard"],
  ["/pipeline", "Pipeline"],
  ["/analysis", "ECG Analysis"],
  ["/twin", "Digital Twin"],
  ["/forecast", "Forecasting"],
  ["/datasets", "Recordings"],
  ["/results", "Results"],
  ["/hardware", "Hardware"],
  ["/methodology", "Methodology"],
  ["/scope", "Scope"],
  ["/limitations", "Limitations"],
  ["/about", "About"],
  ["/explain", "Explain"],
  ["/replay", "Replay"],
];

export default function AppLayout() {
  const { cardiologistMode, demoMode, setCardiologistMode, setDemoMode } = useUI();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-teal-800">M.S. Ramaiah University of Applied Sciences · RTC Peenya</p>
            <h1 className="mt-1 text-xl text-slate-900">Patient-Specific Predictive Cardiac Digital Twin</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Research framework for personalised ECG analysis and experimental short-term ventricular arrhythmia risk forecasting.
            </p>
            <div className="mt-3">
              <PrototypeBadges />
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={cardiologistMode} onChange={(e) => setCardiologistMode(e.target.checked)} />
              Explain to cardiologist
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} />
              Research demo mode
            </label>
          </div>
        </div>
        {demoMode && (
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-2 text-center text-xs text-slate-600">
            Research demonstration using public/synthetic data.
          </div>
        )}
        <nav className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 pb-3">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `px-3 py-1 text-sm ${isActive ? "bg-teal-800 text-white" : "text-slate-700 hover:bg-slate-100"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
