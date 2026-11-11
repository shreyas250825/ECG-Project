/**
 * WireframeHeartScene — cinematic landing-page heart visualization.
 *
 * Renders the procedural heart as a glowing crimson wireframe with
 * floating particles and neural-network connection lines.
 * Completely separate from the app's HeartScene.
 */
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  EdgesGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  SphereGeometry,
  Vector3,
  type Group,
  type BufferAttribute,
} from "three";
import { useHeartBodyGeometry, tubeFromPoints } from "../heart3d/proceduralGeometry";

/* ─── Colour constants ──────────────────────────────────────────── */
const C_GLOW  = new Color("#FF5369");
const C_MID   = new Color("#E63950");
const C_DARK  = new Color("#8B1A28");
const C_CONN  = new Color("#FF8090");

/* ─── Particles ─────────────────────────────────────────────────── */
const N_PARTICLES = 240;

function Particles() {
  const ref = useRef<Points>(null);

  const { origPos, speeds, phases } = useMemo(() => {
    const p  = new Float32Array(N_PARTICLES * 3);
    const s  = new Float32Array(N_PARTICLES);
    const ph = new Float32Array(N_PARTICLES);
    for (let i = 0; i < N_PARTICLES; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph2 = Math.acos(2 * Math.random() - 1);
      const r  = 1.5 + Math.random() * 1.8;
      p[i*3]   = r * Math.sin(ph2) * Math.cos(th);
      p[i*3+1] = r * Math.cos(ph2);
      p[i*3+2] = r * Math.sin(ph2) * Math.sin(th);
      s[i]  = 0.07 + Math.random() * 0.12;
      ph[i] = Math.random() * Math.PI * 2;
    }
    return { origPos: p, speeds: s, phases: ph };
  }, []);

  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(origPos.slice(), 3));
    return g;
  }, [origPos]);

  const mat = useMemo(() => new PointsMaterial({
    color: C_MID, size: 0.025, transparent: true, opacity: 0.72,
    blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const arr = (ref.current.geometry.attributes.position as BufferAttribute).array as Float32Array;
    for (let i = 0; i < N_PARTICLES; i++) {
      const ox = origPos[i*3] ?? 0, oy = origPos[i*3+1] ?? 0, oz = origPos[i*3+2] ?? 0;
      const sp = speeds[i] ?? 0.1, ph = phases[i] ?? 0;
      const a  = t * sp + ph;
      arr[i*3]   = ox * Math.cos(a) - oz * Math.sin(a);
      arr[i*3+1] = oy + Math.sin(t * 0.25 + ph) * 0.045;
      arr[i*3+2] = ox * Math.sin(a) + oz * Math.cos(a);
    }
    (ref.current.geometry.attributes.position as BufferAttribute).needsUpdate = true;
  });

  return <points ref={ref} geometry={geo} material={mat} />;
}

/* ─── Neural connection lines ──────────────────────────────────── */
function NeuralLines() {
  const ref = useRef<LineSegments>(null);

  const { geo, mat } = useMemo(() => {
    const nodes: Vector3[] = [];
    for (let i = 0; i < 55; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const r  = 1.3 + Math.random() * 1.9;
      nodes.push(new Vector3(
        r * Math.sin(ph) * Math.cos(th),
        r * Math.cos(ph) * 0.85,
        r * Math.sin(ph) * Math.sin(th),
      ));
    }
    const pts: number[] = [];
    const thr = 1.15;
    for (let i = 0; i < nodes.length; i++) {
      const ni = nodes[i];
      if (!ni) continue;
      for (let j = i+1; j < nodes.length; j++) {
        const nj = nodes[j];
        if (!nj) continue;
        if (ni.distanceTo(nj) < thr) {
          pts.push(ni.x, ni.y, ni.z, nj.x, nj.y, nj.z);
        }
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    const m = new LineBasicMaterial({
      color: C_GLOW, transparent: true, opacity: 0.07,
      blending: AdditiveBlending, depthWrite: false,
    });
    return { geo: g, mat: m };
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.028;
  });

  return <lineSegments ref={ref} geometry={geo} material={mat} />;
}

/* ─── Wireframe heart meshes ────────────────────────────────────── */
function WireframeHeart() {
  const group   = useRef<Group>(null);
  const bodyGeo = useHeartBodyGeometry();

  /* ---- all geometry & material ---- */
  const assets = useMemo(() => {
    // Body wireframe
    const bodyEdges = new EdgesGeometry(bodyGeo, 15);
    const bodyEdges2 = new EdgesGeometry(bodyGeo, 15);

    // Chamber spheres + their edge geometry
    const chambers = [
      { r: 0.42, segs: 20, pos: [0.32,-0.05,0.22] as [number,number,number], scale: [0.72,0.85,0.70] as [number,number,number] },
      { r: 0.48, segs: 20, pos: [-0.18,-0.12,0.08] as [number,number,number], scale: [0.95,1.05,0.88] as [number,number,number] },
      { r: 0.32, segs: 16, pos: [-0.12,-0.72,0.10] as [number,number,number], scale: [0.55,0.75,0.55] as [number,number,number] },
      { r: 0.28, segs: 16, pos: [0.38,0.28,0.05] as [number,number,number],  scale: [0.90,0.75,0.85] as [number,number,number] },
      { r: 0.26, segs: 16, pos: [-0.30,0.32,-0.08] as [number,number,number], scale: [0.85,0.70,0.80] as [number,number,number] },
    ].map((c) => {
      const sg = new SphereGeometry(c.r, c.segs, c.segs);
      return { ...c, edges: new EdgesGeometry(sg, 20), surface: sg };
    });

    // Vessel wireframes
    const vesselDefs: [number,number,number][][] = [
      [[0.02,0.55,-0.05],[0.0,0.85,-0.08],[-0.05,1.05,-0.02],[-0.28,1.12,0.12],[-0.55,0.95,0.22],[-0.7,0.7,0.18]],
      [[0.08,0.48,0.12],[0.18,0.72,0.22],[0.35,0.88,0.28],[0.55,0.82,0.18]],
      [[0.28,0.35,0.08],[0.32,0.55,0.05],[0.3,0.85,0.0],[0.28,1.1,-0.02]],
      [[0.22,-0.15,0.05],[0.25,-0.45,0.02],[0.22,-0.75,0.0]],
    ];
    const vessels = vesselDefs.map((pts) =>
      new EdgesGeometry(tubeFromPoints(pts, pts === vesselDefs[0] ? 0.085 : pts === vesselDefs[1] ? 0.07 : 0.055, 32, 7), 25)
    );

    // Materials
    const matInner  = new MeshBasicMaterial({ color: C_DARK, transparent: true, opacity: 0.15, blending: AdditiveBlending, depthWrite: false });
    const matEdge1  = new LineBasicMaterial({ color: C_GLOW, transparent: true, opacity: 0.90, blending: AdditiveBlending, depthWrite: false });
    const matEdge2  = new LineBasicMaterial({ color: C_MID,  transparent: true, opacity: 0.28, blending: AdditiveBlending, depthWrite: false });
    const matVessel = new LineBasicMaterial({ color: C_CONN, transparent: true, opacity: 0.65, blending: AdditiveBlending, depthWrite: false });
    const matCham   = new LineBasicMaterial({ color: C_GLOW, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false });

    return { bodyEdges, bodyEdges2, chambers, vessels, matInner, matEdge1, matEdge2, matVessel, matCham };
  // bodyGeo reference is stable (useMemo in proceduralGeometry)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- pulse animation ---- */
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.rotation.y = t * 0.16;
    const beat = 1 + Math.sin(t * 1.1) * 0.022 + Math.sin(t * 2.2) * 0.007;
    group.current.scale.setScalar(beat);
  });

  return (
    <group ref={group}>
      <group rotation={[0.12, 0.55, -0.08]} scale={1.15} position={[0, -0.05, 0]}>
        {/* Body */}
        <mesh geometry={bodyGeo} material={assets.matInner} scale={[1.05,1,0.92]} position={[0.02,0,0.02]} />
        <lineSegments geometry={assets.bodyEdges}  material={assets.matEdge1} scale={[1.05,1,0.92]} position={[0.02,0,0.02]} />
        <lineSegments geometry={assets.bodyEdges2} material={assets.matEdge2} scale={[1.09,1.04,0.96]} position={[0.02,0,0.02]} />

        {/* Chambers */}
        {assets.chambers.map((c, i) => (
          <group key={i} position={c.pos} scale={c.scale}>
            <mesh geometry={c.surface} material={assets.matInner} />
            <lineSegments geometry={c.edges} material={assets.matCham} />
          </group>
        ))}

        {/* Vessels */}
        {assets.vessels.map((v, i) => (
          <lineSegments key={`v${i}`} geometry={v} material={assets.matVessel} />
        ))}
      </group>
    </group>
  );
}

/* ─── Camera intro ──────────────────────────────────────────────── */
function CameraIntro() {
  const { camera } = useThree();
  const t = useRef(0);
  const done = useRef(false);
  useEffect(() => { camera.position.set(0, 0.3, 7); camera.lookAt(0, 0, 0); }, [camera]);
  useFrame((_, delta) => {
    if (done.current) return;
    t.current = Math.min(t.current + delta / 2.8, 1);
    const e = 1 - Math.pow(1 - t.current, 3);
    camera.position.z = 7 + (4.5 - 7) * e;
    if (t.current >= 1) done.current = true;
  });
  return null;
}

/* ─── Error boundary ────────────────────────────────────────────── */
class WebGLErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode; onFail: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ─── Static SVG fallback ───────────────────────────────────────── */
export function StaticHeartFallback({ size = 420 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none"
      style={{ opacity: 0.88 }} aria-label="Wireframe cardiac visualization">
      <defs>
        <radialGradient id="hg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF5369" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#E63950" stopOpacity="0" />
        </radialGradient>
        <filter id="bl"><feGaussianBlur stdDeviation="1.5" /></filter>
      </defs>
      <circle cx="100" cy="105" r="68" fill="url(#hg)" />
      {/* Heart silhouette */}
      <path d="M100 158C60 130 28 108 28 80c0-20 16-32 32-32 12 0 24 8 40 24 16-16 28-24 40-24 16 0 32 12 32 32 0 28-32 50-72 78Z"
        stroke="#E63950" strokeWidth="1.1" fill="none" />
      <path d="M100 158C60 130 28 108 28 80c0-20 16-32 32-32 12 0 24 8 40 24 16-16 28-24 40-24 16 0 32 12 32 32 0 28-32 50-72 78Z"
        stroke="#FF5369" strokeWidth="2" fill="none" filter="url(#bl)" opacity="0.4" />
      {/* Internal lines */}
      <path d="M100 72v86M60 60c8 20 20 40 40 50M140 60c-8 20-20 40-40 50M28 80c24 0 44 12 72 30M172 80c-24 0-44 12-72 30" stroke="#E63950" strokeWidth="0.4" opacity="0.45" />
      {/* Aorta */}
      <path d="M97 70c-2-10-6-18-10-22M87 48c-5-4-2-10 6-8" stroke="#FF8090" strokeWidth="0.9" fill="none" opacity="0.7" />
      {/* Pulmonary */}
      <path d="M105 68c5-10 12-16 18-19" stroke="#FF8090" strokeWidth="0.8" fill="none" opacity="0.6" />
      {/* Nodes */}
      {[[100,70],[60,60],[140,60],[28,80],[172,80],[100,158],[87,48],[120,49]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="2.2" fill="#FF5369" opacity="0.85" />
      ))}
      {/* Grid */}
      {[70,85,100,115,130,145].map(y=>(
        <line key={y} x1="28" y1={y} x2="172" y2={y} stroke="#E63950" strokeWidth="0.2" opacity="0.12"/>
      ))}
      {/* Particles */}
      {[[35,55,0.5],[165,58,0.5],[22,105,0.45],[178,100,0.45],[45,152,0.4],[158,148,0.4],[88,30,0.5],[114,32,0.5]].map(([cx,cy,o],i)=>(
        <circle key={`p${i}`} cx={cx} cy={cy} r="1.4" fill="#E63950" opacity={o} />
      ))}
    </svg>
  );
}

/* ─── Main exported component ───────────────────────────────────── */
export interface WireframeHeartSceneProps {
  className?: string;
  style?: React.CSSProperties;
}

function WireframeHeartSceneInner({ className, style }: WireframeHeartSceneProps) {
  const [failed, setFailed] = useState(false);
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const h = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);

  const fallback = (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"100%", height:"100%" }}>
      <StaticHeartFallback size={420} />
    </div>
  );

  if (failed || reduceMotion) {
    return <div className={className} style={{ display:"flex", alignItems:"center", justifyContent:"center", ...style }}>{fallback}</div>;
  }

  return (
    <div className={className} style={style}>
      <WebGLErrorBoundary fallback={fallback} onFail={() => setFailed(true)}>
        <Canvas
          style={{ width:"100%", height:"100%" }}
          camera={{ position:[0,0.3,4.5], fov:42, near:0.1, far:40 }}
          dpr={[1, Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.75)]}
          gl={{ antialias: true, alpha: true, powerPreference:"high-performance" }}
          onCreated={({ gl }) => gl.setClearColor("#05070B", 0)}
          frameloop={visible ? "always" : "never"}
        >
          <CameraIntro />
          <ambientLight intensity={0.04} />
          <pointLight position={[0,-2,1]}    color="#8B1A28" intensity={2.2} distance={8} />
          <pointLight position={[2,1,2.5]}   color="#FF5369" intensity={1.6} distance={7} />
          <pointLight position={[-2,2,-2]}   color="#3B1A2A" intensity={1.0} distance={6} />
          <pointLight position={[0,0,2]}     color="#FF2040" intensity={0.8} distance={5} />

          <WireframeHeart />
          <Particles />
          <NeuralLines />

          <OrbitControls enablePan={false} enableZoom={false}
            enableRotate={!reduceMotion} autoRotate={false}
            target={[0,0,0]} makeDefault />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}

export const WireframeHeartScene = memo(WireframeHeartSceneInner);
