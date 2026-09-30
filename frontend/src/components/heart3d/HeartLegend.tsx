import type { CardiacVisualizationState, VisualizationMode } from "./types";

type Props = {
  viz: CardiacVisualizationState;
  mode: VisualizationMode;
};

export function HeartLegend({ viz, mode }: Props) {
  return (
    <div className="space-y-1 text-[11px] leading-snug text-slate-600">
      <p>
        Mode:{" "}
        <span className="font-medium text-slate-800">
          {mode === "anatomy" ? "Anatomical visualization" : "ECG-derived computational state visualization"}
        </span>
      </p>
      {viz.heartRate != null ? (
        <p>Visual pulse synchronized to measured ECG-derived heart rate.</p>
      ) : (
        <p>No measured heart rate — pulse idle or stopped (not inventing BPM).</p>
      )}
      {mode === "anatomy" && (
        <p>Anatomical visualization is illustrative and not patient-specific.</p>
      )}
      <p className="text-slate-500">
        3D visualization is an illustrative representation of ECG-derived computational state and is not an anatomical
        or physiological simulation of the patient's heart.
      </p>
      <p className="text-slate-500">
        Scope: primary experimental target is ventricular tachyarrhythmia / VT; PVC/ectopy for detection. The model does
        not visually predict all arrhythmias.
      </p>
    </div>
  );
}
