/** Research visualization types — not clinical diagnoses. */

export type ResearchVizState =
  | "STABLE"
  | "DEVIATION"
  | "ELEVATED_RESEARCH_RISK"
  | "INSUFFICIENT_EVIDENCE"
  | "NO_DATA";

export type VisualizationMode = "anatomy" | "cardiac_state";

export type CardiacVisualizationState = {
  heartRate: number | null;
  signalQuality: number | null;
  baselineDeviation: number | null;
  currentState: string;
  forecastStatus: string;
  modelAvailable: boolean;
  dataAvailable: boolean;
  vizState: ResearchVizState;
  rrMeanSeconds: number | null;
  rPeakTimesS: number[];
  baselineWindowLabel: string | null;
  currentStateUpdatedAt: string | null;
  forecastScore: number | null;
  forecastTarget: string | null;
  observationWindowS: number | null;
  forecastHorizonS: number | null;
  groundTruth: number | null;
  leadTimeSeconds: number | null;
  syntheticNotice: string | null;
};

export type TwinHistoryPoint = {
  id?: string;
  timestamp: number;
  deviation_score: number | null;
  label: string;
};

export type HeartControlsState = {
  autoRotate: boolean;
  paused: boolean;
  showLabels: boolean;
  mode: VisualizationMode;
};

export type HeartMaterialPreset = {
  color: string;
  emissive: string;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
  pulseAmplitude: number;
};

export const EMPTY_VISUALIZATION_STATE: CardiacVisualizationState = {
  heartRate: null,
  signalQuality: null,
  baselineDeviation: null,
  currentState: "Waiting for ECG data",
  forecastStatus: "Forecast unavailable — model not trained.",
  modelAvailable: false,
  dataAvailable: false,
  vizState: "NO_DATA",
  rrMeanSeconds: null,
  rPeakTimesS: [],
  baselineWindowLabel: null,
  currentStateUpdatedAt: null,
  forecastScore: null,
  forecastTarget: null,
  observationWindowS: null,
  forecastHorizonS: null,
  groundTruth: null,
  leadTimeSeconds: null,
  syntheticNotice: null,
};

export const ANATOMY_LABELS = [
  { id: "ra", name: "Right atrium", position: [0.72, 0.18, 0.18] as [number, number, number] },
  { id: "la", name: "Left atrium", position: [-0.62, 0.22, -0.08] as [number, number, number] },
  { id: "rv", name: "Right ventricle", position: [0.62, -0.28, 0.38] as [number, number, number] },
  { id: "lv", name: "Left ventricle", position: [-0.52, -0.42, 0.22] as [number, number, number] },
  { id: "aorta", name: "Aorta", position: [-0.08, 0.95, 0.02] as [number, number, number] },
  { id: "pa", name: "Pulmonary artery", position: [0.38, 0.82, 0.28] as [number, number, number] },
] as const;
