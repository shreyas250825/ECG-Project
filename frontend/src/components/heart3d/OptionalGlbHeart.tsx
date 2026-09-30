import { useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { materialForState } from "./heartMaterials";
import { pulseIntervalFromHr, pulseScale, rPeakBoostDecay } from "./heartAnimations";
import type { CardiacVisualizationState, VisualizationMode } from "./types";
import { HEART_GLB_URL } from "./assetPaths";

type Props = {
  viz: CardiacVisualizationState;
  mode: VisualizationMode;
  paused: boolean;
  lastRPeakMs: number | null;
};

/**
 * Licensed/open GLB heart. Only mount after confirming the asset exists.
 * See docs/3d-heart-assets.md.
 */
export function OptionalGlbHeart({ viz, mode, paused, lastRPeakMs }: Props) {
  const group = useRef<Group>(null);
  const { scene } = useGLTF(HEART_GLB_URL);
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
    <group ref={group} dispose={null}>
      <primitive object={scene.clone()} scale={1.2} position={[0, -0.3, 0]} />
    </group>
  );
}
