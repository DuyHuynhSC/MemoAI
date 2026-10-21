import React, { useEffect, useState, useRef } from "react";
import { X, Film, Video, Settings as SettingsIcon, Link2, UploadCloud, FileVideo } from "lucide-react";
import { createProject, uploadProjectMedia, fetchSettings, fetchMediaInfo } from "../api/client";
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
  const [sourceType, setSourceType] = useState<"url" | "file">("url");
  const [urlOrPath, setUrlOrPath] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [profiles, setProfiles] = useState<AIProfile[]>([]);
  const [selectedAsrProfileId, setSelectedAsrProfileId] = useState<number | undefined>(undefined);
  const [selectedMtProfileId, setSelectedMtProfileId] = useState<number | undefined>(undefined);
  const [mode, setMode] = useState("learning");
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSettings()
        .then((data) => {
          setProfiles(data.profiles);
          const asrList = data.profiles.filter((p) => p.can_asr);
          const mtList = data.profiles.filter((p) => p.can_translate);

          // 1. Resolve default ASR profile: MUST exist in asrList!
          if (
            data.settings.default_asr_profile_id &&
            asrList.some((p) => p.id === data.settings.default_asr_profile_id)
          ) {
            setSelectedAsrProfileId(data.settings.default_asr_profile_id);
          } else if (asrList.length > 0) {
            const geminiProfile = asrList.find((p) => p.provider_type === "gemini");
            setSelectedAsrProfileId(geminiProfile ? geminiProfile.id : asrList[0].id);
          } else {
            setSelectedAsrProfileId(undefined);
          }

          // 2. Resolve default MT profile: MUST exist in mtList!
          if (
            data.settings.default_mt_profile_id &&
            mtList.some((p) => p.id === data.settings.default_mt_profile_id)
          ) {
            setSelectedMtProfileId(data.settings.default_mt_profile_id);
          } else if (mtList.length > 0) {
            const geminiProfile = mtList.find((p) => p.provider_type === "gemini");
            setSelectedMtProfileId(geminiProfile ? geminiProfile.id : mtList[0].id);
          } else {
            setSelectedMtProfileId(undefined);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUrlBlur = async () => {
    if (!urlOrPath.trim() || title.trim()) return;
    const isUrl = urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://");
    if (!isUrl) return;

    setIsFetchingInfo(true);
    try {
      const info = await fetchMediaInfo(urlOrPath.trim());
      if (info.title) {
        setTitle(info.title);
      }
    } catch (e) {
      console.warn("Could not auto-fetch media info:", e);
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!title.trim()) {
        const rawName = file.name.replace(/\.[^/.]+$/, "");
        setTitle(rawName);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAsrProfileId) {
      setError("Vui lòng cấu hình hoặc chọn một Hồ sơ AI cho nhận dạng giọng nói (ASR).");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let project: Project;

      if (sourceType === "file") {
        if (!selectedFile) {
          setError("Vui lòng chọn một file video từ thiết bị.");
          setLoading(false);
          return;
        }

        setUploadStatus("Đang tải video lên máy chủ...");
        const formData = new FormData();
        formData.append("file", selectedFile);
        if (title.trim()) formData.append("title", title.trim());
        formData.append("source_lang", "ja");
        formData.append("target_lang", "vi");
        if (selectedAsrProfileId) formData.append("asr_profile_id", selectedAsrProfileId.toString());
        if (selectedMtProfileId) formData.append("mt_profile_id", selectedMtProfileId.toString());
        formData.append("mode", mode);

        project = await uploadProjectMedia(formData);
      } else {
        if (!urlOrPath.trim()) {
          setError("Vui lòng dán link video hoặc URL.");
          setLoading(false);
          return;
        }

        project = await createProject({
          url_or_path: urlOrPath.trim(),
          title: title || undefined,
          source_lang: "ja",
          target_lang: "vi",
          asr_profile_id: selectedAsrProfileId,
          mt_profile_id: selectedMtProfileId,
          mode: mode,
        });
      }

      setTitle("");
      setUrlOrPath("");
      setSelectedFile(null);
      setUploadStatus("");
      onCreated(project);
      onClose();
    } catch (err: any) {
      setError(err.message || "Lỗi tạo dự án");
    } finally {
      setLoading(false);
      setUploadStatus("");
    }
  };

  const asrOptions = profiles.filter((p) => p.can_asr);
  const mtOptions = profiles.filter((p) => p.can_translate);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 border-t sm:border border-slate-200 dark:border-slate-700 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl relative text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto">
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-1 flex items-center space-x-2">
          <Film className="w-5 h-5 text-indigo-500" />
          <span>Thêm video học ngoại ngữ mới</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Dán link YouTube hoặc chọn trực tiếp video từ bộ nhớ máy/điện thoại.
        </p>

        {/* Source Type Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSourceType("url")}
            className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition ${
              sourceType === "url"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Link YouTube / Web</span>
          </button>
          <button
            type="button"
            onClick={() => setSourceType("file")}
            className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition ${
              sourceType === "file"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Chọn từ thiết bị</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-xs sm:text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {sourceType === "url" ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Link YouTube hoặc video trực tuyến:
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={urlOrPath}
                  onChange={(e) => setUrlOrPath(e.target.value)}
                  onBlur={handleUrlBlur}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {isFetchingInfo && (
                  <div className="absolute right-3 top-2.5 flex items-center space-x-1.5 text-xs text-indigo-500">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="hidden sm:inline">Lấy thông tin...</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Chọn file video từ thư viện / bộ nhớ máy:
              </label>
              <input
                type="file"
                ref={fileInputRef}
                accept="video/mp4,video/mkv,video/webm,video/quicktime,video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl p-4 text-center cursor-pointer transition bg-slate-50 dark:bg-slate-900/60"
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center space-x-2 text-indigo-600 dark:text-indigo-400">
                    <FileVideo className="w-5 h-5 flex-shrink-0" />
                    <div className="text-left truncate max-w-[240px] sm:max-w-xs">
                      <p className="text-xs font-bold truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB · Chạm để đổi video khác
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <UploadCloud className="w-7 h-7 text-indigo-500 mx-auto mb-1" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Chạm vào đây để chọn video từ thiết bị
                    </p>
                    <p className="text-[11px] text-slate-500">Hỗ trợ MP4, MKV, WebM, MOV</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tiêu đề bài học (Tùy chọn):
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Để trống hệ thống sẽ tự động trích xuất tiêu đề"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* ASR Profile Picker */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nhận dạng giọng nói (ASR):
                </label>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="text-[11px] text-indigo-500 hover:underline flex items-center space-x-0.5"
                  >
                    <SettingsIcon className="w-3 h-3" />
                    <span>Cấu hình</span>
                  </button>
                )}
              </div>
              <select
                value={selectedAsrProfileId || ""}
                onChange={(e) => setSelectedAsrProfileId(Number(e.target.value) || undefined)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {asrOptions.length === 0 ? (
                  <option value="">Chưa có hồ sơ ASR</option>
                ) : (
                  asrOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.provider_type === "faster_whisper" ? "Offline" : p.provider_type})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* MT Profile Picker */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Dịch song ngữ (MT):
                </label>
              </div>
              <select
                value={selectedMtProfileId || ""}
                onChange={(e) => setSelectedMtProfileId(Number(e.target.value) || undefined)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {mtOptions.length === 0 ? (
                  <option value="">Chưa có hồ sơ Dịch thuật</option>
                ) : (
                  mtOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.provider_type})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Chế độ dịch ngữ:
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMode("learning")}
                className={`py-2 px-3 rounded-xl border text-center transition ${
                  mode === "learning"
                    ? "bg-indigo-50 dark:bg-indigo-500/20 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold"
                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                }`}
              >
                Học tập (Sát nghĩa)
              </button>
              <button
                type="button"
                onClick={() => setMode("natural")}
                className={`py-2 px-3 rounded-xl border text-center transition ${
                  mode === "natural"
                    ? "bg-indigo-50 dark:bg-indigo-500/20 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold"
                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                }`}
              >
                Tự nhiên (Thoát ý)
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || (sourceType === "url" ? !urlOrPath.trim() : !selectedFile)}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{uploadStatus || "Đang xử lý phân tích video..."}</span>
                </>
              ) : (
                <>
                  <Video className="w-4 h-4" />
                  <span>
                    {sourceType === "file" ? "Tải lên & Phân tích video" : "Bắt đầu phân tích video"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
