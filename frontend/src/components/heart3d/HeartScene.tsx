import React, {
  Suspense,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { HeartModel } from "./HeartModel";
import { RealisticHeart } from "./RealisticHeart";
import {
  HeartLabelAnchors,
  HeartLabelOverlay,
  type LabelAnchorsHandle,
} from "./HeartLabels";
import { REALISTIC_HEART } from "./assetPaths";
import type {
  CardiacVisualizationState,
  HeartControlsState,
  VisualizationMode,
} from "./types";

/* ── Icon helper ─────────────────────────────────────────────────── */
function Ico({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  reset:    "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  rotate:   "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10M17 7l5-5m0 0l-5 0m5 0l0 5",
  pause:    "M6 4h4v16H6zm8 0h4v16h-4z",
  play:     "M5 3l14 9-14 9V3z",
  labels:   "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z",
  anatomy:  "M12 2a10 10 0 100 20A10 10 0 0012 2zM2 12h20",
  state:    "M22 12h-4l-3 9L9 3l-3 9H2",
  info:     "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

/* ── Viz state color map ─────────────────────────────────────────── */
const VIZ_STATE_COLOR: Record<string, string> = {
  STABLE:                   "#10B981",
  DEVIATION:                "#F59E0B",
  ELEVATED_RESEARCH_RISK:   "#EF4444",
  INSUFFICIENT_EVIDENCE:    "#94A3B8",
  NO_DATA:                  "#475569",
};

/* ── Compact toolbar button ──────────────────────────────────────── */
function ToolBtn({
  icon,
  label,
  active,
  onClick,
  title,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "3px",
        padding: "6px 8px",
        borderRadius: "6px",
        border: active
          ? "1px solid rgba(20,184,166,0.5)"
          : "1px solid rgba(255,255,255,0.08)",
        background: active
          ? "rgba(20,184,166,0.18)"
          : "rgba(255,255,255,0.04)",
        color: active ? "#14B8A6" : "rgba(255,255,255,0.55)",
        cursor: "pointer",
        transition: "all 0.15s",
        minWidth: 44,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background =
            "rgba(255,255,255,0.08)";
          (e.currentTarget as HTMLElement).style.color =
            "rgba(255,255,255,0.85)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background =
            "rgba(255,255,255,0.04)";
          (e.currentTarget as HTMLElement).style.color =
            "rgba(255,255,255,0.55)";
        }
      }}
    >
      <Ico d={icon} size={13} />
      <span
        style={{
          fontSize: "9px",
          fontWeight: 600,
          letterSpacing: "0.04em",
          lineHeight: 1,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </button>
  );
}

/* ── Mode toggle ─────────────────────────────────────────────────── */
function ModeToggle({
  mode,
  onChange,
}: {
  mode: VisualizationMode;
  onChange: (m: VisualizationMode) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "6px",
        overflow: "hidden",
      }}
    >
      {(
        [
          { id: "anatomy" as VisualizationMode, icon: ICONS.anatomy, short: "Anatomy" },
          { id: "cardiac_state" as VisualizationMode, icon: ICONS.state, short: "State" },
        ] as const
      ).map((m) => (
        <button
          key={m.id}
          type="button"
          title={m.id === "anatomy" ? "Anatomical visualization" : "ECG-derived computational state"}
          onClick={() => onChange(m.id)}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "3px",
            padding: "6px 10px",
            border: "none",
            background:
              mode === m.id ? "rgba(20,184,166,0.18)" : "transparent",
            color:
              mode === m.id ? "#14B8A6" : "rgba(255,255,255,0.45)",
            cursor: "pointer",
            transition: "all 0.15s",
            borderRight:
              m.id === "anatomy"
                ? "1px solid rgba(255,255,255,0.07)"
                : "none",
          }}
        >
          <Ico d={m.icon} size={13} />
          <span
            style={{
              fontSize: "9px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {m.short}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── Viz state badge (top-left corner of canvas) ─────────────────── */
function VizStateBadge({ viz }: { viz: CardiacVisualizationState }) {
  const color = VIZ_STATE_COLOR[viz.vizState] ?? "#94A3B8";
  const label = viz.vizState.replace(/_/g, " ");
  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: 2,
        display: "flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 8px 3px 6px",
        borderRadius: "6px",
        background: "rgba(11,17,32,0.75)",
        backdropFilter: "blur(4px)",
        border: "1px solid rgba(255,255,255,0.08)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
          boxShadow: `0 0 5px ${color}`,
        }}
      />
      <span
        style={{
          fontSize: "9.5px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.7)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── Metric pills below canvas ───────────────────────────────────── */
function MetricPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 100px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "6px",
        padding: "7px 10px",
      }}
    >
      <p
        style={{
          fontSize: "8.5px",
          fontWeight: 700,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.35)",
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: color ?? "rgba(255,255,255,0.82)",
          margin: "2px 0 0",
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
    </div>
  );
}

/* ── Fallback message ────────────────────────────────────────────── */
function FallbackMessage() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "8px",
        color: "rgba(255,255,255,0.3)",
        fontSize: "13px",
      }}
    >
      <svg
        width={32}
        height={32}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        opacity={0.4}
      >
        <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zM2 12h20" />
      </svg>
      3D visualization unavailable
    </div>
  );
}

/* ── Error boundary ──────────────────────────────────────────────── */
class SceneErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode; onError?: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/* ── FBX availability probe ──────────────────────────────────────── */
async function isRealFbxAvailable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-20" },
    });
    if (!res.ok) return false;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("text/html")) return false;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 8) return false;
    const ascii = String.fromCharCode(...buf.slice(0, 21));
    return (
      ascii.startsWith("Kaydara FBX Binary") ||
      ascii.startsWith("; FBX") ||
      buf[0] === 0x4b
    );
  } catch {
    return false;
  }
}

/* ── Heart mesh (with label anchors inside Canvas) ───────────────── */
function HeartMeshWithLabels({
  viz,
  controls,
  lastRPeakMs,
  fbxAvailable,
  onFbxFailed,
  labelsRef,
}: {
  viz: CardiacVisualizationState;
  controls: HeartControlsState;
  lastRPeakMs: number | null;
  fbxAvailable: boolean;
  onFbxFailed: () => void;
  labelsRef: React.RefObject<LabelAnchorsHandle | null>;
}) {
  const procedural = (
    <HeartModel
      viz={viz}
      mode={controls.mode}
      paused={controls.paused}
      lastRPeakMs={lastRPeakMs}
    />
  );

  return (
    <>
      {fbxAvailable ? (
        <SceneErrorBoundary fallback={procedural} onError={onFbxFailed}>
          <Suspense fallback={procedural}>
            <RealisticHeart
              viz={viz}
              mode={controls.mode}
              paused={controls.paused}
              lastRPeakMs={lastRPeakMs}
            />
          </Suspense>
        </SceneErrorBoundary>
      ) : (
        procedural
      )}
      {/* Label anchor tracker — always inside Canvas, outputs 2D positions to ref */}
      <HeartLabelAnchors
        ref={labelsRef}
        visible={controls.showLabels}
      />
    </>
  );
}

/* ── Main HeartScene component ───────────────────────────────────── */
export type HeartSceneProps = {
  viz: CardiacVisualizationState;
  lastRPeakMs: number | null;
  className?: string;
  /** compact: smaller fixed-height canvas (sidebar / presentation) */
  compact?: boolean;
  /** tall: kept for API compatibility, now handled by CSS class */
  tall?: boolean;
};

function HeartSceneInner({
  viz,
  lastRPeakMs,
  className,
  compact,
}: HeartSceneProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const labelsRef = useRef<LabelAnchorsHandle | null>(null);
  const [controls, setControls] = useState<HeartControlsState>({
    autoRotate: false,
    paused: false,
    showLabels: false,
    mode: "cardiac_state",
  });
  const [fbxAvailable, setFbxAvailable] = useState(true);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isRealFbxAvailable(REALISTIC_HEART.fbx).then((ok) => {
      if (!cancelled) setFbxAvailable(ok);
    });
    return () => { cancelled = true; };
  }, []);

  const onFbxFailed = useCallback(() => setFbxAvailable(false), []);

  const onChange = useCallback((next: Partial<HeartControlsState>) => {
    setControls((c) => ({ ...c, ...next }));
  }, []);

  const onResetCamera = useCallback(() => {
    controlsRef.current?.reset();
  }, []);

  const canvasStyle = useMemo(() => ({ width: "100%", height: "100%" }), []);

  // `tall` prop kept for API compat — responsive height now handled by CSS
  const canvasWrapperClass = compact ? undefined : "heart-canvas-wrapper";
  const canvasWrapperStyle: React.CSSProperties = compact
    ? { position: "relative", width: "100%", height: 260 }
    : {};

  const vizStateColor = VIZ_STATE_COLOR[viz.vizState] ?? "#94A3B8";

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#0B1120",
        borderRadius: "0.875rem",
        border: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}
    >
      {/* ── Header bar ──────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <div>
          <p
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "rgba(255,255,255,0.85)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            3D Heart visualization
          </p>
          <p
            style={{
              fontSize: "10px",
              color: "rgba(255,255,255,0.3)",
              margin: 0,
            }}
          >
            Illustrative · not patient-specific anatomy
          </p>
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <ToolBtn
            icon={ICONS.reset}
            label="Reset"
            onClick={onResetCamera}
            title="Reset camera view"
          />
          <ToolBtn
            icon={controls.autoRotate ? ICONS.pause : ICONS.rotate}
            label={controls.autoRotate ? "Stop" : "Rotate"}
            active={controls.autoRotate}
            onClick={() => onChange({ autoRotate: !controls.autoRotate })}
            title={controls.autoRotate ? "Stop auto-rotation" : "Auto-rotate"}
          />
          <ToolBtn
            icon={controls.paused ? ICONS.play : ICONS.pause}
            label={controls.paused ? "Resume" : "Pause"}
            active={controls.paused}
            onClick={() => onChange({ paused: !controls.paused })}
            title={controls.paused ? "Resume pulse" : "Pause pulse"}
          />
          <ToolBtn
            icon={ICONS.labels}
            label="Labels"
            active={controls.showLabels}
            onClick={() =>
              onChange({ showLabels: !controls.showLabels })
            }
            title="Toggle anatomy labels"
          />
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.07)", margin: "0 2px" }} />
          <ModeToggle
            mode={controls.mode}
            onChange={(m) =>
              onChange({ mode: m, showLabels: m === "anatomy" ? controls.showLabels : controls.showLabels })
            }
          />
        </div>
      </div>

      {/* ── 3D Canvas + label overlay ────────────────────────────── */}
      <div
        className={canvasWrapperClass ? `${canvasWrapperClass} heart-canvas-touch` : "heart-canvas-touch"}
        style={{
          position: "relative",
          width: "100%",
          flexShrink: 0,
          ...canvasWrapperStyle,
        }}
      >
        {webglFailed ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#0B1120",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FallbackMessage />
          </div>
        ) : (
          <>
            <SceneErrorBoundary
              fallback={
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "#0B1120",
                  }}
                >
                  <FallbackMessage />
                </div>
              }
              onError={() => setWebglFailed(true)}
            >
              <Canvas
                style={canvasStyle}
                camera={{ position: [0.4, 0.15, 3.2], fov: 36, near: 0.1, far: 60 }}
                dpr={[1, 1.75]}
                shadows
                gl={{
                  antialias: true,
                  alpha: false,
                  powerPreference: "high-performance",
                }}
                onCreated={({ gl }) => {
                  gl.setClearColor("#0B1120", 1);
                }}
              >
                <color attach="background" args={["#0B1120"]} />
                <fog attach="fog" args={["#0B1120", 10, 22]} />

                {/* Lighting */}
                <ambientLight intensity={0.35} />
                <directionalLight
                  position={[4, 5, 3]}
                  intensity={1.6}
                  castShadow
                  shadow-mapSize={[1024, 1024]}
                  shadow-camera-near={0.5}
                  shadow-camera-far={20}
                  shadow-camera-left={-4}
                  shadow-camera-right={4}
                  shadow-camera-top={4}
                  shadow-camera-bottom={-4}
                />
                <directionalLight
                  position={[-3, 2, -2]}
                  intensity={0.45}
                  color="#a0bcd8"
                />
                <spotLight
                  position={[0, 4, 2.5]}
                  angle={0.4}
                  penumbra={0.7}
                  intensity={0.7}
                  color="#ffe8d0"
                />
                <hemisphereLight args={["#ccd8e8", "#1a1220", 0.4]} />

                <HeartMeshWithLabels
                  viz={viz}
                  controls={controls}
                  lastRPeakMs={lastRPeakMs}
                  fbxAvailable={fbxAvailable}
                  onFbxFailed={onFbxFailed}
                  labelsRef={labelsRef}
                />

                <ContactShadows
                  position={[0, -1.35, 0]}
                  opacity={0.65}
                  scale={9}
                  blur={3.2}
                  far={2.8}
                  color="#000000"
                />

                <OrbitControls
                  ref={controlsRef}
                  enablePan={false}
                  enableZoom
                  enableRotate
                  autoRotate={controls.autoRotate && !controls.paused}
                  autoRotateSpeed={0.55}
                  minDistance={1.8}
                  maxDistance={5.5}
                  target={[0, 0.05, 0]}
                  makeDefault
                />
              </Canvas>
            </SceneErrorBoundary>

            {/* HTML overlay for anatomy labels — outside Canvas, correctly sized */}
            <HeartLabelOverlay
              anchorsRef={labelsRef}
              visible={controls.showLabels}
            />

            {/* Viz state badge */}
            <VizStateBadge viz={viz} />

            {/* Drag hint (fades after first user interaction) */}
            <div
              style={{
                position: "absolute",
                bottom: 10,
                right: 12,
                fontSize: "9px",
                color: "rgba(255,255,255,0.2)",
                pointerEvents: "none",
                letterSpacing: "0.04em",
              }}
            >
              Drag to rotate · Scroll to zoom
            </div>
          </>
        )}
      </div>

      {/* ── Metrics strip ────────────────────────────────────────── */}
      {!compact && (
        <div
          style={{
            display: "flex",
            gap: "6px",
            padding: "10px 12px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            flexWrap: "wrap",
            flexShrink: 0,
          }}
        >
          <MetricPill
            label="Heart rate"
            value={
              viz.heartRate == null
                ? "—"
                : `${viz.heartRate.toFixed(1)} bpm`
            }
            color={viz.heartRate != null ? "#14B8A6" : undefined}
          />
          <MetricPill
            label="Signal quality"
            value={
              viz.signalQuality == null
                ? "—"
                : viz.signalQuality.toFixed(2)
            }
          />
          <MetricPill
            label="Deviation"
            value={
              viz.baselineDeviation == null
                ? "—"
                : viz.baselineDeviation.toFixed(3)
            }
            color={
              viz.baselineDeviation == null
                ? undefined
                : viz.baselineDeviation < 1
                  ? "#10B981"
                  : viz.baselineDeviation < 2
                    ? "#F59E0B"
                    : "#EF4444"
            }
          />
          <MetricPill
            label="State"
            value={viz.currentState}
            color={vizStateColor}
          />
        </div>
      )}

      {/* ── Mode note ────────────────────────────────────────────── */}
      <div
        style={{
          padding: "7px 12px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          fontSize: "9.5px",
          color: "rgba(255,255,255,0.2)",
          flexShrink: 0,
        }}
      >
        {controls.mode === "anatomy"
          ? "Anatomical visualization — illustrative, not patient-specific"
          : "ECG-derived computational state — not an anatomical reconstruction"}
        {viz.syntheticNotice
          ? " · Synthetic demonstration data"
          : ""}
      </div>
    </div>
  );
}

export const HeartScene = memo(HeartSceneInner);
