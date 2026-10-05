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
} from "lucide-react";
import {
  fetchSettings,
  updateSettings,
  saveProfile,
  deleteProfile,
  testProfileConnection,
} from "../api/client";
import type { AIProfile, AppSettings } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"defaults" | "profiles">("defaults");
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
      <div className="bg-slate-800 border border-slate-700 w-full max-w-3xl rounded-2xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-700">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Cài đặt kết nối & Mô hình AI</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Quản lý các kết nối tới Google Gemini, server Qwen nội bộ, Ollama, LM Studio
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700/80 mt-4 space-x-6">
          <button
            onClick={() => {
              setActiveTab("defaults");
              setEditingProfile(null);
            }}
            className={`pb-3 text-sm font-semibold transition border-b-2 ${
              activeTab === "defaults"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Mặc định ứng dụng
          </button>
          <button
            onClick={() => setActiveTab("profiles")}
            className={`pb-3 text-sm font-semibold transition border-b-2 ${
              activeTab === "profiles"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Danh sách kết nối AI ({profiles.length})
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs">Đang tải cấu hình kết nối...</p>
          </div>
        ) : (
          <>
            {/* Tab 1: Default Settings */}
            {activeTab === "defaults" && settings && (
              <form onSubmit={handleSaveDefaults} className="py-5 space-y-5 flex-1 overflow-y-auto">
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-bold text-slate-200">Bộ nhận dạng giọng nói (ASR) mặc định</h3>
              <p className="text-xs text-slate-400">
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
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
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

            <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-bold text-slate-200">Bộ dịch thuật song ngữ (MT) mặc định</h3>
              <p className="text-xs text-slate-400">
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
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
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

            <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-200">Phong cách dịch mặc định</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, default_translation_mode: "learning" })}
                  className={`p-3 rounded-xl border text-left transition ${
                    settings.default_translation_mode === "learning"
                      ? "border-indigo-500 bg-indigo-500/15 text-white"
                      : "border-slate-700 bg-slate-800 text-slate-400"
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider">Học tập</p>
                  <p className="text-xs text-slate-400 mt-1">Dịch sát nghĩa từ và cấu trúc ngữ pháp</p>
                </button>

                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, default_translation_mode: "natural" })}
                  className={`p-3 rounded-xl border text-left transition ${
                    settings.default_translation_mode === "natural"
                      ? "border-indigo-500 bg-indigo-500/15 text-white"
                      : "border-slate-700 bg-slate-800 text-slate-400"
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider">Tự nhiên</p>
                  <p className="text-xs text-slate-400 mt-1">Văn phong trôi chảy tự nhiên</p>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {savedSettingsMsg ? (
                <span className="text-xs text-emerald-400 flex items-center space-x-1">
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
              <form onSubmit={handleSaveProfile} className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white">
                    {editingProfile.id ? "Chỉnh sửa kết nối AI" : "Thêm kết nối AI mới"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingProfile(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Hủy bỏ
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Tên gợi nhớ
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Server Qwen 3.8 Phòng Lab"
                      value={editingProfile.name || ""}
                      onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
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
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="gemini">Google Gemini API</option>
                      <option value="openai_compat">
                        Server tương thích OpenAI (Qwen / Ollama / LM Studio)
                      </option>
                    </select>
                  </div>
                </div>

                {editingProfile.provider_type === "openai_compat" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Base URL Server
                    </label>
                    <input
                      type="text"
                      placeholder="http://192.168.1.100:8000/v1 hoặc http://localhost:11434/v1"
                      value={editingProfile.base_url || ""}
                      onChange={(e) => setEditingProfile({ ...editingProfile, base_url: e.target.value })}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      API Key {editingProfile.provider_type === "openai_compat" && "(nếu có)"}
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        placeholder={editingProfile.provider_type === "gemini" ? "AIzaSy..." : "dummy_key"}
                        value={editingProfile.api_key || ""}
                        onChange={(e) => setEditingProfile({ ...editingProfile, api_key: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Tên mô hình (Model)
                    </label>
                    <input
                      type="text"
                      placeholder={
                        editingProfile.provider_type === "gemini" ? "gemini-2.5-flash" : "qwen2.5:latest hoặc qwen3.8"
                      }
                      value={editingProfile.model || ""}
                      onChange={(e) => setEditingProfile({ ...editingProfile, model: e.target.value })}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Capabilities */}
                <div className="flex items-center space-x-6 pt-2">
                  <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingProfile.can_asr ?? true}
                      onChange={(e) => setEditingProfile({ ...editingProfile, can_asr: e.target.checked })}
                      className="w-4 h-4 accent-indigo-500 rounded"
                    />
                    <span>Dùng cho Nhận dạng giọng nói (ASR)</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingProfile.can_translate ?? true}
                      onChange={(e) => setEditingProfile({ ...editingProfile, can_translate: e.target.checked })}
                      className="w-4 h-4 accent-indigo-500 rounded"
                    />
                    <span>Dùng cho Dịch song ngữ (MT)</span>
                  </label>
                </div>

                {/* Test Feedback */}
                {testResult && testResult.profileId === editingProfile.id && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                      testResult.loading
                        ? "bg-slate-800 text-slate-400"
                        : testResult.success
                        ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                        : "bg-red-500/15 border border-red-500/30 text-red-400"
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

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleTestConnection(editingProfile)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Thử kết nối</span>
                  </button>

                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setEditingProfile(null)}
                      className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition"
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
                  <p className="text-xs text-slate-400">
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
                    className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 flex flex-col space-y-3 hover:border-slate-600 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2.5">
                          <span className="text-base font-bold text-white">{p.name}</span>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-800 text-indigo-400 border border-slate-700">
                            {p.provider_type === "gemini" ? "Google Gemini" : "OpenAI Compatible"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono">
                          Model: <span className="text-slate-200">{p.model}</span>
                          {p.base_url && <span className="ml-2 text-slate-500">({p.base_url})</span>}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => setEditingProfile(p)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => p.id && handleDeleteProfile(p.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Roles Badges & Test Connection Button */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
                      <div className="flex space-x-2">
                        {p.can_asr && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                            ASR (Nghe)
                          </span>
                        )}
                        {p.can_translate && (
                          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-semibold border border-indigo-500/20">
                            MT (Dịch song ngữ)
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleTestConnection(p)}
                        className="flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Thử kết nối</span>
                      </button>
                    </div>

                    {/* Test result message if this profile was tested */}
                    {testResult && testResult.profileId === p.id && (
                      <div
                        className={`p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
                          testResult.loading
                            ? "bg-slate-800 text-slate-400"
                            : testResult.success
                            ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                            : "bg-red-500/15 border border-red-500/30 text-red-400"
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
          </>
        )}
      </div>
    </div>
  );
};
