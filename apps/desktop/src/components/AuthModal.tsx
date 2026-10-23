import React, { useState, useEffect } from "react";
import { User as UserIcon, Lock, Key, Check, AlertCircle, LogIn, UserPlus, Users, X } from "lucide-react";
import type { User } from "../types";
import { loginUser, registerUser, fetchAllUsers } from "../api/client";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserChanged: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChanged,
}) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      loadAvailableUsers();
    }
  }, [isOpen]);

  const loadAvailableUsers = async () => {
    try {
      const users = await fetchAllUsers();
      setAvailableUsers(users);
    } catch {
      // Ignore if cannot load list
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim()) {
      setErrorMsg("Vui lòng nhập tên đăng nhập");
      return;
    }
    if (!password.trim()) {
      setErrorMsg("Vui lòng nhập mật khẩu");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const res = await loginUser({ username: username.trim(), password });
        onUserChanged(res.user);
        onClose();
      } else {
        const res = await registerUser({
          username: username.trim(),
          password,
          full_name: fullName.trim() || undefined,
          gemini_api_key: geminiApiKey.trim() || undefined,
        });
        onUserChanged(res.user);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Đã xảy ra lỗi, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExistingUser = (u: User) => {
    setUsername(u.username);
    setPassword("");
    setMode("login");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {mode === "login" ? "Đăng nhập tài khoản" : "Tạo tài khoản mới"}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Quản lý bài học và API Key LLM riêng biệt
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Users Quick Switcher */}
        {availableUsers.length > 0 && (
          <div className="px-6 pt-4 pb-2 bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-100 dark:border-zinc-800/60">
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              <Users className="w-3.5 h-3.5" />
              <span>Tài khoản trên hệ thống:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {availableUsers.map((u) => {
                const isCurrent = currentUser?.id === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectExistingUser(u)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                      isCurrent
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700/50 dark:text-indigo-300 font-medium"
                        : "bg-white dark:bg-zinc-800/70 border-zinc-200 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300 hover:border-indigo-300 dark:hover:border-indigo-600"
                    }`}
                  >
                    <span>{u.username}</span>
                    {isCurrent && <span className="text-[10px] text-indigo-500">(Hiện tại)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800 px-6 pt-3">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setErrorMsg(null);
            }}
            className={`pb-2.5 text-xs font-semibold border-b-2 mr-6 transition-colors flex items-center gap-1.5 ${
              mode === "login"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setErrorMsg(null);
            }}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              mode === "register"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Đăng ký tài khoản
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Tên đăng nhập (Username) *
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Mật khẩu *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                required
              />
            </div>
          </div>

          {mode === "register" && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Họ và tên / Biệt danh (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Gemini API Key cá nhân (Tùy chọn)
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy... (có thể bổ sung sau)"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Mỗi tài khoản sẽ có API Key LLM riêng để dịch phụ đề và nhận dạng giọng nói.
                </p>
              </div>
            </>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === "login" ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Đăng nhập</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Hoàn tất đăng ký</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
