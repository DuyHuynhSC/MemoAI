export interface User {
  id: number;
  username: string;
  full_name?: string | null;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Token {
  surface: string;
  reading?: string;
  pos?: string;
  romanized?: string;
}

export interface Segment {
  id: number;
  idx: number;
  start: number;
  end: number;
  text: string;
  translation?: string;
  ruby_html?: string;
  romanized?: string;
  tokens?: Token[];
}

export interface Project {
  id: number;
  user_id?: number;
  title: string;
  source_type: "url" | "file";
  source_uri: string;
  media_path?: string;
  source_lang: string;
  target_lang: string;
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  current_step: string;
  error_msg?: string;
  asr_profile_id?: number;
  mt_profile_id?: number;
  asr_provider?: string;
  mt_provider?: string;
  asr_model?: string;
  mt_model?: string;
  created_at: string;
}

export interface Vocab {
  id: number;
  user_id?: number;
  word: string;
  reading?: string;
  romanized?: string;
  meaning: string;
  jlpt?: string;
  pos?: string;
  context_sentence?: string;
  context_translation?: string;
  created_at: string;
}

export interface WordDefinition {
  word: string;
  reading?: string;
  romanized?: string;
  ruby_html?: string;
  meaning: string;
  jlpt?: string;
  pos?: string;
  context_sentence?: string;
  saved?: boolean;
}

export interface AIProfile {
  id?: number;
  user_id?: number;
  name: string;
  provider_type: "gemini" | "openai_compat" | "faster_whisper";
  api_key?: string;
  base_url?: string;
  model: string;
  can_asr: boolean;
  can_translate: boolean;
  proxy_mode?: "auto" | "always" | "never";
  created_at?: string;
}

export interface HardwareInfo {
  platform: string;
  cpu_cores: number;
  ram_total_gb: number;
  ram_avail_gb: number;
  cuda_available: boolean;
  cuda_device_count: number;
  cuda_device_name?: string | null;
  cpu_supported_compute_types: string[];
  cuda_supported_compute_types: string[];
  recommended_device: string;
  recommended_compute_type: string;
  recommended_model: string;
  recommendation_reason: string;
}

export interface OfflineModelItem {
  id: string;
  name: string;
  repo_id: string;
  size_mb: number;
  recommended_for: string;
  description: string;
  is_recommended: boolean;
  is_downloaded: boolean;
  local_path?: string | null;
  disk_size_mb: number;
  status: "not_downloaded" | "downloading" | "completed" | "error" | "cancelled";
  progress: number;
  downloaded_bytes: number;
  total_bytes: number;
  speed_mb_s: number;
  eta_seconds?: number | null;
  error_msg?: string | null;
}

export interface OfflineModelsResponse {
  engine: string;
  models: OfflineModelItem[];
  hardware: HardwareInfo;
}

export interface OfflineModelProgress {
  model_id: string;
  status: "not_downloaded" | "downloading" | "completed" | "error" | "cancelled";
  progress: number;
  downloaded_bytes: number;
  total_bytes: number;
  speed_mb_s: number;
  eta_seconds?: number | null;
  error_msg?: string | null;
  is_downloaded: boolean;
  local_path?: string | null;
  disk_size_mb: number;
}

export interface AppSettings {
  id: number;
  user_id?: number;
  default_asr_profile_id?: number;
  default_mt_profile_id?: number;
  default_translation_mode: string;
  proxy_enabled?: boolean;
  http_proxy?: string;
  https_proxy?: string;
  no_proxy?: string;
  ca_cert_path?: string;
  insecure_skip_verify?: boolean;
}

export interface NetworkTestResult {
  success: boolean;
  message: string;
  youtube?: {
    success: boolean;
    latency_ms?: number;
    status_code?: number;
    error?: string;
    message: string;
  };
  gemini?: {
    success: boolean;
    latency_ms?: number;
    status_code?: number;
    error?: string;
    message: string;
  };
}


export interface ProfileTestResult {
  profileId?: number;
  success: boolean;
  loading?: boolean;
  latency_ms?: number;
  message: string;
  chat_ok?: boolean;
  chat_message?: string;
  asr_tested?: boolean;
  asr_supported?: boolean;
  asr_message?: string;
  discovered_models?: string[];
}

export type AppTheme = "light" | "dark";

export interface SubtitleSettings {
  jaFontSize: number;
  viFontSize: number;
}
