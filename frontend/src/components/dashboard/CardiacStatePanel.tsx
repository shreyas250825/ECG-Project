import type { CardiacVisualizationState } from "../heart3d/types";

type Props = {
  viz: CardiacVisualizationState;
};

export function CardiacStatePanel({ viz }: Props) {
  return (
    <section className="border border-slate-200 bg-white/90 p-4 backdrop-blur-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Patient-specific cardiac state</h3>
      <p className="mt-1 text-xs text-slate-500">
        Computational representation from ECG features — not a health score or anatomical replica.
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase text-slate-500">Baseline</dt>
          <dd className="mt-1 text-slate-900">{viz.baselineWindowLabel ?? "No baseline learned yet"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-500">Current state</dt>
          <dd className="mt-1 text-slate-900">{viz.currentState}</dd>
          <dd className="text-xs text-slate-500">{viz.currentStateUpdatedAt ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-500">Deviation</dt>
          <dd className="mt-1 text-slate-900">
            {viz.baselineDeviation == null
              ? "Not calculated (requires baseline + twin update)"
              : `RMS z-score ${viz.baselineDeviation.toFixed(3)} from feature vector`}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-500">Baseline → Current State → Temporal Trajectory</p>
    </section>
  );
}
