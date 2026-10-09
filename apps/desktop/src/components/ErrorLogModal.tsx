import React, { useState, useEffect } from "react";
import { X, AlertCircle, RefreshCw, Copy, Check, Terminal } from "lucide-react";
import { fetchProjectLogs, retryProject } from "../api/client";
import type { Project } from "../types";

interface ErrorLogModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onRetried?: () => void;
}

export const ErrorLogModal: React.FC<ErrorLogModalProps> = ({
  project,
  isOpen,
  onClose,
  onRetried,
}) => {
  const [logs, setLogs] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [retrying, setRetrying] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && project) {
      setLoading(true);
      setErrorMsg(project.error_msg || "");
      fetchProjectLogs(project.id)
        .then((data) => {
          setLogs(data.logs || "");
          if (data.error_msg) {
            setErrorMsg(data.error_msg);
          }
        })
        .catch((err) => {
          setLogs(`Lỗi khi lấy nhật ký: ${err.message}`);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLogs("");
      setErrorMsg("");
      setCopied(false);
    }
  }, [isOpen, project]);

  if (!isOpen || !project) return null;

  const handleCopy = () => {
    const fullText = `[THÔNG TIN DỰ ÁN]\nID: ${project.id}\nTiêu đề: ${project.title}\nNguồn: ${project.source_uri}\nBước: ${project.current_step}\n\n[CHI TIẾT LỖI]\n${errorMsg}\n\n[NHẬT KÝ PIPELINE LOGS]\n${logs}`;
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRetry = async () => {
    try {
      setRetrying(true);
      await retryProject(project.id);
      if (onRetried) onRetried();
      onClose();
    } catch (err: any) {
      alert(`Không thể thử lại: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative text-slate-900 dark:text-white flex flex-col max-h-[85vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2.5 mb-2">
          <div className="p-2 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-xl">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Chi tiết lỗi xử lý video</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{project.title}</p>
          </div>
        </div>

        <div className="my-3 flex items-center space-x-2 text-xs bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="font-semibold text-slate-600 dark:text-slate-300">Vị trí gặp lỗi:</span>
          <span className="text-red-600 dark:text-red-400 font-mono">{project.current_step || "Xử lý pipeline"}</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          {errorMsg && (
            <div>
              <div className="flex items-center space-x-1.5 mb-1.5 font-semibold text-slate-700 dark:text-slate-200">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span>Thông báo lỗi & Traceback:</span>
              </div>
              <pre className="bg-red-500/5 dark:bg-red-950/30 border border-red-500/20 text-red-700 dark:text-red-300 p-3 rounded-xl overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                {errorMsg}
              </pre>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
                <Terminal className="w-4 h-4 text-indigo-500" />
                <span>Nhật ký tiến trình (Pipeline Execution Log):</span>
              </span>
              {loading && <span className="text-[11px] text-slate-400 animate-pulse">Đang tải log...</span>}
            </div>
            <pre className="bg-slate-900 text-slate-200 p-3.5 rounded-xl overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed max-h-56 select-text border border-slate-700/60">
              {logs || (loading ? "Đang tải dữ liệu..." : "Không có nhật ký bổ sung.")}
            </pre>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-medium transition text-xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Đã sao chép lỗi" : "Sao chép toàn bộ lỗi"}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition text-xs shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
              <span>{retrying ? "Đang gửi..." : "Thử lại ngay"}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-semibold transition text-xs"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
