import type { Project, Segment, Vocab, WordDefinition } from "../types";

export const API_BASE = "http://127.0.0.1:8000";

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/api/projects`);
  if (!res.ok) throw new Error("Failed to load projects");
  return res.json();
}

export async function createProject(payload: {
  url_or_path: string;
  source_lang?: string;
  target_lang?: string;
  asr_provider?: string;
  mt_provider?: string;
  gemini_key?: string;
  openai_base_url?: string;
  openai_model?: string;
  mode?: string;
}): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create project");
  return res.json();
}

export async function fetchProject(id: number): Promise<{ project: Project; segments: Segment[] }> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`);
  if (!res.ok) throw new Error("Failed to load project details");
  return res.json();
}

export async function deleteProject(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete project");
}

export async function lookupWord(q: string, context?: string): Promise<WordDefinition> {
  const params = new URLSearchParams({ q });
  if (context) params.append("context", context);
  const res = await fetch(`${API_BASE}/api/dictionary/lookup?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to lookup word");
  return res.json();
}

export async function fetchVocab(): Promise<Vocab[]> {
  const res = await fetch(`${API_BASE}/api/vocab`);
  if (!res.ok) throw new Error("Failed to load vocab");
  return res.json();
}

export async function addVocab(payload: Partial<Vocab>): Promise<Vocab> {
  const res = await fetch(`${API_BASE}/api/vocab`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save vocab");
  return res.json();
}

export async function deleteVocab(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/vocab/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete vocab");
}

export function getAnkiExportUrl(): string {
  return `${API_BASE}/api/vocab/export/anki`;
}

export function getMediaUrl(projectId: number): string {
  return `${API_BASE}/api/media/${projectId}`;
}
