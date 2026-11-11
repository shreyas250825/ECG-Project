import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { getRecentAnalyses } from "../services/analysisService";
import { getRecentForecasts } from "../services/forecastService";
import { useAuth } from "../contexts/AuthContext";
import type { ResearchRecord } from "../types/research";
import { Icon, EmptyState } from "../components/ui";

/* ── Icons ─────────────────────────────────────────────────────────── */
const I = {
  ecg:      "M22 12h-4l-3 9L9 3l-3 9H2",
  twin:     "M12 2a10 10 0 100 20A10 10 0 0012 2zM2 12h20",
  forecast: "M2 12l3-3 4 4 4-7 4 4 3-3",
  upload:   "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  check:    "M20 6L9 17l-5-5",
  arrow:    "M5 12h14M12 5l7 7-7 7",
  quality:  "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10",
  database: "M12 2C6.48 2 4.69 2 8s4.48 6 10 6 10-2.69 10-6-4.48-6-10-6zM2 8v4c0 3.31 4.48 6 10 6s10-2.69 10-6V8",
  lab:      "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
};

/* ── Helpers ────────────────────────────────────────────────────────── */
function fmtDuration(s: number) {
  if (!s) return "—";
  if (s >= 3600) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 60).toFixed(1)} min`;
}

/* ── Guided workflow ────────────────────────────────────────────────── */
const STEPS = [
  { n: 1, label: "Import ECG",     sub: "Load or upload a recording",        to: "/research/recordings", icon: I.upload,   color: "#3B82F6" },
  { n: 2, label: "Assess Signal",  sub: "Quality check & preprocessing",     to: "/analysis",             icon: I.quality,  color: "#0D9488" },
  { n: 3, label: "Build Baseline", sub: "Learn patient-specific reference",  to: "/twin",                 icon: I.database, color: "#8B5CF6" },
  { n: 4, label: "Update Twin",    sub: "Compute cardiac state deviation",   to: "/twin",                 icon: I.twin,     color: "#EC4899" },
  { n: 5, label: "Run Forecast",   sub: "Experimental risk estimation",      to: "/forecast",             icon: I.forecast, color: "#F59E0B" },
];

/* ── Research questions ─────────────────────────────────────────────── */
const RQS = [
  { q: "Can patient-specific ECG baselines capture individual electrical characteristics?", tag: "RQ 1" },
  { q: "Can temporal deviations provide earlier information about evolving ventricular-arrhythmia-related states?", tag: "RQ 2" },
  { q: "Can selected ECG processing operations be accelerated using PYNQ/FPGA hardware?", tag: "RQ 3" },
];

/* ── Pipeline stages ─────────────────────────────────────────────────── */
const PIPE = [
  { tag: "INPUT",    label: "ECG Signal",              color: "#3B82F6" },
  { tag: "DSP",      label: "Quality & Preprocessing", color: "#0D9488" },
  { tag: "DSP",      label: "Feature Extraction",      color: "#0D9488" },
  { tag: "BASELINE", label: "Patient Baseline",        color: "#8B5CF6" },
  { tag: "TWIN",     label: "Cardiac State",           color: "#EC4899" },
  { tag: "AI",       label: "Temporal Analysis",       color: "#F59E0B" },
  { tag: "FORECAST", label: "Exp. Forecast",           color: "#EF4444" },
];

/* ── Components ──────────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <div
      style={{
        background: "linear-gradient(140deg, #0D1829 0%, #112240 60%, #0F2345 100%)",
        borderRadius: "1.125rem",
        padding: "2.25rem 2.5rem",
        marginBottom: "1.5rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ECG decoration */}
      <svg
        aria-hidden
        style={{
          position: "absolute",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          opacity: 0.055,
          pointerEvents: "none",
          width: "55%",
          height: "80%",
        }}
        viewBox="0 0 500 200"
        fill="none"
        preserveAspectRatio="xMaxYMid meet"
      >
        <polyline
          points="0,100 60,100 90,20 110,180 140,100 190,100 220,55 250,145 280,100 340,100 370,75 400,125 430,100 500,100"
          stroke="white"
          strokeWidth="2.5"
          fill="none"
        />
      </svg>

      {/* Content */}
      <div style={{ position: "relative", maxWidth: 560 }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <span className="badge badge-prototype">Research Prototype</span>
          <span className="badge badge-warning">Not for clinical diagnosis</span>
        </div>

        <h1
          style={{
            fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
            fontWeight: 800,
            color: "#fff",
            margin: 0,
            letterSpacing: "-0.035em",
            lineHeight: 1.2,
          }}
        >
          Your Cardiac Digital Twin
        </h1>

        <p
          style={{
            fontSize: "0.9375rem",
            color: "rgba(255,255,255,0.58)",
            marginTop: "0.75rem",
            lineHeight: 1.65,
            maxWidth: 440,
          }}
        >
          Understand cardiac signals, build personalised baselines, and explore
          experimental short-term arrhythmia risk forecasts.
        </p>

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginTop: "1.75rem",
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/analysis"
            className="btn-primary"
            style={{
              fontSize: "0.875rem",
              padding: "0.625rem 1.5rem",
              background: "var(--color-teal)",
            }}
          >
            <Icon d={I.ecg} size={15} />
            Start New Analysis
          </Link>
          <Link
            to="/twin"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              padding: "0.625rem 1.5rem",
              borderRadius: "0.5rem",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.82)",
              textDecoration: "none",
              transition: "all 0.15s",
            }}
          >
            <Icon d={I.twin} size={15} />
            Explore Digital Twin
          </Link>
        </div>
      </div>
    </div>
  );
}

function SnapshotStats({ records, analysesCount, forecastsCount }: {
  records: ResearchRecord[];
  analysesCount: number;
  forecastsCount: number;
}) {
  const total      = records.length;
  const real       = records.filter((r) => !r.synthetic).length;
  const synth      = records.filter((r) => r.synthetic).length;

  const items = [
    { label: "Loaded",      value: total      ? String(total)         : "—", sub: "recordings" },
    { label: "Real data",   value: real       ? String(real)          : "—", sub: "from datasets" },
    { label: "Synthetic",   value: synth      ? String(synth)         : "—", sub: "demo / test" },
    { label: "Analyses",    value: analysesCount  ? String(analysesCount)  : "—", sub: "completed" },
    { label: "Forecasts",   value: forecastsCount ? String(forecastsCount) : "—", sub: "experiments" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: "0.75rem",
        marginBottom: "1.5rem",
      }}
    >
      {items.map((s) => (
        <div
          key={s.label}
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-line)",
            borderRadius: "0.875rem",
            padding: "0.875rem 1rem",
          }}
        >
          <p
            style={{
              fontSize: "0.625rem",
              fontWeight: 700,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: "var(--color-muted)",
              margin: 0,
            }}
          >
            {s.label}
          </p>
          <p
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "var(--color-ink)",
              margin: "0.125rem 0 0",
              letterSpacing: "-0.04em",
            }}
          >
            {s.value}
          </p>
          <p style={{ fontSize: "0.6875rem", color: "var(--color-muted)", margin: 0 }}>
            {s.sub}
          </p>
        </div>
      ))}
    </div>
  );
}

function GuidedWorkflow({ recordsExist }: { recordsExist: boolean }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: "0.875rem",
        padding: "1.25rem",
      }}
    >
      <p
        style={{
          fontSize: "0.8125rem",
          fontWeight: 700,
          color: "var(--color-ink)",
          margin: "0 0 0.125rem",
        }}
      >
        Guided workflow
      </p>
      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--color-muted)",
          margin: "0 0 1rem",
        }}
      >
        Five steps from raw ECG to experimental forecast
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {STEPS.map((step, idx) => {
          const done = step.n === 1 && recordsExist;
          return (
            <Link
              key={step.n}
              to={step.to}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem 0.875rem",
                borderRadius: "0.625rem",
                border: "1px solid",
                borderColor: done
                  ? "rgba(13,148,136,0.25)"
                  : "var(--color-line)",
                background: done
                  ? "rgba(13,148,136,0.04)"
                  : "transparent",
                textDecoration: "none",
                transition: "all 0.15s",
                color: "inherit",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  step.color;
                (e.currentTarget as HTMLElement).style.background =
                  `${step.color}08`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  done ? "rgba(13,148,136,0.25)" : "var(--color-line)";
                (e.currentTarget as HTMLElement).style.background =
                  done ? "rgba(13,148,136,0.04)" : "transparent";
              }}
            >
              {/* Step number */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  background: done ? "rgba(13,148,136,0.12)" : `${step.color}14`,
                  border: `1.5px solid ${done ? "rgba(13,148,136,0.35)" : `${step.color}30`}`,
                  color: done ? "var(--color-teal)" : step.color,
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                }}
              >
                {done ? <Icon d={I.check} size={12} /> : <span>{step.n}</span>}
              </div>

              {/* Labels */}
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "var(--color-ink)",
                    margin: 0,
                  }}
                >
                  {step.label}
                </p>
                <p
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--color-muted)",
                    margin: 0,
                  }}
                >
                  {step.sub}
                </p>
              </div>

              {/* Connector line to next step (all but last) */}
              {idx < STEPS.length - 1 && (
                <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginRight: "0.25rem" }}>
                  →
                </span>
              )}

              <Icon
                d={I.arrow}
                size={13}
                style={{ color: "var(--color-muted)", flexShrink: 0 }}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function RecentRecordings({ records }: { records: ResearchRecord[] }) {
  const shown = records.slice(0, 5);

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: "0.875rem",
        padding: "1.25rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.8125rem",
              fontWeight: 700,
              color: "var(--color-ink)",
              margin: 0,
            }}
          >
            Recent recordings
          </p>
          <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", margin: 0 }}>
            Available in the analysis pipeline
          </p>
        </div>
        <Link
          to="/research/recordings"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: "0.75rem",
            color: "var(--color-teal)",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          View all
          <Icon d={I.arrow} size={12} />
        </Link>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={I.database}
          title="No recordings loaded"
          body="Load a recording from the Datasets browser in Research Lab to get started."
          action={
            <Link to="/research/recordings" className="btn-primary" style={{ fontSize: "0.8125rem" }}>
              Open recordings
            </Link>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {shown.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.5rem 0.625rem",
                borderRadius: "0.5rem",
                background: "var(--color-bg)",
                border: "1px solid var(--color-line)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: r.synthetic ? "#D97706" : "#10B981",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "var(--color-ink)",
                  }}
                >
                  {r.record_name}
                </span>
                {r.source_dataset && (
                  <span style={{ fontSize: "0.6875rem", color: "var(--color-muted)" }}>
                    {r.source_dataset}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <span style={{ fontSize: "0.6875rem", color: "var(--color-muted)" }}>
                  {fmtDuration(r.duration_seconds)}
                </span>
                <Link
                  to="/analysis"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "var(--color-teal)",
                    textDecoration: "none",
                  }}
                >
                  Analyse →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResearchQuestions() {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: "0.875rem",
        padding: "1.25rem",
      }}
    >
      <p
        style={{
          fontSize: "0.8125rem",
          fontWeight: 700,
          color: "var(--color-ink)",
          margin: "0 0 0.875rem",
        }}
      >
        Research questions
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "0.625rem",
        }}
      >
        {RQS.map(({ q, tag }) => (
          <div
            key={tag}
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-line)",
              borderRadius: "0.625rem",
              padding: "0.875rem 1rem",
            }}
          >
            <p
              style={{
                fontSize: "0.5625rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--color-teal)",
                margin: "0 0 0.375rem",
              }}
            >
              {tag}
            </p>
            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--color-ink)",
                margin: 0,
                lineHeight: 1.55,
              }}
            >
              {q}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineOverview() {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: "0.875rem",
        padding: "1.25rem",
      }}
    >
      <p
        style={{
          fontSize: "0.8125rem",
          fontWeight: 700,
          color: "var(--color-ink)",
          margin: "0 0 0.875rem",
        }}
      >
        Processing pipeline
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.25rem",
        }}
      >
        {PIPE.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <div
              style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-line)",
                borderRadius: "0.5rem",
                padding: "0.375rem 0.75rem",
                borderTop: `2.5px solid ${s.color}`,
              }}
            >
              <p
                style={{
                  fontSize: "0.5rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: s.color,
                  margin: 0,
                }}
              >
                {s.tag}
              </p>
              <p
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--color-ink)",
                  margin: "0.125rem 0 0",
                  whiteSpace: "nowrap",
                }}
              >
                {s.label}
              </p>
            </div>
            {i < PIPE.length - 1 && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-muted)"
                strokeWidth={1.5}
                style={{ flexShrink: 0, opacity: 0.5 }}
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </div>
        ))}
      </div>
      <p
        style={{
          fontSize: "0.6875rem",
          color: "var(--color-muted)",
          marginTop: "0.75rem",
        }}
      >
        Detection describes the current ECG window. Forecasting estimates
        target-event risk within horizon H — they are distinct outputs.
      </p>
    </div>
  );
}

/* ── Overview page ──────────────────────────────────────────────────── */
export default function OverviewPage() {
  const { user } = useAuth();
  const recordsQ   = useQuery({ queryKey: ["records"],         queryFn: api.records });
  const analysesQ  = useQuery({ queryKey: ["recent-analyses"], queryFn: () => getRecentAnalyses(5) });
  const forecastsQ = useQuery({ queryKey: ["recent-forecasts"],queryFn: () => getRecentForecasts(5) });
  const records: ResearchRecord[] = recordsQ.data?.records ?? [];

  const analysesCount  = analysesQ.data?.length  ?? 0;
  const forecastsCount = forecastsQ.data?.length ?? 0;
  const displayName    = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string).split(" ")[0]
    : null;

  return (
    <div className="fade-in">
      {displayName && (
        <p style={{ fontSize: "0.9375rem", color: "var(--color-muted)", marginBottom: "0.5rem" }}>
          Welcome back, <strong style={{ color: "var(--color-ink)" }}>{displayName}</strong>
        </p>
      )}
      <HeroSection />

      <SnapshotStats records={records} analysesCount={analysesCount} forecastsCount={forecastsCount} />

      {/* Two-column middle section — collapses to single on mobile */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)",
          gap: "1.25rem",
          marginBottom: "1.25rem",
          alignItems: "start",
        }}
        className="responsive-two-col"
      >
        <GuidedWorkflow recordsExist={records.length > 0} />
        <RecentRecordings records={records} />
      </div>

      {/* Bottom row — collapses on mobile */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)",
          gap: "1.25rem",
        }}
        className="responsive-two-col"
      >
        <ResearchQuestions />
        <PipelineOverview />
      </div>
    </div>
  );
}
