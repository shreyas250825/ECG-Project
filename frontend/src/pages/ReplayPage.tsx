import { useEffect, useRef, useState } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Disclaimer } from "../components/Disclaimer";

export default function ReplayPage() {
  const [speed, setSpeed]   = useState(1);
  const [frame, setFrame]   = useState<{ timestamp: number; hr: number | null; status: string; ecg: number[] } | null>(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const sock = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/ecg-analysis/demo`,
    );
    ws.current = sock;
    sock.onopen = () => setConnected(true);
    sock.onclose = () => setConnected(false);
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
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0 }}>Replay stream</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
          Replay of stored ECG at selectable speed. Not a live clinical monitor.
        </p>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <Disclaimer compact />
      </div>

      {/* Connection status */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: "50%",
            background: connected ? "#10B981" : "#94A3B8",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>
          {connected ? "WebSocket connected" : "WebSocket disconnected — backend may not be running"}
        </span>
      </div>

      {/* Speed controls */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--color-muted)", alignSelf: "center" }}>Speed:</span>
        {[0.5, 1, 2, 4].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            style={{
              padding: "0.375rem 0.875rem",
              borderRadius: "0.375rem",
              fontSize: "0.8125rem",
              fontWeight: 500,
              border: "1px solid var(--color-line)",
              background: speed === s ? "var(--color-navy)" : "var(--color-surface)",
              color: speed === s ? "#fff" : "var(--color-muted)",
              cursor: "pointer",
            }}
          >
            {s}×
          </button>
        ))}
      </div>

      {/* Status bar */}
      <div
        style={{
          background: "var(--color-navy)",
          borderRadius: "0.625rem",
          padding: "0.75rem 1rem",
          display: "flex",
          gap: "1.5rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "Time", value: frame?.timestamp != null ? `${frame.timestamp.toFixed(1)} s` : "—" },
          { label: "HR",   value: frame?.hr != null ? `${frame.hr.toFixed(1)} bpm` : "—" },
          { label: "Forecast status", value: frame?.status ?? "—" },
        ].map(({ label, value }) => (
          <div key={label}>
            <p style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", margin: 0 }}>
              {label}
            </p>
            <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#fff", margin: "0.125rem 0 0" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Waveform */}
      <div className="ecg-panel" style={{ padding: "1rem 0.5rem 0.5rem" }}>
        <div style={{ height: 180 }}>
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                <XAxis dataKey="i" hide />
                <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.35)" }} tickLine={false} axisLine={false} />
                <Line type="monotone" dataKey="y" dot={false} stroke="#14B8A6" strokeWidth={1.5} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.25)", fontSize: "0.875rem" }}>
              Waiting for WebSocket stream…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
