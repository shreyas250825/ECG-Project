import React, { Suspense, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { HeartControls } from "./HeartControls";
import { HeartLabels } from "./HeartLabels";
import { HeartLegend } from "./HeartLegend";
import { HeartModel } from "./HeartModel";
import { HeartState } from "./HeartState";
import { RealisticHeart } from "./RealisticHeart";
import { REALISTIC_HEART } from "./assetPaths";
import type { CardiacVisualizationState, HeartControlsState } from "./types";

type Props = {
  viz: CardiacVisualizationState;
  lastRPeakMs: number | null;
  className?: string;
  compact?: boolean;
};

function FallbackMessage() {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center bg-slate-800 text-sm text-slate-300">
      3D anatomical model unavailable.
    </div>
  );
}

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

/** True for a real FBX file — not Vite HTML SPA fallback for missing files. */
async function isRealFbxAvailable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-20" } });
    if (!res.ok) return false;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("text/html")) return false;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 8) return false;
    const ascii = String.fromCharCode(...buf.slice(0, 21));
    return ascii.startsWith("Kaydara FBX Binary") || ascii.startsWith("; FBX") || buf[0] === 0x4b;
  } catch {
    return false;
  }
}

function HeartMesh({
  viz,
  controls,
  lastRPeakMs,
  fbxAvailable,
  onFbxFailed,
}: {
  viz: CardiacVisualizationState;
  controls: HeartControlsState;
  lastRPeakMs: number | null;
  fbxAvailable: boolean;
  onFbxFailed: () => void;
}) {
  const procedural = (
    <HeartModel viz={viz} mode={controls.mode} paused={controls.paused} lastRPeakMs={lastRPeakMs} />
  );

  if (!fbxAvailable) return procedural;

  return (
    <SceneErrorBoundary fallback={procedural} onError={onFbxFailed}>
      <Suspense fallback={procedural}>
        <RealisticHeart viz={viz} mode={controls.mode} paused={controls.paused} lastRPeakMs={lastRPeakMs} />
      </Suspense>
    </SceneErrorBoundary>
  );
}

function HeartSceneInner({ viz, lastRPeakMs, className, compact }: Props) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
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
    return () => {
      cancelled = true;
    };
  }, []);

  const onFbxFailed = useCallback(() => setFbxAvailable(false), []);

  const onChange = useCallback((next: Partial<HeartControlsState>) => {
    setControls((c) => ({ ...c, ...next }));
  }, []);

  const onResetCamera = useCallback(() => {
    controlsRef.current?.reset();
  }, []);

  const canvasStyle = useMemo(() => ({ width: "100%", height: "100%" }), []);

  return (
    <section className={`flex flex-col overflow-hidden border border-slate-700/40 bg-slate-900 ${className ?? ""}`}>
      <div className="flex items-center justify-between border-b border-slate-700/50 px-3 py-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">3D heart visualization</h3>
          <p className="text-[11px] text-slate-400">Illustrative layer · not patient-specific anatomy</p>
        </div>
      </div>

      <div className={`relative w-full ${compact ? "h-[260px]" : "h-[340px] md:h-[400px]"}`}>
        {webglFailed ? (
          <FallbackMessage />
        ) : (
          <SceneErrorBoundary fallback={<FallbackMessage />} onError={() => setWebglFailed(true)}>
            <Canvas
              style={canvasStyle}
              camera={{ position: [0.4, 0.25, 3.0], fov: 38, near: 0.1, far: 50 }}
              dpr={[1, 1.75]}
              shadows
              gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
              onCreated={({ gl }) => {
                gl.setClearColor("#1a1f26", 1);
              }}
            >
              <color attach="background" args={["#1a1f26"]} />
              <fog attach="fog" args={["#1a1f26", 7, 16]} />
              <ambientLight intensity={0.42} />
              <directionalLight position={[3.5, 4.5, 2.5]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
              <directionalLight position={[-2.5, 1.5, -1.5]} intensity={0.5} color="#a8c0d8" />
              <spotLight position={[0, 3, 2]} angle={0.45} penumbra={0.6} intensity={0.6} color="#ffd0c8" />
              <hemisphereLight args={["#c8d4e0", "#1a1214", 0.45]} />
              <HeartMesh
                viz={viz}
                controls={controls}
                lastRPeakMs={lastRPeakMs}
                fbxAvailable={fbxAvailable}
                onFbxFailed={onFbxFailed}
              />
              <HeartLabels visible={controls.showLabels || controls.mode === "anatomy"} />
              <ContactShadows position={[0, -1.25, 0]} opacity={0.55} scale={8} blur={2.8} far={2.5} color="#000000" />
              <OrbitControls
                ref={controlsRef}
                enablePan
                enableZoom
                enableRotate
                autoRotate={controls.autoRotate && !controls.paused}
                autoRotateSpeed={0.45}
                minDistance={1.6}
                maxDistance={5.5}
                target={[0, 0.05, 0]}
                makeDefault
              />
            </Canvas>
          </SceneErrorBoundary>
        )}
      </div>

      <div className="space-y-3 border-t border-slate-700/50 bg-slate-950/80 px-3 py-3 text-slate-200">
        <HeartControls controls={controls} onChange={onChange} onResetCamera={onResetCamera} />
        <HeartState viz={viz} />
        <HeartLegend viz={viz} mode={controls.mode} />
      </div>
    </section>
  );
}

export const HeartScene = memo(HeartSceneInner);
