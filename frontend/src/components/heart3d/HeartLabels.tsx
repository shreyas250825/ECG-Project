/**
 * HeartLabels — pure CSS overlay approach.
 *
 * The @react-three/drei <Html distanceFactor> approach caused labels to scale
 * with camera distance, appearing enormous at close zoom levels (distanceFactor=28
 * at camera distance ~2 units → ~14× HTML size).
 *
 * This replacement uses a <Billboard> to expose label 3D positions to a
 * useFrame loop, then a sibling HTML overlay div (outside the Canvas) renders
 * all labels at fixed CSS sizes using computed 2D screen coordinates.
 *
 * Usage:
 *   Inside Canvas: <HeartLabelAnchors ref={anchorsRef} visible={visible} />
 *   Outside Canvas (sibling div): <HeartLabelOverlay anchorsRef={anchorsRef} canvasRef={canvasRef} />
 */

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type RefObject,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { ANATOMY_LABELS } from "./types";

export type LabelAnchor = {
  id: string;
  name: string;
  x: number; // screen x, 0-1
  y: number; // screen y, 0-1
  visible: boolean;
  depth: number; // z-depth for occlusion hints
};

export type LabelAnchorsHandle = {
  anchors: LabelAnchor[];
};

/* ── In-scene anchor tracker (inside Canvas) ─────────────────────── */
export const HeartLabelAnchors = forwardRef<
  LabelAnchorsHandle,
  { visible: boolean }
>(function HeartLabelAnchors({ visible }, ref) {
  const { camera } = useThree();
  const anchors = useRef<LabelAnchor[]>(
    ANATOMY_LABELS.map((l) => ({
      id: l.id,
      name: l.name,
      x: 0.5,
      y: 0.5,
      visible: false,
      depth: 0,
    })),
  );

  useImperativeHandle(ref, () => ({ get anchors() { return anchors.current; } }));

  useFrame(() => {
    if (!visible) {
      anchors.current.forEach((a) => (a.visible = false));
      return;
    }

    ANATOMY_LABELS.forEach((lab, i) => {
      const world = new Vector3(...lab.position);
      const projected = world.clone().project(camera);
      // projected is in NDC: x,y ∈ [-1,1], z ∈ [-1,1]
      // Convert to 0-1 range for use as CSS percentages
      const sx = (projected.x + 1) / 2;
      const sy = 1 - (projected.y + 1) / 2; // flip Y
      // Visible if within canvas bounds and in front of camera
      const inBounds = sx > 0.02 && sx < 0.98 && sy > 0.02 && sy < 0.98;
      const inFront = projected.z < 1.0;
      anchors.current[i] = {
        id: lab.id,
        name: lab.name,
        x: sx,
        y: sy,
        visible: inBounds && inFront,
        depth: projected.z,
      };
    });
  });

  return null;
});

/* ── HTML overlay (outside Canvas, absolute over canvas div) ─────── */
export function HeartLabelOverlay({
  anchorsRef,
  visible,
}: {
  anchorsRef: RefObject<LabelAnchorsHandle | null>;
  visible: boolean;
}) {
  const frameRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Repaint labels from anchor data via RAF loop
  const updateLabels = () => {
    const container = containerRef.current;
    if (!container) return;
    const data = anchorsRef.current?.anchors;
    if (!data) return;

    data.forEach((anchor) => {
      const el = container.querySelector<HTMLElement>(`[data-label-id="${anchor.id}"]`);
      if (!el) return;
      if (!anchor.visible || !visible) {
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
        return;
      }
      el.style.opacity = "1";
      el.style.pointerEvents = "auto";
      // Position center of label at projected screen point
      el.style.left = `${anchor.x * 100}%`;
      el.style.top  = `${anchor.y * 100}%`;
    });

    frameRef.current = requestAnimationFrame(updateLabels);
  };

  // Start/stop loop
  const startRef = useRef(false);
  if (visible && !startRef.current) {
    startRef.current = true;
    frameRef.current = requestAnimationFrame(updateLabels);
  }
  if (!visible && startRef.current) {
    startRef.current = false;
    cancelAnimationFrame(frameRef.current);
  }

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {ANATOMY_LABELS.map((lab) => (
        <div
          key={lab.id}
          data-label-id={lab.id}
          style={{
            position: "absolute",
            transform: "translate(-50%, -50%)",
            opacity: 0,
            transition: "opacity 0.2s",
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {/* Dot */}
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "rgba(20, 184, 166, 0.9)",
              flexShrink: 0,
              boxShadow: "0 0 4px rgba(20,184,166,0.6)",
            }}
          />
          {/* Label chip */}
          <span
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              fontSize: "10px",
              lineHeight: 1.3,
              fontWeight: 600,
              letterSpacing: "0.01em",
              padding: "2px 7px",
              borderRadius: "4px",
              background: "rgba(15, 27, 50, 0.88)",
              color: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(20,184,166,0.35)",
              backdropFilter: "blur(4px)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.45)",
            }}
          >
            {lab.name}
          </span>
        </div>
      ))}
    </div>
  );
}
