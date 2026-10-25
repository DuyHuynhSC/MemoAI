import React, { useEffect, useState } from "react";
import {
  Film,
  Plus,
  BookOpen,
  ArrowLeft,
  Trash2,
  Play,
  CheckCircle2,
  AlertCircle,
  Settings,
  Sun,
  Moon,
  Pencil,
  Check,
  X,
  RefreshCw,
  FileText,
  Server,
  WifiOff,
  User as UserIcon,
  LogOut,
} from "lucide-react";
import type { Project, Segment, WordDefinition, AppTheme, User } from "./types";
import {
  fetchProjects,
  fetchProject,
  deleteProject,
  updateProject,
  lookupWord,
  retryProject,
  getApiBase,
  getAuthUser,
  setAuthUser,
  logoutUser,
  fetchCurrentUser,
} from "./api/client";
import { VideoPlayer } from "./components/VideoPlayer";
import { TranscriptList } from "./components/TranscriptList";
import { WordPopup } from "./components/WordPopup";
import { CreateModal } from "./components/CreateModal";
import { VocabModal } from "./components/VocabModal";
import { SettingsModal } from "./components/SettingsModal";
import { ErrorLogModal } from "./components/ErrorLogModal";
import { ServerAddressModal } from "./components/ServerAddressModal";
import { AuthModal } from "./components/AuthModal";
import { AnalysisModal } from "./components/AnalysisModal";

export const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [seekTarget, setSeekTarget] = useState<number | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [hasConnectionError, setHasConnectionError] = useState<boolean>(false);

  const handleSeekFromTranscript = (time: number) => {
    setCurrentTime(time);
    setSeekTarget(time);
  };

  // Theme state
  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem("memoai_theme");
    return saved === "light" ? "light" : "dark";
  });

  // Subtitle font size settings
  const [jaFontSize, setJaFontSize] = useState<number>(() => {
    const saved = localStorage.getItem("memoai_ja_font_size");
    return saved ? parseInt(saved) : 26;
  });
  const [viFontSize, setViFontSize] = useState<number>(() => {
    const saved = localStorage.getItem("memoai_vi_font_size");
    return saved ? parseInt(saved) : 20;
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
    localStorage.setItem("memoai_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("memoai_ja_font_size", jaFontSize.toString());
  }, [jaFontSize]);

  useEffect(() => {
    localStorage.setItem("memoai_vi_font_size", viFontSize.toString());
  }, [viFontSize]);

  // User auth state
  const [currentUser, setCurrentUser] = useState<User | null>(() => getAuthUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setCurrentUser(u);
        setAuthUser(u);
      })
      .catch(() => {});
  }, []);

  const handleUserChanged = (u: User) => {
    const isDifferentUser = currentUser?.id !== u.id;
    setCurrentUser(u);
    if (isDifferentUser) {
      setSelectedProjectId(null);
      setSelectedProject(null);
      setSegments([]);
      loadProjects();
    }
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setSelectedProjectId(null);
    setSelectedProject(null);
    setSegments([]);
    loadProjects();
  };

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isVocabOpen, setIsVocabOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [errorModalProject, setErrorModalProject] = useState<Project | null>(null);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [analyzingSegment, setAnalyzingSegment] = useState<Segment | null>(null);

  // Word Popup
  const [wordDef, setWordDef] = useState<WordDefinition | null>(null);
  const [wordLoading, setWordLoading] = useState(false);
  const [activeWordContext, setActiveWordContext] = useState<Segment | null>(null);

  // Subtitle Layer Controls
  const [showFurigana, setShowFurigana] = useState(true);
  const [showRomaji, setShowRomaji] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showJapanese, setShowJapanese] = useState(true);

  // Load project list
  const loadProjects = async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
      setHasConnectionError(false);
    } catch (e) {
      console.error(e);
      setHasConnectionError(true);
    }
  };

  useEffect(() => {
    loadProjects();
    const interval = setInterval(loadProjects, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load details of selected project
  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedProject(null);
      setSegments([]);
      return;
    }

    const loadProjectDetail = async () => {
      try {
        const data = await fetchProject(selectedProjectId);
        setSelectedProject(data.project);
        setSegments(data.segments);
      } catch (e) {
        console.error(e);
      }
    };

    loadProjectDetail();
  }, [selectedProjectId]);

  const handleWordClick = async (word: string, context: Segment) => {
    setWordDef(null);
    setWordLoading(true);
    setActiveWordContext(context);
    if (currentTime < context.start || currentTime > context.end) {
      setCurrentTime(context.start);
      setSeekTarget(context.start);
    }
    try {
      const def = await lookupWord(word, context.text);
      setWordDef(def);
    } catch (e) {
      console.error(e);
    } finally {
      setWordLoading(false);
    }
  };

  const handleDeleteProject = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Bạn có chắc chắn muốn xóa bài học này không?")) return;
    try {
      await deleteProject(id);
      if (selectedProjectId === id) {
        setSelectedProjectId(null);
      }
      loadProjects();
    } catch (err: any) {
      alert(`Lỗi khi xóa bài học: ${err.message}`);
    }
  };

  const handleStartEdit = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(p.id);
    setEditingTitle(p.title);
  };

  const handleSaveEdit = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!editingTitle.trim()) return;
    try {
      const updated = await updateProject(id, { title: editingTitle.trim() });
      setProjects((prev) => prev.map((item) => (item.id === id ? { ...item, title: updated.title } : item)));
      if (selectedProject?.id === id) {
        setSelectedProject((prev) => (prev ? { ...prev, title: updated.title } : null));
      }
      setEditingProjectId(null);
    } catch (err: any) {
      alert(`Lỗi khi cập nhật tiêu đề: ${err.message}`);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(null);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className={`bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 ${selectedProject ? "h-[100dvh] max-h-[100dvh] overflow-hidden" : "min-h-screen"}`}>

      {/* Top Navbar */}
      <header className={`h-16 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur px-4 sm:px-6 items-center justify-between z-30 sticky top-0 ${selectedProject ? "hidden sm:flex" : "flex"}`}>

        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          {selectedProjectId ? (
            <button
              onClick={() => setSelectedProjectId(null)}
              className="flex items-center space-x-1.5 sm:space-x-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition px-2.5 sm:px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-medium text-xs sm:text-sm">Thư viện</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <Film className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-wide">MemoAI</h1>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 hidden xs:block">Học ngoại ngữ qua phụ đề song ngữ</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2.5">
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center space-x-1.5 p-2 sm:px-3 sm:py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition"
            title={theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}
            aria-label="Đổi giao diện sáng/tối"
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden lg:inline">Giao diện sáng</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-600" />
                <span className="hidden lg:inline">Giao diện tối</span>
              </>
            )}
          </button>

          {/* User Profile Switcher */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center space-x-1.5 p-2 sm:px-3 sm:py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold border border-indigo-200 dark:border-indigo-800/70 transition"
              title={currentUser ? `Đang đăng nhập: ${currentUser.username} (JLPT ${currentUser.jlpt_level || "N5"})` : "Đăng nhập / Đổi tài khoản"}
            >
              <UserIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline max-w-[100px] truncate">
                {currentUser ? currentUser.username : "Tài khoản"}
              </span>
              {currentUser && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-indigo-600 text-white">
                  {currentUser.jlpt_level || "N5"}
                </span>
              )}
            </button>
            {currentUser && (
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition"
                title="Đăng xuất"
                aria-label="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Server IP config button (Desktop only, mobile uses bottom bar) */}
          <button
            onClick={() => setIsServerModalOpen(true)}
            className="hidden sm:flex items-center space-x-1.5 p-2 sm:px-3 sm:py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition"
            title="Địa chỉ máy chủ Backend"
          >
            <Server className="w-4 h-4 text-indigo-500" />
            <span className="hidden md:inline">Máy chủ</span>
          </button>

          {/* AI Settings Button (Desktop only, mobile uses bottom bar) */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="hidden sm:flex items-center space-x-1.5 p-2 sm:px-3 sm:py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition"
            title="Cài đặt kết nối AI & Giao diện"
          >
            <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">Cài đặt AI</span>
          </button>

          {/* Vocab Modal Button */}
          <button
            onClick={() => setIsVocabOpen(true)}
            className="hidden sm:flex items-center space-x-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition"
          >
            <BookOpen className="w-4 h-4 text-indigo-500" />
            <span>Sổ từ vựng & Anki</span>
          </button>

          {/* Add Video Button (Desktop only, mobile uses center bottom '+' button) */}
          <button
            onClick={() => setIsCreateOpen(true)}
            className="hidden sm:flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">Thêm video</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        className={`flex-1 min-h-0 flex flex-col ${
          selectedProject
            ? "p-0 sm:p-4 md:p-6 h-full overflow-hidden sm:overflow-visible"
            : "p-3 sm:p-4 md:p-6 pb-20 sm:pb-6"
        }`}
      >
        {selectedProject ? (
          /* Video Learning Room - Exact 50/50 Split on Mobile, Side-by-side on Desktop */
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-0 lg:gap-6 max-w-[1720px] mx-auto w-full items-stretch h-full">
            {/* Top Navigation Bar in Lesson Room (Compact on Mobile) */}
            <div className="w-full flex-shrink-0 h-11 sm:h-12 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-3 sm:px-4 flex items-center justify-between lg:hidden z-10">
              <div className="flex items-center space-x-2 min-w-0 flex-1 mr-2">
                <button
                  onClick={() => setSelectedProjectId(null)}
                  title="Quay lại thư viện"
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex-shrink-0 flex items-center space-x-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-xs font-semibold">Thư viện</span>
                </button>
                <h2 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {selectedProject.title}
                </h2>
              </div>
              <div className="flex items-center space-x-1.5 flex-shrink-0">
                <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 rounded-full font-medium border border-indigo-500/20">
                  {selectedProject.source_lang.toUpperCase()} ➔ {selectedProject.target_lang.toUpperCase()}
                </span>
                <button
                  onClick={toggleTheme}
                  className="p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                  title="Đổi giao diện"
                >
                  {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                </button>
              </div>
            </div>

            {/* Top (Mobile 50%) / Left (Desktop): Video Player Area */}
            <div className="w-full flex-1 min-h-0 basis-0 lg:basis-auto lg:h-[calc(100vh-130px)] lg:min-h-[580px] lg:flex-1 flex flex-col overflow-hidden bg-black">
              {/* Desktop-only title bar */}
              <div className="hidden lg:flex items-center justify-between flex-shrink-0 px-0.5 mb-2.5">
                <div className="flex items-center space-x-2 flex-1 min-w-0 mr-2">
                  <button
                    onClick={() => setSelectedProjectId(null)}
                    title="Quay lại thư viện"
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition flex-shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {editingProjectId === selectedProject.id ? (
                    <div className="flex items-center space-x-2 flex-1 max-w-xl">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(selectedProject.id);
                          if (e.key === "Escape") setEditingProjectId(null);
                        }}
                        autoFocus
                        className="flex-1 bg-white dark:bg-slate-800 border border-indigo-500 rounded-lg px-2.5 py-1 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                      />
                      <button
                        onClick={(e) => handleSaveEdit(selectedProject.id, e)}
                        title="Lưu tiêu đề"
                        className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        title="Hủy"
                        className="p-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 max-w-xl group/edit min-w-0">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                        {selectedProject.title}
                      </h2>
                      <button
                        onClick={(e) => handleStartEdit(selectedProject, e)}
                        title="Đổi tên video"
                        className="opacity-60 hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex-shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <span className="text-xs px-2.5 py-1 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 rounded-full font-medium border border-indigo-500/20 flex-shrink-0">
                  {selectedProject.source_lang.toUpperCase()} ➔ {selectedProject.target_lang.toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-h-0 flex flex-col">
                <VideoPlayer
                  project={selectedProject}
                  segments={segments}
                  currentTime={currentTime}
                  seekTarget={seekTarget}
                  onTimeUpdate={setCurrentTime}
                  onWordClick={handleWordClick}
                  onAnalyzeSegment={(seg) => setAnalyzingSegment(seg)}
                  showFurigana={showFurigana}
                  setShowFurigana={setShowFurigana}
                  showRomaji={showRomaji}
                  setShowRomaji={setShowRomaji}
                  showTranslation={showTranslation}
                  setShowTranslation={setShowTranslation}
                  showJapanese={showJapanese}
                  setShowJapanese={setShowJapanese}
                  jaFontSize={jaFontSize}
                  setJaFontSize={setJaFontSize}
                  viFontSize={viFontSize}
                  setViFontSize={setViFontSize}
                  isWordPopupOpen={wordLoading || wordDef !== null || analyzingSegment !== null}
                  onSeekHandled={() => setSeekTarget(null)}
                />
              </div>
            </div>

            {/* Bottom (Mobile 50%) / Right (Desktop): Transcript Sidebar */}
            <div className="w-full flex-1 min-h-0 basis-0 lg:basis-auto lg:h-[calc(100vh-130px)] lg:min-h-[580px] lg:w-[480px] xl:w-[540px] 2xl:w-[580px] flex-shrink-0 bg-white dark:bg-slate-900 border-t lg:border border-slate-200 dark:border-slate-800 lg:rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-2xl z-10">
              <div className="p-2 sm:p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70 flex-shrink-0">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Lời thoại & Phụ đề</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                    Chạm câu để nhảy tới · Chạm từ để tra nghĩa · Phân tích AI
                  </p>
                </div>
                <span className="text-[10px] sm:text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  {segments.length} câu
                </span>
              </div>

              <TranscriptList
                segments={segments}
                currentTime={currentTime}
                onSeek={handleSeekFromTranscript}
                onWordClick={handleWordClick}
                onAnalyzeSegment={(seg) => setAnalyzingSegment(seg)}
                showFurigana={showFurigana}
                showRomaji={showRomaji}
                showTranslation={showTranslation}
                jaFontSize={jaFontSize}
                viFontSize={viFontSize}
              />
            </div>
          </div>
        ) : (
          /* Library View */
          <div className="max-w-6xl mx-auto w-full space-y-5 sm:space-y-6">
            {/* Backend connection warning banner */}
            {hasConnectionError && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 text-sm shadow-sm">
                <div className="flex items-start space-x-3">
                  <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Chưa kết nối được máy chủ Backend MemoAI ({getApiBase()})</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                      Nếu đang mở trên điện thoại, hãy đổi địa chỉ máy chủ thành IP của máy tính (ví dụ: <code className="bg-amber-200/50 dark:bg-amber-900/60 px-1 py-0.5 rounded font-mono">http://192.168.1.x:8000</code>).
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsServerModalOpen(true)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-sm transition whitespace-nowrap"
                >
                  Cài đặt IP máy chủ
                </button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Thư viện bài học</h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Chọn một video để bắt đầu học hoặc bấm "Thêm video" để phân tích
                </p>
              </div>
            </div>

            {projects.length === 0 ? (
              <div className="py-20 sm:py-24 text-center border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl p-6 sm:p-8 bg-white dark:bg-slate-900/50">
                <Film className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                <h3 className="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-300">Chưa có video nào trong thư viện</h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
                  Bạn có thể thêm video từ YouTube, YouTube Shorts hoặc video có sẵn trong bộ nhớ thiết bị.
                </p>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/20 inline-flex items-center space-x-2 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm video đầu tiên</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (p.status === "completed") {
                        setSelectedProjectId(p.id);
                      } else if (p.status === "error") {
                        setErrorModalProject(p);
                        setIsErrorModalOpen(true);
                      }
                    }}
                    className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition relative overflow-hidden group shadow-sm dark:shadow-none ${
                      p.status === "completed"
                        ? "border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:shadow-xl cursor-pointer"
                        : p.status === "error"
                        ? "border-red-200 dark:border-red-900/60 hover:border-red-400 cursor-pointer"
                        : "border-slate-200 dark:border-slate-800 opacity-90"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">
                            {p.source_lang.toUpperCase()} ➔ {p.target_lang.toUpperCase()}
                          </span>
                          {p.asr_model && (
                            <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              {p.asr_provider === "gemini" ? "Gemini" : "OpenAI"}: {p.asr_model}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => handleStartEdit(p, e)}
                            title="Đổi tên video"
                            className="text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 transition p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteProject(p.id, e)}
                            title="Xóa dự án"
                            className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {editingProjectId === p.id ? (
                        <div
                          className="mt-3 flex items-center space-x-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(p.id);
                              if (e.key === "Escape") setEditingProjectId(null);
                            }}
                            autoFocus
                            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-indigo-500 rounded-lg px-2.5 py-1 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                          />
                          <button
                            onClick={(e) => handleSaveEdit(p.id, e)}
                            title="Lưu"
                            className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            title="Hủy"
                            className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mt-3 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition">
                          {p.title}
                        </h3>
                      )}
                      <p className="text-xs text-slate-500 truncate mt-1">{p.source_uri}</p>
                    </div>

                    <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
                      {p.status === "processing" ? (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-indigo-500 dark:text-indigo-400 font-medium">{p.current_step}</span>
                            <span className="text-slate-500 dark:text-slate-400">{Math.round(p.progress * 100)}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${p.progress * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      ) : p.status === "completed" ? (
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Đã sẵn sàng</span>
                          </span>
                          <span className="flex items-center space-x-1 group-hover:text-indigo-600 dark:group-hover:text-white transition font-medium">
                            <span>Vào học</span>
                            <Play className="w-3 h-3 fill-current ml-1" />
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-start space-x-1.5 text-xs text-red-600 dark:text-red-400">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span className="line-clamp-2 font-medium">
                              {p.current_step?.startsWith("Lỗi:") ? p.current_step : (p.error_msg?.split("\n")[0] || "Lỗi xử lý")}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 pt-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setErrorModalProject(p);
                                setIsErrorModalOpen(true);
                              }}
                              className="flex-1 py-1.5 px-2 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Xem lỗi</span>
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await retryProject(p.id);
                                  loadProjects();
                                } catch (err: any) {
                                  alert(`Lỗi khi thử lại: ${err.message}`);
                                }
                              }}
                              title="Thử lại"
                              className="py-1.5 px-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Thử lại</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className={`sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 items-center justify-around py-1.5 px-2 shadow-xl ${selectedProject ? "hidden" : "flex"}`}>

        <button
          onClick={() => setSelectedProjectId(null)}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
            !selectedProjectId
              ? "text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <Film className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Thư viện</span>
        </button>

        <button
          onClick={() => setIsVocabOpen(true)}
          className="flex flex-col items-center py-1 px-3 text-slate-500 dark:text-slate-400 rounded-xl transition"
        >
          <BookOpen className="w-5 h-5 text-indigo-500" />
          <span className="text-[10px] mt-0.5">Sổ từ</span>
        </button>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center justify-center w-11 h-11 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-600/30 -mt-3 transition active:scale-95"
          aria-label="Thêm video mới"
        >
          <Plus className="w-6 h-6" />
        </button>

        <button
          onClick={() => setIsServerModalOpen(true)}
          className="flex flex-col items-center py-1 px-3 text-slate-500 dark:text-slate-400 rounded-xl transition"
        >
          <Server className="w-5 h-5 text-indigo-500" />
          <span className="text-[10px] mt-0.5">Máy chủ</span>
        </button>

        <button
          onClick={() => setIsSettingsOpen(true)}
          className="flex flex-col items-center py-1 px-3 text-slate-500 dark:text-slate-400 rounded-xl transition"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Cài đặt</span>
        </button>
      </nav>

      {/* Modals */}
      <CreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          loadProjects();
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <VocabModal isOpen={isVocabOpen} onClose={() => setIsVocabOpen(false)} />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        onUserUpdated={handleUserChanged}
        theme={theme}
        setTheme={setTheme}
        jaFontSize={jaFontSize}
        setJaFontSize={setJaFontSize}
        viFontSize={viFontSize}
        setViFontSize={setViFontSize}
        activeSegment={segments.find((s) => currentTime >= s.start && currentTime <= s.end) || segments[0] || null}
      />

      <ServerAddressModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        onSaved={() => {
          loadProjects();
        }}
      />

      <WordPopup
        definition={wordDef}
        loading={wordLoading}
        onClose={() => setWordDef(null)}
        contextSentence={activeWordContext?.text}
        contextTranslation={activeWordContext?.translation}
      />

      <ErrorLogModal
        isOpen={isErrorModalOpen}
        project={errorModalProject}
        onClose={() => setIsErrorModalOpen(false)}
        onRetried={() => loadProjects()}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUserChanged={handleUserChanged}
      />

      <AnalysisModal
        segment={analyzingSegment}
        isOpen={analyzingSegment !== null}
        onClose={() => setAnalyzingSegment(null)}
        userLevel={currentUser?.jlpt_level || "N5"}
      />
    </div>
  );
};

export default App;
