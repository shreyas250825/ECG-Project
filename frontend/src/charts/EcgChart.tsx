import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Brush, ReferenceDot, ReferenceLine } from "recharts";

type Props = {
  time: number[];
  raw: number[];
  cleaned?: number[];
  title?: string;
  rPeakTimes?: number[];
  cursorTime?: number | null;
};

export function EcgChart({ time, raw, cleaned, title, rPeakTimes, cursorTime }: Props) {
  const data = time.map((t, i) => ({ t, raw: raw[i], cleaned: cleaned?.[i] }));
  const peakPoints = (rPeakTimes ?? [])
    .map((pt) => {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < time.length; i++) {
        const ti = time[i];
        if (ti == null) continue;
        const d = Math.abs(ti - pt);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (bestD > 0.05) return null;
      const tVal = time[best];
      const yVal = cleaned?.[best] ?? raw[best];
      if (tVal == null || yVal == null) return null;
      return { t: tVal, y: yVal };
    })
    .filter(Boolean) as { t: number; y: number }[];

  return (
    <div className="border border-slate-200 bg-white p-3">
      {title && <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <XAxis dataKey="t" tick={{ fontSize: 11 }} label={{ value: "Time (s)", position: "insideBottom", offset: -2, fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="raw" dot={false} stroke="#64748b" strokeWidth={1} name="Raw" isAnimationActive={false} />
            {cleaned && (
              <Line
                type="monotone"
                dataKey="cleaned"
                dot={false}
                stroke="#1f6f7a"
                strokeWidth={1.2}
                name="Cleaned"
                isAnimationActive={false}
              />
            )}
            {peakPoints.map((p) => (
              <ReferenceDot key={p.t} x={p.t} y={p.y} r={3} fill="#2a5f8f" stroke="none" />
            ))}
            {cursorTime != null && <ReferenceLine x={cursorTime} stroke="#8a5a12" strokeDasharray="3 3" />}
            <Brush dataKey="t" height={18} stroke="#94a3b8" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Use the brush below the plot to zoom. Blue markers are detected R-peaks from the processing pipeline.
      </p>
    </div>
  );
}
