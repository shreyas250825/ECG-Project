export const DISCLAIMER =
  "Research prototype only. Model outputs are experimental estimates derived from ECG data and are not clinical diagnoses, medical advice, or treatment recommendations.";

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`border border-amber-200 bg-amber-50 text-amber-950 ${compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"}`}>
      {DISCLAIMER}
    </p>
  );
}

export function PrototypeBadges() {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="border border-slate-300 bg-white px-2 py-1 text-xs font-semibold tracking-wide text-slate-700">
        RESEARCH PROTOTYPE
      </span>
      <span className="border border-slate-300 bg-white px-2 py-1 text-xs font-semibold tracking-wide text-slate-700">
        NOT FOR CLINICAL DIAGNOSIS
      </span>
    </div>
  );
}
