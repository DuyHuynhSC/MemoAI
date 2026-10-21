import React, { useState } from "react";
import { X, Server, Check, AlertCircle, RefreshCw, Smartphone } from "lucide-react";
import { getApiBase, setApiBase } from "../api/client";

interface ServerAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ServerAddressModal: React.FC<ServerAddressModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [url, setUrl] = useState(getApiBase());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const targetUrl = url.trim().replace(/\/+$/, "");
    try {
      const res = await fetch(`${targetUrl}/api/projects`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setTestResult({ ok: true, message: "Kết nối máy chủ thành công!" });
      } else {
        setTestResult({ ok: false, message: `Máy chủ phản hồi mã lỗi HTTP ${res.status}` });
      }
    } catch (e: any) {
      setTestResult({
        ok: false,
        message: "Không thể kết nối. Vui lòng kiểm tra lại địa chỉ IP, cổng (8000) và tường lửa PC.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const targetUrl = url.trim().replace(/\/+$/, "");
    if (!targetUrl) return;
    setApiBase(targetUrl);
    onSaved();
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative text-slate-900 dark:text-white"
      >
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white transition p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Địa chỉ Máy chủ (Backend URL)</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Kết nối MemoAI Mobile tới máy chủ xử lý</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              URL Máy chủ Backend:
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setTestResult(null);
              }}
              placeholder="http://192.168.1.100:8000"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Quick presets */}
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
              Gợi ý thiết lập nhanh:
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setUrl("http://127.0.0.1:8000");
                  setTestResult(null);
                }}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-mono transition"
              >
                127.0.0.1 (Desktop)
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrl("http://10.0.2.2:8000");
                  setTestResult(null);
                }}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-mono transition flex items-center space-x-1"
              >
                <Smartphone className="w-3 h-3 text-indigo-500" />
                <span>10.0.2.2 (Máy ảo Android)</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5">📌 Lưu ý khi dùng trên điện thoại thật:</p>
            <p>1. Điện thoại và Máy tính cần kết nối chung một mạng Wi-Fi.</p>
            <p>2. Mở Command Prompt trên PC, gõ <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">ipconfig</code> để lấy địa chỉ IPv4 (ví dụ: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">192.168.1.15</code>).</p>
            <p>3. Điền vào ô trên dạng: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">http://192.168.1.15:8000</code>.</p>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl flex items-start space-x-2 text-xs font-medium ${
                testResult.ok
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80"
                  : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/80"
              }`}
            >
              {testResult.ok ? (
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition flex items-center justify-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin text-indigo-500" : ""}`} />
              <span>{testing ? "Đang thử..." : "Kiểm tra kết nối"}</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center justify-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Lưu địa chỉ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
