import React, { useEffect, useState } from "react";
import { X, Trash2, Download, BookOpen, GraduationCap, Volume2, Search } from "lucide-react";
import {
  fetchVocab,
  deleteVocab,
  getAnkiExportUrl,
  fetchGrammar,
  deleteGrammar,
  getGrammarAnkiExportUrl,
} from "../api/client";
import type { Vocab, Grammar } from "../types";

interface VocabModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const JLPT_FILTERS = ["ALL", "N5", "N4", "N3", "N2", "N1"];

export const VocabModal: React.FC<VocabModalProps> = ({ isOpen, onClose }) => {
  const [vocabs, setVocabs] = useState<Vocab[]>([]);
  const [grammars, setGrammars] = useState<Grammar[]>([]);
  const [activeTab, setActiveTab] = useState<"vocab" | "grammar">("vocab");
  const [jlptFilter, setJlptFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vocabData, grammarData] = await Promise.all([
        fetchVocab(),
        fetchGrammar(),
      ]);
      setVocabs(vocabData);
      setGrammars(grammarData);
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

  const handleDeleteVocab = async (id: number) => {
    try {
      await deleteVocab(id);
      setVocabs((prev) => prev.filter((v) => v.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteGrammar = async (id: number) => {
    try {
      await deleteGrammar(id);
      setGrammars((prev) => prev.filter((g) => g.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!isOpen) return null;

  const q = searchQuery.trim().toLowerCase();

  const filteredVocabs = vocabs.filter((v) => {
    if (jlptFilter !== "ALL" && (v.jlpt || "").toUpperCase() !== jlptFilter) return false;
    if (!q) return true;
    return (
      v.word.toLowerCase().includes(q) ||
      (v.reading || "").toLowerCase().includes(q) ||
      v.meaning.toLowerCase().includes(q)
    );
  });

  const filteredGrammars = grammars.filter((g) => {
    if (jlptFilter !== "ALL" && (g.jlpt || "").toUpperCase() !== jlptFilter) return false;
    if (!q) return true;
    return (
      g.pattern.toLowerCase().includes(q) ||
      g.meaning.toLowerCase().includes(q) ||
      (g.explanation || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 border-t sm:border border-slate-200 dark:border-slate-700 w-full sm:max-w-3xl rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl relative max-h-[88vh] flex flex-col text-slate-900 dark:text-white">
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-700/80 pr-8">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              <span>Sổ tay học tập cá nhân</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Lưu trữ từ vựng & cấu trúc ngữ pháp của riêng bạn theo cấp độ JLPT
            </p>
          </div>

          {activeTab === "vocab" ? (
            <a
              href={getAnkiExportUrl()}
              download="memoai_japanese_vocab.apkg"
              className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Anki Từ vựng (.apkg)</span>
            </a>
          ) : (
            <a
              href={getGrammarAnkiExportUrl()}
              download="memoai_japanese_grammar.apkg"
              className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-amber-600/20 transition whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Anki Ngữ pháp (.apkg)</span>
            </a>
          )}
        </div>

        {/* Tabs & Filters */}
        <div className="pt-3 pb-2 border-b border-slate-200 dark:border-slate-700/80 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab("vocab")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition ${
                  activeTab === "vocab"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Sổ Từ Vựng ({vocabs.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("grammar")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition ${
                  activeTab === "grammar"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Sổ Ngữ Pháp ({grammars.length})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm từ vựng, mẫu ngữ pháp, nghĩa..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {/* JLPT Level Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Cấp độ:</span>
            {JLPT_FILTERS.map((lvl) => (
              <button
                key={lvl}
                onClick={() => setJlptFilter(lvl)}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition ${
                  jlptFilter === lvl
                    ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/40"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                }`}
              >
                {lvl === "ALL" ? "Tất cả" : lvl}
              </button>
            ))}
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">Đang tải dữ liệu sổ tay...</div>
          ) : activeTab === "vocab" ? (
            filteredVocabs.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <BookOpen className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                <p className="font-medium text-slate-700 dark:text-slate-300">Chưa có từ vựng nào phù hợp.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Hãy bấm vào từ tiếng Nhật hoặc nút "Phân tích AI" khi học video để lưu từ vựng!
                </p>
              </div>
            ) : (
              filteredVocabs.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 flex items-start justify-between hover:border-slate-300 dark:hover:border-slate-600 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                        {item.word}
                      </span>
                      {item.reading && (
                        <span className="text-sm text-indigo-600 dark:text-indigo-300 font-medium">
                          {item.reading}
                        </span>
                      )}
                      {item.jlpt && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                          {item.jlpt}
                        </span>
                      )}
                      {item.pos && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          ({item.pos})
                        </span>
                      )}
                      <button
                        onClick={() => speak(item.word)}
                        title="Phát âm"
                        className="text-slate-400 hover:text-indigo-500 transition p-1"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      {item.meaning}
                    </p>

                    {item.context_sentence && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200 dark:border-slate-800/80 mt-1">
                        <p className="text-slate-800 dark:text-slate-300 font-serif">
                          {item.context_sentence}
                        </p>
                        {item.context_translation && (
                          <p className="text-slate-500 italic mt-0.5">{item.context_translation}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteVocab(item.id)}
                    title="Xoá từ này"
                    className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg ml-2 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )
          ) : filteredGrammars.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <GraduationCap className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
              <p className="font-medium text-slate-700 dark:text-slate-300">Chưa có mẫu ngữ pháp nào được lưu.</p>
              <p className="text-xs text-slate-500 mt-1">
                Khi học video, hãy bấm nút "Phân tích AI" để trích xuất và lưu các mẫu ngữ pháp quan trọng!
              </p>
            </div>
          ) : (
            filteredGrammars.map((g) => (
              <div
                key={g.id}
                className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 flex items-start justify-between hover:border-amber-400/50 transition"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400">
                      {g.pattern}
                    </span>
                    {g.jlpt && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                        {g.jlpt}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {g.meaning}
                  </p>

                  {g.explanation && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 leading-relaxed">
                      {g.explanation}
                    </p>
                  )}

                  {g.context_sentence && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200 dark:border-slate-800/80 mt-1">
                      <p className="text-slate-800 dark:text-slate-300 font-serif">
                        Ví dụ: {g.context_sentence}
                      </p>
                      {g.context_translation && (
                        <p className="text-slate-500 italic mt-0.5">{g.context_translation}</p>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteGrammar(g.id)}
                  title="Xoá ngữ pháp này"
                  className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg ml-2 flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
