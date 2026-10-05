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
