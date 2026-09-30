import { Html } from "@react-three/drei";
import { ANATOMY_LABELS } from "./types";

type Props = {
  visible: boolean;
};

/** Compact educational labels — keep them subordinate to the 3D model. */
export function HeartLabels({ visible }: Props) {
  if (!visible) return null;
  return (
    <group>
      {ANATOMY_LABELS.map((lab) => (
        <Html
          key={lab.id}
          position={lab.position}
          center
          distanceFactor={28}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <span
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              fontSize: "9px",
              lineHeight: 1.2,
              padding: "1px 5px",
              borderRadius: "3px",
              border: "1px solid rgba(148,163,184,0.7)",
              background: "rgba(255,255,255,0.88)",
              color: "#1e293b",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              transform: "scale(0.85)",
              transformOrigin: "center",
            }}
          >
            {lab.name}
          </span>
        </Html>
      ))}
    </group>
  );
}
