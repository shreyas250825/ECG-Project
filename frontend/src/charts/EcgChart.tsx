import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Brush, ReferenceDot, ReferenceLine } from "recharts";

type Props = {
  time: number[];
  raw: number[];
  cleaned?: number[];
  title?: string;
  rPeakTimes?: number[];
  cursorTime?: number | null;
  dark?: boolean;
};

export function EcgChart({ time, raw, cleaned, title, rPeakTimes, cursorTime, dark = false }: Props) {
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

  const tickStyle = { fontSize: 10, fill: dark ? "rgba(255,255,255,0.35)" : "#64748b" };
  const gridColor  = dark ? "rgba(255,255,255,0.06)" : "#E2E8F0";
  const rawColor   = dark ? "rgba(148,163,184,0.5)" : "#94a3b8";
  const cleanColor = dark ? "#14B8A6" : "#0D9488";
  const peakColor  = dark ? "#60A5FA" : "#2563EB";
  const brushBg    = dark ? "#1E293B" : "#F1F5F9";
  const brushStroke = dark ? "#334155" : "#CBD5E1";

  return (
    <div style={{ padding: dark ? 0 : "0.75rem", background: dark ? "transparent" : "#fff" }}>
      {title && !dark && (
        <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem", color: "#0F172A" }}>{title}</h3>
      )}
      <div style={{ height: dark ? 220 : 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
            <XAxis
              dataKey="t"
              tick={tickStyle}
              stroke={gridColor}
              tickLine={false}
              label={dark ? undefined : { value: "Time (s)", position: "insideBottom", offset: -2, fontSize: 10, fill: "#94a3b8" }}
            />
            <YAxis
              tick={tickStyle}
              stroke={gridColor}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: dark ? "#1E293B" : "#fff",
                border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "#E2E8F0"}`,
                borderRadius: "0.5rem",
                fontSize: "0.75rem",
                color: dark ? "#fff" : "#0F172A",
              }}
              itemStyle={{ color: dark ? "rgba(255,255,255,0.7)" : "#64748B" }}
            />
            <Line
              type="monotone"
              dataKey="raw"
              dot={false}
              stroke={rawColor}
              strokeWidth={1}
              name="Raw"
              isAnimationActive={false}
            />
            {cleaned && (
              <Line
                type="monotone"
                dataKey="cleaned"
                dot={false}
                stroke={cleanColor}
                strokeWidth={1.5}
                name="Cleaned"
                isAnimationActive={false}
              />
            )}
            {peakPoints.map((p) => (
              <ReferenceDot key={p.t} x={p.t} y={p.y} r={3} fill={peakColor} stroke="none" />
            ))}
            {cursorTime != null && (
              <ReferenceLine x={cursorTime} stroke="#F59E0B" strokeDasharray="3 3" strokeWidth={1.5} />
            )}
            <Brush
              dataKey="t"
              height={20}
              stroke={brushStroke}
              fill={brushBg}
              travellerWidth={6}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {!dark && (
        <p style={{ marginTop: "0.375rem", fontSize: "0.6875rem", color: "#94a3b8" }}>
          Use the brush below to zoom. Blue markers are detected R-peaks.
        </p>
      )}
      {dark && (
        <p style={{ padding: "0.375rem 1.25rem 0.625rem", fontSize: "0.6875rem", color: "rgba(255,255,255,0.25)" }}>
          Drag the brush to zoom · Grey = raw · Teal = cleaned · Blue = R-peaks
        </p>
      )}
    </div>
  );
}
