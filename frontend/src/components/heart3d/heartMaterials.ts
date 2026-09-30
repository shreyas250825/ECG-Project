import type { HeartMaterialPreset, ResearchVizState, VisualizationMode } from "./types";

/** Restrained biomedical palette — subtle teal/navy, no dramatic red flash. */
const PRESETS: Record<ResearchVizState, HeartMaterialPreset> = {
  STABLE: {
    color: "#8b1e2d",
    emissive: "#3a1018",
    emissiveIntensity: 0.12,
    roughness: 0.38,
    metalness: 0.02,
    pulseAmplitude: 0.035,
  },
  DEVIATION: {
    color: "#942436",
    emissive: "#4a1820",
    emissiveIntensity: 0.16,
    roughness: 0.36,
    metalness: 0.03,
    pulseAmplitude: 0.05,
  },
  ELEVATED_RESEARCH_RISK: {
    color: "#a02838",
    emissive: "#5a2010",
    emissiveIntensity: 0.2,
    roughness: 0.34,
    metalness: 0.04,
    pulseAmplitude: 0.06,
  },
  INSUFFICIENT_EVIDENCE: {
    color: "#6a6064",
    emissive: "#2a2830",
    emissiveIntensity: 0.04,
    roughness: 0.65,
    metalness: 0.02,
    pulseAmplitude: 0.02,
  },
  NO_DATA: {
    color: "#7a2a36",
    emissive: "#2a1014",
    emissiveIntensity: 0.08,
    roughness: 0.4,
    metalness: 0.02,
    pulseAmplitude: 0,
  },
};

export function materialForState(state: ResearchVizState, mode: VisualizationMode): HeartMaterialPreset {
  if (mode === "anatomy") {
    return {
      color: "#9a2232",
      emissive: "#3a1018",
      emissiveIntensity: 0.1,
      roughness: 0.36,
      metalness: 0.02,
      pulseAmplitude: PRESETS[state].pulseAmplitude * 0.55,
    };
  }
  return PRESETS[state];
}

export function vesselMaterial(state: ResearchVizState) {
  if (state === "NO_DATA" || state === "INSUFFICIENT_EVIDENCE") {
    return { color: "#8a929a", emissive: "#3d4650", emissiveIntensity: 0.02 };
  }
  return { color: "#c45a4a", emissive: "#2a5f8f", emissiveIntensity: 0.05 };
}
