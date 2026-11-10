import { Disclaimer } from "../components/Disclaimer";

const nodes = [
  { id: "ecg",  label: "ECG INPUT",                    tag: "SIGNAL",    color: "#3B82F6" },
  { id: "sq",   label: "Signal quality check",          tag: "DSP",       color: "#0D9488" },
  { id: "pre",  label: "Preprocessing",                 tag: "DSP",       color: "#0D9488" },
  { id: "feat", label: "Feature extraction",            tag: "DSP",       color: "#0D9488" },
  { id: "base", label: "Patient-specific baseline",     tag: "TWIN",      color: "#8B5CF6" },
  { id: "twin", label: "Digital twin state",            tag: "TWIN",      color: "#8B5CF6" },
  { id: "hist", label: "Temporal state history",        tag: "AI",        color: "#F59E0B" },
  { id: "ai",   label: "Temporal AI / baseline ML",     tag: "AI",        color: "#F59E0B" },
  { id: "fc",   label: "Experimental VA risk forecast", tag: "FORECAST",  color: "#EF4444" },
  { id: "ui",   label: "Dashboard / Frontend",          tag: "FRONTEND",  color: "#64748B" },
];

const splitNodes = [
  { id: "sw",   label: "SOFTWARE DSP",   tag: "SOFTWARE",    color: "#0D9488" },
  { id: "fpga", label: "PYNQ FPGA DSP",  tag: "PYNQ / FPGA", color: "#8B5CF6" },
];

export default function ArchitecturePage() {
  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0 }}>System architecture</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
          Layers: FRONTEND · DATABASE (optional Supabase) · AI · SOFTWARE DSP · PYNQ/FPGA (optional)
        </p>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <Disclaimer compact />
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* ECG, SQ, PRE */}
        {nodes.slice(0, 3).map((n, i) => (
          <div key={n.id} style={{ textAlign: "center" }}>
            <div
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-line)",
                borderRadius: "0.625rem",
                padding: "0.625rem 1rem",
                display: "inline-block",
                minWidth: 220,
              }}
            >
              <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: n.color, margin: 0 }}>
                {n.tag}
              </p>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0.125rem 0 0", color: "var(--color-ink)" }}>{n.label}</p>
            </div>
            {i < 2 && (
              <div style={{ fontSize: "0.875rem", color: "var(--color-muted)", padding: "0.25rem 0" }}>
                {i === 1 ? "↓ splits ↓" : "↓"}
              </div>
            )}
          </div>
        ))}

        {/* Split */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", margin: "0.5rem 0" }}>
          {splitNodes.map((n) => (
            <div
              key={n.id}
              style={{
                background: "var(--color-bg)",
                border: `1px dashed ${n.color}`,
                borderRadius: "0.625rem",
                padding: "0.625rem 0.875rem",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: n.color, margin: 0 }}>
                {n.tag}
              </p>
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, margin: "0.125rem 0 0" }}>{n.label}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--color-muted)", padding: "0.25rem 0" }}>↓</div>

        {/* Remaining nodes */}
        {nodes.slice(3).map((n, i) => (
          <div key={n.id} style={{ textAlign: "center" }}>
            <div
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-line)",
                borderRadius: "0.625rem",
                padding: "0.625rem 1rem",
                display: "inline-block",
                minWidth: 220,
              }}
            >
              <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: n.color, margin: 0 }}>
                {n.tag}
              </p>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0.125rem 0 0", color: "var(--color-ink)" }}>{n.label}</p>
            </div>
            {i < nodes.slice(3).length - 1 && (
              <div style={{ fontSize: "0.875rem", color: "var(--color-muted)", padding: "0.25rem 0" }}>↓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
