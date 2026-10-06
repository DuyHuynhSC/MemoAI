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
  created_at: string;
}

export interface Vocab {
  id: number;
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
  name: string;
  provider_type: "gemini" | "openai_compat";
  api_key?: string;
  base_url?: string;
  model: string;
  can_asr: boolean;
  can_translate: boolean;
  created_at?: string;
}

export interface AppSettings {
  id: number;
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


export type AppTheme = "light" | "dark";

export interface SubtitleSettings {
  jaFontSize: number;
  viFontSize: number;
}
