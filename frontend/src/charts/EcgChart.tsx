import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Brush } from "recharts";

type Props = {
  time: number[];
  raw: number[];
  cleaned?: number[];
  title?: string;
};

export function EcgChart({ time, raw, cleaned, title }: Props) {
  const data = time.map((t, i) => ({ t, raw: raw[i], cleaned: cleaned?.[i] }));
  return (
    <div className="border border-slate-200 bg-white p-3">
      {title && <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <XAxis dataKey="t" tick={{ fontSize: 11 }} label={{ value: "Time (s)", position: "insideBottom", offset: -2, fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="raw" dot={false} stroke="#64748b" strokeWidth={1} name="Raw" />
            {cleaned && <Line type="monotone" dataKey="cleaned" dot={false} stroke="#1f6f7a" strokeWidth={1.2} name="Cleaned" />}
            <Brush dataKey="t" height={18} stroke="#94a3b8" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-slate-500">Use the brush below the plot to zoom. Waveforms are computed, not drawn from a library of fake traces.</p>
    </div>
  );
}
