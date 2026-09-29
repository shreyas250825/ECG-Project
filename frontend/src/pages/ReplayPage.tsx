import { useEffect, useRef, useState } from "react";
import { Disclaimer } from "../components/Disclaimer";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

export default function ReplayPage() {
  const [speed, setSpeed] = useState(1);
  const [frame, setFrame] = useState<{ timestamp: number; hr: number | null; status: string; ecg: number[] } | null>(null);
  const ws = useRef<WebSocket | null>(null);
  useEffect(() => {
    const sock = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/ecg-analysis/demo`);
    ws.current = sock;
    sock.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.error) return;
      setFrame({
        timestamp: msg.timestamp,
        hr: msg.hr,
        status: msg.forecast_output?.status,
        ecg: msg.ecg_segment,
      });
    };
    return () => sock.close();
  }, []);
  useEffect(() => {
    const sock = ws.current;
    if (sock && sock.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify({ speed }));
    }
  }, [speed]);
  const data = (frame?.ecg ?? []).map((y, i) => ({ i, y }));
  return (
    <div className="space-y-4">
      <h2 className="text-2xl">Replay stream</h2>
      <Disclaimer compact />
      <p className="text-sm">Replay of stored ECG at selectable speed. Not a live clinical monitor.</p>
      <div className="flex gap-2 text-sm">
        {[0.5, 1, 2, 4].map((s) => (
          <button key={s} className={`border px-3 py-1 ${speed === s ? "bg-teal-800 text-white" : ""}`} type="button" onClick={() => setSpeed(s)}>
            {s}×
          </button>
        ))}
      </div>
      <p className="text-sm">t = {frame?.timestamp?.toFixed?.(1) ?? "—"} s · HR = {frame?.hr?.toFixed?.(1) ?? "n/a"} · forecast status = {frame?.status ?? "—"}</p>
      <div className="h-48 border bg-white">
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="i" hide />
            <YAxis />
            <Line dataKey="y" dot={false} stroke="#1f6f7a" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
