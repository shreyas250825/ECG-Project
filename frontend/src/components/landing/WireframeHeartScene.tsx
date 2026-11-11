/**
 * WireframeHeartScene — cinematic landing-page heart visualization.
 *
 * ARCHITECTURE: Anatomically modeled heart using SDF union of cardiac lobes.
 *
 * The heart is built from explicit anatomical components:
 *   - Left ventricle: dominant elongated teardrop (main cardiac mass)
 *   - Right ventricle: crescent-shaped anterior mass wrapping the LV
 *   - Left atrium: upper-posterior rounded mass
 *   - Right atrium: upper-right rounded mass
 *   - Aorta: arch emerging left from apex of base
 *   - Pulmonary trunk: rising right/anterior
 *   - Superior/Inferior vena cava: flanking right side
 *
 * We use a marching-cubes-inspired approach: sample the SDF on a 3-D grid,
 * then triangulate using a full 256-case lookup table. This produces a smooth
 * continuous surface with correct anatomical silhouette.
 *
 * WireframeGeometry is applied to the resulting mesh to show ALL triangle edges,
 * producing the dense crimson triangular mesh of the reference image.
 */
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  FrontSide,
  LineBasicMaterial,
  LineSegments,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Vector3,
  WireframeGeometry,
  type BufferAttribute,
  type Group,
} from "three";

/* ─── Colour palette ────────────────────────────────────────────── */
const C_BRIGHT = new Color("#FF6B7A");
const C_MID    = new Color("#E63950");
const C_DARK   = new Color("#C01830");
const C_FILL   = new Color("#6B0F1A");
const C_NEURAL = new Color("#FF4060");

/* ══════════════════════════════════════════════════════════════════
   SDF PRIMITIVES & COMBINATORS
   All coordinates in heart-space (roughly -1 to 1 per axis)
══════════════════════════════════════════════════════════════════ */

/** Signed distance to a sphere */
function sdSphere(x: number, y: number, z: number, cx: number, cy: number, cz: number, r: number): number {
  const dx = x - cx, dy = y - cy, dz = z - cz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

/** Signed distance to an ellipsoid (anisotropic scaling) */
function sdEllipsoid(
  x: number, y: number, z: number,
  cx: number, cy: number, cz: number,
  rx: number, ry: number, rz: number
): number {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  const dz = (z - cz) / rz;
  const k = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return (k - 1) * Math.min(rx, ry, rz);
}

/** SDF union (smooth blend) using polynomial smooth min */
function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * h * k * (1 / 6);
}

/* ══════════════════════════════════════════════════════════════════
   CARDIAC SDF
   
   Returns the signed distance to the heart surface at (x,y,z).
   Negative inside, positive outside.
   
   Coordinate frame:
     +Y = apex-to-base (up)
     +X = right (from patient's perspective, so anatomical left)
     +Z = anterior (toward viewer)
   
   Anatomy placed in normalized units (~0.9 total radius):
══════════════════════════════════════════════════════════════════ */
function heartSDF(x: number, y: number, z: number): number {
  // ── Left ventricle ──────────────────────────────────────────────
  // Dominant elongated teardrop: tall, slightly tilted apex-down-left
  // Apex at bottom, base at top right. Tilt 15° clockwise around Z.
  const lvTilt = 0.26; // radians, apex toward patient's right (our +x)
  const cosLV = Math.cos(-lvTilt), sinLV = Math.sin(-lvTilt);
  const lvx = (x) * cosLV - (y) * sinLV;
  const lvy = (x) * sinLV + (y) * cosLV;
  // Teardrop: tall ellipsoid, narrowed at bottom (apex)
  const lvApexPull = 0.18 * Math.max(0, (-lvy - 0.1)); // narrow the apex end
  const dLV = sdEllipsoid(lvx, lvy, z, 0, 0.08, 0, 0.52 - lvApexPull, 0.72, 0.46) + lvApexPull * 0.6;

  // ── Right ventricle ─────────────────────────────────────────────
  // Anterior crescent wrapping the left side of the LV.
  // Modelled as a wider but shallower ellipsoid, offset anteriorly and to the right.
  const dRV = sdEllipsoid(x, y, z, 0.28, 0.06, 0.18, 0.44, 0.60, 0.36);

  // Blend the two ventricles smoothly
  const dVentricles = smin(dLV, dRV, 0.28);

  // ── Left atrium ─────────────────────────────────────────────────
  // Upper-posterior, sits behind the aortic root
  const dLA = sdEllipsoid(x, y, z, -0.14, 0.52, -0.22, 0.32, 0.26, 0.28);

  // ── Right atrium ────────────────────────────────────────────────
  // Upper-right side, slightly anterior
  const dRA = sdEllipsoid(x, y, z, 0.38, 0.46, 0.08, 0.28, 0.26, 0.24);

  // Blend atria into ventricles
  const dAtria = smin(dLA, dRA, 0.18);
  const dChambers = smin(dVentricles, dAtria, 0.22);

  return dChambers;
}

/** SDF for the great vessels (aorta + pulmonary trunk only, as tubes) */
function vesselSDF(x: number, y: number, z: number): number {
  // Aorta: emerges from center-left of base, arches left+posterior
  // Model as a chain of overlapping spheres (capsule approximation)
  const aortaPoints: [number,number,number,number][] = [
    [-0.04, 0.72, -0.02, 0.13],
    [-0.08, 0.90,  0.00, 0.12],
    [-0.16, 1.05,  0.04, 0.11],
    [-0.30, 1.12,  0.10, 0.11],
    [-0.46, 1.08,  0.16, 0.10],
    [-0.58, 0.96,  0.18, 0.10],
  ];

  // Pulmonary trunk: emerges anterior-right, then arches right
  const ptPoints: [number,number,number,number][] = [
    [ 0.14, 0.68,  0.14, 0.11],
    [ 0.22, 0.84,  0.20, 0.10],
    [ 0.36, 0.94,  0.22, 0.10],
    [ 0.50, 0.90,  0.18, 0.09],
    [ 0.60, 0.80,  0.12, 0.09],
  ];

  // SVC: right side, going up
  const svcPoints: [number,number,number,number][] = [
    [ 0.42, 0.62,  0.04, 0.09],
    [ 0.44, 0.80,  0.02, 0.08],
    [ 0.44, 1.00,  0.00, 0.08],
    [ 0.42, 1.18, -0.02, 0.08],
  ];

  // IVC: right side, going down
  const ivcPoints: [number,number,number,number][] = [
    [ 0.38, 0.30,  0.02, 0.09],
    [ 0.38, 0.06,  0.02, 0.09],
    [ 0.36,-0.18,  0.02, 0.09],
  ];

  let d = Infinity;

  function capsuleChain(pts: [number,number,number,number][]) {
    for (const [px, py, pz, r] of pts) {
      const s = sdSphere(x, y, z, px, py, pz, r);
      d = smin(d, s, 0.06);
    }
  }

  capsuleChain(aortaPoints);
  capsuleChain(ptPoints);
  capsuleChain(svcPoints);
  capsuleChain(ivcPoints);

  return d;
}

/** Full heart+vessel SDF */
function fullHeartSDF(x: number, y: number, z: number): number {
  const dHeart   = heartSDF(x, y, z);
  const dVessels = vesselSDF(x, y, z);
  return smin(dHeart, dVessels, 0.12);
}

/* ══════════════════════════════════════════════════════════════════
   MARCHING CUBES — full 256-case lookup
   
   Triangulates an isosurface from a scalar field sampled on a grid.
   Uses the standard Lorensen & Cline table (1987).
══════════════════════════════════════════════════════════════════ */

// Edge table: which edges are crossed for each cube configuration (256 entries)
const edgeTable = new Uint16Array([
  0x000,0x109,0x203,0x30a,0x406,0x50f,0x605,0x70c,
  0x80c,0x905,0xa0f,0xb06,0xc0a,0xd03,0xe09,0xf00,
  0x190,0x099,0x393,0x29a,0x596,0x49f,0x795,0x69c,
  0x99c,0x895,0xb9f,0xa96,0xd9a,0xc93,0xf99,0xe90,
  0x230,0x339,0x033,0x13a,0x636,0x73f,0x435,0x53c,
  0xa3c,0xb35,0x83f,0x936,0xe3a,0xf33,0xc39,0xd30,
  0x3a0,0x2a9,0x1a3,0x0aa,0x7a6,0x6af,0x5a5,0x4ac,
  0xbac,0xaa5,0x9af,0x8a6,0xfaa,0xea3,0xda9,0xca0,
  0x460,0x569,0x663,0x76a,0x066,0x16f,0x265,0x36c,
  0xc6c,0xd65,0xe6f,0xf66,0x86a,0x963,0xa69,0xb60,
  0x5f0,0x4f9,0x7f3,0x6fa,0x1f6,0x0ff,0x3f5,0x2fc,
  0xdfc,0xcf5,0xfff,0xef6,0x9fa,0x8f3,0xbf9,0xaf0,
  0x650,0x759,0x453,0x55a,0x256,0x35f,0x055,0x15c,
  0xe5c,0xf55,0xc5f,0xd56,0xa5a,0xb53,0x859,0x950,
  0x7c0,0x6c9,0x5c3,0x4ca,0x3c6,0x2cf,0x1c5,0x0cc,
  0xfcc,0xec5,0xdcf,0xcc6,0xbca,0xac3,0x9c9,0x8c0,
  0x8c0,0x9c9,0xac3,0xbca,0xcc6,0xdcf,0xec5,0xfcc,
  0x0cc,0x1c5,0x2cf,0x3c6,0x4ca,0x5c3,0x6c9,0x7c0,
  0x950,0x859,0xb53,0xa5a,0xd56,0xc5f,0xf55,0xe5c,
  0x15c,0x055,0x35f,0x256,0x55a,0x453,0x759,0x650,
  0xaf0,0xbf9,0x8f3,0x9fa,0xef6,0xfff,0xcf5,0xdfc,
  0x2fc,0x3f5,0x0ff,0x1f6,0x6fa,0x7f3,0x4f9,0x5f0,
  0xb60,0xa69,0x963,0x86a,0xf66,0xe6f,0xd65,0xc6c,
  0x36c,0x265,0x16f,0x066,0x76a,0x663,0x569,0x460,
  0xca0,0xda9,0xea3,0xfaa,0x8a6,0x9af,0xaa5,0xbac,
  0x4ac,0x5a5,0x6af,0x7a6,0x0aa,0x1a3,0x2a9,0x3a0,
  0xd30,0xc39,0xf33,0xe3a,0x936,0x83f,0xb35,0xa3c,
  0x53c,0x435,0x73f,0x636,0x13a,0x033,0x339,0x230,
  0xe90,0xf99,0xc93,0xd9a,0xa96,0xb9f,0x895,0x99c,
  0x69c,0x795,0x49f,0x596,0x29a,0x393,0x099,0x190,
  0xf00,0xe09,0xd03,0xc0a,0xb06,0xa0f,0x905,0x80c,
  0x70c,0x605,0x50f,0x406,0x30a,0x203,0x109,0x000

]);

// Triangle table: which vertices form triangles for each configuration
// Flattened: 256 × 16 entries (max 5 triangles × 3 vertices + sentinel -1)
/* eslint-disable */
const triTable = new Int8Array([
  -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  0,8,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  0,1,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  1,8,3,9,8,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  1,2,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  0,8,3,1,2,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  9,2,10,0,2,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  2,8,3,2,10,8,10,9,8,-1,-1,-1,-1,-1,-1,-1,
  3,11,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  0,11,2,8,11,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  1,9,0,2,3,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  1,11,2,1,9,11,9,8,11,-1,-1,-1,-1,-1,-1,-1,
  3,10,1,11,10,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  0,10,1,0,8,10,8,11,10,-1,-1,-1,-1,-1,-1,-1,
  3,9,0,3,11,9,11,10,9,-1,-1,-1,-1,-1,-1,-1,
  9,8,10,10,8,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  4,7,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  4,3,0,7,3,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  0,1,9,8,4,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  4,1,9,4,7,1,7,3,1,-1,-1,-1,-1,-1,-1,-1,
  1,2,10,8,4,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  3,4,7,3,0,4,1,2,10,-1,-1,-1,-1,-1,-1,-1,
  9,2,10,9,0,2,8,4,7,-1,-1,-1,-1,-1,-1,-1,
  2,10,9,2,9,7,2,7,3,7,9,4,-1,-1,-1,-1,
  8,4,7,3,11,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  11,4,7,11,2,4,2,0,4,-1,-1,-1,-1,-1,-1,-1,
  9,0,1,8,4,7,2,3,11,-1,-1,-1,-1,-1,-1,-1,
  4,7,11,9,4,11,9,11,2,9,2,1,-1,-1,-1,-1,
  3,10,1,3,11,10,7,8,4,-1,-1,-1,-1,-1,-1,-1,
  1,11,10,1,4,11,1,0,4,7,11,4,-1,-1,-1,-1,
  4,7,8,9,0,11,9,11,10,11,0,3,-1,-1,-1,-1,
  4,7,11,4,11,9,9,11,10,-1,-1,-1,-1,-1,-1,-1,
  9,5,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  9,5,4,0,8,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  0,5,4,1,5,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  8,5,4,8,3,5,3,1,5,-1,-1,-1,-1,-1,-1,-1,
  1,2,10,9,5,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  3,0,8,1,2,10,4,9,5,-1,-1,-1,-1,-1,-1,-1,
  5,2,10,5,4,2,4,0,2,-1,-1,-1,-1,-1,-1,-1,
  2,10,5,3,2,5,3,5,4,3,4,8,-1,-1,-1,-1,
  9,5,4,2,3,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  0,11,2,0,8,11,4,9,5,-1,-1,-1,-1,-1,-1,-1,
  0,5,4,0,1,5,2,3,11,-1,-1,-1,-1,-1,-1,-1,
  2,1,5,2,5,8,2,8,11,4,8,5,-1,-1,-1,-1,
  10,3,11,10,1,3,9,5,4,-1,-1,-1,-1,-1,-1,-1,
  4,9,5,0,8,1,8,10,1,8,11,10,-1,-1,-1,-1,
  5,4,0,5,0,11,5,11,10,11,0,3,-1,-1,-1,-1,
  5,4,8,5,8,10,10,8,11,-1,-1,-1,-1,-1,-1,-1,
  9,7,8,5,7,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  9,3,0,9,5,3,5,7,3,-1,-1,-1,-1,-1,-1,-1,
  0,7,8,0,1,7,1,5,7,-1,-1,-1,-1,-1,-1,-1,
  1,5,3,3,5,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  9,7,8,9,5,7,10,1,2,-1,-1,-1,-1,-1,-1,-1,
  10,1,2,9,5,0,5,3,0,5,7,3,-1,-1,-1,-1,
  8,0,2,8,2,5,8,5,7,10,5,2,-1,-1,-1,-1,
  2,10,5,2,5,3,3,5,7,-1,-1,-1,-1,-1,-1,-1,
  7,9,5,7,8,9,3,11,2,-1,-1,-1,-1,-1,-1,-1,
  9,5,7,9,7,2,9,2,0,2,7,11,-1,-1,-1,-1,
  2,3,11,0,1,8,1,7,8,1,5,7,-1,-1,-1,-1,
  11,2,1,11,1,7,7,1,5,-1,-1,-1,-1,-1,-1,-1,
  9,5,8,8,5,7,10,1,3,10,3,11,-1,-1,-1,-1,
  5,7,0,5,0,9,7,11,0,1,0,10,11,10,0,-1,
  11,10,0,11,0,3,10,5,0,8,0,7,5,7,0,-1,
  11,10,5,7,11,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  10,6,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  0,8,3,5,10,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  9,0,1,5,10,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  1,8,3,1,9,8,5,10,6,-1,-1,-1,-1,-1,-1,-1,
  1,6,5,2,6,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  1,6,5,1,2,6,3,0,8,-1,-1,-1,-1,-1,-1,-1,
  9,6,5,9,0,6,0,2,6,-1,-1,-1,-1,-1,-1,-1,
  5,9,8,5,8,2,5,2,6,3,2,8,-1,-1,-1,-1,
  2,3,11,10,6,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  11,0,8,11,2,0,10,6,5,-1,-1,-1,-1,-1,-1,-1,
  0,1,9,2,3,11,5,10,6,-1,-1,-1,-1,-1,-1,-1,
  5,10,6,1,9,2,9,11,2,9,8,11,-1,-1,-1,-1,
  6,3,11,6,5,3,5,1,3,-1,-1,-1,-1,-1,-1,-1,
  0,8,11,0,11,5,0,5,1,5,11,6,-1,-1,-1,-1,
  3,11,6,0,3,6,0,6,5,0,5,9,-1,-1,-1,-1,
  6,5,9,6,9,11,11,9,8,-1,-1,-1,-1,-1,-1,-1,
  5,10,6,4,7,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  4,3,0,4,7,3,6,5,10,-1,-1,-1,-1,-1,-1,-1,
  1,9,0,5,10,6,8,4,7,-1,-1,-1,-1,-1,-1,-1,
  10,6,5,1,9,7,1,7,3,7,9,4,-1,-1,-1,-1,
  6,1,2,6,5,1,4,7,8,-1,-1,-1,-1,-1,-1,-1,
  1,2,5,5,2,6,3,0,4,3,4,7,-1,-1,-1,-1,
  8,4,7,9,0,5,0,6,5,0,2,6,-1,-1,-1,-1,
  7,3,9,7,9,4,3,2,9,5,9,6,2,6,9,-1,
  3,11,2,7,8,4,10,6,5,-1,-1,-1,-1,-1,-1,-1,
  5,10,6,4,7,2,4,2,0,2,7,11,-1,-1,-1,-1,
  0,1,9,4,7,8,2,3,11,5,10,6,-1,-1,-1,-1,
  9,2,1,9,11,2,9,4,11,7,11,4,5,10,6,-1,
  8,4,7,3,11,5,3,5,1,5,11,6,-1,-1,-1,-1,
  5,1,11,5,11,6,1,0,11,7,11,4,0,4,11,-1,
  0,5,9,0,6,5,0,3,6,11,6,3,8,4,7,-1,
  6,5,9,6,9,11,4,7,9,7,11,9,-1,-1,-1,-1,
  10,4,9,6,4,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  4,10,6,4,9,10,0,8,3,-1,-1,-1,-1,-1,-1,-1,
  10,0,1,10,6,0,6,4,0,-1,-1,-1,-1,-1,-1,-1,
  8,3,1,8,1,6,8,6,4,6,1,10,-1,-1,-1,-1,
  1,4,9,1,2,4,2,6,4,-1,-1,-1,-1,-1,-1,-1,
  3,0,8,1,2,9,2,4,9,2,6,4,-1,-1,-1,-1,
  0,2,4,4,2,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  8,3,2,8,2,4,4,2,6,-1,-1,-1,-1,-1,-1,-1,
  10,4,9,10,6,4,11,2,3,-1,-1,-1,-1,-1,-1,-1,
  0,8,2,2,8,11,4,9,10,4,10,6,-1,-1,-1,-1,
  3,11,2,0,1,6,0,6,4,6,1,10,-1,-1,-1,-1,
  6,4,1,6,1,10,4,8,1,2,1,11,8,11,1,-1,
  9,6,4,9,3,6,9,1,3,11,6,3,-1,-1,-1,-1,
  8,11,1,8,1,0,11,6,1,9,1,4,6,4,1,-1,
  3,11,6,3,6,0,0,6,4,-1,-1,-1,-1,-1,-1,-1,
  6,4,8,11,6,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  7,10,6,7,8,10,8,9,10,-1,-1,-1,-1,-1,-1,-1,
  0,7,3,0,10,7,0,9,10,6,7,10,-1,-1,-1,-1,
  10,6,7,1,10,7,1,7,8,1,8,0,-1,-1,-1,-1,
  10,6,7,10,7,1,1,7,3,-1,-1,-1,-1,-1,-1,-1,
  1,2,6,1,6,8,1,8,9,8,6,7,-1,-1,-1,-1,
  2,6,9,2,9,1,6,7,9,0,9,3,7,3,9,-1,
  7,8,0,7,0,6,6,0,2,-1,-1,-1,-1,-1,-1,-1,
  7,3,2,6,7,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  2,3,11,10,6,8,10,8,9,8,6,7,-1,-1,-1,-1,
  2,0,7,2,7,11,0,9,7,6,7,10,9,10,7,-1,
  1,8,0,1,7,8,1,10,7,6,7,10,2,3,11,-1,
  11,2,1,11,1,7,10,6,1,6,7,1,-1,-1,-1,-1,
  8,9,6,8,6,7,9,1,6,11,6,3,1,3,6,-1,
  0,9,1,11,6,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  7,8,0,7,0,6,3,11,0,11,6,0,-1,-1,-1,-1,
  7,11,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  7,6,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  3,0,8,11,7,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  0,1,9,11,7,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  8,1,9,8,3,1,11,7,6,-1,-1,-1,-1,-1,-1,-1,
  10,1,2,6,11,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  1,2,10,3,0,8,6,11,7,-1,-1,-1,-1,-1,-1,-1,
  2,9,0,2,10,9,6,11,7,-1,-1,-1,-1,-1,-1,-1,
  6,11,7,2,10,3,10,8,3,10,9,8,-1,-1,-1,-1,
  7,2,3,6,2,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  7,0,8,7,6,0,6,2,0,-1,-1,-1,-1,-1,-1,-1,
  2,7,6,2,3,7,0,1,9,-1,-1,-1,-1,-1,-1,-1,
  1,6,2,1,8,6,1,9,8,8,7,6,-1,-1,-1,-1,
  10,7,6,10,1,7,1,3,7,-1,-1,-1,-1,-1,-1,-1,
  10,7,6,1,7,10,1,8,7,1,0,8,-1,-1,-1,-1,
  0,3,7,0,7,10,0,10,9,6,10,7,-1,-1,-1,-1,
  7,6,10,7,10,8,8,10,9,-1,-1,-1,-1,-1,-1,-1,
  6,8,4,11,8,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  3,6,11,3,0,6,0,4,6,-1,-1,-1,-1,-1,-1,-1,
  8,6,11,8,4,6,9,0,1,-1,-1,-1,-1,-1,-1,-1,
  9,4,6,9,6,3,9,3,1,11,3,6,-1,-1,-1,-1,
  6,8,4,6,11,8,2,10,1,-1,-1,-1,-1,-1,-1,-1,
  1,2,10,3,0,11,0,6,11,0,4,6,-1,-1,-1,-1,
  4,11,8,4,6,11,0,2,9,2,10,9,-1,-1,-1,-1,
  10,9,3,10,3,2,9,4,3,11,3,6,4,6,3,-1,
  8,2,3,8,4,2,4,6,2,-1,-1,-1,-1,-1,-1,-1,
  0,4,2,4,6,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  1,9,0,2,3,4,2,4,6,4,3,8,-1,-1,-1,-1,
  1,9,4,1,4,2,2,4,6,-1,-1,-1,-1,-1,-1,-1,
  8,1,3,8,6,1,8,4,6,6,10,1,-1,-1,-1,-1,
  10,1,0,10,0,6,6,0,4,-1,-1,-1,-1,-1,-1,-1,
  4,6,3,4,3,8,6,10,3,0,3,9,10,9,3,-1,
  10,9,4,6,10,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  4,9,5,7,6,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  0,8,3,4,9,5,11,7,6,-1,-1,-1,-1,-1,-1,-1,
  5,0,1,5,4,0,7,6,11,-1,-1,-1,-1,-1,-1,-1,
  11,7,6,8,3,4,3,5,4,3,1,5,-1,-1,-1,-1,
  9,5,4,10,1,2,7,6,11,-1,-1,-1,-1,-1,-1,-1,
  6,11,7,1,2,10,0,8,3,4,9,5,-1,-1,-1,-1,
  7,6,11,5,4,10,4,2,10,4,0,2,-1,-1,-1,-1,
  3,4,8,3,5,4,3,2,5,10,5,2,11,7,6,-1,
  7,2,3,7,6,2,5,4,9,-1,-1,-1,-1,-1,-1,-1,
  9,5,4,0,8,6,0,6,2,6,8,7,-1,-1,-1,-1,
  3,6,2,3,7,6,1,5,0,5,4,0,-1,-1,-1,-1,
  6,2,8,6,8,7,2,1,8,4,8,5,1,5,8,-1,
  9,5,4,10,1,6,1,7,6,1,3,7,-1,-1,-1,-1,
  1,6,10,1,7,6,1,0,7,8,7,0,9,5,4,-1,
  4,0,10,4,10,5,0,3,10,6,10,7,3,7,10,-1,
  7,6,10,7,10,8,5,4,10,4,8,10,-1,-1,-1,-1,
  6,9,5,6,11,9,11,8,9,-1,-1,-1,-1,-1,-1,-1,
  3,6,11,0,6,3,0,5,6,0,9,5,-1,-1,-1,-1,
  0,11,8,0,5,11,0,1,5,5,6,11,-1,-1,-1,-1,
  6,11,3,6,3,5,5,3,1,-1,-1,-1,-1,-1,-1,-1,
  1,2,10,9,5,11,9,11,8,11,5,6,-1,-1,-1,-1,
  0,11,3,0,6,11,0,9,6,5,6,9,1,2,10,-1,
  11,8,5,11,5,6,8,0,5,10,5,2,0,2,5,-1,
  6,11,3,6,3,5,2,10,3,10,5,3,-1,-1,-1,-1,
  5,8,9,5,2,8,5,6,2,3,8,2,-1,-1,-1,-1,
  9,5,6,9,6,0,0,6,2,-1,-1,-1,-1,-1,-1,-1,
  1,5,8,1,8,0,5,6,8,3,8,2,6,2,8,-1,
  1,5,6,2,1,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  1,3,6,1,6,10,3,8,6,5,6,9,8,9,6,-1,
  10,1,0,10,0,6,9,5,0,5,6,0,-1,-1,-1,-1,
  0,3,8,5,6,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  10,5,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  11,5,10,7,5,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  11,5,10,11,7,5,8,3,0,-1,-1,-1,-1,-1,-1,-1,
  5,11,7,5,10,11,1,9,0,-1,-1,-1,-1,-1,-1,-1,
  10,7,5,10,11,7,9,8,1,8,3,1,-1,-1,-1,-1,
  11,1,2,11,7,1,7,5,1,-1,-1,-1,-1,-1,-1,-1,
  0,8,3,1,2,7,1,7,5,7,2,11,-1,-1,-1,-1,
  9,7,5,9,2,7,9,0,2,2,11,7,-1,-1,-1,-1,
  7,5,2,7,2,11,5,9,2,3,2,8,9,8,2,-1,
  2,5,10,2,3,5,3,7,5,-1,-1,-1,-1,-1,-1,-1,
  8,2,0,8,5,2,8,7,5,10,2,5,-1,-1,-1,-1,
  9,0,1,2,3,10,3,5,10,3,7,5,-1,-1,-1,-1,
  1,2,5,8,7,0,8,0,2,2,5,9,-1,-1,-1,-1,
  1,3,5,3,7,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  0,8,7,0,7,1,1,7,5,-1,-1,-1,-1,-1,-1,-1,
  9,0,3,9,3,5,5,3,7,-1,-1,-1,-1,-1,-1,-1,
  9,8,7,5,9,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  5,8,4,5,10,8,10,11,8,-1,-1,-1,-1,-1,-1,-1,
  5,0,4,5,11,0,5,10,11,11,3,0,-1,-1,-1,-1,
  0,1,9,8,4,10,8,10,11,10,4,5,-1,-1,-1,-1,
  10,11,4,10,4,5,11,3,4,9,4,1,3,1,4,-1,
  2,5,1,2,8,5,2,11,8,4,5,8,-1,-1,-1,-1,
  0,4,11,0,11,3,4,5,11,2,11,1,5,1,11,-1,
  0,2,5,0,5,9,2,11,5,4,5,8,11,8,5,-1,
  9,4,5,2,11,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  2,5,10,3,5,2,3,4,5,3,8,4,-1,-1,-1,-1,
  5,10,2,5,2,4,4,2,0,-1,-1,-1,-1,-1,-1,-1,
  3,10,2,3,5,10,3,8,5,4,5,8,0,1,9,-1,
  5,10,2,5,2,4,1,9,2,9,4,2,-1,-1,-1,-1,
  8,4,5,8,5,3,3,5,1,-1,-1,-1,-1,-1,-1,-1,
  0,4,5,1,0,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  8,4,5,8,5,3,9,0,5,0,3,5,-1,-1,-1,-1,
  9,4,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  4,11,7,4,9,11,9,10,11,-1,-1,-1,-1,-1,-1,-1,
  0,8,3,4,9,7,9,11,7,9,10,11,-1,-1,-1,-1,
  1,10,11,1,11,4,1,4,0,7,4,11,-1,-1,-1,-1,
  3,1,4,3,4,8,1,10,4,7,4,11,10,11,4,-1,
  4,11,7,9,11,4,9,2,11,9,1,2,-1,-1,-1,-1,
  9,7,4,9,11,7,9,1,11,2,11,1,0,8,3,-1,
  11,7,4,11,4,2,2,4,0,-1,-1,-1,-1,-1,-1,-1,
  11,7,4,11,4,2,8,3,4,3,2,4,-1,-1,-1,-1,
  2,9,10,2,7,9,2,3,7,7,4,9,-1,-1,-1,-1,
  9,10,7,9,7,4,10,2,7,8,7,0,2,0,7,-1,
  3,7,10,3,10,2,7,4,10,1,10,0,4,0,10,-1,
  1,10,2,8,7,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  4,9,1,4,1,7,7,1,3,-1,-1,-1,-1,-1,-1,-1,
  4,9,1,4,1,7,0,8,1,8,7,1,-1,-1,-1,-1,
  4,0,3,7,4,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  4,8,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  9,10,8,10,11,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  3,0,9,3,9,11,11,9,10,-1,-1,-1,-1,-1,-1,-1,
  0,1,10,0,10,8,8,10,11,-1,-1,-1,-1,-1,-1,-1,
  3,1,10,11,3,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  1,2,11,1,11,9,9,11,8,-1,-1,-1,-1,-1,-1,-1,
  3,0,9,3,9,11,1,2,9,2,11,9,-1,-1,-1,-1,
  0,2,11,8,0,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  3,2,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  2,3,8,2,8,10,10,8,9,-1,-1,-1,-1,-1,-1,-1,
  9,10,2,0,9,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  2,3,8,2,8,10,0,1,8,1,10,8,-1,-1,-1,-1,
  1,10,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  1,3,8,9,1,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  0,9,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  0,3,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
]);
/* eslint-enable */

/** Interpolate vertex position along an edge */
function vertexInterp(
  iso: number,
  x1: number, y1: number, z1: number, v1: number,
  x2: number, y2: number, z2: number, v2: number
): [number, number, number] {
  if (Math.abs(v1 - v2) < 1e-9) return [x1, y1, z1];
  const t = (iso - v1) / (v2 - v1);
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1), z1 + t * (z2 - z1)];
}

/** March a single cube and push triangles */
function marchCube(
  field: Float32Array,
  nx: number, ny: number, _nz: number,
  xi: number, yi: number, zi: number,
  dx: number, dy: number, dz: number,
  ox: number, oy: number, oz: number,
  iso: number,
  outPos: number[],
): void {
  const idx = (xi: number, yi: number, zi: number) => xi + yi * (nx + 1) + zi * (nx + 1) * (ny + 1);

  const x0 = ox + xi * dx, y0 = oy + yi * dy, z0 = oz + zi * dz;
  const x1 = x0 + dx, y1 = y0 + dy, z1 = z0 + dz;

  const v: [number, number, number, number][] = [
    [x0, y0, z0, field[idx(xi,   yi,   zi  )] ?? 1],
    [x1, y0, z0, field[idx(xi+1, yi,   zi  )] ?? 1],
    [x1, y1, z0, field[idx(xi+1, yi+1, zi  )] ?? 1],
    [x0, y1, z0, field[idx(xi,   yi+1, zi  )] ?? 1],
    [x0, y0, z1, field[idx(xi,   yi,   zi+1)] ?? 1],
    [x1, y0, z1, field[idx(xi+1, yi,   zi+1)] ?? 1],
    [x1, y1, z1, field[idx(xi+1, yi+1, zi+1)] ?? 1],
    [x0, y1, z1, field[idx(xi,   yi+1, zi+1)] ?? 1],
  ];

  let cubeIndex = 0;
  for (let i = 0; i < 8; i++) if ((v[i]![3] ?? 1) < iso) cubeIndex |= (1 << i);

  const edges = edgeTable[cubeIndex] ?? 0;
  if (edges === 0) return;

  const edgeVerts: [number, number, number][] = new Array(12).fill([0,0,0]);

  if (edges & 0x001) edgeVerts[0]  = vertexInterp(iso, v[0]![0],v[0]![1],v[0]![2],v[0]![3], v[1]![0],v[1]![1],v[1]![2],v[1]![3]);
  if (edges & 0x002) edgeVerts[1]  = vertexInterp(iso, v[1]![0],v[1]![1],v[1]![2],v[1]![3], v[2]![0],v[2]![1],v[2]![2],v[2]![3]);
  if (edges & 0x004) edgeVerts[2]  = vertexInterp(iso, v[2]![0],v[2]![1],v[2]![2],v[2]![3], v[3]![0],v[3]![1],v[3]![2],v[3]![3]);
  if (edges & 0x008) edgeVerts[3]  = vertexInterp(iso, v[3]![0],v[3]![1],v[3]![2],v[3]![3], v[0]![0],v[0]![1],v[0]![2],v[0]![3]);
  if (edges & 0x010) edgeVerts[4]  = vertexInterp(iso, v[4]![0],v[4]![1],v[4]![2],v[4]![3], v[5]![0],v[5]![1],v[5]![2],v[5]![3]);
  if (edges & 0x020) edgeVerts[5]  = vertexInterp(iso, v[5]![0],v[5]![1],v[5]![2],v[5]![3], v[6]![0],v[6]![1],v[6]![2],v[6]![3]);
  if (edges & 0x040) edgeVerts[6]  = vertexInterp(iso, v[6]![0],v[6]![1],v[6]![2],v[6]![3], v[7]![0],v[7]![1],v[7]![2],v[7]![3]);
  if (edges & 0x080) edgeVerts[7]  = vertexInterp(iso, v[7]![0],v[7]![1],v[7]![2],v[7]![3], v[4]![0],v[4]![1],v[4]![2],v[4]![3]);
  if (edges & 0x100) edgeVerts[8]  = vertexInterp(iso, v[0]![0],v[0]![1],v[0]![2],v[0]![3], v[4]![0],v[4]![1],v[4]![2],v[4]![3]);
  if (edges & 0x200) edgeVerts[9]  = vertexInterp(iso, v[1]![0],v[1]![1],v[1]![2],v[1]![3], v[5]![0],v[5]![1],v[5]![2],v[5]![3]);
  if (edges & 0x400) edgeVerts[10] = vertexInterp(iso, v[2]![0],v[2]![1],v[2]![2],v[2]![3], v[6]![0],v[6]![1],v[6]![2],v[6]![3]);
  if (edges & 0x800) edgeVerts[11] = vertexInterp(iso, v[3]![0],v[3]![1],v[3]![2],v[3]![3], v[7]![0],v[7]![1],v[7]![2],v[7]![3]);

  const base = cubeIndex * 16;
  for (let t = 0; t < 5; t++) {
    const i0 = triTable[base + t*3];
    const i1 = triTable[base + t*3 + 1];
    const i2 = triTable[base + t*3 + 2];
    if (i0 === undefined || i0 < 0) break;
    const p0 = edgeVerts[i0]!, p1 = edgeVerts[i1!]!, p2 = edgeVerts[i2!]!;
    outPos.push(p0[0],p0[1],p0[2], p1[0],p1[1],p1[2], p2[0],p2[1],p2[2]);
  }
}

/** Full marching cubes — builds a BufferGeometry from our cardiac SDF */
function buildHeartMesh(res: number): BufferGeometry {
  const nx = res, ny = Math.round(res * 1.4), nz = res;
  const ox = -1.0, oy = -1.0, oz = -0.9;
  const ex =  1.0, ey =  1.6, ez =  0.9;
  const dx = (ex - ox) / nx;
  const dy = (ey - oy) / ny;
  const dz = (ez - oz) / nz;

  // Sample SDF on grid
  const field = new Float32Array((nx+1) * (ny+1) * (nz+1));
  for (let zi = 0; zi <= nz; zi++) {
    for (let yi = 0; yi <= ny; yi++) {
      for (let xi = 0; xi <= nx; xi++) {
        const wx = ox + xi * dx;
        const wy = oy + yi * dy;
        const wz = oz + zi * dz;
        field[xi + yi*(nx+1) + zi*(nx+1)*(ny+1)] = fullHeartSDF(wx, wy, wz);
      }
    }
  }

  // March the grid
  const positions: number[] = [];
  for (let zi = 0; zi < nz; zi++) {
    for (let yi = 0; yi < ny; yi++) {
      for (let xi = 0; xi < nx; xi++) {
        marchCube(field, nx, ny, nz, xi, yi, zi, dx, dy, dz, ox, oy, oz, 0.0, positions);
      }
    }
  }

  const posArr = new Float32Array(positions);
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(posArr, 3));
  geo.computeVertexNormals();
  return geo;
}

/* ══════════════════════════════════════════════════════════════════
   WIREFRAME HEART COMPONENT
══════════════════════════════════════════════════════════════════ */
function WireframeHeart() {
  const group = useRef<Group>(null);

  const { wireLine, innerMesh, glowMesh } = useMemo(() => {
    // Resolution 36 → ~36³ cells → good density without freezing the page
    const heartGeo  = buildHeartMesh(36);

    // WireframeGeometry shows ALL triangle edges → dense crimson mesh
    const wireGeo   = new WireframeGeometry(heartGeo);

    const matWire = new LineBasicMaterial({
      color: C_MID,
      transparent: true,
      opacity: 0.80,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    const matInner = new MeshBasicMaterial({
      color: C_FILL,
      transparent: true,
      opacity: 0.60,
      blending: AdditiveBlending,
      depthWrite: false,
      side: FrontSide,
    });

    const matGlow = new MeshBasicMaterial({
      color: C_DARK,
      transparent: true,
      opacity: 0.25,
      blending: AdditiveBlending,
      depthWrite: false,
      side: BackSide,
    });

    return {
      wireLine:  new LineSegments(wireGeo, matWire),
      innerMesh: { geo: heartGeo, mat: matInner },
      glowMesh:  { geo: heartGeo, mat: matGlow },
    };
  }, []);

  /* Subtle animation: slow rotation + gentle float */
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.rotation.y = t * 0.07;
    group.current.position.y = Math.sin(t * 0.38) * 0.04;
    const beat = 1 + Math.sin(t * 1.1) * 0.013;
    group.current.scale.setScalar(beat);
  });

  return (
    <group ref={group}>
      {/* Outer glow (BackSide, renders behind) */}
      <mesh geometry={glowMesh.geo} material={glowMesh.mat} scale={1.03} />
      {/* Solid inner fill for crimson depth */}
      <mesh geometry={innerMesh.geo} material={innerMesh.mat} />
      {/* Dense wireframe — the primary visual */}
      <primitive object={wireLine} />
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SURFACE NODES — small glowing dots sampled from the SDF surface
══════════════════════════════════════════════════════════════════ */
function SurfaceNodes() {
  const ref = useRef<Points>(null);

  const { geo, mat } = useMemo(() => {
    // Rejection-sample points near the heart surface (SDF ≈ 0)
    const N = 200;
    const pts = new Float32Array(N * 3);
    let count = 0;
    let attempts = 0;
    while (count < N && attempts < 20000) {
      attempts++;
      const x = (Math.random() - 0.5) * 2.0;
      const y = (Math.random() - 0.5) * 2.8;
      const z = (Math.random() - 0.5) * 1.8;
      const d = fullHeartSDF(x, y, z);
      if (d > -0.04 && d < 0.08) {
        pts[count*3]   = x;
        pts[count*3+1] = y;
        pts[count*3+2] = z;
        count++;
      }
    }

    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts.slice(0, count*3), 3));
    const m = new PointsMaterial({
      color: C_BRIGHT, size: 0.025, transparent: true, opacity: 0.95,
      blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    return { geo: g, mat: m };
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const m = ref.current.material as PointsMaterial;
    m.opacity = 0.72 + Math.sin(clock.getElapsedTime() * 1.8) * 0.22;
  });

  return <points ref={ref} geometry={geo} material={mat} />;
}

/* ══════════════════════════════════════════════════════════════════
   BACKGROUND PARTICLES
══════════════════════════════════════════════════════════════════ */
const N_BG = 160;
function BackgroundParticles() {
  const ref = useRef<Points>(null);

  const { origPos, phases } = useMemo(() => {
    const p  = new Float32Array(N_BG * 3);
    const ph = new Float32Array(N_BG);
    for (let i = 0; i < N_BG; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph2 = Math.acos(2 * Math.random() - 1);
      const r  = 1.6 + Math.random() * 2.2;
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
    color: C_MID, size: 0.018, transparent: true, opacity: 0.55,
    blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const arr = (ref.current.geometry.attributes.position as BufferAttribute).array as Float32Array;
    for (let i = 0; i < N_BG; i++) {
      const ph = phases[i] ?? 0;
      arr[i*3+1] = (origPos[i*3+1] ?? 0) + Math.sin(t * 0.3 + ph) * 0.06;
    }
    (ref.current.geometry.attributes.position as BufferAttribute).needsUpdate = true;
  });

  return <points ref={ref} geometry={geo} material={mat} />;
}

/* ══════════════════════════════════════════════════════════════════
   BACKGROUND NEURAL LINES
══════════════════════════════════════════════════════════════════ */
function BackgroundNeural() {
  const ref = useRef<LineSegments>(null);

  const { geo, mat } = useMemo(() => {
    const nodes: Vector3[] = [];
    for (let i = 0; i < 60; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const r  = 1.4 + Math.random() * 2.0;
      nodes.push(new Vector3(
        r * Math.sin(ph) * Math.cos(th),
        r * Math.cos(ph) * 0.80,
        r * Math.sin(ph) * Math.sin(th),
      ));
    }
    const pts: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const ni = nodes[i]; if (!ni) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        const nj = nodes[j]; if (!nj) continue;
        if (ni.distanceTo(nj) < 1.3) {
          pts.push(ni.x, ni.y, ni.z, nj.x, nj.y, nj.z);
        }
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    const m = new LineBasicMaterial({
      color: C_NEURAL, transparent: true, opacity: 0.06,
      blending: AdditiveBlending, depthWrite: false,
    });
    return { geo: g, mat: m };
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.022;
  });

  return <lineSegments ref={ref} geometry={geo} material={mat} />;
}

/* ══════════════════════════════════════════════════════════════════
   CAMERA INTRO
══════════════════════════════════════════════════════════════════ */
function CameraIntro() {
  const { camera } = useThree();
  const t  = useRef(0);
  const done = useRef(false);
  useEffect(() => {
    camera.position.set(0.2, 0.3, 5.5);
    camera.lookAt(0, 0.3, 0);
  }, [camera]);
  useFrame((_, delta) => {
    if (done.current) return;
    t.current = Math.min(t.current + delta / 2.5, 1);
    const e = 1 - Math.pow(1 - t.current, 3);
    camera.position.z = 5.5 + (3.8 - 5.5) * e;
    camera.position.x = 0.2 * (1 - e);
    if (t.current >= 1) done.current = true;
  });
  return null;
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
   STATIC SVG FALLBACK
══════════════════════════════════════════════════════════════════ */
export function StaticHeartFallback({ size = 420 }: { size?: number }) {
  const meshLines: React.ReactElement[] = [];
  const W = 200, H = 220;
  const cx = 100, cy = 115;

  // Generate a grid of points inside the heart shape and triangulate them
  const pts: [number, number][] = [];
  for (let row = 0; row <= 22; row++) {
    for (let col = 0; col <= 24; col++) {
      const px = 20 + col * 7.0;
      const py = 48 + row * 6.5;
      // Approximate heart membership
      const dx = (px - cx) / 72, dy = (py - (cy - 8)) / 76;
      const heartVal = dx*dx + dy*dy;
      if (heartVal < 1.0 && py < 172 && py > 48) {
        // Also exclude the aortic notch at top-center
        const notchX = Math.abs(px - cx) < 12 && py < 68;
        if (!notchX) pts.push([px, py]);
      }
    }
  }

  let key = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const pi = pts[i]!, pj = pts[j]!;
      const d = Math.hypot(pi[0] - pj[0], pi[1] - pj[1]);
      if (d < 10) {
        meshLines.push(
          <line key={key++}
            x1={pi[0]} y1={pi[1]} x2={pj[0]} y2={pj[1]}
            stroke="#E63950" strokeWidth="0.4" opacity={0.5 - d * 0.025} />
        );
      }
    }
  }

  return (
    <svg width={size} height={size * H / W} viewBox={`0 0 ${W} ${H}`} fill="none"
      style={{ opacity: 0.92 }} aria-label="Wireframe cardiac visualization">
      <defs>
        <radialGradient id="hgf" cx="50%" cy="52%" r="45%">
          <stop offset="0%" stopColor="#C01830" stopOpacity="0.7" />
          <stop offset="60%" stopColor="#8B1A28" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#E63950" stopOpacity="0" />
        </radialGradient>
        <filter id="blf"><feGaussianBlur stdDeviation="2.5" /></filter>
        <clipPath id="heartClip">
          <path d="M100 170C50 138 18 110 18 80c0-24 18-38 36-38 15 0 30 10 46 30 16-20 31-30 46-30 18 0 36 14 36 38 0 30-34 58-82 90Z" />
        </clipPath>
      </defs>

      <ellipse cx="100" cy="112" rx="76" ry="72" fill="url(#hgf)" />
      <path d="M100 170C50 138 18 110 18 80c0-24 18-38 36-38 15 0 30 10 46 30 16-20 31-30 46-30 18 0 36 14 36 38 0 30-34 58-82 90Z"
        fill="rgba(107,15,26,0.5)" />

      <g clipPath="url(#heartClip)">{meshLines}</g>

      {/* Heart outline with glow */}
      <path d="M100 170C50 138 18 110 18 80c0-24 18-38 36-38 15 0 30 10 46 30 16-20 31-30 46-30 18 0 36 14 36 38 0 30-34 58-82 90Z"
        stroke="#FF5369" strokeWidth="2.5" fill="none" filter="url(#blf)" opacity="0.5" />
      <path d="M100 170C50 138 18 110 18 80c0-24 18-38 36-38 15 0 30 10 46 30 16-20 31-30 46-30 18 0 36 14 36 38 0 30-34 58-82 90Z"
        stroke="#FF8090" strokeWidth="1.0" fill="none" />

      {/* Aorta */}
      <path d="M94 42c-1-10-6-18-12-24" stroke="#FF8090" strokeWidth="11" strokeLinecap="round" fill="none" opacity="0.18"/>
      <path d="M94 42c-1-10-6-18-12-24" stroke="#FF8090" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.52"/>
      <path d="M82 18c-5-4-2-10 5-8" stroke="#FF8090" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.52"/>
      {/* Pulmonary */}
      <path d="M108 40c6-10 14-17 22-20" stroke="#FF8090" strokeWidth="8" strokeLinecap="round" fill="none" opacity="0.18"/>
      <path d="M108 40c6-10 14-17 22-20" stroke="#FF8090" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.46"/>
      {/* SVC */}
      <path d="M124 50c5-8 8-16 7-24" stroke="#FF8090" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.14"/>
      <path d="M124 50c5-8 8-16 7-24" stroke="#FF8090" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.38"/>

      {/* Node dots */}
      {([[100,78],[58,68],[142,68],[18,80],[182,80],[100,170],[82,18],[130,20],[124,26]] as [number,number][]).map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="#FF5369" opacity="0.9" />
      ))}
      {([[28,42,0.4],[172,44,0.4],[14,112,0.38],[188,108,0.38],[38,164,0.35],[164,162,0.35],[88,20,0.5],[114,22,0.5]] as [number,number,number][]).map(([x,y,o],i) => (
        <circle key={`p${i}`} cx={x} cy={y} r="1.6" fill="#E63950" opacity={o} />
      ))}
      {([[28,42,58,68],[172,44,142,68],[14,112,18,80],[188,108,182,80],[38,164,18,148],[164,162,182,148]] as [number,number,number,number][]).map(([x1,y1,x2,y2],i) => (
        <line key={`nl${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#E63950" strokeWidth="0.35" opacity="0.2" />
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
          camera={{ position:[0.2, 0.3, 3.8], fov:40, near:0.05, far:40 }}
          dpr={[1, Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.75)]}
          gl={{ antialias:true, alpha:true, powerPreference:"high-performance" }}
          onCreated={({ gl }) => gl.setClearColor("#05070B", 0)}
          frameloop={visible ? "always" : "never"}
        >
          <CameraIntro />

          {/* Lighting */}
          <ambientLight intensity={0.06} color="#300810" />
          <pointLight position={[0, 1.5, 3]}   color="#FF3050" intensity={3.0} distance={9} />
          <pointLight position={[-2, 0.5, 1.5]} color="#C01030" intensity={2.0} distance={8} />
          <pointLight position={[2, -0.5, 2]}   color="#FF2040" intensity={1.5} distance={7} />
          <pointLight position={[0, -2, 1]}     color="#8B0010" intensity={1.0} distance={6} />
          <directionalLight position={[-1.5, 2, 1.5]} color="#FFFFFF" intensity={0.3} />

          <WireframeHeart />
          <SurfaceNodes />
          <BackgroundParticles />
          <BackgroundNeural />

          <OrbitControls
            enablePan={false} enableZoom={false}
            enableRotate={!reduceMotion} autoRotate={false}
            target={[0, 0.3, 0]} makeDefault
          />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}

export const WireframeHeartScene = memo(WireframeHeartSceneInner);
