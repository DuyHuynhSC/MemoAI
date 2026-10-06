import React, { useEffect, useState } from "react";
import { X, Trash2, Download, BookOpen, Volume2 } from "lucide-react";
import { fetchVocab, deleteVocab, getAnkiExportUrl } from "../api/client";
import type { Vocab } from "../types";

interface VocabModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VocabModal: React.FC<VocabModalProps> = ({ isOpen, onClose }) => {
  const [vocabs, setVocabs] = useState<Vocab[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchVocab();
      setVocabs(data);
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

  const handleDelete = async (id: number) => {
    try {
      await deleteVocab(id);
      setVocabs(vocabs.filter((v) => v.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col text-slate-900 dark:text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700/80 pr-8">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              <span>Sổ từ vựng cá nhân ({vocabs.length})</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Các từ vựng bạn đã lưu trong lúc xem video
            </p>
          </div>

          <a
            href={getAnkiExportUrl()}
            download="memoai_japanese_vocab.apkg"
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition"
          >
            <Download className="w-4 h-4" />
            <span>Xuất thẻ Anki (.apkg)</span>
          </a>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
          {loading ? (
            <div className="py-16 text-center text-slate-400">Đang tải danh sách từ vựng...</div>
          ) : vocabs.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <BookOpen className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
              <p className="font-medium text-slate-700 dark:text-slate-300">Chưa có từ vựng nào được lưu.</p>
              <p className="text-xs text-slate-500 mt-1">
                Hãy bấm vào bất kỳ từ tiếng Nhật nào khi xem video để lưu vào đây!
              </p>
            </div>
          ) : (
            vocabs.map((item) => (
              <div
                key={item.id}
                className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 flex items-start justify-between hover:border-slate-300 dark:hover:border-slate-600 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl font-bold text-slate-900 dark:text-white">{item.word}</span>
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
                    <button
                      onClick={() => speak(item.word)}
                      title="Phát âm"
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{item.meaning}</p>

                  {item.context_sentence && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800/80 mt-1">
                      <p className="text-slate-800 dark:text-slate-300 font-serif">{item.context_sentence}</p>
                      {item.context_translation && (
                        <p className="text-slate-500 italic mt-0.5">{item.context_translation}</p>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDelete(item.id)}
                  title="Xoá từ này"
                  className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg ml-3"
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
