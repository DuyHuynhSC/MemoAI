import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  BookOpen,
  GraduationCap,
  Check,
  BookmarkPlus,
  Volume2,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import type {
  Segment,
  SentenceAnalysisResponse,
  AnalysisVocabItem,
  AnalysisGrammarItem,
} from "../types";
import { analyzeSegment, addVocab, addGrammar, saveBatchAnalysis } from "../api/client";

interface AnalysisModalProps {
  segment: Segment | null;
  isOpen: boolean;
  onClose: () => void;
  userLevel?: string;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({
  segment,
  isOpen,
  onClose,
  userLevel = "N5",
}) => {
  const [data, setData] = useState<SentenceAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "vocab" | "grammar">("all");
  const [savingAll, setSavingAll] = useState(false);
  const [savingWord, setSavingWord] = useState<string | null>(null);
  const [savingPattern, setSavingPattern] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const runAnalysis = async (forceRefresh = false) => {
    if (!segment) return;
    setLoading(true);
    setError(null);
    setBannerMsg(null);
    try {
      const res = await analyzeSegment({
        segment_id: segment.id,
        sentence: segment.text,
        translation: segment.translation,
        force_refresh: forceRefresh,
        auto_save: false,
      });
      setData(res);
    } catch (e: any) {
      setError(e.message || "Lỗi khi phân tích câu thoại bằng AI");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && segment) {
      runAnalysis(false);
    } else {
      setData(null);
      setBannerMsg(null);
      setError(null);
    }
  }, [isOpen, segment?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !segment) return null;

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSaveSingleVocab = async (item: AnalysisVocabItem) => {
    if (item.is_saved || savingWord === item.word) return;
    setSavingWord(item.word);
    try {
      await addVocab({
        word: item.word,
        reading: item.reading,
        romanized: item.romanized,
        meaning: item.meaning,
        jlpt: item.jlpt || userLevel,
        pos: item.pos,
        context_sentence: segment.text,
        context_translation: data?.translation || segment.translation,
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              vocabs: prev.vocabs.map((v) =>
                v.word === item.word ? { ...v, is_saved: true } : v
              ),
            }
          : null
      );
    } catch (e) {
      console.error(e);
    } finally {
      setSavingWord(null);
    }
  };

  const handleSaveSingleGrammar = async (item: AnalysisGrammarItem) => {
    if (item.is_saved || savingPattern === item.pattern) return;
    setSavingPattern(item.pattern);
    try {
      await addGrammar({
        pattern: item.pattern,
        meaning: item.meaning,
        explanation: item.explanation,
        jlpt: item.jlpt || userLevel,
        context_sentence: segment.text,
        context_translation: data?.translation || segment.translation,
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              grammars: prev.grammars.map((g) =>
                g.pattern === item.pattern ? { ...g, is_saved: true } : g
              ),
            }
          : null
      );
    } catch (e) {
      console.error(e);
    } finally {
      setSavingPattern(null);
    }
  };

  const handleSaveAllNew = async () => {
    if (!data || savingAll) return;
    setSavingAll(true);
    setBannerMsg(null);
    try {
      const res = await saveBatchAnalysis({
        vocabs: data.vocabs,
        grammars: data.grammars,
        context_sentence: segment.text,
        context_translation: data.translation || segment.translation,
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              vocabs: prev.vocabs.map((v) => ({ ...v, is_saved: true })),
              grammars: prev.grammars.map((g) => ({ ...g, is_saved: true })),
            }
          : null
      );
      const totalSkipped = res.skipped_vocabs + res.skipped_grammars;
      setBannerMsg(
        `Đã lưu ${res.saved_vocabs} từ vựng & ${res.saved_grammars} ngữ pháp mới vào sổ cá nhân` +
          (totalSkipped > 0 ? ` (đã tự động bỏ qua ${totalSkipped} mục đã có).` : ".")
      );
    } catch (e: any) {
      setError(e.message || "Không thể lưu hàng loạt");
    } finally {
      setSavingAll(false);
    }
  };

  const unsavedVocabCount = data ? data.vocabs.filter((v) => !v.is_saved).length : 0;
  const unsavedGrammarCount = data ? data.grammars.filter((g) => !g.is_saved).length : 0;
  const totalUnsaved = unsavedVocabCount + unsavedGrammarCount;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-700/80 w-full sm:max-w-3xl rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl relative max-h-[90vh] flex flex-col text-slate-900 dark:text-white"
      >
        {/* Mobile Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-200 dark:border-slate-800 pr-8">
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <span>Phân tích AI: Từ vựng & Ngữ pháp</span>
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30">
                Trình độ: {data?.user_level || userLevel}
              </span>
              {data?.cached && (
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  ⚡ Tải tức thì từ bộ nhớ đệm
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tự động nhận diện các mục đã có trong sổ tay của bạn để bỏ qua trùng lặp
            </p>
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Sentence Box */}
        <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70">
          <div className="flex items-start justify-between gap-2">
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
              {segment.text}
            </p>
            <button
              onClick={() => speak(segment.text)}
              title="Nghe câu thoại"
              className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition flex-shrink-0"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
          {(data?.translation || segment.translation) && (
            <p className="text-sm text-indigo-600 dark:text-indigo-300 font-medium mt-1">
              {data?.translation || segment.translation}
            </p>
          )}
          {data?.breakdown_notes && (
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/60 leading-relaxed">
              💡 <span className="font-semibold">Ghi chú cấu trúc:</span> {data.breakdown_notes}
            </p>
          )}
        </div>

        {bannerMsg && (
          <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{bannerMsg}</span>
          </div>
        )}

        {error && (
          <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Tabs */}
        {!loading && data && (
          <div className="flex items-center justify-between gap-2 mt-3 border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === "all"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                Tất cả ({data.vocabs.length + data.grammars.length})
              </button>
              <button
                onClick={() => setActiveTab("vocab")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
                  activeTab === "vocab"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Từ vựng ({data.vocabs.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("grammar")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
                  activeTab === "grammar"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Ngữ pháp ({data.grammars.length})</span>
              </button>
            </div>

            <button
              onClick={() => runAnalysis(true)}
              title="Phân tích lại bằng LLM"
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Phân tích lại</span>
            </button>
          </div>
        )}

        {/* Content List */}
        <div className="flex-1 overflow-y-auto mt-3 space-y-4 pr-1 min-h-[220px]">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <div className="w-9 h-9 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                AI đang bóc tách từ vựng & cấu trúc ngữ pháp (trình độ {userLevel})...
              </p>
            </div>
          ) : data ? (
            <>
              {/* Vocab Section */}
              {(activeTab === "all" || activeTab === "vocab") && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center space-x-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Từ vựng trong câu ({data.vocabs.length})</span>
                  </h3>
                  {data.vocabs.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">Không có từ vựng nào được trích xuất.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {data.vocabs.map((v, idx) => (
                        <div
                          key={`${v.word}-${idx}`}
                          className={`p-3 rounded-xl border transition flex flex-col justify-between ${
                            v.is_saved
                              ? "bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-85"
                              : "bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/80 hover:border-indigo-400/60"
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center flex-wrap gap-1.5">
                                <span className="text-base font-bold text-slate-900 dark:text-white">
                                  {v.word}
                                </span>
                                {v.reading && v.reading !== v.word && (
                                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                                    【{v.reading}】
                                  </span>
                                )}
                                <button
                                  onClick={() => speak(v.word)}
                                  className="p-1 text-slate-400 hover:text-indigo-500 rounded-md"
                                  title="Phát âm"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {v.jlpt && (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                                  {v.jlpt}
                                </span>
                              )}
                            </div>

                            {v.pos && (
                              <span className="inline-block mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                                {v.pos} {v.romanized ? `• ${v.romanized}` : ""}
                              </span>
                            )}

                            <p className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-400 mt-1.5">
                              {v.meaning}
                            </p>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex justify-end">
                            {v.is_saved ? (
                              <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <Check className="w-3.5 h-3.5" />
                                <span>Đã có trong sổ (Bỏ qua)</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSaveSingleVocab(v)}
                                disabled={savingWord === v.word}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-600/10 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white text-xs font-semibold transition"
                              >
                                <BookmarkPlus className="w-3.5 h-3.5" />
                                <span>{savingWord === v.word ? "Đang lưu..." : "Lưu từ vựng"}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Grammar Section */}
              {(activeTab === "all" || activeTab === "grammar") && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center space-x-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Cấu trúc ngữ pháp ({data.grammars.length})</span>
                  </h3>
                  {data.grammars.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">
                      Không phát hiện cấu trúc ngữ pháp đặc biệt trong câu này.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {data.grammars.map((g, idx) => (
                        <div
                          key={`${g.pattern}-${idx}`}
                          className={`p-3.5 rounded-xl border transition ${
                            g.is_saved
                              ? "bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-85"
                              : "bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/80 hover:border-amber-400/60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                                {g.pattern}
                              </span>
                              {g.jlpt && (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20">
                                  {g.jlpt}
                                </span>
                              )}
                            </div>

                            {g.is_saved ? (
                              <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                <Check className="w-3.5 h-3.5" />
                                <span>Đã có trong sổ (Bỏ qua)</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSaveSingleGrammar(g)}
                                disabled={savingPattern === g.pattern}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-600 text-amber-700 dark:text-amber-300 hover:text-white text-xs font-semibold transition flex-shrink-0"
                              >
                                <BookmarkPlus className="w-3.5 h-3.5" />
                                <span>{savingPattern === g.pattern ? "Đang lưu..." : "Lưu ngữ pháp"}</span>
                              </button>
                            )}
                          </div>

                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1">
                            Nghĩa: {g.meaning}
                          </p>
                          {g.explanation && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                              {g.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        {!loading && data && (
          <div className="pt-3.5 mt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {totalUnsaved > 0
                ? `Phát hiện ${unsavedVocabCount} từ vựng & ${unsavedGrammarCount} ngữ pháp mới chưa có trong sổ.`
                : "Tất cả từ vựng & ngữ pháp trong câu này đều đã có trong sổ của bạn."}
            </span>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
              >
                Đóng
              </button>
              <button
                onClick={handleSaveAllNew}
                disabled={savingAll || totalUnsaved === 0}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-md ${
                  totalUnsaved === 0
                    ? "bg-emerald-600/20 text-emerald-500 cursor-default shadow-none"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20"
                }`}
              >
                {totalUnsaved === 0 ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Đã lưu toàn bộ</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-4 h-4" />
                    <span>
                      {savingAll
                        ? "Đang lưu..."
                        : `Lưu tất cả mục mới (${totalUnsaved})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
