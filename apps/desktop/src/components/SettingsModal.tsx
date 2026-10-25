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
  Cpu,
  Download,
  RefreshCw,
  Play,
  Ban,
  HardDrive,
  ShieldCheck,
  KeyRound,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  fetchSettings,
  updateSettings,
  saveProfile,
  deleteProfile,
  testProfileConnection,
  testNetworkConnection,
  uploadCaCertificate,
  fetchOfflineModels,
  downloadOfflineModel,
  cancelOfflineModelDownload,
  deleteOfflineModel,
  quickTestOfflineModel,
  fetchAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  getAuthUser,
  updateUserProfile,
} from "../api/client";
import type {
  AIProfile,
  AppSettings,
  AppTheme,
  NetworkTestResult,
  ProfileTestResult,
  Segment,
  OfflineModelsResponse,
  User,
} from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
  onUserUpdated?: (user: User) => void;
  theme?: AppTheme;
  setTheme?: (t: AppTheme) => void;
  jaFontSize?: number;
  setJaFontSize?: (v: number) => void;
  viFontSize?: number;
  setViFontSize?: (v: number) => void;
  activeSegment?: Segment | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  theme = "dark",
  setTheme,
  jaFontSize = 26,
  setJaFontSize,
  viFontSize = 20,
  setViFontSize,
  activeSegment,
}) => {
  const [activeTab, setActiveTab] = useState<"defaults" | "profiles" | "appearance" | "network" | "offline_asr" | "users">("defaults");

  // Admin Users tab state
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);
  const [adminUserMsg, setAdminUserMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingTargetUser, setEditingTargetUser] = useState<User | null>(null);
  const [editUserFullName, setEditUserFullName] = useState("");
  const [editUserRole, setEditUserRole] = useState<"admin" | "user">("user");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserIsActive, setEditUserIsActive] = useState(true);
  const [savingAdminUser, setSavingAdminUser] = useState(false);

  const activeUser = currentUser || getAuthUser();
  const isAdmin = activeUser?.role === "admin";

  const loadAdminUsersData = async () => {
    if (!isAdmin) return;
    setLoadingAdminUsers(true);
    try {
      const data = await fetchAdminUsers();
      setAdminUsers(data);
    } catch (err: any) {
      setAdminUserMsg({ type: "error", text: err.message || "Lỗi tải danh sách người dùng" });
    } finally {
      setLoadingAdminUsers(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "users" && isAdmin) {
      loadAdminUsersData();
    }
  }, [isOpen, activeTab, isAdmin]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [profiles, setProfiles] = useState<AIProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit / Add profile form state
  const [editingProfile, setEditingProfile] = useState<Partial<AIProfile> | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<(ProfileTestResult & { loading?: boolean }) | null>(null);

  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSettingsMsg, setSavedSettingsMsg] = useState(false);
  const [userJlptLevel, setUserJlptLevel] = useState<string>(activeUser?.jlpt_level || "N5");

  // Network & Proxy tab state
  const [savingNetwork, setSavingNetwork] = useState(false);
  const [savedNetworkMsg, setSavedNetworkMsg] = useState(false);
  const [testingNetwork, setTestingNetwork] = useState(false);
  const [networkTestResult, setNetworkTestResult] = useState<NetworkTestResult | null>(null);
  const [uploadingCa, setUploadingCa] = useState(false);
  const [uploadCaMsg, setUploadCaMsg] = useState<string | null>(null);

  // Offline ASR tab state
  const [offlineData, setOfflineData] = useState<OfflineModelsResponse | null>(null);
  const [loadingOffline, setLoadingOffline] = useState(false);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [quickTestResults, setQuickTestResults] = useState<{
    [modelId: string]: { ok: boolean; latency_ms?: number; device?: string; message: string };
  }>({});
  const [offlineActionError, setOfflineActionError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchSettings();
      if (data.user?.jlpt_level) {
        setUserJlptLevel(data.user.jlpt_level);
      } else if (activeUser?.jlpt_level) {
        setUserJlptLevel(activeUser.jlpt_level);
      }
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
      if (userJlptLevel) {
        const updatedUser = await updateUserProfile({ jlpt_level: userJlptLevel });
        if (onUserUpdated) onUserUpdated(updatedUser);
      }
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

  const loadOfflineModels = async (silent = false) => {
    if (!silent) setLoadingOffline(true);
    try {
      const data = await fetchOfflineModels();
      setOfflineData(data);
    } catch (e: any) {
      console.error(e);
      if (!silent) setOfflineActionError(e.message || "Lỗi tải danh mục mô hình offline");
    } finally {
      if (!silent) setLoadingOffline(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "offline_asr") {
      loadOfflineModels();
    }
  }, [activeTab, isOpen]);

  useEffect(() => {
    if (!isOpen || !offlineData) return;
    const hasDownloading = offlineData.models.some((m) => m.status === "downloading");
    if (!hasDownloading) return;

    const interval = setInterval(() => {
      loadOfflineModels(true);
    }, 1500);

    return () => clearInterval(interval);
  }, [isOpen, offlineData]);

  const handleDownloadModel = async (modelId: string) => {
    setOfflineActionError(null);
    try {
      await downloadOfflineModel(modelId);
      await loadOfflineModels(true);
    } catch (e: any) {
      setOfflineActionError(e.message || "Lỗi bắt đầu tải mô hình");
    }
  };

  const handleCancelDownload = async (modelId: string) => {
    try {
      await cancelOfflineModelDownload(modelId);
      await loadOfflineModels(true);
    } catch (e: any) {
      setOfflineActionError(e.message || "Lỗi hủy tải mô hình");
    }
  };

  const handleDeleteModel = async (modelId: string, modelName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa mô hình "${modelName}" khỏi ổ đĩa?`)) return;
    try {
      await deleteOfflineModel(modelId);
      await loadOfflineModels(true);
    } catch (e: any) {
      setOfflineActionError(e.message || "Lỗi xóa mô hình");
    }
  };

  const handleQuickTestModel = async (modelId: string) => {
    setTestingModelId(modelId);
    try {
      const res = await quickTestOfflineModel(modelId);
      setQuickTestResults((prev) => ({ ...prev, [modelId]: res }));
    } catch (e: any) {
      setQuickTestResults((prev) => ({
        ...prev,
        [modelId]: { ok: false, message: e.message || "Lỗi kiểm tra mô hình" },
      }));
    } finally {
      setTestingModelId(null);
    }
  };

  if (!isOpen) return null;


  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 border-t sm:border border-slate-200 dark:border-slate-700 w-full sm:max-w-3xl rounded-t-3xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl relative max-h-[92vh] flex flex-col text-slate-900 dark:text-white">
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-200 dark:border-slate-700 pr-8">
          <div className="p-2 bg-indigo-500/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Cài đặt ứng dụng</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tùy chỉnh giao diện, cỡ chữ phụ đề và quản lý các kết nối AI
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700/80 mt-3 sm:mt-4 space-x-4 sm:space-x-6 overflow-x-auto scrollbar-none flex-nowrap pb-1">
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
              setActiveTab("offline_asr");
              setEditingProfile(null);
            }}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center space-x-1.5 ${
              activeTab === "offline_asr"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Mô hình Offline</span>
            {offlineData && (
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 rounded-full font-bold">
                {offlineData.models.filter((m) => m.is_downloaded).length}/{offlineData.models.length}
              </span>
            )}
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
          {isAdmin && (
            <button
              onClick={() => {
                setActiveTab("users");
                setEditingProfile(null);
              }}
              className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center space-x-1.5 ${
                activeTab === "users"
                  ? "border-amber-500 text-amber-600 dark:text-amber-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span>Quản lý Người dùng ({adminUsers.length || "Admin"})</span>
            </button>
          )}
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
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Trình độ tiếng Nhật hiện tại (JLPT N5 - N1)
                    </h3>
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-indigo-600 text-white">
                      JLPT {userJlptLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Khi bấm "Phân tích AI" trong lúc học, LLM sẽ điều chỉnh độ sâu giải thích từ vựng & ngữ pháp phù hợp với trình độ này của bạn.
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {["N5", "N4", "N3", "N2", "N1"].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setUserJlptLevel(lvl)}
                        className={`py-2 rounded-xl text-xs font-bold border transition ${
                          userJlptLevel === lvl
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

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
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setEditingProfile({
                              ...editingProfile,
                              provider_type: val,
                              can_asr: val === "gemini" || val === "faster_whisper",
                              can_translate: val !== "faster_whisper",
                              model: val === "faster_whisper" ? (editingProfile.model || "base") : editingProfile.model,
                            });
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="gemini">Google Gemini (Cloud)</option>
                          <option value="faster_whisper">Faster-Whisper (Offline - Chạy cục bộ)</option>
                          <option value="openai_compat">OpenAI Compatible (Server nội bộ / Ollama)</option>
                        </select>
                      </div>
                    </div>

                    {editingProfile.provider_type === "faster_whisper" ? (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                          Phiên bản mô hình Whisper
                        </label>
                        <select
                          value={editingProfile.model || "base"}
                          onChange={(e) => setEditingProfile({ ...editingProfile, model: e.target.value })}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="tiny">Whisper Tiny (~75 MB - Siêu nhẹ)</option>
                          <option value="base">Whisper Base (~145 MB - Tiêu chuẩn CPU)</option>
                          <option value="small">Whisper Small (~480 MB - Khuyên dùng 16GB RAM)</option>
                          <option value="medium">Whisper Medium (~1.5 GB - Độ chuẩn xác cao)</option>
                          <option value="large-v3-turbo">Whisper Large v3 Turbo (~1.6 GB - Tối ưu cho GPU)</option>
                          <option value="large-v3">Whisper Large v3 (~3.1 GB - Đầy đủ)</option>
                        </select>
                        <div className="mt-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 p-3 rounded-xl text-xs flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                          <span>Mô hình Faster-Whisper chạy hoàn toàn offline trên máy tính, không cần cấu hình Base URL hay API Key.</span>
                        </div>
                      </div>
                    ) : (
                      <>
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
                      </>
                    )}

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
                      Xem trước phụ đề thực tế {activeSegment ? "(Theo đoạn video hiện tại)" : "(Đoạn mẫu)"}:
                    </p>
                    <div className="bg-black/85 backdrop-blur-md rounded-2xl p-4 text-center border border-white/10 shadow-xl space-y-2">
                      <div
                        style={{ fontSize: `${jaFontSize}px`, lineHeight: 1.35 }}
                        className="font-semibold text-white tracking-wide"
                      >
                        {activeSegment && activeSegment.ruby_html ? (
                          <span dangerouslySetInnerHTML={{ __html: activeSegment.ruby_html }} />
                        ) : activeSegment ? (
                          activeSegment.text
                        ) : (
                          <>
                            <ruby>
                              最近<rt>さいきん</rt>
                            </ruby>{" "}
                            は いろんな アプリ が ある し 、 AI も ある し
                          </>
                        )}
                      </div>
                      <div
                        style={{ fontSize: `${viFontSize}px`, lineHeight: 1.35 }}
                        className="font-medium text-emerald-400 dark:text-emerald-300"
                      >
                        {activeSegment?.translation || "Gần đây có rất nhiều ứng dụng, có cả AI, tôi nghĩ việc học sẽ dễ dàng hơn."}
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

            {/* Tab 5: Offline Models (Faster-Whisper) */}
            {activeTab === "offline_asr" && (
              <div className="py-4 space-y-4 flex-1 overflow-y-auto">
                {/* Header banner */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        Mô hình nhận dạng giọng nói Offline (Faster-Whisper)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Chạy trực tiếp trên thiết bị của bạn. Không cần mạng Internet, bảo mật tuyệt đối và không mất phí API.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadOfflineModels()}
                    disabled={loadingOffline}
                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition text-slate-700 dark:text-slate-200"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingOffline ? "animate-spin" : ""}`} />
                    <span>Làm mới</span>
                  </button>
                </div>

                {offlineActionError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center justify-between">
                    <span>{offlineActionError}</span>
                    <button
                      onClick={() => setOfflineActionError(null)}
                      className="p-1 hover:bg-red-500/20 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Hardware Diagnostic Banner */}
                {offlineData?.hardware && (
                  <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Chẩn đoán phần cứng thiết bị</span>
                      </h4>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Hệ điều hành: {offlineData.hardware.platform}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {/* CPU & RAM */}
                      <div className="bg-white dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/70">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Bộ xử lý & RAM
                        </span>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {offlineData.hardware.cpu_cores} nhân CPU
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {offlineData.hardware.ram_total_gb} GB RAM (trống {offlineData.hardware.ram_avail_gb} GB)
                        </div>
                      </div>

                      {/* GPU Acceleration */}
                      <div className="bg-white dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/70">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Tăng tốc phần cứng
                        </span>
                        {offlineData.hardware.cuda_available ? (
                          <>
                            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                              <span>🚀 NVIDIA CUDA</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={offlineData.hardware.cuda_device_name || ""}>
                              {offlineData.hardware.cuda_device_name || "CUDA GPU"} (float16)
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center space-x-1">
                              <span>💻 CPU Optimized</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              Lượng tử hóa int8
                            </div>
                          </>
                        )}
                      </div>

                      {/* Recommendation */}
                      <div className="bg-white dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/70">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Đề xuất tối ưu
                        </span>
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          Mô hình {offlineData.hardware.recommended_model.toUpperCase()}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={offlineData.hardware.recommendation_reason}>
                          {offlineData.hardware.recommendation_reason}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Model Catalog List */}
                <div className="space-y-3">
                  {loadingOffline && !offlineData ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                      <span className="text-xs">Đang kiểm tra danh mục mô hình offline...</span>
                    </div>
                  ) : (
                    offlineData?.models.map((model) => {
                      const isTesting = testingModelId === model.id;
                      const testRes = quickTestResults[model.id];
                      const isDownloading = model.status === "downloading";

                      return (
                        <div
                          key={model.id}
                          className={`bg-white dark:bg-slate-800/90 border rounded-xl p-4 transition shadow-sm ${
                            model.is_recommended
                              ? "border-indigo-400/60 dark:border-indigo-500/60 ring-1 ring-indigo-400/20"
                              : "border-slate-200 dark:border-slate-700/80"
                          }`}
                        >
                          {/* Top row */}
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                  {model.name}
                                </h4>
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                  ~{model.size_mb} MB
                                </span>
                                {model.is_recommended && (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center space-x-1">
                                    <span>⭐ Khuyên dùng cho máy này</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {model.description}
                              </p>
                            </div>

                            {/* Status badge & Actions */}
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              {model.is_downloaded ? (
                                <>
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Đã sẵn sàng ({model.disk_size_mb} MB)</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickTestModel(model.id)}
                                    disabled={isTesting}
                                    className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
                                    title="Chạy thử nghiệm phát âm mẫu để kiểm tra độ trễ"
                                  >
                                    {isTesting ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Play className="w-3.5 h-3.5" />
                                    )}
                                    <span>Thử nghiệm</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteModel(model.id, model.name)}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                                    title="Xóa mô hình khỏi ổ đĩa"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : isDownloading ? (
                                <button
                                  type="button"
                                  onClick={() => handleCancelDownload(model.id)}
                                  className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Hủy tải</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleDownloadModel(model.id)}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Tải xuống ({model.size_mb} MB)</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Downloading progress bar */}
                          {isDownloading && (
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400 animate-pulse">
                                  Đang tải tệp mô hình từ HuggingFace...
                                </span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                  {Math.round(model.progress * 100)}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-700/80 h-2.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 h-full transition-all duration-300 rounded-full"
                                  style={{ width: `${Math.max(5, Math.round(model.progress * 100))}%` }}
                                ></div>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                <span>
                                  {(model.downloaded_bytes / (1024 * 1024)).toFixed(1)} MB / {(model.total_bytes / (1024 * 1024)).toFixed(1)} MB
                                </span>
                                <span>
                                  {model.speed_mb_s > 0 ? `${model.speed_mb_s} MB/s` : "Đang kết nối..."}
                                  {model.eta_seconds != null ? ` • Còn lại: ~${model.eta_seconds}s` : ""}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Quick test feedback notification */}
                          {testRes && (
                            <div
                              className={`mt-3 p-2.5 rounded-lg text-xs flex items-center justify-between ${
                                testRes.ok
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                {testRes.ok ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                                )}
                                <span>{testRes.message}</span>
                              </div>
                              <button
                                onClick={() =>
                                  setQuickTestResults((prev) => {
                                    const next = { ...prev };
                                    delete next[model.id];
                                    return next;
                                  })
                                }
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Admin Users Tab Content */}
            {activeTab === "users" && isAdmin && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-500" />
                      Danh sách tài khoản & Phân quyền hệ thống
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Quản trị viên có toàn quyền sửa thông tin, đặt lại mật khẩu, phân vai trò hoặc xóa tài khoản.
                    </p>
                  </div>
                  <button
                    onClick={loadAdminUsersData}
                    disabled={loadingAdminUsers}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingAdminUsers ? "animate-spin" : ""}`} />
                    <span>Làm mới</span>
                  </button>
                </div>

                {adminUserMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center justify-between ${
                      adminUserMsg.type === "success"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                        : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
                    }`}
                  >
                    <span>{adminUserMsg.text}</span>
                    <button onClick={() => setAdminUserMsg(null)} className="hover:opacity-75">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Edit User Form / Modal */}
                {editingTargetUser && (
                  <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <Edit2 className="w-3.5 h-3.5" />
                        Chỉnh sửa tài khoản: <span className="font-mono text-indigo-600 dark:text-indigo-400">{editingTargetUser.username}</span>
                      </h4>
                      <button
                        onClick={() => setEditingTargetUser(null)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Họ và tên
                        </label>
                        <input
                          type="text"
                          value={editUserFullName}
                          onChange={(e) => setEditUserFullName(e.target.value)}
                          placeholder="Họ và tên hiển thị..."
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Vai trò (Role)
                        </label>
                        <select
                          value={editUserRole}
                          onChange={(e) => setEditUserRole(e.target.value as "admin" | "user")}
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        >
                          <option value="user">Người dùng (User)</option>
                          <option value="admin">Quản trị viên (Admin)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                          <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                          <span>Đặt lại mật khẩu mới (Bỏ trống nếu không đổi)</span>
                        </label>
                        <input
                          type="password"
                          value={editUserPassword}
                          onChange={(e) => setEditUserPassword(e.target.value)}
                          placeholder="Nhập mật khẩu mới..."
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Trạng thái tài khoản
                        </label>
                        <div className="flex items-center gap-3 pt-1">
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="radio"
                              name="is_active"
                              checked={editUserIsActive}
                              onChange={() => setEditUserIsActive(true)}
                              className="text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">Hoạt động</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="radio"
                              name="is_active"
                              checked={!editUserIsActive}
                              onChange={() => setEditUserIsActive(false)}
                              className="text-red-600 focus:ring-red-500"
                            />
                            <span className="text-red-700 dark:text-red-400 font-medium">Khóa tài khoản</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingTargetUser(null)}
                        className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={savingAdminUser}
                        onClick={async () => {
                          setSavingAdminUser(true);
                          setAdminUserMsg(null);
                          try {
                            await updateAdminUser(editingTargetUser.id, {
                              full_name: editUserFullName,
                              role: editUserRole,
                              password: editUserPassword.trim() || undefined,
                              is_active: editUserIsActive,
                            });
                            setAdminUserMsg({ type: "success", text: `Đã cập nhật thành công tài khoản ${editingTargetUser.username}` });
                            setEditingTargetUser(null);
                            loadAdminUsersData();
                          } catch (err: any) {
                            setAdminUserMsg({ type: "error", text: err.message || "Lỗi cập nhật người dùng" });
                          } finally {
                            setSavingAdminUser(false);
                          }
                        }}
                        className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5"
                      >
                        {savingAdminUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>Lưu thay đổi</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Users Table */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/60 shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Tài khoản (Username)</th>
                        <th className="py-2.5 px-3">Họ và tên</th>
                        <th className="py-2.5 px-3">Vai trò</th>
                        <th className="py-2.5 px-3">Trạng thái</th>
                        <th className="py-2.5 px-3 text-center">Số bài học</th>
                        <th className="py-2.5 px-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {adminUsers.map((u) => {
                        const isSelf = activeUser?.id === u.id;
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{u.username}</span>
                              {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold">
                                  Bạn
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                              {u.full_name || <span className="text-slate-400 italic">Chưa đặt</span>}
                            </td>
                            <td className="py-2.5 px-3">
                              {u.role === "admin" ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                                  <ShieldCheck className="w-3 h-3" />
                                  Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  User
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {u.is_active !== false ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                  <UserCheck className="w-3.5 h-3.5" />
                                  Hoạt động
                                </span>
                              ) : (
                                <span className="text-red-500 dark:text-red-400 font-medium flex items-center gap-1">
                                  <UserX className="w-3.5 h-3.5" />
                                  Đã khóa
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-400 font-mono">
                              {u.project_count || 0}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setEditingTargetUser(u);
                                    setEditUserFullName(u.full_name || "");
                                    setEditUserRole(u.role || "user");
                                    setEditUserPassword("");
                                    setEditUserIsActive(u.is_active !== false);
                                  }}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition"
                                  title="Chỉnh sửa & Đặt lại mật khẩu"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {!isSelf && (
                                  <button
                                    onClick={async () => {
                                      if (confirm(`Bạn có chắc chắn muốn xóa tài khoản '${u.username}' cùng toàn bộ bài học và dữ liệu liên quan không?`)) {
                                        try {
                                          await deleteAdminUser(u.id);
                                          setAdminUserMsg({ type: "success", text: `Đã xóa tài khoản ${u.username}` });
                                          loadAdminUsersData();
                                        } catch (err: any) {
                                          setAdminUserMsg({ type: "error", text: err.message || "Lỗi khi xóa người dùng" });
                                        }
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                                    title="Xóa tài khoản"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>

        )}
      </div>
    </div>
  );
};
