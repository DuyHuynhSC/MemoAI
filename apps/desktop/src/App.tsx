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
} from "lucide-react";
import type { Project, Segment, WordDefinition } from "./types";
import { fetchProjects, fetchProject, deleteProject, lookupWord } from "./api/client";
import { VideoPlayer } from "./components/VideoPlayer";
import { TranscriptList } from "./components/TranscriptList";
import { WordPopup } from "./components/WordPopup";
import { CreateModal } from "./components/CreateModal";
import { VocabModal } from "./components/VocabModal";
import { SettingsModal } from "./components/SettingsModal";

export const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isVocabOpen, setIsVocabOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
    } catch (e) {
      console.error(e);
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
    if (confirm("Bạn có chắc chắn muốn xóa video này khỏi danh sách?")) {
      await deleteProject(id);
      if (selectedProjectId === id) setSelectedProjectId(null);
      loadProjects();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 flex items-center justify-between z-30 sticky top-0">
        <div className="flex items-center space-x-4">
          {selectedProjectId ? (
            <button
              onClick={() => setSelectedProjectId(null)}
              className="flex items-center space-x-2 text-sm text-slate-400 hover:text-white transition px-3 py-1.5 rounded-xl hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Thư viện</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <Film className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-wide">MemoAI</h1>
                <p className="text-[11px] text-slate-400">Học ngoại ngữ qua phụ đề song ngữ</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition"
            title="Cài đặt kết nối AI"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Cài đặt AI</span>
          </button>

          <button
            onClick={() => setIsVocabOpen(true)}
            className="flex items-center space-x-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition"
          >
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>Sổ từ vựng & Anki</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm video mới</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-6">
        {selectedProject ? (
          /* Video Learning Room */
          <div className="flex-1 flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full">
            {/* Left: Video Player */}
            <div className="flex-1 flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white truncate max-w-xl">
                  {selectedProject.title}
                </h2>
                <span className="text-xs px-2.5 py-1 bg-indigo-500/20 text-indigo-300 rounded-full font-medium">
                  {selectedProject.source_lang.toUpperCase()} ➔ {selectedProject.target_lang.toUpperCase()}
                </span>
              </div>

              <VideoPlayer
                project={selectedProject}
                segments={segments}
                currentTime={currentTime}
                onTimeUpdate={setCurrentTime}
                onWordClick={handleWordClick}
                showFurigana={showFurigana}
                setShowFurigana={setShowFurigana}
                showRomaji={showRomaji}
                setShowRomaji={setShowRomaji}
                showTranslation={showTranslation}
                setShowTranslation={setShowTranslation}
                showJapanese={showJapanese}
                setShowJapanese={setShowJapanese}
              />
            </div>

            {/* Right: Transcript Sidebar */}
            <div className="w-full lg:w-96 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden max-h-[720px] shadow-xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Lời thoại & Phụ đề</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Bấm vào câu để nhảy tới · Bấm vào từ để tra nghĩa
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded-lg">
                  {segments.length} câu
                </span>
              </div>

              <TranscriptList
                segments={segments}
                currentTime={currentTime}
                onSeek={setCurrentTime}
                onWordClick={handleWordClick}
                showFurigana={showFurigana}
                showRomaji={showRomaji}
                showTranslation={showTranslation}
              />
            </div>
          </div>
        ) : (
          /* Library View */
          <div className="max-w-6xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Thư viện bài học</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Chọn một video để bắt đầu học hoặc bấm "Thêm video mới" để phân tích
                </p>
              </div>
            </div>

            {projects.length === 0 ? (
              <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl p-8">
                <Film className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-300">Chưa có video nào trong thư viện</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
                  Bạn có thể thêm video bất kỳ từ YouTube Shorts, YouTube thông thường hoặc file trên máy tính của bạn.
                </p>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 inline-flex items-center space-x-2 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm video đầu tiên</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => p.status === "completed" && setSelectedProjectId(p.id)}
                    className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition relative overflow-hidden group ${
                      p.status === "completed"
                        ? "border-slate-800 hover:border-indigo-500/50 hover:shadow-xl cursor-pointer"
                        : "border-slate-800 opacity-90"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-slate-800 text-indigo-400 border border-slate-700">
                          {p.source_lang.toUpperCase()} ➔ {p.target_lang.toUpperCase()}
                        </span>

                        <button
                          onClick={(e) => handleDeleteProject(p.id, e)}
                          title="Xóa dự án"
                          className="text-slate-600 hover:text-red-400 transition p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <h3 className="text-base font-bold text-white mt-3 line-clamp-2 group-hover:text-indigo-300 transition">
                        {p.title}
                      </h3>
                      <p className="text-xs text-slate-500 truncate mt-1">{p.source_uri}</p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800/80">
                      {p.status === "processing" ? (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-indigo-400 font-medium">{p.current_step}</span>
                            <span className="text-slate-400">{Math.round(p.progress * 100)}%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${p.progress * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      ) : p.status === "completed" ? (
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="flex items-center space-x-1.5 text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Đã sẵn sàng</span>
                          </span>
                          <span className="flex items-center space-x-1 group-hover:text-white transition font-medium">
                            <span>Vào học</span>
                            <Play className="w-3 h-3 fill-current ml-1" />
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5 text-xs text-red-400">
                          <AlertCircle className="w-4 h-4" />
                          <span className="truncate">{p.error_msg || "Lỗi xử lý"}</span>
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

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <WordPopup
        definition={wordDef}
        loading={wordLoading}
        onClose={() => setWordDef(null)}
        contextSentence={activeWordContext?.text}
        contextTranslation={activeWordContext?.translation}
      />
    </div>
  );
};

export default App;
