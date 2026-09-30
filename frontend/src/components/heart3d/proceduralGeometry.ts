import { useMemo } from "react";
import {
  CatmullRomCurve3,
  Color,
  DoubleSide,
  LatheGeometry,
  MeshPhysicalMaterial,
  TubeGeometry,
  Vector2,
  Vector3,
  type Material,
} from "three";

/** Deep myocardium red with wet clearcoat — illustrative, not patient-specific. */
export function createMyocardiumMaterial(baseHex: string, emissiveHex: string, emissiveIntensity: number) {
  return new MeshPhysicalMaterial({
    color: new Color(baseHex),
    emissive: new Color(emissiveHex),
    emissiveIntensity,
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.65,
    clearcoatRoughness: 0.28,
    sheen: 0.35,
    sheenColor: new Color("#5c1018"),
    sheenRoughness: 0.55,
    side: DoubleSide,
  });
}

export function createFatMaterial() {
  return new MeshPhysicalMaterial({
    color: "#c9a66b",
    roughness: 0.72,
    metalness: 0,
    clearcoat: 0.15,
    clearcoatRoughness: 0.6,
  });
}

export function createVesselMaterial(hex: string, artery: boolean) {
  return new MeshPhysicalMaterial({
    color: hex,
    roughness: artery ? 0.32 : 0.45,
    metalness: 0.04,
    clearcoat: 0.4,
    clearcoatRoughness: 0.35,
  });
}

export function createEndocardiumMaterial() {
  return new MeshPhysicalMaterial({
    color: "#6e1c28",
    roughness: 0.55,
    metalness: 0,
    side: DoubleSide,
  });
}

/** Classic anatomical heart silhouette lathed into a solid body. */
export function useHeartBodyGeometry() {
  return useMemo(() => {
    const pts: Vector2[] = [];
    const n = 64;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      // Profile from base (apex-ish at bottom of lathe) to base of great vessels.
      // Approximate anatomical outline rather than valentine heart.
      const y = -0.85 + t * 1.55;
      let r: number;
      if (t < 0.12) {
        r = 0.08 + t * 1.8;
      } else if (t < 0.45) {
        r = 0.32 + Math.sin(((t - 0.12) / 0.33) * Math.PI) * 0.38;
      } else if (t < 0.72) {
        r = 0.55 + Math.sin(((t - 0.45) / 0.27) * Math.PI) * 0.12;
      } else if (t < 0.9) {
        r = 0.42 - (t - 0.72) * 0.7;
      } else {
        r = 0.28 - (t - 0.9) * 0.9;
      }
      pts.push(new Vector2(Math.max(0.04, r), y));
    }
    const geo = new LatheGeometry(pts, 64);
    geo.computeVertexNormals();
    return geo;
  }, []);
}

export function tubeFromPoints(points: [number, number, number][], radius: number, tubular = 64, radial = 10) {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  return new TubeGeometry(curve, tubular, radius, radial, false);
}

export type HeartMatBag = {
  myocardium: Material;
  fat: Material;
  artery: Material;
  vein: Material;
  endocardium: Material;
  pulmonary: Material;
};
