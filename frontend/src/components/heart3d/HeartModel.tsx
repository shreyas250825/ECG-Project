import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { materialForState } from "./heartMaterials";
import { pulseIntervalFromHr, pulseScale, rPeakBoostDecay } from "./heartAnimations";
import {
  createEndocardiumMaterial,
  createFatMaterial,
  createMyocardiumMaterial,
  createVesselMaterial,
  tubeFromPoints,
  useHeartBodyGeometry,
} from "./proceduralGeometry";
import type { CardiacVisualizationState, VisualizationMode } from "./types";

type Props = {
  viz: CardiacVisualizationState;
  mode: VisualizationMode;
  paused: boolean;
  lastRPeakMs: number | null;
};

/**
 * High-detail procedural anatomical heart for research visualization.
 * Illustrative only — not patient-specific / not ECG-reconstructed /
 * not a redistributed proprietary Sketchfab mesh.
 */
function AnatomicalHeartMeshes({
  bodyColor,
  emissive,
  emissiveIntensity,
  showCutaway,
}: {
  bodyColor: string;
  emissive: string;
  emissiveIntensity: number;
  showCutaway: boolean;
}) {
  const bodyGeo = useHeartBodyGeometry();

  const mats = useMemo(
    () => ({
      myocardium: createMyocardiumMaterial(bodyColor, emissive, emissiveIntensity),
      fat: createFatMaterial(),
      artery: createVesselMaterial("#b03038", true),
      vein: createVesselMaterial("#4a5a78", false),
      endocardium: createEndocardiumMaterial(),
      pulmonary: createVesselMaterial("#8a4058", true),
    }),
    [bodyColor, emissive, emissiveIntensity],
  );

  const vessels = useMemo(
    () => ({
      aorta: tubeFromPoints(
        [
          [0.02, 0.55, -0.05],
          [0.0, 0.85, -0.08],
          [-0.05, 1.05, -0.02],
          [-0.28, 1.12, 0.12],
          [-0.55, 0.95, 0.22],
          [-0.7, 0.7, 0.18],
        ],
        0.085,
        72,
        12,
      ),
      pulmonaryTrunk: tubeFromPoints(
        [
          [0.08, 0.48, 0.12],
          [0.18, 0.72, 0.22],
          [0.35, 0.88, 0.28],
          [0.55, 0.82, 0.18],
        ],
        0.07,
        48,
        10,
      ),
      pulmonaryL: tubeFromPoints(
        [
          [0.35, 0.88, 0.28],
          [0.48, 0.95, 0.05],
          [0.58, 0.9, -0.15],
        ],
        0.045,
        32,
        8,
      ),
      svc: tubeFromPoints(
        [
          [0.28, 0.35, 0.08],
          [0.32, 0.55, 0.05],
          [0.3, 0.85, 0.0],
          [0.28, 1.1, -0.02],
        ],
        0.055,
        40,
        8,
      ),
      ivc: tubeFromPoints(
        [
          [0.22, -0.15, 0.05],
          [0.25, -0.45, 0.02],
          [0.22, -0.75, 0.0],
        ],
        0.06,
        28,
        8,
      ),
      coronary: tubeFromPoints(
        [
          [0.05, 0.5, 0.15],
          [0.25, 0.35, 0.35],
          [0.4, 0.05, 0.38],
          [0.28, -0.35, 0.32],
          [0.05, -0.55, 0.2],
        ],
        0.018,
        56,
        6,
      ),
      coronary2: tubeFromPoints(
        [
          [-0.02, 0.48, 0.12],
          [-0.22, 0.3, 0.32],
          [-0.35, -0.05, 0.3],
          [-0.25, -0.4, 0.22],
        ],
        0.015,
        48,
        6,
      ),
    }),
    [],
  );

  return (
    <group rotation={[0.12, 0.55, -0.08]} scale={1.15} position={[0, -0.05, 0]}>
      <mesh geometry={bodyGeo} material={mats.myocardium} castShadow receiveShadow scale={[1.05, 1, 0.92]} position={[0.02, 0, 0.02]} />

      <mesh material={mats.myocardium} castShadow position={[0.32, -0.05, 0.22]} scale={[0.72, 0.85, 0.7]} rotation={[0.1, -0.3, 0.15]}>
        <sphereGeometry args={[0.42, 48, 48]} />
      </mesh>
      <mesh material={mats.myocardium} castShadow position={[-0.18, -0.12, 0.08]} scale={[0.95, 1.05, 0.88]}>
        <sphereGeometry args={[0.48, 48, 48]} />
      </mesh>
      <mesh material={mats.myocardium} castShadow position={[-0.12, -0.72, 0.1]} scale={[0.55, 0.75, 0.55]} rotation={[0.2, 0, 0.15]}>
        <sphereGeometry args={[0.32, 32, 32]} />
      </mesh>
      <mesh material={mats.myocardium} castShadow position={[0.38, 0.28, 0.05]} scale={[0.9, 0.75, 0.85]}>
        <sphereGeometry args={[0.28, 40, 40]} />
      </mesh>
      <mesh material={mats.myocardium} castShadow position={[-0.3, 0.32, -0.08]} scale={[0.85, 0.7, 0.8]}>
        <sphereGeometry args={[0.26, 40, 40]} />
      </mesh>
      <mesh material={mats.myocardium} castShadow position={[0.48, 0.38, 0.18]} rotation={[0.4, 0.5, 0.2]} scale={[0.55, 0.35, 0.4]}>
        <sphereGeometry args={[0.22, 24, 24]} />
      </mesh>
      <mesh material={mats.myocardium} castShadow position={[-0.42, 0.4, 0.05]} rotation={[-0.3, -0.4, 0.1]} scale={[0.5, 0.32, 0.38]}>
        <sphereGeometry args={[0.2, 24, 24]} />
      </mesh>

      {(
        [
          [0.15, 0.45, 0.25, 0.09],
          [-0.05, 0.42, 0.22, 0.07],
          [0.35, 0.1, 0.35, 0.08],
          [-0.25, -0.2, 0.28, 0.07],
          [0.1, -0.35, 0.3, 0.06],
          [-0.15, 0.15, -0.25, 0.08],
          [0.2, 0.2, -0.2, 0.06],
        ] as const
      ).map(([x, y, z, r], i) => (
        <mesh key={i} material={mats.fat} castShadow position={[x, y, z]}>
          <sphereGeometry args={[r, 16, 16]} />
        </mesh>
      ))}

      <mesh geometry={vessels.aorta} material={mats.artery} castShadow />
      <mesh geometry={vessels.pulmonaryTrunk} material={mats.pulmonary} castShadow />
      <mesh geometry={vessels.pulmonaryL} material={mats.pulmonary} castShadow />
      <mesh geometry={vessels.svc} material={mats.vein} castShadow />
      <mesh geometry={vessels.ivc} material={mats.vein} castShadow />
      <mesh geometry={vessels.coronary} material={mats.artery} castShadow />
      <mesh geometry={vessels.coronary2} material={mats.artery} castShadow />

      {(
        [
          [-0.2, 1.14, 0.05, 0.035],
          [-0.32, 1.1, 0.12, 0.03],
          [-0.42, 1.02, 0.18, 0.028],
        ] as const
      ).map(([x, y, z, r], i) => (
        <mesh key={`br-${i}`} material={mats.artery} castShadow position={[x, y, z]}>
          <cylinderGeometry args={[r, r * 1.1, 0.12, 12]} />
        </mesh>
      ))}

      {showCutaway && (
        <group position={[0.15, -0.05, 0.35]} rotation={[0.1, -0.4, 0]}>
          <mesh material={mats.endocardium}>
            <boxGeometry args={[0.55, 0.7, 0.02]} />
          </mesh>
          <mesh position={[-0.08, -0.08, 0.02]}>
            <sphereGeometry args={[0.16, 24, 24]} />
            <meshPhysicalMaterial color="#3a0e14" roughness={0.8} />
          </mesh>
          <mesh position={[0.12, 0.12, 0.02]}>
            <sphereGeometry args={[0.12, 20, 20]} />
            <meshPhysicalMaterial color="#4a1218" roughness={0.8} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[-0.05 + i * 0.04, -0.02, 0.05]} rotation={[0.5, 0, i * 0.3]}>
              <cylinderGeometry args={[0.004, 0.004, 0.14, 4]} />
              <meshStandardMaterial color="#d8c8c0" roughness={0.5} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

function HeartModelInner({ viz, mode, paused, lastRPeakMs }: Props) {
  const group = useRef<Group>(null);
  const preset = materialForState(viz.vizState, mode);
  const interval = pulseIntervalFromHr(viz.heartRate);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const boost = rPeakBoostDecay(performance.now(), lastRPeakMs);
    const s = pulseScale(clock.getElapsedTime(), interval, preset.pulseAmplitude, paused, boost);
    g.scale.setScalar(s);
  });

  return (
    <group ref={group}>
      <AnatomicalHeartMeshes
        bodyColor={preset.color}
        emissive={preset.emissive}
        emissiveIntensity={preset.emissiveIntensity}
        showCutaway={mode === "anatomy"}
      />
    </group>
  );
}

export const HeartModel = memo(HeartModelInner);
