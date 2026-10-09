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
  Globe,
  Shield,
  Upload,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  fetchSettings,
  updateSettings,
  saveProfile,
  deleteProfile,
  testProfileConnection,
  testNetworkConnection,
  uploadCaCertificate,
} from "../api/client";
import type { AIProfile, AppSettings, AppTheme, NetworkTestResult, ProfileTestResult } from "../types";

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
  const [activeTab, setActiveTab] = useState<"defaults" | "profiles" | "appearance" | "network">("defaults");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [profiles, setProfiles] = useState<AIProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit / Add profile form state
  const [editingProfile, setEditingProfile] = useState<Partial<AIProfile> | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<(ProfileTestResult & { loading?: boolean }) | null>(null);

  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSettingsMsg, setSavedSettingsMsg] = useState(false);

  // Network & Proxy tab state
  const [savingNetwork, setSavingNetwork] = useState(false);
  const [savedNetworkMsg, setSavedNetworkMsg] = useState(false);
  const [testingNetwork, setTestingNetwork] = useState(false);
  const [networkTestResult, setNetworkTestResult] = useState<NetworkTestResult | null>(null);
  const [uploadingCa, setUploadingCa] = useState(false);
  const [uploadCaMsg, setUploadCaMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchSettings();
      const validAsr = data.profiles.filter((p) => p.can_asr);
      const validMt = data.profiles.filter((p) => p.can_translate);
      const s = { ...data.settings };
      if (!s.default_asr_profile_id || !validAsr.some((p) => p.id === s.default_asr_profile_id)) {
        const geminiAsr = validAsr.find((p) => p.provider_type === "gemini") || validAsr[0];
        if (geminiAsr) s.default_asr_profile_id = geminiAsr.id;
      }
      if (!s.default_mt_profile_id || !validMt.some((p) => p.id === s.default_mt_profile_id)) {
        const geminiMt = validMt.find((p) => p.provider_type === "gemini") || validMt[0];
        if (geminiMt) s.default_mt_profile_id = geminiMt.id;
      }
      setSettings(s);
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
    setTestResult({
      profileId: profile.id,
      loading: true,
      success: false,
      message: "Đang kiểm tra kết nối...",
    });
    try {
      const res = await testProfileConnection({
        provider_type: profile.provider_type || "gemini",
        api_key: profile.api_key,
        base_url: profile.base_url,
        model: profile.model || "gemini-2.5-flash",
        proxy_mode: profile.proxy_mode || "auto",
        can_asr: profile.can_asr ?? false,
        can_translate: profile.can_translate ?? true,
      });
      setTestResult({
        ...res,
        profileId: profile.id,
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

  const handleSaveNetwork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSavingNetwork(true);
    setSavedNetworkMsg(false);
    try {
      await updateSettings(settings);
      setSavedNetworkMsg(true);
      setTimeout(() => setSavedNetworkMsg(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingNetwork(false);
    }
  };

  const handleTestNetwork = async () => {
    if (!settings) return;
    setTestingNetwork(true);
    setNetworkTestResult(null);
    try {
      const res = await testNetworkConnection({
        proxy_enabled: !!settings.proxy_enabled,
        http_proxy: settings.http_proxy,
        https_proxy: settings.https_proxy,
        no_proxy: settings.no_proxy,
        ca_cert_path: settings.ca_cert_path,
        insecure_skip_verify: !!settings.insecure_skip_verify,
      });
      setNetworkTestResult(res);
    } catch (err: any) {
      setNetworkTestResult({
        success: false,
        message: err.message || "Lỗi kiểm tra kết nối mạng",
      });
    } finally {
      setTestingNetwork(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    setUploadingCa(true);
    setUploadCaMsg(null);
    try {
      const content = await file.text();
      const res = await uploadCaCertificate({
        filename: file.name,
        content,
      });
      setSettings({
        ...settings,
        ca_cert_path: res.file_path,
      });
      setUploadCaMsg(`Đã nạp tệp: ${res.filename} (${(res.size / 1024).toFixed(1)} KB)`);
      setTimeout(() => setUploadCaMsg(null), 4000);
    } catch (err: any) {
      alert("Lỗi khi tải lên file CA: " + (err.message || String(err)));
    } finally {
      setUploadingCa(false);
      e.target.value = "";
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
          <button
            onClick={() => {
              setActiveTab("network");
              setEditingProfile(null);
            }}
            className={`pb-3 text-sm font-semibold transition border-b-2 ${
              activeTab === "network"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Mạng & Proxy (Corporate)
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

                    {/* Proxy Mode Selection */}
                    <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                          <Globe className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Chế độ kết nối Proxy:</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setEditingProfile({ ...editingProfile, proxy_mode: "auto" })}
                          className={`p-2.5 rounded-lg border text-left transition ${
                            (editingProfile.proxy_mode || "auto") === "auto"
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-950 dark:text-white font-semibold"
                              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          <p className="font-semibold text-xs">⚙️ Tự động</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Theo cấu hình Proxy & Bỏ qua LAN</p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingProfile({ ...editingProfile, proxy_mode: "always" })}
                          className={`p-2.5 rounded-lg border text-left transition ${
                            editingProfile.proxy_mode === "always"
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-950 dark:text-white font-semibold"
                              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          <p className="font-semibold text-xs">🌐 Luôn qua Proxy</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Dành cho Custom OpenAI / Cloud</p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingProfile({ ...editingProfile, proxy_mode: "never" })}
                          className={`p-2.5 rounded-lg border text-left transition ${
                            editingProfile.proxy_mode === "never"
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-950 dark:text-white font-semibold"
                              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          <p className="font-semibold text-xs">🏠 Không qua Proxy</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Model nội bộ / Ollama / LAN</p>
                        </button>
                      </div>
                    </div>

                    {/* Test Result Card inside form */}
                    {testResult && (
                      <div
                        className={`p-3.5 rounded-xl text-xs border space-y-2.5 transition ${
                          testResult.loading
                            ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60 text-indigo-800 dark:text-indigo-300"
                            : testResult.success
                            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200"
                            : "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800/60 text-red-900 dark:text-red-200"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2">
                            {testResult.loading ? (
                              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0" />
                            ) : testResult.success ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            )}
                            <span className="font-semibold text-xs">
                              {testResult.loading
                                ? "Đang gửi yêu cầu kiểm tra kết nối & đo độ trễ..."
                                : testResult.message}
                            </span>
                          </div>
                          {testResult.latency_ms !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[10px] font-mono font-bold">
                              {testResult.latency_ms} ms
                            </span>
                          )}
                        </div>

                        {/* Detailed ASR compatibility feedback */}
                        {!testResult.loading && editingProfile.can_asr && (
                          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                            {testResult.asr_supported ? (
                              <div className="flex items-center space-x-1.5 text-emerald-700 dark:text-emerald-300 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span>{testResult.asr_message || "Mô hình này hỗ trợ nhận dạng giọng nói (ASR) qua API!"}</span>
                              </div>
                            ) : (
                              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-800 dark:text-amber-200 space-y-1.5">
                                <div className="flex items-center space-x-1.5 font-bold text-xs text-amber-700 dark:text-amber-300">
                                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                  <span>Cảnh báo: Mô hình không hỗ trợ nhận dạng giọng nói!</span>
                                </div>
                                <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                                  {testResult.asr_message || `Mô hình '${editingProfile.model}' không hỗ trợ endpoint /v1/audio/transcriptions.`}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setEditingProfile({ ...editingProfile, can_asr: false })}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold transition shadow-sm"
                                >
                                  Bỏ chọn 'Nhận dạng giọng nói (ASR)' cho mô hình này
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Discovered models on gateway */}
                        {!testResult.loading && testResult.discovered_models && testResult.discovered_models.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                              Các mô hình tìm thấy trên máy chủ ({testResult.discovered_models.length} model):
                            </p>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                              {testResult.discovered_models.map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setEditingProfile({ ...editingProfile, model: m })}
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                                    editingProfile.model === m
                                      ? "bg-indigo-600 text-white border-indigo-600 font-bold"
                                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-indigo-400"
                                  }`}
                                  title={`Bấm để chọn model: ${m}`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        disabled={testResult?.loading}
                        onClick={() => handleTestConnection(editingProfile)}
                        className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
                      >
                        {testResult?.loading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        <span>{testResult?.loading ? "Đang thử kết nối..." : "Thử kết nối (Ping test)"}</span>
                      </button>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProfile(null);
                            setTestResult(null);
                          }}
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
                        onClick={() => {
                          setEditingProfile({
                            name: "",
                            provider_type: "openai_compat",
                            model: "qwen2.5:latest",
                            base_url: "http://localhost:11434/v1",
                            can_asr: false,
                            can_translate: true,
                            proxy_mode: "never",
                          });
                          setTestResult(null);
                        }}
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
                              {p.proxy_mode === "always" ? (
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  Luôn qua Proxy
                                </span>
                              ) : p.proxy_mode === "never" ? (
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  Không qua Proxy (LAN)
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              Model: <span className="text-slate-800 dark:text-slate-200">{p.model}</span>
                              {p.base_url && <span className="ml-2 text-slate-400 dark:text-slate-500">({p.base_url})</span>}
                            </p>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => {
                                setEditingProfile(p);
                                setTestResult(null);
                              }}
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

            {/* Tab 4: Network & Proxy (Corporate) */}
            {activeTab === "network" && settings && (
              <form onSubmit={handleSaveNetwork} className="py-5 space-y-5 flex-1 overflow-y-auto">
                {/* Info Card */}
                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 p-4 rounded-xl flex items-start space-x-3 text-xs leading-relaxed">
                  <Globe className="w-5 h-5 flex-shrink-0 text-blue-500 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-0.5">Hỗ trợ mạng doanh nghiệp (Corporate Proxy & Deep Packet Inspection):</span>
                    Dành cho người dùng trong mạng nội bộ công ty (như Fujinet, FPT, v.v.) sử dụng Proxy và có thiết bị firewall giải mã SSL. Khi ở nhà hoặc mạng cá nhân, chỉ cần tắt Proxy để kết nối Internet trực tiếp với tốc độ tối đa.
                  </div>
                </div>

                {/* Proxy Configuration Box */}
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                        <span>Máy chủ Proxy (HTTP/HTTPS)</span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Chuyển tiếp lưu lượng mạng thông qua Proxy của doanh nghiệp.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!settings.proxy_enabled}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            proxy_enabled: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {settings.proxy_enabled ? "Đang bật" : "Đang tắt"}
                      </span>
                    </label>
                  </div>

                  {settings.proxy_enabled && (
                    <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Địa chỉ Proxy (HTTP/HTTPS) <span className="text-rose-500">*</span>:
                        </label>
                        <input
                          type="text"
                          value={settings.http_proxy || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              http_proxy: e.target.value,
                              https_proxy: e.target.value,
                            })
                          }
                          placeholder="http://proxy2.fujinet.vn:8080 hoặc http://user:pass@host:port"
                          className="w-full text-xs px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Danh sách bỏ qua Proxy (No Proxy):
                        </label>
                        <input
                          type="text"
                          value={settings.no_proxy || "localhost,127.0.0.1"}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              no_proxy: e.target.value,
                            })
                          }
                          placeholder="localhost,127.0.0.1"
                          className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-mono"
                        />
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                          Bắt buộc giữ <code>localhost,127.0.0.1</code> để giao tiếp nội bộ giữa giao diện và Backend cục bộ không bị nghẽn.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Custom CA Certificate Box */}
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                        <Shield className="w-4 h-4 text-emerald-500" />
                        <span>Chứng chỉ Root CA nội bộ (.ca, .pem, .crt)</span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Cung cấp Root Certificate của công ty để SDK Gemini và yt-dlp tin cậy kết nối khi firewall quét bảo mật SSL.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Đường dẫn tệp chứng chỉ CA trên máy:
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={settings.ca_cert_path || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            ca_cert_path: e.target.value,
                          })
                        }
                        placeholder="Ví dụ: C:\certs\fujinet.ca hoặc D:\keys\company-root.pem"
                        className="flex-1 text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                      />
                      <label className="cursor-pointer px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition flex items-center space-x-1.5 flex-shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingCa ? "Đang tải..." : "Chọn tệp..."}</span>
                        <input
                          type="file"
                          accept=".ca,.pem,.crt,.cer,.txt"
                          onChange={handleFileChange}
                          disabled={uploadingCa}
                          className="hidden"
                        />
                      </label>
                      {settings.ca_cert_path && (
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, ca_cert_path: "" })}
                          className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Xóa đường dẫn CA"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {uploadCaMsg && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{uploadCaMsg}</span>
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!settings.insecure_skip_verify}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            insecure_skip_verify: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Bỏ qua xác thực SSL (Insecure Skip Verify - Chỉ dùng thử nghiệm khẩn cấp)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Test Connection Button & Results */}
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Chẩn đoán kết nối mạng & SSL
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Kiểm tra ngay khả năng tải YouTube và gọi API Gemini qua proxy hiện tại.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestNetwork}
                      disabled={testingNetwork}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
                    >
                      {testingNetwork ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Đang kiểm tra...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          <span>Kiểm tra kết nối</span>
                        </>
                      )}
                    </button>
                  </div>

                  {networkTestResult && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                        networkTestResult.success
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                          : "bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-200"
                      }`}
                    >
                      <div className="flex items-center space-x-2 font-bold text-sm">
                        {networkTestResult.success ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <span>{networkTestResult.message}</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                            <span>{networkTestResult.message}</span>
                          </>
                        )}
                      </div>

                      {/* Detail breakdown */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                        {networkTestResult.youtube && (
                          <div className="p-2 rounded-lg bg-white/50 dark:bg-slate-800/50">
                            <div className="font-semibold flex items-center justify-between">
                              <span>YouTube:</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  networkTestResult.youtube.success
                                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                                    : "bg-rose-500/20 text-rose-600 dark:text-rose-300"
                                }`}
                              >
                                {networkTestResult.youtube.success ? "Thành công" : "Lỗi"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                              {networkTestResult.youtube.message}
                            </p>
                          </div>
                        )}

                        {networkTestResult.gemini && (
                          <div className="p-2 rounded-lg bg-white/50 dark:bg-slate-800/50">
                            <div className="font-semibold flex items-center justify-between">
                              <span>Google Gemini API:</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  networkTestResult.gemini.success
                                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                                    : "bg-rose-500/20 text-rose-600 dark:text-rose-300"
                                }`}
                              >
                                {networkTestResult.gemini.success ? "Thành công" : "Lỗi"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                              {networkTestResult.gemini.message}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Save Button */}
                <div className="pt-2 flex items-center justify-end space-x-3">
                  {savedNetworkMsg && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Đã lưu cài đặt mạng & proxy thành công!</span>
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={savingNetwork}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 shadow-md shadow-indigo-600/20"
                  >
                    {savingNetwork ? "Đang lưu..." : "Lưu cài đặt mạng"}
                  </button>
                </div>
              </form>
            )}
          </>

        )}
      </div>
    </div>
  );
};
