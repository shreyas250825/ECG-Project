import { useEffect, useRef, useState, useCallback } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Disclaimer } from "../components/Disclaimer";

/* ── Build the correct WebSocket URL from VITE_API_URL ───────────────────────
   Production: VITE_API_URL=https://ecg-backend.onrender.com
               → wss://ecg-backend.onrender.com/ws/ecg-analysis/demo
   Development (same host via Vite proxy): ws://localhost:5173/ws/...
   This fixes the production bug where location.host pointed at Vercel.          */
function buildWsUrl(recordId: string): string {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (apiUrl && apiUrl.length > 0) {
    const wsBase = apiUrl
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://")
      .replace(/\/$/, "");
    return `${wsBase}/ws/ecg-analysis/${recordId}`;
  }
  // Fallback: same-origin (dev with proxy, or test)
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws/ecg-analysis/${recordId}`;
}

type Frame = {
  timestamp: number;
  hr: number | null;
  status: string;
  ecg: number[];
  deviation_score: number | null;
  signal_quality: string;
};

const MAX_RECONNECT = 5;
const RECONNECT_MS  = 3000;

export default function ReplayPage() {
  const [speed, setSpeed]       = useState(1);
  const [paused, setPaused]     = useState(false);
  const [frame, setFrame]       = useState<Frame | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [error, setError]       = useState<string | null>(null);
  const ws           = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const url = buildWsUrl("demo");
    const sock = new WebSocket(url);
    ws.current = sock;

    sock.onopen = () => {
      setConnected(true);
      setError(null);
      setReconnectCount(0);
      sock.send(JSON.stringify({ speed, paused }));
    };
    sock.onclose = () => {
      setConnected(false);
      setReconnectCount((n) => {
        if (n < MAX_RECONNECT) {
          reconnectRef.current = setTimeout(connect, RECONNECT_MS);
          return n + 1;
        }
        setError("WebSocket disconnected. Max reconnect attempts reached.");
        return n;
      });
    };
    sock.onerror = () => {
      setError(`Cannot reach backend WebSocket at ${url}`);
    };
    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
        if (msg.error) { setError(String(msg.message ?? msg.error)); return; }
        setFrame({
          timestamp:      Number(msg.timestamp ?? 0),
          hr:             msg.hr != null ? Number(msg.hr) : null,
          status:         String(msg.forecast_output != null ? (msg.forecast_output as Record<string, unknown>).status ?? "—" : "—"),
          ecg:            Array.isArray(msg.ecg_segment) ? (msg.ecg_segment as number[]) : [],
          deviation_score: msg.deviation_score != null ? Number(msg.deviation_score) : null,
          signal_quality: String(msg.signal_quality ?? "—"),
        });
      } catch { /* ignore parse errors */ }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      ws.current?.close();
    };
  }, [connect]);

  // Send speed/pause updates
  useEffect(() => {
    const sock = ws.current;
    if (sock?.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify({ speed, paused }));
    }
  }, [speed, paused]);

  const data = (frame?.ecg ?? []).map((y, i) => ({ i, y }));

  return (
    <div className="fade-in">
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "var(--color-ink)" }}>
          ECG Replay Stream
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
          Recorded ECG replay at selectable speed. Not live sensor acquisition. Not a clinical monitor.
        </p>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <Disclaimer compact />
      </div>

      {/* Connection status */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem" }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: connected ? "#10B981" : reconnectCount > 0 ? "#F59E0B" : "#94A3B8",
            display: "inline-block",
            boxShadow: connected ? "0 0 6px #10B981" : "none",
          }} />
          <span style={{ color: "var(--color-muted)" }}>
            {connected ? "WebSocket connected"
              : reconnectCount > 0 && reconnectCount < MAX_RECONNECT
                ? `Reconnecting… (${reconnectCount}/${MAX_RECONNECT})`
                : "Disconnected"}
          </span>
        </span>
        {error && (
          <span style={{ fontSize: "0.75rem", color: "#EF4444", background: "#FEF2F2",
            border: "1px solid #FECACA", borderRadius: "0.375rem", padding: "0.25rem 0.5rem" }}>
            {error}
          </span>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>Speed:</span>
        {[0.5, 1, 2, 4].map((s) => (
          <button key={s} type="button" onClick={() => setSpeed(s)}
            style={{
              padding: "0.375rem 0.875rem", borderRadius: "0.375rem",
              fontSize: "0.8125rem", fontWeight: 500,
              border: "1px solid var(--color-line)",
              background: speed === s ? "var(--color-teal)" : "var(--color-surface)",
              color: speed === s ? "#fff" : "var(--color-muted)",
              cursor: "pointer",
            }}>
            {s}×
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: "var(--color-line)" }} />
        <button type="button" onClick={() => setPaused((p) => !p)}
          style={{
            padding: "0.375rem 0.875rem", borderRadius: "0.375rem",
            fontSize: "0.8125rem", fontWeight: 500,
            border: "1px solid var(--color-line)",
            background: paused ? "#F59E0B" : "var(--color-surface)",
            color: paused ? "#fff" : "var(--color-muted)",
            cursor: "pointer",
          }}>
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
      </div>

      {/* Metrics strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: "0.5rem", marginBottom: "1rem",
      }}>
        {[
          { label: "Time",       value: frame ? `${frame.timestamp.toFixed(1)} s` : "—" },
          { label: "Heart Rate", value: frame?.hr != null ? `${frame.hr.toFixed(1)} bpm` : "—" },
          { label: "Quality",    value: frame?.signal_quality ?? "—" },
          { label: "Deviation",  value: frame?.deviation_score != null ? frame.deviation_score.toFixed(3) : "—" },
          { label: "Forecast",   value: frame?.status ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)",
            borderRadius: "0.5rem", padding: "0.5rem 0.75rem" }}>
            <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.07em",
              textTransform: "uppercase", color: "var(--color-muted)", margin: 0 }}>
              {label}
            </p>
            <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-ink)",
              margin: "0.125rem 0 0" }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Waveform */}
      <div style={{ background: "#0B1120", borderRadius: "0.75rem",
        border: "1px solid rgba(255,255,255,0.08)", padding: "1rem 0.5rem 0.5rem" }}>
        <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.3)", margin: "0 0 0.5rem 0.75rem" }}>
          ECG WAVEFORM — 8 s window
        </p>
        <div style={{ height: 200 }}>
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                <XAxis dataKey="i" hide />
                <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} />
                <Line type="monotone" dataKey="y" dot={false} stroke="#14B8A6"
                  strokeWidth={1.5} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center",
              justifyContent: "center", color: "rgba(255,255,255,0.2)", fontSize: "0.875rem" }}>
              {connected ? "Waiting for ECG frames…" : "Connect to backend to start replay"}
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize: "0.6875rem", color: "var(--color-muted)", marginTop: "0.75rem" }}>
        Recorded ECG replay only. Classification shown when a beat classifier model is loaded.
        Forecast status requires a trained temporal model on SDDB data.
      </p>
    </div>
  );
}
