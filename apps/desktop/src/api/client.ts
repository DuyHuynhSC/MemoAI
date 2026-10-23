import type {
  Project,
  Segment,
  Vocab,
  WordDefinition,
  AIProfile,
  AppSettings,
  ProfileTestResult,
  User,
  AuthResponse,
} from "../types";

export const DEFAULT_API_BASE = "http://127.0.0.1:8000";

export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("memoai_api_base");
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, "");
  }
  return DEFAULT_API_BASE;
}

export function setApiBase(url: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("memoai_api_base", url.trim().replace(/\/+$/, ""));
  }
}

// ==================== AUTH TOKEN MANAGEMENT ====================

export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("memoai_auth_token");
  }
  return null;
}

export function setAuthToken(token: string | null) {
  if (typeof window !== "undefined") {
    if (token) localStorage.setItem("memoai_auth_token", token);
    else localStorage.removeItem("memoai_auth_token");
  }
}

export function getAuthUser(): User | null {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem("memoai_auth_user");
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function setAuthUser(user: User | null) {
  if (typeof window !== "undefined") {
    if (user) localStorage.setItem("memoai_auth_user", JSON.stringify(user));
    else localStorage.removeItem("memoai_auth_user");
  }
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function registerUser(payload: {
  username: string;
  password: string;
  full_name?: string;
  gemini_api_key?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${getApiBase()}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Đăng ký thất bại");
  }
  const data: AuthResponse = await res.json();
  setAuthToken(data.access_token);
  setAuthUser(data.user);
  return data;
}

export async function loginUser(payload: { username: string; password: string }): Promise<AuthResponse> {
  const res = await fetch(`${getApiBase()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Đăng nhập thất bại");
  }
  const data: AuthResponse = await res.json();
  setAuthToken(data.access_token);
  setAuthUser(data.user);
  return data;
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await fetch(`${getApiBase()}/api/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Chưa đăng nhập");
  return res.json();
}

export async function fetchAllUsers(): Promise<User[]> {
  const res = await fetch(`${getApiBase()}/api/auth/users`);
  if (!res.ok) throw new Error("Không thể tải danh sách tài khoản");
  return res.json();
}

export function logoutUser() {
  setAuthToken(null);
  setAuthUser(null);
}

// ==================== PROJECTS ====================

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${getApiBase()}/api/projects`, {
    headers: getAuthHeaders(),
  });
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
  const res = await fetch(`${getApiBase()}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create project");
  return res.json();
}

export async function uploadProjectMedia(formData: FormData): Promise<Project> {
  const res = await fetch(`${getApiBase()}/api/projects/upload`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to upload and create project");
  }
  return res.json();
}

export async function updateProject(id: number, payload: { title?: string }): Promise<Project> {
  const res = await fetch(`${getApiBase()}/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update project");
  return res.json();
}

export async function fetchMediaInfo(url: string): Promise<{ title?: string; duration?: number; error?: string }> {
  const params = new URLSearchParams({ url });
  const res = await fetch(`${getApiBase()}/api/media/fetch-info?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch media info");
  return res.json();
}

export async function fetchProject(id: number): Promise<{ project: Project; segments: Segment[] }> {
  const res = await fetch(`${getApiBase()}/api/projects/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load project details");
  return res.json();
}

export async function deleteProject(id: number): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/projects/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete project");
}

export async function fetchProjectLogs(id: number): Promise<{
  project_id: number;
  status: string;
  current_step: string;
  error_msg?: string;
  logs: string;
}> {
  const res = await fetch(`${getApiBase()}/api/projects/${id}/logs`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch project logs");
  return res.json();
}

export async function retryProject(
  id: number,
  payload?: { asr_profile_id?: number; mt_profile_id?: number }
): Promise<Project> {
  const res = await fetch(`${getApiBase()}/api/projects/${id}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error("Failed to retry project");
  return res.json();
}

export async function lookupWord(q: string, context?: string): Promise<WordDefinition> {
  const params = new URLSearchParams({ q });
  if (context) params.append("context", context);
  const res = await fetch(`${getApiBase()}/api/dictionary/lookup?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to lookup word");
  return res.json();
}

export async function fetchVocab(): Promise<Vocab[]> {
  const res = await fetch(`${getApiBase()}/api/vocab`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load vocab");
  return res.json();
}

export async function addVocab(payload: Partial<Vocab>): Promise<Vocab> {
  const res = await fetch(`${getApiBase()}/api/vocab`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save vocab");
  return res.json();
}

export async function deleteVocab(id: number): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/vocab/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete vocab");
}

export function getAnkiExportUrl(): string {
  const token = getAuthToken();
  if (token) {
    return `${getApiBase()}/api/vocab/export/anki?token=${encodeURIComponent(token)}`;
  }
  return `${getApiBase()}/api/vocab/export/anki`;
}

export function getMediaUrl(projectId: number): string {
  return `${getApiBase()}/api/media/${projectId}`;
}

// ==================== SETTINGS & PROFILES ====================

export async function fetchSettings(): Promise<{ settings: AppSettings; profiles: AIProfile[]; user?: User }> {
  const res = await fetch(`${getApiBase()}/api/settings`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

export async function updateSettings(payload: Partial<AppSettings>): Promise<AppSettings> {
  const res = await fetch(`${getApiBase()}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update settings");
  return res.json();
}

export async function fetchProfiles(): Promise<AIProfile[]> {
  const res = await fetch(`${getApiBase()}/api/settings/profiles`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch profiles");
  return res.json();
}

export async function saveProfile(profile: Partial<AIProfile>): Promise<AIProfile> {
  const isEdit = !!profile.id;
  const url = isEdit
    ? `${getApiBase()}/api/settings/profiles/${profile.id}`
    : `${getApiBase()}/api/settings/profiles`;
  const method = isEdit ? "PUT" : "POST";
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error("Failed to save profile");
  return res.json();
}

export async function deleteProfile(id: number): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/settings/profiles/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete profile");
}

export async function testProfileConnection(payload: {
  provider_type: string;
  api_key?: string;
  base_url?: string;
  model: string;
  proxy_mode?: string;
  can_asr?: boolean;
  can_translate?: boolean;
}): Promise<ProfileTestResult> {
  const res = await fetch(`${getApiBase()}/api/settings/profiles/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
  const res = await fetch(`${getApiBase()}/api/settings/test-network`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to test network connection");
  return res.json();
}

export async function uploadCaCertificate(payload: {
  filename: string;
  content: string;
}): Promise<{ file_path: string; filename: string; size: number }> {
  const res = await fetch(`${getApiBase()}/api/settings/upload-ca`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to save certificate");
  }
  return res.json();
}

export async function fetchHardwareInfo(): Promise<import("../types").HardwareInfo> {
  const res = await fetch(`${getApiBase()}/api/system/hardware`);
  if (!res.ok) throw new Error("Failed to fetch hardware information");
  return res.json();
}

export async function fetchOfflineModels(): Promise<import("../types").OfflineModelsResponse> {
  const res = await fetch(`${getApiBase()}/api/asr/offline/models`);
  if (!res.ok) throw new Error("Failed to fetch offline models");
  return res.json();
}

export async function downloadOfflineModel(modelId: string): Promise<{ ok: boolean; message: string; status: string }> {
  const res = await fetch(`${getApiBase()}/api/asr/offline/models/${modelId}/download`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to start download");
  }
  return res.json();
}

export async function fetchOfflineModelProgress(modelId: string): Promise<import("../types").OfflineModelProgress> {
  const res = await fetch(`${getApiBase()}/api/asr/offline/models/${modelId}/progress`);
  if (!res.ok) throw new Error("Failed to fetch model download progress");
  return res.json();
}

export async function cancelOfflineModelDownload(modelId: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${getApiBase()}/api/asr/offline/models/${modelId}/cancel`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to cancel download");
  return res.json();
}

export async function deleteOfflineModel(modelId: string): Promise<{ ok: boolean; message: string; freed_mb: number }> {
  const res = await fetch(`${getApiBase()}/api/asr/offline/models/${modelId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete model");
  return res.json();
}

export async function quickTestOfflineModel(modelId: string): Promise<{
  ok: boolean;
  latency_ms: number;
  device: string;
  compute_type: string;
  message: string;
}> {
  const res = await fetch(`${getApiBase()}/api/asr/offline/models/${modelId}/quick-test`, {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Quick test failed");
  return data;
}


// ==================== ADMIN USER MANAGEMENT ====================

export async function fetchAdminUsers(): Promise<User[]> {
  const res = await fetch(`${getApiBase()}/api/admin/users`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Không thể tải danh sách người dùng");
  }
  return res.json();
}

export async function updateAdminUser(
  userId: number,
  payload: { full_name?: string; role?: "admin" | "user"; password?: string; is_active?: boolean }
): Promise<User> {
  const res = await fetch(`${getApiBase()}/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Không thể cập nhật người dùng");
  }
  return res.json();
}

export async function deleteAdminUser(userId: number): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/admin/users/${userId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Không thể xóa người dùng");
  }
}
