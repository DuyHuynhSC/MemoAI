import React, { useState } from "react";
import { X, Film, Sparkles, Video } from "lucide-react";
import { createProject } from "../api/client";
import type { Project } from "../types";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

export const CreateModal: React.FC<CreateModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [urlOrPath, setUrlOrPath] = useState("");
  const [asrProvider, setAsrProvider] = useState("gemini");
  const [mtProvider, setMtProvider] = useState("gemini");
  const [mode, setMode] = useState("learning");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlOrPath.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const project = await createProject({
        url_or_path: urlOrPath.trim(),
        source_lang: "ja",
        target_lang: "vi",
        asr_provider: asrProvider,
        mt_provider: mtProvider,
        mode: mode,
      });
      onCreated(project);
      onClose();
    } catch (err: any) {
      setError(err.message || "Lỗi tạo dự án");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/50"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-white mb-1 flex items-center space-x-2">
          <Film className="w-5 h-5 text-indigo-400" />
          <span>Thêm video học ngoại ngữ mới</span>
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Dán đường link YouTube (hoặc video Shorts) hoặc đường dẫn file trên máy của bạn.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Đường dẫn video / URL YouTube
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="https://www.youtube.com/watch?v=... hoặc D:\video.mp4"
                value={urlOrPath}
                onChange={(e) => setUrlOrPath(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 pr-10"
              />
              <Video className="w-5 h-5 text-red-500 absolute right-3 top-3.5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Nhận dạng giọng nói (ASR)
              </label>
              <select
                value={asrProvider}
                onChange={(e) => setAsrProvider(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="gemini">Google Gemini (Khuyên dùng)</option>
                <option value="openai">OpenAI / Whisper Server</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Bộ dịch song ngữ (MT)
              </label>
              <select
                value={mtProvider}
                onChange={(e) => setMtProvider(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">Qwen / Ollama Server</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Phong cách dịch
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("learning")}
                className={`p-3 rounded-xl border text-left transition ${
                  mode === "learning"
                    ? "border-indigo-500 bg-indigo-500/10 text-white"
                    : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600"
                }`}
              >
                <p className="text-sm font-semibold">Chế độ học tập</p>
                <p className="text-xs text-slate-400 mt-0.5">Dịch sát nghĩa, chuẩn ngữ pháp</p>
              </button>

              <button
                type="button"
                onClick={() => setMode("natural")}
                className={`p-3 rounded-xl border text-left transition ${
                  mode === "natural"
                    ? "border-indigo-500 bg-indigo-500/10 text-white"
                    : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600"
                }`}
              >
                <p className="text-sm font-semibold">Tự nhiên / Phim</p>
                <p className="text-xs text-slate-400 mt-0.5">Văn phong lưu loát, tự nhiên</p>
              </button>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition"
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
