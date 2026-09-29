export type ResearchRecord = {
  id: string;
  source_dataset?: string;
  record_name: string;
  sampling_rate: number;
  duration_seconds: number;
  lead_count?: number;
  format?: string;
  has_annotations?: boolean;
  privacy_status?: string;
  synthetic?: boolean;
  disclaimer?: string;
  source_url?: string;
  purpose?: string;
  lead?: string;
};

export type PipelineStage = {
  id: string;
  title: string;
  does: string;
  input: string;
  output: string;
  algorithm: string;
  reason: string;
  limitations: string;
};
