/**
 * LandingPage — public-facing cinematic landing page.
 * Routes: / (public, no auth required)
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { StaticHeartFallback } from "../components/landing/WireframeHeartScene";

/* Lazy-load the heavy Three.js scene */
const WireframeHeartScene = lazy(() =>
  import("../components/landing/WireframeHeartScene").then((m) => ({
    default: m.WireframeHeartScene,
  }))
);

/* ─── Design tokens ─────────────────────────────────────────────── */
const BG      = "#05070B";
const BG2     = "#0B1019";
const SURF    = "#111827";
const CRIMSON = "#E63950";
const BRIGHT  = "#FF5369";
const WHITE   = "#F8FAFC";
const MUTED   = "#9CA3AF";
const BORDER  = "rgba(230,57,80,0.15)";

/* ─── Helpers ───────────────────────────────────────────────────── */
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

function IconSvg({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/* ─── Navbar ─────────────────────────────────────────────────────── */
function Navbar() {
  const { status, configured } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const handleGetStarted = () => {
    if (!configured || status === "authenticated") {
      navigate("/app");
    } else {
      navigate("/login");
    }
  };

  const links = [
    { label: "Technology", onClick: () => { scrollTo("technology"); setMenuOpen(false); } },
    { label: "Research",   onClick: () => { scrollTo("research");   setMenuOpen(false); } },
    { label: "About",      onClick: () => { scrollTo("about");      setMenuOpen(false); } },
  ];

  return (
    <header
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 100,
        background: scrolled
          ? "rgba(5,7,11,0.88)"
          : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(230,57,80,0.1)" : "none",
        transition: "background 0.3s, border-color 0.3s",
      }}
    >
      <div style={{
        maxWidth: 1200, margin: "0 auto",
        padding: "0 1.5rem",
        height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Logo */}
        <Link to="/" style={{ display:"flex", alignItems:"center", gap:"0.625rem", textDecoration:"none" }}>
          <div style={{ width:30, height:30, borderRadius:"0.4rem",
            background:"linear-gradient(135deg, #E63950 0%, #8B1A28 100%)",
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <path d="M3 12h3l3-9 3 18 3-9 3 0"/>
            </svg>
          </div>
          <span style={{ fontSize:"0.875rem", fontWeight:700, color:WHITE, letterSpacing:"-0.01em" }}>
            CARDIAC DIGITAL TWIN
          </span>
        </Link>

        {/* Desktop nav */}
        <nav style={{ display:"flex", alignItems:"center", gap:"0.25rem" }} className="landing-desktop-nav">
          {links.map((l) => (
            <button key={l.label} type="button" onClick={l.onClick}
              style={{ background:"none", border:"none", cursor:"pointer",
                color:MUTED, fontSize:"0.875rem", fontWeight:500, padding:"0.5rem 0.875rem",
                borderRadius:"0.375rem", transition:"color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = WHITE)}
              onMouseLeave={(e) => (e.currentTarget.style.color = MUTED)}>
              {l.label}
            </button>
          ))}
          <div style={{ width:1, height:20, background:"rgba(255,255,255,0.1)", margin:"0 0.5rem" }} />
          <Link to="/login"
            style={{ color:MUTED, fontSize:"0.875rem", fontWeight:500,
              padding:"0.5rem 0.875rem", textDecoration:"none", borderRadius:"0.375rem",
              transition:"color 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = WHITE)}
            onMouseLeave={(e) => (e.currentTarget.style.color = MUTED)}>
            Sign In
          </Link>
          <button type="button" onClick={handleGetStarted}
            style={{ background:CRIMSON, color:WHITE, border:"none",
              padding:"0.5rem 1.125rem", borderRadius:"0.5rem",
              fontSize:"0.875rem", fontWeight:600, cursor:"pointer",
              transition:"background 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = BRIGHT)}
            onMouseLeave={(e) => (e.currentTarget.style.background = CRIMSON)}>
            Get Started
          </button>
        </nav>

        {/* Mobile hamburger */}
        <button type="button" onClick={() => setMenuOpen((v) => !v)}
          className="landing-hamburger"
          style={{ display:"none", background:"none", border:"none",
            color:WHITE, cursor:"pointer", padding:8 }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2}>
            {menuOpen
              ? <path d="M18 6L6 18M6 6l12 12" />
              : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          background:"rgba(5,7,11,0.98)", borderTop:"1px solid rgba(230,57,80,0.1)",
          padding:"1rem 1.5rem 1.5rem",
        }}>
          {links.map((l) => (
            <button key={l.label} type="button" onClick={l.onClick}
              style={{ display:"block", width:"100%", textAlign:"left",
                background:"none", border:"none", cursor:"pointer",
                color:MUTED, fontSize:"1rem", fontWeight:500,
                padding:"0.75rem 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
              {l.label}
            </button>
          ))}
          <div style={{ display:"flex", gap:"0.75rem", marginTop:"1rem", flexWrap:"wrap" }}>
            <Link to="/login" onClick={() => setMenuOpen(false)}
              style={{ flex:1, textAlign:"center", padding:"0.75rem",
                border:"1px solid rgba(255,255,255,0.1)", borderRadius:"0.5rem",
                color:WHITE, textDecoration:"none", fontSize:"0.9375rem", fontWeight:500 }}>
              Sign In
            </Link>
            <button type="button" onClick={() => { setMenuOpen(false); handleGetStarted(); }}
              style={{ flex:1, background:CRIMSON, color:WHITE, border:"none",
                padding:"0.75rem", borderRadius:"0.5rem", cursor:"pointer",
                fontSize:"0.9375rem", fontWeight:600 }}>
              Get Started
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────── */
function Hero() {
  const { status, configured } = useAuth();
  const navigate = useNavigate();

  const handleCTA = () => {
    if (!configured || status === "authenticated") navigate("/app");
    else navigate("/login");
  };

  return (
    <section style={{
      minHeight:"100vh", background:BG, position:"relative", overflow:"hidden",
      display:"flex", alignItems:"center",
    }}>
      {/* Atmospheric background grid */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:`
          linear-gradient(rgba(230,57,80,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(230,57,80,0.03) 1px, transparent 1px)`,
        backgroundSize:"80px 80px",
      }} />
      {/* Deep red ambient vignette */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        background:"radial-gradient(ellipse 60% 60% at 50% 50%, rgba(139,26,40,0.12) 0%, transparent 70%)",
      }} />
      {/* Bottom fade */}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0, height:200, pointerEvents:"none",
        background:`linear-gradient(transparent, ${BG})`,
      }} />

      <div style={{
        maxWidth:1200, margin:"0 auto", padding:"0 1.5rem",
        width:"100%", paddingTop:80,
        display:"grid", gridTemplateColumns:"1fr 1fr",
        gap:"2rem", alignItems:"center",
      }} className="hero-grid">

        {/* Left — typography */}
        <div style={{ position:"relative", zIndex:2 }}>
          <div style={{
            display:"inline-flex", alignItems:"center", gap:"0.5rem",
            background:"rgba(230,57,80,0.1)", border:"1px solid rgba(230,57,80,0.25)",
            borderRadius:"9999px", padding:"0.3125rem 0.875rem",
            marginBottom:"1.5rem",
          }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:CRIMSON, display:"inline-block" }} />
            <span style={{ fontSize:"0.6875rem", fontWeight:700, letterSpacing:"0.1em",
              textTransform:"uppercase", color:CRIMSON }}>
              AI Cardiac Research Platform
            </span>
          </div>

          <h1 style={{
            fontSize:"clamp(2.25rem, 4.5vw, 3.75rem)",
            fontWeight:800, color:WHITE, margin:"0 0 1.25rem",
            lineHeight:1.1, letterSpacing:"-0.03em",
          }}>
            Understand<br />
            the Heart.<br />
            <span style={{ color:CRIMSON }}>Anticipate</span><br />
            What Comes Next.
          </h1>

          <p style={{
            fontSize:"1.0625rem", color:MUTED, lineHeight:1.7,
            maxWidth:460, margin:"0 0 2rem",
          }}>
            Personalized cardiac intelligence through ECG analysis,
            computational digital twins and experimental predictive AI.
          </p>

          <div style={{ display:"flex", gap:"0.875rem", flexWrap:"wrap" }}>
            <button type="button" onClick={handleCTA}
              style={{
                background:CRIMSON, color:WHITE, border:"none",
                padding:"0.875rem 1.75rem", borderRadius:"0.625rem",
                fontSize:"1rem", fontWeight:700, cursor:"pointer",
                display:"flex", alignItems:"center", gap:"0.5rem",
                transition:"background 0.15s, transform 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = BRIGHT; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = CRIMSON; e.currentTarget.style.transform = "none"; }}>
              <IconSvg d="M5 12h14M12 5l7 7-7 7" size={18} />
              Explore the Platform
            </button>
            <button type="button" onClick={() => scrollTo("technology")}
              style={{
                background:"rgba(255,255,255,0.05)", color:WHITE,
                border:"1px solid rgba(255,255,255,0.12)",
                padding:"0.875rem 1.75rem", borderRadius:"0.625rem",
                fontSize:"1rem", fontWeight:500, cursor:"pointer",
                transition:"background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.09)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}>
              Discover the Research
            </button>
          </div>

          {/* Research disclaimer */}
          <p style={{ fontSize:"0.6875rem", color:"rgba(156,163,175,0.6)",
            marginTop:"1.5rem", letterSpacing:"0.02em" }}>
            Research prototype · Not for clinical diagnosis or medical decision-making
          </p>
        </div>

        {/* Right — wireframe heart */}
        <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}
          className="hero-heart-container">
          {/* Glow behind canvas */}
          <div style={{
            position:"absolute", width:"70%", height:"70%",
            background:"radial-gradient(ellipse, rgba(230,57,80,0.18) 0%, transparent 70%)",
            pointerEvents:"none", zIndex:0,
          }} />
          <Suspense fallback={
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"100%", height:520 }}>
              <StaticHeartFallback size={420} />
            </div>
          }>
            <WireframeHeartScene style={{
              width:"100%", height:560,
              position:"relative", zIndex:1,
            }} />
          </Suspense>
        </div>
      </div>

      {/* Scroll indicator */}
      <div style={{
        position:"absolute", bottom:32, left:"50%", transform:"translateX(-50%)",
        display:"flex", flexDirection:"column", alignItems:"center", gap:6,
        color:"rgba(156,163,175,0.4)", cursor:"pointer",
        animation:"fadeInUp 1s 2s both",
      }} onClick={() => scrollTo("technology")}>
        <span style={{ fontSize:"0.6875rem", letterSpacing:"0.1em", textTransform:"uppercase" }}>Scroll</span>
        <svg width={16} height={20} viewBox="0 0 16 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M8 1v14M1 11l7 7 7-7" />
        </svg>
      </div>
    </section>
  );
}

/* ─── Section: The Vision ───────────────────────────────────────── */
function VisionSection() {
  const cards = [
    {
      icon: "M22 12h-4l-3 9L9 3l-3 9H2",
      title: "ECG Intelligence",
      color: "#3B82F6",
      items: ["Signal quality assessment", "Noise filtering & preprocessing", "R-peak detection", "Feature extraction & HRV"],
    },
    {
      icon: "M12 2a10 10 0 100 20A10 10 0 0012 2zM2 12h20",
      title: "Cardiac Digital Twin",
      color: CRIMSON,
      items: ["Patient-specific baseline", "ECG-derived state vector", "Temporal state updates", "Physiological feature modelling"],
    },
    {
      icon: "M2 12l3-3 4 4 4-7 4 4 3-3",
      title: "Predictive Intelligence",
      color: "#10B981",
      items: ["Temporal modelling", "Experimental forecasts", "Configurable horizon H", "Uncertainty representation"],
    },
  ];

  return (
    <section id="technology" style={{ background:BG2, padding:"7rem 1.5rem" }}>
      <div style={{ maxWidth:1200, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:"4rem" }}>
          <span style={{ fontSize:"0.6875rem", fontWeight:700, letterSpacing:"0.12em",
            textTransform:"uppercase", color:CRIMSON, display:"block", marginBottom:"1rem" }}>
            The Technology
          </span>
          <h2 style={{ fontSize:"clamp(1.875rem, 3.5vw, 3rem)", fontWeight:800,
            color:WHITE, margin:0, letterSpacing:"-0.03em" }}>
            Beyond Traditional Cardiac Monitoring
          </h2>
          <p style={{ fontSize:"1.0625rem", color:MUTED, margin:"1.25rem auto 0", maxWidth:580, lineHeight:1.7 }}>
            A computational research framework that connects ECG signal intelligence,
            patient-specific cardiac state modelling and experimental temporal forecasting.
          </p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:"1.5rem" }}>
          {cards.map(({ icon, title, color, items }) => (
            <div key={title} style={{
              background:SURF, border:`1px solid ${BORDER}`,
              borderRadius:"1rem", padding:"2rem",
              transition:"transform 0.2s, border-color 0.2s",
            }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
                (e.currentTarget as HTMLDivElement).style.borderColor = `${color}40`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "none";
                (e.currentTarget as HTMLDivElement).style.borderColor = BORDER;
              }}>
              <div style={{ width:48, height:48, borderRadius:"0.75rem",
                background:`${color}18`, display:"flex", alignItems:"center",
                justifyContent:"center", marginBottom:"1.25rem", color }}>
                <IconSvg d={icon} size={22} />
              </div>
              <h3 style={{ fontSize:"1.125rem", fontWeight:700, color:WHITE,
                margin:"0 0 1rem", letterSpacing:"-0.02em" }}>
                {title}
              </h3>
              <ul style={{ margin:0, padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:"0.5rem" }}>
                {items.map((item) => (
                  <li key={item} style={{ display:"flex", alignItems:"center", gap:"0.625rem",
                    fontSize:"0.9375rem", color:MUTED }}>
                    <span style={{ width:5, height:5, borderRadius:"50%",
                      background:color, flexShrink:0 }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section: How It Works ─────────────────────────────────────── */
function HowItWorksSection() {
  const steps = [
    { n:"01", label:"ECG Input",          sub:"Continuous time-series signal",          icon:"M22 12h-4l-3 9L9 3l-3 9H2",        color:"#3B82F6" },
    { n:"02", label:"Signal Analysis",    sub:"Quality, filtering, R-peaks, features",  icon:"M9 19V6l3-3 3 3v13M3 19h18",       color:"#8B5CF6" },
    { n:"03", label:"Patient Baseline",   sub:"Individual ECG reference model",         icon:"M12 2a10 10 0 100 20A10 10 0 0012 2z", color:"#F59E0B" },
    { n:"04", label:"Digital Twin",       sub:"Cardiac state vector & deviation",       icon:"M12 2a10 10 0 100 20A10 10 0 0012 2zM2 12h20", color:CRIMSON },
    { n:"05", label:"Experimental Forecast", sub:"Temporal AI · horizon H · risk estimate", icon:"M2 12l3-3 4 4 4-7 4 4 3-3",   color:"#10B981" },
  ];

  return (
    <section style={{ background:BG, padding:"7rem 1.5rem" }}>
      <div style={{ maxWidth:1200, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:"4rem" }}>
          <span style={{ fontSize:"0.6875rem", fontWeight:700, letterSpacing:"0.12em",
            textTransform:"uppercase", color:CRIMSON, display:"block", marginBottom:"1rem" }}>
            Workflow
          </span>
          <h2 style={{ fontSize:"clamp(1.875rem, 3.5vw, 3rem)", fontWeight:800,
            color:WHITE, margin:0, letterSpacing:"-0.03em" }}>
            How It Works
          </h2>
        </div>

        {/* Stepper */}
        <div style={{ position:"relative" }}>
          {/* Connecting line */}
          <div style={{
            position:"absolute", top:40, left:"10%", right:"10%", height:1,
            background:`linear-gradient(90deg, transparent, ${CRIMSON}40, ${CRIMSON}40, transparent)`,
            pointerEvents:"none",
          }} className="workflow-line" />

          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"1rem" }}
            className="workflow-steps">
            {steps.map(({ n, label, sub, icon, color }, idx) => (
              <div key={n} style={{ textAlign:"center", position:"relative" }}>
                <div style={{
                  width:80, height:80, borderRadius:"50%",
                  background:`${color}12`,
                  border:`1.5px solid ${color}40`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  margin:"0 auto 1rem", color, position:"relative",
                }}>
                  <IconSvg d={icon} size={28} />
                  <span style={{
                    position:"absolute", top:-8, right:-8,
                    fontSize:"0.5625rem", fontWeight:800, letterSpacing:"0.05em",
                    background:color, color:BG,
                    width:22, height:22, borderRadius:"50%",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>{n}</span>
                </div>
                <p style={{ fontSize:"0.9375rem", fontWeight:700, color:WHITE, margin:"0 0 0.375rem" }}>
                  {label}
                </p>
                <p style={{ fontSize:"0.8125rem", color:MUTED, margin:0, lineHeight:1.5 }}>
                  {sub}
                </p>
                {idx < steps.length - 1 && (
                  <svg style={{ position:"absolute", top:38, right:-12, opacity:0.3 }}
                    width={16} height={16} viewBox="0 0 24 24" fill="none"
                    stroke={CRIMSON} strokeWidth={1.5}>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Section: Research ─────────────────────────────────────────── */
function ResearchSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const items = [
    {
      title: "Research objectives",
      body: "Investigate whether patient-specific ECG baselines and temporal feature deviations provide earlier indication of evolving ventricular-arrhythmia-related risk states. Three research questions span ECG-based modelling, temporal deviation analysis, and FPGA-accelerated DSP.",
    },
    {
      title: "Computational approach",
      body: "The system learns a patient-specific baseline feature distribution from an explicit early ECG window. Subsequent windows are compared as deviations from this baseline — not as generic 'abnormality'. The digital twin is a compact state vector, not an anatomical simulation.",
    },
    {
      title: "Signal processing pipeline",
      body: "Continuous ECG → signal quality assessment → bandpass FIR filtering (optional PYNQ/FPGA acceleration) → Pan-Tompkins R-peak detection → RR intervals → HRV-like feature extraction → feature vector construction.",
    },
    {
      title: "Temporal modelling",
      body: "Given history up to time t, estimate whether a labelled ventricular tachyarrhythmia target event starts within (t, t+H]. H is the forecast horizon, chosen by the experimenter. The system uses logistic regression as the base forecasting model.",
    },
    {
      title: "Experimental evaluation",
      body: "Metrics include sensitivity, specificity, precision, F1, AUROC, AUPRC, false-alarm rate, and observed lead time — computed only after a patient/recording-level split with labelled events. No metric is shown until an experiment is run.",
    },
    {
      title: "Research limitations",
      body: "Limited dataset size and diversity. Arrhythmias do not always have predictable ECG precursors. Model performance may differ across patients. Clinical deployment requires external prospective validation. This is a research prototype — not a medical device.",
    },
  ];

  return (
    <section id="research" style={{ background:BG2, padding:"7rem 1.5rem" }}>
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:"4rem" }}>
          <span style={{ fontSize:"0.6875rem", fontWeight:700, letterSpacing:"0.12em",
            textTransform:"uppercase", color:CRIMSON, display:"block", marginBottom:"1rem" }}>
            Research & Methodology
          </span>
          <h2 style={{ fontSize:"clamp(1.875rem, 3.5vw, 3rem)", fontWeight:800,
            color:WHITE, margin:0, letterSpacing:"-0.03em" }}>
            Scientific Approach
          </h2>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
          {items.map(({ title, body }, i) => (
            <div key={title} style={{
              background:SURF, border:`1px solid ${openIdx===i ? BORDER : "rgba(255,255,255,0.05)"}`,
              borderRadius:"0.75rem", overflow:"hidden",
              transition:"border-color 0.2s",
            }}>
              <button type="button" onClick={() => setOpenIdx(openIdx===i ? null : i)}
                style={{
                  width:"100%", textAlign:"left", background:"none", border:"none",
                  padding:"1.25rem 1.5rem", cursor:"pointer",
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                }}>
                <span style={{ fontSize:"1rem", fontWeight:600, color:WHITE }}>{title}</span>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
                  stroke={MUTED} strokeWidth={2}
                  style={{ transform: openIdx===i ? "rotate(180deg)" : "none", transition:"transform 0.2s", flexShrink:0 }}>
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIdx === i && (
                <p style={{ margin:0, padding:"0 1.5rem 1.25rem",
                  fontSize:"0.9375rem", color:MUTED, lineHeight:1.75 }}>
                  {body}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section: CTA ──────────────────────────────────────────────── */
function CtaSection() {
  const { status, configured } = useAuth();
  const navigate = useNavigate();
  const handleAccess = () => (!configured || status === "authenticated") ? navigate("/app") : navigate("/login");

  return (
    <section style={{ background:BG, padding:"8rem 1.5rem", position:"relative", overflow:"hidden" }}>
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        background:"radial-gradient(ellipse 50% 70% at 50% 50%, rgba(139,26,40,0.14) 0%, transparent 70%)",
      }} />
      <div style={{ maxWidth:700, margin:"0 auto", textAlign:"center", position:"relative" }}>
        <h2 style={{ fontSize:"clamp(2rem, 4vw, 3.25rem)", fontWeight:800,
          color:WHITE, margin:"0 0 1.25rem", letterSpacing:"-0.03em" }}>
          Explore the Cardiac Digital Twin.
        </h2>
        <p style={{ fontSize:"1.0625rem", color:MUTED, margin:"0 0 2.5rem", lineHeight:1.7, maxWidth:500, marginLeft:"auto", marginRight:"auto" }}>
          Enter the research environment and explore ECG-driven cardiac intelligence.
        </p>
        <div style={{ display:"flex", gap:"1rem", justifyContent:"center", flexWrap:"wrap" }}>
          <button type="button" onClick={handleAccess}
            style={{ background:CRIMSON, color:WHITE, border:"none",
              padding:"0.9375rem 2rem", borderRadius:"0.625rem",
              fontSize:"1rem", fontWeight:700, cursor:"pointer",
              transition:"background 0.15s, transform 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = BRIGHT; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = CRIMSON; e.currentTarget.style.transform = "none"; }}>
            Access Research Platform
          </button>
          <Link to="/signup"
            style={{ background:"rgba(255,255,255,0.06)", color:WHITE,
              border:"1px solid rgba(255,255,255,0.12)",
              padding:"0.9375rem 2rem", borderRadius:"0.625rem",
              fontSize:"1rem", fontWeight:500, textDecoration:"none",
              transition:"background 0.15s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)")}>
            Create Account
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Section: About ────────────────────────────────────────────── */
function AboutSection() {
  return (
    <section id="about" style={{ background:BG2, padding:"5rem 1.5rem", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3rem", alignItems:"start" }}
          className="about-grid">
          <div>
            <span style={{ fontSize:"0.6875rem", fontWeight:700, letterSpacing:"0.12em",
              textTransform:"uppercase", color:CRIMSON, display:"block", marginBottom:"1rem" }}>
              About
            </span>
            <h3 style={{ fontSize:"1.5rem", fontWeight:700, color:WHITE, margin:"0 0 1rem" }}>
              Research-driven cardiac AI
            </h3>
            <p style={{ fontSize:"0.9375rem", color:MUTED, lineHeight:1.75, margin:"0 0 1rem" }}>
              A research framework for personalized ECG analysis, computational cardiac state modelling
              and experimental short-term ventricular arrhythmia risk forecasting.
            </p>
            <p style={{ fontSize:"0.9375rem", color:MUTED, lineHeight:1.75, margin:0 }}>
              We are not developing a new ECG acquisition device. ECG is the input signal.
              The research contribution is the computational analysis pipeline above the signal.
            </p>
          </div>
          <div>
            <div style={{
              background:SURF, border:"1px solid rgba(255,255,255,0.06)",
              borderRadius:"0.875rem", padding:"1.5rem",
            }}>
              <p style={{ fontSize:"0.6875rem", fontWeight:700, letterSpacing:"0.08em",
                textTransform:"uppercase", color:MUTED, margin:"0 0 1rem" }}>
                Project details
              </p>
              {[
                ["Institution", "M.S. Ramaiah University of Applied Sciences"],
                ["Team", "Shreyas Salian, Sai Kiran S C"],
                ["Supervisor", "Mrs. Prafulla Kumari Kannagala Siddaiah"],
                ["Co-supervisor", "Mrs. Deepthi S"],
              ].map(([k,v]) => (
                <div key={k} style={{
                  display:"flex", justifyContent:"space-between", gap:"1rem",
                  padding:"0.625rem 0", borderBottom:"1px solid rgba(255,255,255,0.05)",
                  fontSize:"0.875rem",
                }}>
                  <span style={{ color:MUTED, flexShrink:0 }}>{k}</span>
                  <span style={{ color:WHITE, textAlign:"right" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{ background:BG, borderTop:"1px solid rgba(255,255,255,0.05)", padding:"3rem 1.5rem 2rem" }}>
      <div style={{ maxWidth:1200, margin:"0 auto" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:"2rem", marginBottom:"2.5rem" }}
          className="footer-grid">
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"1rem" }}>
              <div style={{ width:26, height:26, borderRadius:"0.35rem",
                background:"linear-gradient(135deg, #E63950, #8B1A28)",
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                  <path d="M3 12h3l3-9 3 18 3-9 3 0"/>
                </svg>
              </div>
              <span style={{ fontSize:"0.8125rem", fontWeight:700, color:WHITE }}>CARDIAC DIGITAL TWIN</span>
            </div>
            <p style={{ fontSize:"0.875rem", color:MUTED, lineHeight:1.7, maxWidth:280, margin:0 }}>
              Personalized cardiac intelligence through ECG analysis, computational modelling
              and experimental predictive AI.
            </p>
          </div>
          {[
            { heading:"Technology", links:[
              { l:"ECG Analysis",   onClick:()=>scrollTo("technology") },
              { l:"Digital Twin",   onClick:()=>scrollTo("technology") },
              { l:"Forecasting",    onClick:()=>scrollTo("technology") },
            ]},
            { heading:"Research", links:[
              { l:"Methodology",   onClick:()=>scrollTo("research") },
              { l:"Limitations",   onClick:()=>scrollTo("research") },
              { l:"Publications",  onClick:()=>scrollTo("research") },
            ]},
            { heading:"Platform", links:[
              { l:"Sign In",       href:"/login" },
              { l:"Create Account",href:"/signup" },
              { l:"Documentation", href:"/app/research/methodology" },
            ]},
          ].map(({ heading, links }) => (
            <div key={heading}>
              <p style={{ fontSize:"0.6875rem", fontWeight:700, letterSpacing:"0.09em",
                textTransform:"uppercase", color:MUTED, margin:"0 0 1rem" }}>{heading}</p>
              <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
                {links.map((l) => (
                  "href" in l ? (
                    <Link key={l.l} to={l.href}
                      style={{ fontSize:"0.875rem", color:"rgba(156,163,175,0.7)",
                        textDecoration:"none", transition:"color 0.15s" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = WHITE)}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(156,163,175,0.7)")}>
                      {l.l}
                    </Link>
                  ) : (
                    <button key={l.l} type="button" onClick={l.onClick}
                      style={{ background:"none", border:"none", cursor:"pointer",
                        textAlign:"left", fontSize:"0.875rem", color:"rgba(156,163,175,0.7)",
                        padding:0, transition:"color 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = WHITE)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(156,163,175,0.7)")}>
                      {l.l}
                    </button>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          borderTop:"1px solid rgba(255,255,255,0.05)",
          paddingTop:"1.5rem",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          flexWrap:"wrap", gap:"1rem",
        }}>
          <p style={{ fontSize:"0.75rem", color:"rgba(156,163,175,0.5)", margin:0 }}>
            © 2024 Cardiac Digital Twin · Research prototype · Not intended for clinical diagnosis or medical decision-making.
          </p>
          <div style={{ display:"flex", gap:"1.25rem" }}>
            {["Privacy Policy", "Terms"].map((t) => (
              <span key={t} style={{ fontSize:"0.75rem", color:"rgba(156,163,175,0.4)", cursor:"default" }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Root LandingPage component ─────────────────────────────────── */
export default function LandingPage() {
  // If Supabase is configured and user is logged in, offer redirect but don't force it
  // (user may want to read the landing page)

  return (
    <div style={{ background:BG, minHeight:"100vh", overflowX:"hidden" }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }

        /* Responsive overrides for landing page */
        @media (max-width: 900px) {
          .hero-grid       { grid-template-columns: 1fr !important; }
          .hero-heart-container { height: 420px !important; order: -1; }
          .workflow-steps  { grid-template-columns: repeat(3,1fr) !important; }
          .workflow-line   { display: none !important; }
          .about-grid      { grid-template-columns: 1fr !important; }
          .footer-grid     { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .landing-desktop-nav { display: none !important; }
          .landing-hamburger   { display: flex !important; }
          .workflow-steps  { grid-template-columns: repeat(2,1fr) !important; }
          .footer-grid     { grid-template-columns: 1fr !important; }
          .hero-heart-container { height: 320px !important; }
        }
        @media (max-width: 400px) {
          .workflow-steps  { grid-template-columns: 1fr !important; }
          .hero-heart-container { height: 280px !important; }
        }

        /* Smooth section transitions */
        section { scroll-margin-top: 64px; }
      `}</style>

      <Navbar />
      <Hero />
      <VisionSection />
      <HowItWorksSection />
      <ResearchSection />
      <CtaSection />
      <AboutSection />
      <Footer />
    </div>
  );
}
