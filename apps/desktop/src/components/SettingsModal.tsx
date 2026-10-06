import React, { useEffect, useState } from "react";
import {
  X,
  Settings,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  Sun,
  Moon,
  Palette,
  Type,
} from "lucide-react";
import {
  fetchSettings,
  updateSettings,
  saveProfile,
  deleteProfile,
  testProfileConnection,
} from "../api/client";
import type { AIProfile, AppSettings, AppTheme } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: AppTheme;
  setTheme?: (t: AppTheme) => void;
  jaFontSize?: number;
  setJaFontSize?: (v: number) => void;
  viFontSize?: number;
  setViFontSize?: (v: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme = "dark",
  setTheme,
  jaFontSize = 26,
  setJaFontSize,
  viFontSize = 20,
  setViFontSize,
}) => {
  const [activeTab, setActiveTab] = useState<"defaults" | "profiles" | "appearance">("defaults");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [profiles, setProfiles] = useState<AIProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit / Add profile form state
  const [editingProfile, setEditingProfile] = useState<Partial<AIProfile> | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    profileId?: number;
    success?: boolean;
    message?: string;
    loading?: boolean;
  } | null>(null);

  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSettingsMsg, setSavedSettingsMsg] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchSettings();
      setSettings(data.settings);
      setProfiles(data.profiles);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleSaveDefaults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSavingSettings(true);
    setSavedSettingsMsg(false);
    try {
      await updateSettings(settings);
      setSavedSettingsMsg(true);
      setTimeout(() => setSavedSettingsMsg(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestConnection = async (profile: Partial<AIProfile>) => {
    setTestResult({ profileId: profile.id, loading: true });
    try {
      const res = await testProfileConnection({
        provider_type: profile.provider_type || "gemini",
        api_key: profile.api_key,
        base_url: profile.base_url,
        model: profile.model || "gemini-2.5-flash",
      });
      setTestResult({
        profileId: profile.id,
        success: res.success,
        message: res.message,
        loading: false,
      });
    } catch (err: any) {
      setTestResult({
        profileId: profile.id,
        success: false,
        message: err.message || "Lỗi kiểm tra kết nối",
        loading: false,
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile || !editingProfile.name || !editingProfile.model) return;
    try {
      await saveProfile(editingProfile);
      setEditingProfile(null);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProfile = async (id: number) => {
    if (confirm("Bạn có chắc chắn muốn xóa cấu hình kết nối này?")) {
      try {
        await deleteProfile(id);
        await loadData();
      } catch (e) {
        console.error(e);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full max-w-3xl rounded-2xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col text-slate-900 dark:text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="p-2 bg-indigo-500/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Cài đặt ứng dụng</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tùy chỉnh giao diện, cỡ chữ phụ đề và quản lý các kết nối AI (Gemini, Qwen, Ollama)
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700/80 mt-4 space-x-6">
          <button
            onClick={() => {
              setActiveTab("defaults");
              setEditingProfile(null);
            }}
            className={`pb-3 text-sm font-semibold transition border-b-2 ${
              activeTab === "defaults"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Mặc định ứng dụng
          </button>
          <button
            onClick={() => {
              setActiveTab("profiles");
            }}
            className={`pb-3 text-sm font-semibold transition border-b-2 ${
              activeTab === "profiles"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Danh sách kết nối AI ({profiles.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("appearance");
              setEditingProfile(null);
            }}
            className={`pb-3 text-sm font-semibold transition border-b-2 ${
              activeTab === "appearance"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Giao diện & Cỡ chữ phụ đề
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs">Đang tải cấu hình...</p>
          </div>
        ) : (
          <>
            {/* Tab 1: Default Settings */}
            {activeTab === "defaults" && settings && (
              <form onSubmit={handleSaveDefaults} className="py-5 space-y-5 flex-1 overflow-y-auto">
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Bộ nhận dạng giọng nói (ASR) mặc định
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Mô hình chịu trách nhiệm nghe âm thanh tiếng Nhật và tách câu kèm mốc thời gian.
                  </p>
                  <select
                    value={settings.default_asr_profile_id || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        default_asr_profile_id: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  >
                    {profiles
                      .filter((p) => p.can_asr)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.model})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Bộ dịch thuật song ngữ (MT) mặc định
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Mô hình chịu trách nhiệm dịch từng câu tiếng Nhật sang tiếng Việt theo ngữ cảnh.
                  </p>
                  <select
                    value={settings.default_mt_profile_id || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        default_mt_profile_id: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  >
                    {profiles
                      .filter((p) => p.can_translate)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.model})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Phong cách dịch mặc định</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, default_translation_mode: "learning" })}
                      className={`p-3 rounded-xl border text-left transition ${
                        settings.default_translation_mode === "learning"
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-950 dark:text-white"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <p className="text-xs font-bold uppercase tracking-wider">Học tập</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Dịch sát nghĩa từ và cấu trúc ngữ pháp</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, default_translation_mode: "natural" })}
                      className={`p-3 rounded-xl border text-left transition ${
                        settings.default_translation_mode === "natural"
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-950 dark:text-white"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <p className="text-xs font-bold uppercase tracking-wider">Tự nhiên</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Văn phong trôi chảy tự nhiên</p>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  {savedSettingsMsg ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Đã lưu thiết lập thành công!</span>
                    </span>
                  ) : (
                    <span></span>
                  )}
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition"
                  >
                    {savingSettings ? "Đang lưu..." : "Lưu thiết lập"}
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: Profile List & Edit */}
            {activeTab === "profiles" && (
              <div className="py-4 flex-1 overflow-y-auto space-y-4">
                {editingProfile ? (
                  /* Edit / Create Form */
                  <form
                    onSubmit={handleSaveProfile}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4 text-slate-900 dark:text-white"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {editingProfile.id ? "Chỉnh sửa kết nối AI" : "Thêm kết nối AI mới"}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setEditingProfile(null)}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                      >
                        Hủy bỏ
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                          Tên gợi nhớ
                        </label>
                        <input
                          type="text"
                          placeholder="Ví dụ: Server Qwen 3.8 Phòng Lab"
                          value={editingProfile.name || ""}
                          onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                          required
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                          Loại dịch vụ (Provider)
                        </label>
                        <select
                          value={editingProfile.provider_type || "gemini"}
                          onChange={(e) =>
                            setEditingProfile({
                              ...editingProfile,
                              provider_type: e.target.value as any,
                              can_asr: e.target.value === "gemini",
                            })
                          }
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="gemini">Google Gemini (Cloud)</option>
                          <option value="openai_compat">OpenAI Compatible (Server nội bộ / Ollama)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                          Tên mô hình (Model Name)
                        </label>
                        <input
                          type="text"
                          placeholder={editingProfile.provider_type === "gemini" ? "gemini-2.5-flash" : "qwen2.5:latest"}
                          value={editingProfile.model || ""}
                          onChange={(e) => setEditingProfile({ ...editingProfile, model: e.target.value })}
                          required
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                          {editingProfile.provider_type === "gemini" ? "Base URL (Mặc định để trống)" : "Base URL Endpoint"}
                        </label>
                        <input
                          type="text"
                          placeholder={editingProfile.provider_type === "gemini" ? "Để trống cho Gemini" : "http://localhost:11434/v1"}
                          value={editingProfile.base_url || ""}
                          onChange={(e) => setEditingProfile({ ...editingProfile, base_url: e.target.value })}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          API Key (Khóa kết nối)
                        </label>
                        {editingProfile.provider_type === "gemini" && (
                          <a
                            href="https://aistudio.google.com/"
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-indigo-500 hover:underline"
                          >
                            Lấy API key Google AI Studio
                          </a>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showApiKey ? "text" : "password"}
                          placeholder={editingProfile.provider_type === "gemini" ? "AIzaSy..." : "dummy_key hoặc khóa OpenAI của bạn"}
                          value={editingProfile.api_key || ""}
                          onChange={(e) => setEditingProfile({ ...editingProfile, api_key: e.target.value })}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Capabilities Checkboxes */}
                    <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Phân quyền vai trò:
                      </span>
                      <div className="flex items-center space-x-6 text-xs text-slate-700 dark:text-slate-200">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingProfile.can_asr || false}
                            onChange={(e) => setEditingProfile({ ...editingProfile, can_asr: e.target.checked })}
                            className="accent-indigo-500 w-4 h-4 rounded"
                          />
                          <span>Nhận dạng giọng nói (ASR)</span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingProfile.can_translate || false}
                            onChange={(e) => setEditingProfile({ ...editingProfile, can_translate: e.target.checked })}
                            className="accent-indigo-500 w-4 h-4 rounded"
                          />
                          <span>Dịch song ngữ (MT)</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => handleTestConnection(editingProfile)}
                        className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span>Thử kết nối (Ping test)</span>
                      </button>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setEditingProfile(null)}
                          className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition shadow-md shadow-indigo-600/20"
                        >
                          Lưu kết nối
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  /* Profiles List */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Bấm "Thử kết nối" để đo độ trễ và kiểm tra model có phản hồi hay không.
                      </p>
                      <button
                        onClick={() =>
                          setEditingProfile({
                            name: "",
                            provider_type: "openai_compat",
                            model: "qwen2.5:latest",
                            base_url: "http://localhost:11434/v1",
                            can_asr: false,
                            can_translate: true,
                          })
                        }
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm kết nối mới</span>
                      </button>
                    </div>

                    {profiles.map((p) => (
                      <div
                        key={p.id}
                        className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 flex flex-col space-y-3 hover:border-slate-300 dark:hover:border-slate-600 transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2.5">
                              <span className="text-base font-bold text-slate-900 dark:text-white">{p.name}</span>
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">
                                {p.provider_type === "gemini" ? "Google Gemini" : "OpenAI Compatible"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              Model: <span className="text-slate-800 dark:text-slate-200">{p.model}</span>
                              {p.base_url && <span className="ml-2 text-slate-400 dark:text-slate-500">({p.base_url})</span>}
                            </p>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => setEditingProfile(p)}
                              className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => p.id && handleDeleteProfile(p.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Roles Badges & Test Connection Button */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800/80 text-xs">
                          <div className="flex space-x-2">
                            {p.can_asr && (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                                ASR (Nghe)
                              </span>
                            )}
                            {p.can_translate && (
                              <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-semibold border border-indigo-500/20">
                                MT (Dịch song ngữ)
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => handleTestConnection(p)}
                            className="flex items-center space-x-1.5 px-3 py-1 bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 transition"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                            <span>Thử kết nối</span>
                          </button>
                        </div>

                        {/* Test result message if this profile was tested */}
                        {testResult && testResult.profileId === p.id && (
                          <div
                            className={`p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
                              testResult.loading
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                : testResult.success
                                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                : "bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400"
                            }`}
                          >
                            {testResult.loading ? (
                              <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                            ) : testResult.success ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <AlertCircle className="w-4 h-4" />
                            )}
                            <span>{testResult.loading ? "Đang gửi ping thử nghiệm..." : testResult.message}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Appearance & Font Sizes */}
            {activeTab === "appearance" && (
              <div className="py-5 space-y-5 flex-1 overflow-y-auto">
                {/* Theme Selector */}
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Palette className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Giao diện ứng dụng</h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Chọn chủ đề màu sắc hiển thị phù hợp với môi trường làm việc của bạn.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setTheme && setTheme("light")}
                      className={`p-3.5 rounded-xl border flex items-center space-x-3 transition ${
                        theme === "light"
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-950 dark:text-white shadow-sm ring-1 ring-indigo-500"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                        <Sun className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold">Chế độ Sáng (Light)</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Nền trắng tinh gọn, tương phản sắc nét</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme && setTheme("dark")}
                      className={`p-3.5 rounded-xl border flex items-center space-x-3 transition ${
                        theme === "dark"
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-950 dark:text-white shadow-sm ring-1 ring-indigo-500"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
                        <Moon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold">Chế độ Tối (Dark)</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Bảo vệ mắt, dịu nhẹ khi xem video ban đêm</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Subtitle Font Size Controls */}
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Type className="w-4 h-4 text-indigo-500" />
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Cỡ chữ phụ đề hiển thị trên video
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setJaFontSize && setJaFontSize(26);
                        setViFontSize && setViFontSize(20);
                      }}
                      className="text-xs text-indigo-500 hover:underline font-medium"
                    >
                      Khôi phục mặc định
                    </button>
                  </div>

                  {/* Japanese Font Size */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        🇯🇵 Tiếng Nhật (kèm Furigana):
                      </label>
                      <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {jaFontSize}px
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={() => setJaFontSize && setJaFontSize(Math.max(16, jaFontSize - 2))}
                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min={18}
                        max={42}
                        step={2}
                        value={jaFontSize}
                        onChange={(e) => setJaFontSize && setJaFontSize(parseInt(e.target.value))}
                        className="flex-1 accent-indigo-600 dark:accent-indigo-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setJaFontSize && setJaFontSize(Math.min(42, jaFontSize + 2))}
                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Vietnamese Font Size */}
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        🇻🇳 Tiếng Việt (Bản dịch song ngữ):
                      </label>
                      <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {viFontSize}px
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={() => setViFontSize && setViFontSize(Math.max(14, viFontSize - 2))}
                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min={14}
                        max={36}
                        step={2}
                        value={viFontSize}
                        onChange={(e) => setViFontSize && setViFontSize(parseInt(e.target.value))}
                        className="flex-1 accent-emerald-600 dark:accent-emerald-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setViFontSize && setViFontSize(Math.min(36, viFontSize + 2))}
                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Live Subtitle Preview */}
                  <div className="pt-3">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Xem trước phụ đề thực tế:
                    </p>
                    <div className="bg-black/85 backdrop-blur-md rounded-2xl p-4 text-center border border-white/10 shadow-xl space-y-2">
                      <div
                        style={{ fontSize: `${jaFontSize}px`, lineHeight: 1.35 }}
                        className="font-semibold text-white tracking-wide"
                      >
                        <ruby>
                          最近<rt>さいきん</rt>
                        </ruby>{" "}
                        は いろんな アプリ が ある し 、 AI も ある し
                      </div>
                      <div
                        style={{ fontSize: `${viFontSize}px`, lineHeight: 1.35 }}
                        className="font-medium text-emerald-400 dark:text-emerald-300"
                      >
                        Gần đây có rất nhiều ứng dụng, có cả AI, tôi nghĩ việc học sẽ dễ dàng hơn.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
