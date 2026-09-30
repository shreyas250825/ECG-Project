import type { TwinHistoryPoint } from "../heart3d/types";

type Props = {
  history: TwinHistoryPoint[];
};

export function StateTimeline({ history }: Props) {
  if (!history.length) {
    return (
      <div className="border border-slate-200 bg-white p-4 text-sm text-slate-600">
        No cardiac-state history available.
      </div>
    );
  }

  return (
    <div className="border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Cardiac state timeline</h3>
      <p className="mt-1 text-xs text-slate-500">From stored digital_twin_states · not synthetic history</p>
      <ol className="mt-3 space-y-0 border-l border-slate-300 pl-4">
        <li className="relative pb-3 text-xs text-slate-500">
          <span className="absolute -left-[1.15rem] top-0.5 h-2 w-2 rounded-full bg-slate-400" />
          Baseline
        </li>
        {history.map((h, i) => (
          <li key={h.id ?? `${h.timestamp}-${i}`} className="relative pb-3 text-sm last:pb-0">
            <span
              className={`absolute -left-[1.15rem] top-1.5 h-2.5 w-2.5 rounded-full ${
                i === history.length - 1 ? "bg-teal-800" : "bg-slate-300"
              }`}
            />
            <p className="font-medium text-slate-800">{h.label}</p>
            <p className="text-xs text-slate-500">
              t = {h.timestamp.toFixed(1)} s
              {h.deviation_score != null ? ` · deviation ${h.deviation_score.toFixed(3)}` : ""}
              {i === history.length - 1 ? " · Current state" : ""}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
