export const DISCLAIMER =
  "Research prototype only. Model outputs are experimental estimates derived from ECG data and are not clinical diagnoses, medical advice, or treatment recommendations.";

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className="disclaimer-strip" style={compact ? { fontSize: "0.6875rem" } : {}}>
      {DISCLAIMER}
    </p>
  );
}

export function PrototypeBadges() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
      <span className="badge badge-prototype">Research Prototype</span>
      <span className="badge badge-warning">Not for clinical diagnosis</span>
    </div>
  );
}
