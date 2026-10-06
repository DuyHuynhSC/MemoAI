import React, { useEffect, useRef } from "react";
import type { Segment } from "../types";
import { Play } from "lucide-react";

interface TranscriptListProps {
  segments: Segment[];
  currentTime: number;
  onSeek: (time: number) => void;
  onWordClick: (word: string, context: Segment) => void;
  showFurigana: boolean;
  showRomaji: boolean;
  showTranslation: boolean;
}

export const TranscriptList: React.FC<TranscriptListProps> = ({
  segments,
  currentTime,
  onSeek,
  onWordClick,
  showFurigana,
  showRomaji,
  showTranslation,
}) => {
  const activeRef = useRef<HTMLDivElement | null>(null);

  const activeIdx = segments.findIndex(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIdx]);

  return (
    <div className="flex-1 overflow-y-auto space-y-2.5 p-3.5">
      {segments.map((s, idx) => {
        const isActive = idx === activeIdx;
        return (
          <div
            key={s.id || idx}
            ref={isActive ? activeRef : null}
            onClick={() => onSeek(s.start)}
            className={`p-3.5 rounded-xl cursor-pointer transition border text-left ${
              isActive
                ? "bg-indigo-50 dark:bg-indigo-600/15 border-indigo-400 dark:border-indigo-500/60 shadow-md text-slate-900 dark:text-white"
                : "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-100"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 dark:text-slate-500 mb-1.5">
              <span>
                {formatTime(s.start)} - {formatTime(s.end)}
              </span>
              {isActive && (
                <span className="flex items-center space-x-1 text-indigo-600 dark:text-indigo-400 font-sans font-medium text-xs">
                  <Play className="w-3 h-3 fill-current" />
                  <span>Đang phát</span>
                </span>
              )}
            </div>

            <div className="text-base font-medium text-slate-900 dark:text-slate-100 flex flex-wrap gap-x-1 gap-y-1.5 items-end">
              {s.tokens && s.tokens.length > 0 ? (
                s.tokens.map((token, tIdx) => (
                  <span
                    key={tIdx}
                    onClick={(e) => {
                      e.stopPropagation();
                      onWordClick(token.surface, s);
                    }}
                    className="hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-1 py-0.5 rounded transition cursor-pointer"
                  >
                    {showFurigana && token.reading && token.surface !== token.reading ? (
                      <ruby>
                        {token.surface}
                        <rt>{token.reading}</rt>
                      </ruby>
                    ) : (
                      token.surface
                    )}
                  </span>
                ))
              ) : (
                <span>{s.text}</span>
              )}
            </div>

            {showRomaji && s.romanized && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">{s.romanized}</p>
            )}

            {showTranslation && s.translation && (
              <p
                className={`text-sm mt-1.5 transition ${
                  isActive
                    ? "text-indigo-700 dark:text-indigo-200 font-medium"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {s.translation}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
