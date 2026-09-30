import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFBX, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Box3,
  Color,
  DoubleSide,
  Mesh,
  MeshPhysicalMaterial,
  SRGBColorSpace,
  Vector3,
  type Group,
  type Object3D,
} from "three";
import { REALISTIC_HEART } from "./assetPaths";
import { pulseIntervalFromHr, pulseScale, rPeakBoostDecay } from "./heartAnimations";
import { materialForState } from "./heartMaterials";
import type { CardiacVisualizationState, VisualizationMode } from "./types";

type Props = {
  viz: CardiacVisualizationState;
  mode: VisualizationMode;
  paused: boolean;
  lastRPeakMs: number | null;
};

const TARGET_SIZE = 2.15;

function fitAndCenter(root: Object3D) {
  const box = new Box3().setFromObject(root);
  const size = new Vector3();
  const center = new Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const s = TARGET_SIZE / maxDim;
  root.scale.setScalar(s);
  root.position.set(-center.x * s, -center.y * s + 0.05, -center.z * s);
}

/**
 * User-supplied realistic anatomical heart (FBX + PBR maps).
 * Visualization only — not patient-specific / not from ECG.
 */
export function RealisticHeart({ viz, mode, paused, lastRPeakMs }: Props) {
  const pulse = useRef<Group>(null);
  const fbx = useFBX(REALISTIC_HEART.fbx);
  const [baseColor, normalMap, roughnessMap, metalnessMap] = useTexture([
    REALISTIC_HEART.baseColor,
    REALISTIC_HEART.normal,
    REALISTIC_HEART.roughness,
    REALISTIC_HEART.metalness,
  ]);

  const preset = materialForState(viz.vizState, mode);
  const interval = pulseIntervalFromHr(viz.heartRate);

  const scene = useMemo(() => fbx.clone(true), [fbx]);

  useLayoutEffect(() => {
    if (!baseColor || !normalMap || !roughnessMap || !metalnessMap) return;

    baseColor.colorSpace = SRGBColorSpace;
    baseColor.needsUpdate = true;
    normalMap.needsUpdate = true;
    roughnessMap.needsUpdate = true;
    metalnessMap.needsUpdate = true;

    const tint = new Color(preset.color);
    // Keep textured look; subtle state tint via emissive only.
    scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mat = new MeshPhysicalMaterial({
        map: baseColor,
        normalMap,
        roughnessMap,
        metalnessMap,
        roughness: 0.45,
        metalness: 0.08,
        clearcoat: 0.35,
        clearcoatRoughness: 0.4,
        sheen: 0.2,
        sheenColor: new Color("#5c1018"),
        emissive: new Color(preset.emissive),
        emissiveIntensity: preset.emissiveIntensity * 0.85,
        side: DoubleSide,
      });
      // Soft multiply toward research-state color without washing out albedo.
      mat.color.copy(tint).lerp(new Color("#ffffff"), 0.72);
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material?.dispose?.();
      }
      obj.material = mat;
    });

    fitAndCenter(scene);
  }, [scene, baseColor, normalMap, roughnessMap, metalnessMap, preset.color, preset.emissive, preset.emissiveIntensity]);

  useEffect(() => {
    return () => {
      scene.traverse((obj) => {
        if (obj instanceof Mesh) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m?.dispose?.());
        }
      });
    };
  }, [scene]);

  useFrame(({ clock }) => {
    const g = pulse.current;
    if (!g) return;
    const boost = rPeakBoostDecay(performance.now(), lastRPeakMs);
    const s = pulseScale(clock.getElapsedTime(), interval, preset.pulseAmplitude, paused, boost);
    g.scale.setScalar(s);
  });

  return (
    <group ref={pulse} rotation={[0.05, 0.35, 0]}>
      <primitive object={scene} />
    </group>
  );
}

useFBX.preload(REALISTIC_HEART.fbx);
