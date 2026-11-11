/**
 * Minimal hand-written type definitions matching the Supabase schema.
 * Generate the full version with: npx supabase gen types typescript --project-id YOUR_ID
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          role: string;
          institution: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Omit<Database["public"]["Tables"]["profiles"]["Row"], "id" | "role" | "created_at" | "updated_at">>;
      };
      recordings: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          file_name: string;
          storage_path: string | null;
          file_type: string | null;
          file_size: number | null;
          recording_source: string | null;
          dataset_name: string | null;
          duration_seconds: number | null;
          sampling_rate: number | null;
          lead_information: string | null;
          is_synthetic: boolean;
          recording_metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["recordings"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["recordings"]["Insert"]>;
      };
      ecg_analyses: {
        Row: {
          id: string;
          user_id: string;
          recording_id: string;
          analysis_status: string;
          signal_quality: number | null;
          heart_rate: number | null;
          hrv_metrics: Json | null;
          r_peak_count: number | null;
          extracted_features: Json | null;
          preprocessing_metadata: Json | null;
          analysis_summary: string | null;
          error_message: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["ecg_analyses"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["ecg_analyses"]["Insert"]>;
      };
      digital_twin_states: {
        Row: {
          id: string;
          user_id: string;
          recording_id: string;
          analysis_id: string | null;
          baseline_data: Json | null;
          state_vector: Json | null;
          physiological_features: Json | null;
          deviation_metrics: Json | null;
          state_metadata: Json | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["digital_twin_states"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["digital_twin_states"]["Insert"]>;
      };
      forecasts: {
        Row: {
          id: string;
          user_id: string;
          recording_id: string;
          analysis_id: string | null;
          digital_twin_state_id: string | null;
          model_name: string | null;
          model_version: string | null;
          observation_window: number | null;
          prediction_horizon: number | null;
          forecast_output: Json | null;
          uncertainty_data: Json | null;
          experimental_risk_estimate: number | null;
          forecast_status: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["forecasts"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["forecasts"]["Insert"]>;
      };
      experiments: {
        Row: {
          id: string;
          user_id: string;
          recording_id: string | null;
          analysis_id: string | null;
          experiment_name: string;
          experiment_type: string;
          parameters: Json | null;
          results: Json | null;
          experiment_status: string;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["experiments"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["experiments"]["Insert"]>;
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          theme: string;
          preferred_visualization: string;
          anatomy_labels_enabled: boolean;
          auto_rotate_enabled: boolean;
          notification_preferences: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_preferences"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["user_preferences"]["Insert"]>;
      };
    };
  };
}
