import React, { useEffect, useState } from "react";
import { X, Film, Sparkles, Video, Settings as SettingsIcon } from "lucide-react";
import { createProject, fetchSettings, fetchMediaInfo } from "../api/client";
import type { Project, AIProfile } from "../types";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
  onOpenSettings?: () => void;
}

export const CreateModal: React.FC<CreateModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  onOpenSettings,
}) => {
  const [urlOrPath, setUrlOrPath] = useState("");
  const [title, setTitle] = useState("");
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [profiles, setProfiles] = useState<AIProfile[]>([]);
  const [selectedAsrProfileId, setSelectedAsrProfileId] = useState<number | undefined>(undefined);
  const [selectedMtProfileId, setSelectedMtProfileId] = useState<number | undefined>(undefined);
  const [mode, setMode] = useState("learning");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSettings()
        .then((data) => {
          setProfiles(data.profiles);
          if (data.settings.default_asr_profile_id) {
            setSelectedAsrProfileId(data.settings.default_asr_profile_id);
          } else if (data.profiles.length > 0) {
            setSelectedAsrProfileId(data.profiles[0].id);
          }
          if (data.settings.default_mt_profile_id) {
            setSelectedMtProfileId(data.settings.default_mt_profile_id);
          } else if (data.profiles.length > 0) {
            setSelectedMtProfileId(data.profiles[0].id);
          }
          if (data.settings.default_translation_mode) {
            setMode(data.settings.default_translation_mode);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUrlBlur = async () => {
    const trimmed = urlOrPath.trim();
    if (!trimmed || !trimmed.startsWith("http") || title.trim()) return;
    try {
      setIsFetchingInfo(true);
      const info = await fetchMediaInfo(trimmed);
      if (info && info.title && !title.trim()) {
        setTitle(info.title);
      }
    } catch {
      // ignore
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlOrPath.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const project = await createProject({
        url_or_path: urlOrPath.trim(),
        title: title.trim() || undefined,
        source_lang: "ja",
        target_lang: "vi",
        asr_profile_id: selectedAsrProfileId,
        mt_profile_id: selectedMtProfileId,
        mode: mode,
      });
      setTitle("");
      setUrlOrPath("");
      onCreated(project);
      onClose();
    } catch (err: any) {
      setError(err.message || "Lỗi tạo dự án");
    } finally {
      setLoading(false);
    }
  };

  const asrOptions = profiles.filter((p) => p.can_asr);
  const mtOptions = profiles.filter((p) => p.can_translate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative text-slate-900 dark:text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1 flex items-center space-x-2">
          <Film className="w-5 h-5 text-indigo-500" />
          <span>Thêm video học ngoại ngữ mới</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Dán đường link YouTube (hoặc video Shorts) hoặc đường dẫn file trên máy của bạn.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
              Đường dẫn video / URL YouTube
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="https://www.youtube.com/watch?v=... hoặc D:\video.mp4"
                value={urlOrPath}
                onChange={(e) => setUrlOrPath(e.target.value)}
                onBlur={handleUrlBlur}
                required
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 pr-10"
              />
              <Video className="w-5 h-5 text-red-500 absolute right-3 top-3.5" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Tiêu đề video (tùy chọn)
              </label>
              {isFetchingInfo && (
                <span className="text-[11px] text-indigo-500 dark:text-indigo-400 animate-pulse font-medium">
                  Đang lấy tiêu đề YouTube...
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="Để trống sẽ tự động lấy tên video từ YouTube..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Bộ nhận dạng giọng (ASR)
                </label>
              </div>
              <select
                value={selectedAsrProfileId || ""}
                onChange={(e) => setSelectedAsrProfileId(parseInt(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              >
                {asrOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.model})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Bộ dịch song ngữ (MT)
                </label>
              </div>
              <select
                value={selectedMtProfileId || ""}
                onChange={(e) => setSelectedMtProfileId(parseInt(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              >
                {mtOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.model})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {onOpenSettings && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="text-[11px] text-indigo-500 dark:text-indigo-400 hover:underline inline-flex items-center space-x-1"
              >
                <SettingsIcon className="w-3 h-3" />
                <span>Quản lý danh sách kết nối AI & API Key</span>
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
              Phong cách dịch
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("learning")}
                className={`p-3 rounded-xl border text-left transition ${
                  mode === "learning"
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-900 dark:text-white"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                }`}
              >
                <p className="text-sm font-semibold">Chế độ học tập</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Dịch sát nghĩa, chuẩn ngữ pháp</p>
              </button>

              <button
                type="button"
                onClick={() => setMode("natural")}
                className={`p-3 rounded-xl border text-left transition ${
                  mode === "natural"
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-900 dark:text-white"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                }`}
              >
                <p className="text-sm font-semibold">Tự nhiên / Phim</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Văn phong lưu loát, tự nhiên</p>
              </button>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || !urlOrPath.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-lg shadow-indigo-600/20 transition flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Đang khởi tạo...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Bắt đầu xử lý</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
