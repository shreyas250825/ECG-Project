import type { HeartControlsState, VisualizationMode } from "./types";

type Props = {
  controls: HeartControlsState;
  onChange: (next: Partial<HeartControlsState>) => void;
  onResetCamera: () => void;
};

export function HeartControls({ controls, onChange, onResetCamera }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
      <button
        type="button"
        className="border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
        onClick={onResetCamera}
      >
        Reset camera
      </button>
      <label className="flex items-center gap-1.5 border border-slate-200 bg-white/80 px-2 py-1">
        <input
          type="checkbox"
          checked={controls.autoRotate}
          onChange={(e) => onChange({ autoRotate: e.target.checked })}
        />
        Auto-rotate
      </label>
      <button
        type="button"
        className="border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
        onClick={() => onChange({ paused: !controls.paused })}
      >
        {controls.paused ? "Resume pulse" : "Pause pulse"}
      </button>
      <label className="flex items-center gap-1.5 border border-slate-200 bg-white/80 px-2 py-1">
        <input
          type="checkbox"
          checked={controls.showLabels}
          onChange={(e) => onChange({ showLabels: e.target.checked })}
        />
        Anatomy labels
      </label>
      <div className="flex overflow-hidden border border-slate-300">
        {(["anatomy", "cardiac_state"] as VisualizationMode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`px-2 py-1 ${controls.mode === m ? "bg-teal-800 text-white" : "bg-white"}`}
            onClick={() => onChange({ mode: m, showLabels: m === "anatomy" ? true : controls.showLabels })}
          >
            {m === "anatomy" ? "Anatomical visualization" : "ECG-derived computational state"}
          </button>
        ))}
      </div>
    </div>
  );
}
