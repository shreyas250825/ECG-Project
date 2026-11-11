/**
 * WireframeHeartScene — cinematic landing-page heart visualization.
 *
 * Uses the actual anatomical FBX heart model (Heart.fbx + PBR textures)
 * already present in the project at /models/realistic-human-heart/.
 *
 * Visual treatment applied to the real mesh surface:
 *  - Deep crimson inner surface (MeshBasicMaterial, additive)
 *  - WireframeGeometry overlay — ALL triangle edges → dense red mesh
 *  - Outer glow surface (BackSide, slightly scaled up)
 *  - Surface nodes sampled from the actual geometry
 *  - Background neural network lines + scattered particles
 *
 * The FBX is the same 16 MB anatomical asset used in the dashboard's
 * RealisticHeart component, so it is fully anatomically correct.
 */
import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useFBX } from "@react-three/drei";
import {
  AdditiveBlending,
  BackSide,
  Box3,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  FrontSide,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Vector3,
  WireframeGeometry,
  type BufferAttribute,
  type Group,
  type Object3D,
} from "three";

/* ─── Colour palette ────────────────────────────────────────────── */
const C_WIRE   = new Color("#D42840"); // primary wireframe edges
const C_BRIGHT = new Color("#FF6B7A"); // bright highlights / nodes
const C_FILL   = new Color("#5A0A16"); // deep inner glow fill
const C_GLOW   = new Color("#B01428"); // outer glow (BackSide)
const C_NEURAL = new Color("#FF3050"); // background neural lines

/* ─── Asset paths ────────────────────────────────────────────────── */
const FBX_PATH  = "/models/realistic-human-heart/Heart.fbx";

/* ══════════════════════════════════════════════════════════════════
   FIT + CENTER HELPER
   Scales the loaded FBX to a consistent target size and centers it.
══════════════════════════════════════════════════════════════════ */
const TARGET_SIZE = 2.2;

function fitAndCenter(root: Object3D) {
  const box    = new Box3().setFromObject(root);
  const size   = new Vector3();
  const center = new Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const s = TARGET_SIZE / maxDim;
  root.scale.setScalar(s);
  // Center + slight upward shift so apex sits at the bottom
  root.position.set(-center.x * s, -center.y * s + 0.05, -center.z * s);
}

/* ══════════════════════════════════════════════════════════════════
   EXTRACT MERGED WIREFRAME GEOMETRY
   Collects all Mesh geometries from the FBX scene, merges their
   world-space positions into a single BufferGeometry, then builds
   a WireframeGeometry for the crimson mesh overlay.
══════════════════════════════════════════════════════════════════ */
function extractWireframe(root: Object3D): {
  wireGeo: BufferGeometry;
  solidGeo: BufferGeometry;
  surfacePts: Float32Array;
} {
  const allPositions: number[] = [];

  root.updateWorldMatrix(true, true);

  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const geo = obj.geometry as BufferGeometry;
    if (!geo.attributes.position) return;

    const posAttr = geo.attributes.position as BufferAttribute;
    const count   = posAttr.count;
    const matWorld = obj.matrixWorld;

    // If indexed, unroll into non-indexed triangles
    if (geo.index) {
      const idx = geo.index;
      for (let i = 0; i < idx.count; i++) {
        const vi = idx.getX(i);
        const x  = posAttr.getX(vi);
        const y  = posAttr.getY(vi);
        const z  = posAttr.getZ(vi);
        const v  = new Vector3(x, y, z).applyMatrix4(matWorld);
        allPositions.push(v.x, v.y, v.z);
      }
    } else {
      for (let i = 0; i < count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);
        const v = new Vector3(x, y, z).applyMatrix4(matWorld);
        allPositions.push(v.x, v.y, v.z);
      }
    }
  });

  const posArr  = new Float32Array(allPositions);
  const solidGeo = new BufferGeometry();
  solidGeo.setAttribute("position", new Float32BufferAttribute(posArr, 3));
  solidGeo.computeVertexNormals();

  const wireGeo = new WireframeGeometry(solidGeo);

  // Sample ~300 surface points for the glowing node overlay
  const nNodes = 300;
  const step   = Math.max(1, Math.floor(posArr.length / 3 / nNodes));
  const nodePts: number[] = [];
  for (let i = 0; i < posArr.length / 3 && nodePts.length / 3 < nNodes; i += step) {
    nodePts.push(posArr[i * 3]!, posArr[i * 3 + 1]!, posArr[i * 3 + 2]!);
  }
  const surfacePts = new Float32Array(nodePts);

  return { wireGeo, solidGeo, surfacePts };
}

/* ══════════════════════════════════════════════════════════════════
   WIREFRAME HEART — loads the FBX and applies the visual treatment
══════════════════════════════════════════════════════════════════ */
function WireframeHeartMesh() {
  const fbxRaw = useFBX(FBX_PATH);
  const group  = useRef<Group>(null);
  const nodesRef = useRef<Points>(null);

  // Clone so we don't mutate the cached FBX
  const scene = useMemo(() => fbxRaw.clone(true), [fbxRaw]);

  const { wireLine, glowMeshes, nodePoints } = useMemo(() => {
    // Apply fit+center to the clone
    fitAndCenter(scene);

    // Replace all mesh materials with the crimson inner fill
    const matInner = new MeshBasicMaterial({
      color:       C_FILL,
      transparent: true,
      opacity:     0.72,
      blending:    AdditiveBlending,
      depthWrite:  false,
      side:        FrontSide,
    });

    const matGlow = new MeshBasicMaterial({
      color:       C_GLOW,
      transparent: true,
      opacity:     0.18,
      blending:    AdditiveBlending,
      depthWrite:  false,
      side:        BackSide,
    });

    const innerMeshes: { geo: BufferGeometry; mat: MeshBasicMaterial }[] = [];
    const glowMeshes:  { geo: BufferGeometry; mat: MeshBasicMaterial }[] = [];

    scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      const geo = obj.geometry as BufferGeometry;

      // Replace visible material with inner fill
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material?.dispose?.();
      obj.material = matInner.clone();
      (obj.material as MeshBasicMaterial).side = FrontSide;

      innerMeshes.push({ geo, mat: obj.material as MeshBasicMaterial });
      glowMeshes.push({ geo, mat: matGlow.clone() });
    });

    // Extract merged wireframe from the fitted scene
    const { wireGeo, surfacePts } = extractWireframe(scene);

    const matWire = new LineBasicMaterial({
      color:       C_WIRE,
      transparent: true,
      opacity:     0.72,
      blending:    AdditiveBlending,
      depthWrite:  false,
    });

    const wireLine = new LineSegments(wireGeo, matWire);

    // Surface nodes
    const nodeGeo = new BufferGeometry();
    nodeGeo.setAttribute("position", new Float32BufferAttribute(surfacePts, 3));
    const nodeMat = new PointsMaterial({
      color:          C_BRIGHT,
      size:           0.018,
      transparent:    true,
      opacity:        0.90,
      blending:       AdditiveBlending,
      depthWrite:     false,
      sizeAttenuation: true,
    });
    const nodePoints = new Points(nodeGeo, nodeMat);

    return { wireLine, glowMeshes, nodePoints };
  }, [scene]);

  /* Subtle animation: slow rotation + gentle float */
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.rotation.y = t * 0.07;
    group.current.position.y = Math.sin(t * 0.38) * 0.04;
    const beat = 1 + Math.sin(t * 1.1) * 0.012;
    group.current.scale.setScalar(beat);

    // Subtle node twinkle
    if (nodesRef.current) {
      const m = nodesRef.current.material as PointsMaterial;
      m.opacity = 0.70 + Math.sin(t * 2.1) * 0.20;
    }

    // Subtle wireframe pulse — slight brightness variation
    const wm = wireLine.material as LineBasicMaterial;
    wm.opacity = 0.65 + Math.sin(t * 1.4 + 0.5) * 0.12;
  });

  return (
    <group ref={group}>
      {/* Original FBX scene — crimson inner fill materials */}
      <primitive object={scene} />

      {/* Glow surfaces (BackSide, slightly enlarged) */}
      {glowMeshes.map(({ geo, mat }, i) => (
        <mesh key={`glow${i}`} geometry={geo} material={mat} scale={1.025} />
      ))}

      {/* Dense wireframe overlay — extracted from actual anatomy */}
      <primitive object={wireLine} />

      {/* Surface nodes */}
      <primitive ref={nodesRef} object={nodePoints} />
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BACKGROUND PARTICLES
══════════════════════════════════════════════════════════════════ */
const N_BG = 120;
function BackgroundParticles() {
  const ref = useRef<Points>(null);

  const { origPos, phases } = useMemo(() => {
    const p  = new Float32Array(N_BG * 3);
    const ph = new Float32Array(N_BG);
    for (let i = 0; i < N_BG; i++) {
      const th  = Math.random() * Math.PI * 2;
      const ph2 = Math.acos(2 * Math.random() - 1);
      const r   = 1.8 + Math.random() * 2.4;
      p[i*3]   = r * Math.sin(ph2) * Math.cos(th);
      p[i*3+1] = r * Math.cos(ph2) * 0.9;
      p[i*3+2] = r * Math.sin(ph2) * Math.sin(th);
      ph[i] = Math.random() * Math.PI * 2;
    }
    return { origPos: p, phases: ph };
  }, []);

  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(origPos.slice(), 3));
    return g;
  }, [origPos]);

  const mat = useMemo(() => new PointsMaterial({
    color: C_WIRE, size: 0.016, transparent: true, opacity: 0.45,
    blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t   = clock.getElapsedTime();
    const arr = (ref.current.geometry.attributes.position as BufferAttribute).array as Float32Array;
    for (let i = 0; i < N_BG; i++) {
      arr[i*3+1] = (origPos[i*3+1] ?? 0) + Math.sin(t * 0.3 + (phases[i] ?? 0)) * 0.06;
    }
    (ref.current.geometry.attributes.position as BufferAttribute).needsUpdate = true;
  });

  return <points ref={ref} geometry={geo} material={mat} />;
}

/* ══════════════════════════════════════════════════════════════════
   BACKGROUND NEURAL LINES (subtle — heart stays focal point)
══════════════════════════════════════════════════════════════════ */
function BackgroundNeural() {
  const ref = useRef<LineSegments>(null);

  const { geo, mat } = useMemo(() => {
    const nodes: Vector3[] = [];
    for (let i = 0; i < 48; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const r  = 1.6 + Math.random() * 2.2;
      nodes.push(new Vector3(
        r * Math.sin(ph) * Math.cos(th),
        r * Math.cos(ph) * 0.75,
        r * Math.sin(ph) * Math.sin(th),
      ));
    }
    const pts: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const ni = nodes[i]; if (!ni) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        const nj = nodes[j]; if (!nj) continue;
        if (ni.distanceTo(nj) < 1.4) pts.push(ni.x, ni.y, ni.z, nj.x, nj.y, nj.z);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    // Kept deliberately dim so heart stays focal
    const m = new LineBasicMaterial({
      color: C_NEURAL, transparent: true, opacity: 0.04,
      blending: AdditiveBlending, depthWrite: false,
    });
    return { geo: g, mat: m };
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.018;
  });

  return <lineSegments ref={ref} geometry={geo} material={mat} />;
}

/* ══════════════════════════════════════════════════════════════════
   LOADING PLACEHOLDER — shown while FBX streams in
══════════════════════════════════════════════════════════════════ */
function HeartPlaceholder() {
  const ref = useRef<Points>(null);
  const geo = useMemo(() => {
    const pts = new Float32Array(240);
    for (let i = 0; i < 80; i++) {
      const th  = Math.random() * Math.PI * 2;
      const ph2 = Math.acos(2 * Math.random() - 1);
      const r   = 0.6 + Math.random() * 0.5;
      pts[i*3]   = r * Math.sin(ph2) * Math.cos(th);
      pts[i*3+1] = r * Math.cos(ph2);
      pts[i*3+2] = r * Math.sin(ph2) * Math.sin(th);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.3;
      (ref.current.material as PointsMaterial).opacity =
        0.3 + Math.sin(clock.getElapsedTime() * 2) * 0.2;
    }
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color={C_WIRE} size={0.03} transparent opacity={0.4}
        blending={AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ERROR BOUNDARY
══════════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════════
   STATIC SVG FALLBACK — used when WebGL unavailable / reduced motion
══════════════════════════════════════════════════════════════════ */
export function StaticHeartFallback({ size = 420 }: { size?: number }) {
  const meshLines: React.ReactElement[] = [];
  const W = 220, H = 240;

  const pts: [number, number][] = [];
  for (let row = 0; row <= 24; row++) {
    for (let col = 0; col <= 26; col++) {
      const px = 18 + col * 7.1;
      const py = 46 + row * 6.8;
      const cx = 110, cy = 125;
      const dx = (px - cx) / 78, dy = (py - cy) / 84;
      if (dx*dx + dy*dy < 1.0 && py < 185 && py > 50) {
        const notch = Math.abs(px - cx) < 14 && py < 68;
        if (!notch) pts.push([px, py]);
      }
    }
  }

  let key = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const pi = pts[i]!, pj = pts[j]!;
      const d = Math.hypot(pi[0]-pj[0], pi[1]-pj[1]);
      if (d < 10.5) {
        meshLines.push(
          <line key={key++}
            x1={pi[0]} y1={pi[1]} x2={pj[0]} y2={pj[1]}
            stroke="#D42840" strokeWidth="0.4" opacity={0.5 - d * 0.025} />
        );
      }
    }
  }

  return (
    <svg width={size} height={size * H / W} viewBox={`0 0 ${W} ${H}`} fill="none"
      style={{ opacity: 0.92 }} aria-label="Wireframe cardiac visualization">
      <defs>
        <radialGradient id="hgf2" cx="50%" cy="52%" r="45%">
          <stop offset="0%" stopColor="#B01428" stopOpacity="0.72"/>
          <stop offset="60%" stopColor="#7A1020" stopOpacity="0.38"/>
          <stop offset="100%" stopColor="#D42840" stopOpacity="0"/>
        </radialGradient>
        <filter id="blf2"><feGaussianBlur stdDeviation="2.8"/></filter>
        <clipPath id="hClip2">
          <path d="M110 184C57 150 20 120 20 88c0-26 20-42 40-42 16 0 32 12 50 34 18-22 34-34 50-34 20 0 40 16 40 42 0 32-38 62-90 96Z"/>
        </clipPath>
      </defs>
      <ellipse cx="110" cy="124" rx="82" ry="78" fill="url(#hgf2)"/>
      <path d="M110 184C57 150 20 120 20 88c0-26 20-42 40-42 16 0 32 12 50 34 18-22 34-34 50-34 20 0 40 16 40 42 0 32-38 62-90 96Z"
        fill="rgba(90,10,22,0.52)"/>
      <g clipPath="url(#hClip2)">{meshLines}</g>
      <path d="M110 184C57 150 20 120 20 88c0-26 20-42 40-42 16 0 32 12 50 34 18-22 34-34 50-34 20 0 40 16 40 42 0 32-38 62-90 96Z"
        stroke="#FF5369" strokeWidth="2.5" fill="none" filter="url(#blf2)" opacity="0.5"/>
      <path d="M110 184C57 150 20 120 20 88c0-26 20-42 40-42 16 0 32 12 50 34 18-22 34-34 50-34 20 0 40 16 40 42 0 32-38 62-90 96Z"
        stroke="#FF8090" strokeWidth="1.0" fill="none"/>
      {/* Aorta */}
      <path d="M103 46c-2-11-7-20-14-27" stroke="#FF8090" strokeWidth="12" strokeLinecap="round" fill="none" opacity="0.18"/>
      <path d="M103 46c-2-11-7-20-14-27" stroke="#FF8090" strokeWidth="5.5" strokeLinecap="round" fill="none" opacity="0.52"/>
      <path d="M89 19c-5-5-2-11 6-9" stroke="#FF8090" strokeWidth="5.5" strokeLinecap="round" fill="none" opacity="0.52"/>
      {/* Pulmonary */}
      <path d="M118 44c7-11 16-19 25-22" stroke="#FF8090" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.18"/>
      <path d="M118 44c7-11 16-19 25-22" stroke="#FF8090" strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.46"/>
      {/* SVC */}
      <path d="M136 55c5-9 8-18 7-27" stroke="#FF8090" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.14"/>
      <path d="M136 55c5-9 8-18 7-27" stroke="#FF8090" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.38"/>
      {/* Nodes */}
      {([[110,86],[64,74],[156,74],[20,88],[200,88],[110,184],[89,19],[143,22],[136,28]] as [number,number][]).map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="2.8" fill="#FF5369" opacity="0.9"/>
      ))}
      {([[30,46,0.4],[190,48,0.4],[15,124,0.38],[206,120,0.38],[42,178,0.35],[180,176,0.35]] as [number,number,number][]).map(([x,y,o],i) => (
        <circle key={`p${i}`} cx={x} cy={y} r="1.7" fill="#D42840" opacity={o}/>
      ))}
      {([[30,46,64,74],[190,48,156,74],[15,124,20,88],[206,120,200,88],[42,178,20,160],[180,176,200,160]] as [number,number,number,number][]).map(([x1,y1,x2,y2],i) => (
        <line key={`nl${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#D42840" strokeWidth="0.35" opacity="0.2"/>
      ))}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════════ */
export interface WireframeHeartSceneProps {
  className?: string;
  style?: React.CSSProperties;
}

function WireframeHeartSceneInner({ className, style }: WireframeHeartSceneProps) {
  const [failed, setFailed]   = useState(false);
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const h = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);

  const fallback = (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
      width:"100%", height:"100%" }}>
      <StaticHeartFallback size={380} />
    </div>
  );

  if (failed || reduceMotion) {
    return (
      <div className={className}
        style={{ display:"flex", alignItems:"center", justifyContent:"center", ...style }}>
        {fallback}
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      <WebGLErrorBoundary fallback={fallback} onFail={() => setFailed(true)}>
        <Canvas
          style={{ width:"100%", height:"100%" }}
          camera={{ position:[0.3, 0.2, 4.0], fov:38, near:0.05, far:40 }}
          dpr={[1, Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.75)]}
          gl={{ antialias:true, alpha:true, powerPreference:"high-performance" }}
          onCreated={({ gl }) => gl.setClearColor("#05070B", 0)}
          frameloop={visible ? "always" : "never"}
        >
          {/* Lighting: crimson key from front-left + warm fill + cool rim */}
          <ambientLight intensity={0.04} color="#200608" />
          <pointLight position={[-1.5, 2.0, 3.0]} color="#FF3050" intensity={3.5} distance={10} />
          <pointLight position={[2.0, 0.0, 2.0]}  color="#C01030" intensity={2.0} distance={8}  />
          <pointLight position={[0.0, -2.0, 1.5]} color="#8B0010" intensity={1.2} distance={7}  />
          <pointLight position={[-2.5, 1.0, 1.0]} color="#FF2040" intensity={1.5} distance={8}  />
          {/* Subtle white top-left highlight matching reference */}
          <directionalLight position={[-2, 3, 2]} color="#FFFFFF" intensity={0.22} />

          {/* Actual anatomical FBX heart with wireframe treatment */}
          <Suspense fallback={<HeartPlaceholder />}>
            <WireframeHeartMesh />
          </Suspense>

          <BackgroundParticles />
          <BackgroundNeural />

          <OrbitControls
            enablePan={false}
            enableZoom={false}
            enableRotate={!reduceMotion}
            autoRotate={false}
            target={[0, 0, 0]}
            makeDefault
          />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}

export const WireframeHeartScene = memo(WireframeHeartSceneInner);

// Preload the FBX so it starts streaming immediately on page load
useFBX.preload(FBX_PATH);
