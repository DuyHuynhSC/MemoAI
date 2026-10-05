import React, { useState } from "react";
import { X, BookmarkPlus, Check, Volume2, Sparkles } from "lucide-react";
import type { WordDefinition } from "../types";
import { addVocab } from "../api/client";

interface WordPopupProps {
  definition: WordDefinition | null;
  loading: boolean;
  onClose: () => void;
  contextSentence?: string;
  contextTranslation?: string;
}

export const WordPopup: React.FC<WordPopupProps> = ({
  definition,
  loading,
  onClose,
  contextSentence,
  contextTranslation,
}) => {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!definition && !loading) return null;

  const handleSaveToAnki = async () => {
    if (!definition || saved) return;
    setSaving(true);
    try {
      await addVocab({
        word: definition.word,
        reading: definition.reading,
        romanized: definition.romanized,
        meaning: definition.meaning,
        jlpt: definition.jlpt,
        pos: definition.pos,
        context_sentence: contextSentence || definition.context_sentence,
        context_translation: contextTranslation,
      });
      setSaved(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-700/50"
        >
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium">Đang tra cứu từ điển & phân tích...</p>
          </div>
        ) : definition ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between pr-8">
              <div>
                <div className="flex items-center space-x-3">
                  <h2 className="text-3xl font-bold text-white tracking-wide">{definition.word}</h2>
                  <button
                    onClick={() => speak(definition.word)}
                    title="Phát âm"
                    className="p-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded-full transition"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                {definition.reading && (
                  <p className="text-lg text-indigo-300 font-medium mt-0.5">{definition.reading}</p>
                )}
                {definition.romanized && (
                  <p className="text-xs text-slate-400 tracking-wider uppercase font-mono">{definition.romanized}</p>
                )}
              </div>

              {definition.jlpt && (
                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {definition.jlpt}
                </span>
              )}
            </div>

            <div className="bg-slate-900/80 border border-slate-700/70 rounded-xl p-4">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-400 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Ý NGHĨA TIẾNG VIỆT</span>
                {definition.pos && <span className="text-slate-500">({definition.pos})</span>}
              </div>
              <p className="text-base text-slate-100 font-medium leading-relaxed">{definition.meaning}</p>
            </div>

            {(contextSentence || definition.context_sentence) && (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 text-sm">
                <p className="text-slate-400 text-xs font-medium mb-1">Ví dụ trong ngữ cảnh:</p>
                <p className="text-slate-200">{contextSentence || definition.context_sentence}</p>
                {contextTranslation && (
                  <p className="text-slate-400 text-xs mt-1 italic">{contextTranslation}</p>
                )}
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={handleSaveToAnki}
                disabled={saved || saving}
                className={`w-full py-2.5 px-4 rounded-xl font-medium flex items-center justify-center space-x-2 transition ${
                  saved
                    ? "bg-emerald-600 text-white cursor-default"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                }`}
              >
                {saved ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Đã lưu vào Sổ từ (Anki)</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-4 h-4" />
                    <span>{saving ? "Đang lưu..." : "Lưu vào Sổ từ (Anki Flashcard)"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
