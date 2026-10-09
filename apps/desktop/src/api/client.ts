import type { Project, Segment, Vocab, WordDefinition, AIProfile, AppSettings } from "../types";

export const API_BASE = "http://127.0.0.1:8000";

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/api/projects`);
  if (!res.ok) throw new Error("Failed to load projects");
  return res.json();
}

export async function createProject(payload: {
  url_or_path: string;
  title?: string;
  source_lang?: string;
  target_lang?: string;
  asr_provider?: string;
  mt_provider?: string;
  asr_profile_id?: number;
  mt_profile_id?: number;
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

export async function updateProject(id: number, payload: { title?: string }): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update project");
  return res.json();
}

export async function fetchMediaInfo(url: string): Promise<{ title?: string; duration?: number; error?: string }> {
  const params = new URLSearchParams({ url });
  const res = await fetch(`${API_BASE}/api/media/fetch-info?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch media info");
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

export async function fetchProjectLogs(id: number): Promise<{
  project_id: number;
  status: string;
  current_step: string;
  error_msg?: string;
  logs: string;
}> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/logs`);
  if (!res.ok) throw new Error("Failed to fetch project logs");
  return res.json();
}

export async function retryProject(id: number): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/retry`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to retry project");
  return res.json();
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

// ==================== SETTINGS & PROFILES ====================

export async function fetchSettings(): Promise<{ settings: AppSettings; profiles: AIProfile[] }> {
  const res = await fetch(`${API_BASE}/api/settings`);
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

export async function updateSettings(payload: Partial<AppSettings>): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update settings");
  return res.json();
}

export async function fetchProfiles(): Promise<AIProfile[]> {
  const res = await fetch(`${API_BASE}/api/settings/profiles`);
  if (!res.ok) throw new Error("Failed to fetch profiles");
  return res.json();
}

export async function saveProfile(profile: Partial<AIProfile>): Promise<AIProfile> {
  const isEdit = !!profile.id;
  const url = isEdit
    ? `${API_BASE}/api/settings/profiles/${profile.id}`
    : `${API_BASE}/api/settings/profiles`;
  const method = isEdit ? "PUT" : "POST";
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error("Failed to save profile");
  return res.json();
}

export async function deleteProfile(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/settings/profiles/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete profile");
}

export async function testProfileConnection(payload: {
  provider_type: string;
  api_key?: string;
  base_url?: string;
  model: string;
}): Promise<{ success: boolean; latency_ms?: number; message: string }> {
  const res = await fetch(`${API_BASE}/api/settings/profiles/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to test connection");
  return res.json();
}

export async function testNetworkConnection(payload: {
  proxy_enabled: boolean;
  http_proxy?: string;
  https_proxy?: string;
  no_proxy?: string;
  ca_cert_path?: string;
  insecure_skip_verify?: boolean;
}): Promise<import("../types").NetworkTestResult> {
  const res = await fetch(`${API_BASE}/api/settings/test-network`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to test network connection");
  return res.json();
}

export async function uploadCaCertificate(payload: {
  filename: string;
  content: string;
}): Promise<{ file_path: string; filename: string; size: number }> {
  const res = await fetch(`${API_BASE}/api/settings/upload-ca`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to save certificate");
  }
  return res.json();
}

