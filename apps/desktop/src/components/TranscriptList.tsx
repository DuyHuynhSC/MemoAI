import React, { useEffect, useRef } from "react";
import type { Segment } from "../types";
import { Play, Sparkles } from "lucide-react";

interface TranscriptListProps {
  segments: Segment[];
  currentTime: number;
  onSeek: (time: number) => void;
  onWordClick: (word: string, context: Segment) => void;
  onAnalyzeSegment?: (segment: Segment) => void;
  showFurigana: boolean;
  showRomaji: boolean;
  showTranslation: boolean;
  jaFontSize?: number;
  viFontSize?: number;
}

export const TranscriptList: React.FC<TranscriptListProps> = ({
  segments,
  currentTime,
  onSeek,
  onWordClick,
  onAnalyzeSegment,
  showFurigana,
  showRomaji,
  showTranslation,
  jaFontSize,
  viFontSize,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLDivElement | null>(null);

  const activeIdx = segments.findIndex(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  // Auto-scroll to active segment inside container
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeEl = activeRef.current;
      const activeRect = activeEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const relativeTop = activeRect.top - containerRect.top + container.scrollTop;
      const targetTop = relativeTop - (container.clientHeight / 2 - activeEl.clientHeight / 2);

      container.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });
    }
  }, [activeIdx]);

  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto space-y-2 p-2 sm:p-3.5 relative">
      {segments.map((s, idx) => {
        const isActive = idx === activeIdx;
        return (
          <div
            key={s.id || idx}
            ref={isActive ? activeRef : null}
            onClick={() => onSeek(s.start)}
            className={`p-2.5 sm:p-3.5 rounded-xl cursor-pointer transition border text-left ${
              isActive
                ? "bg-indigo-50 dark:bg-indigo-600/15 border-indigo-400 dark:border-indigo-500/60 shadow-md text-slate-900 dark:text-white ring-1 ring-indigo-400/50"
                : "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-100"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 dark:text-slate-500 mb-1">
              <span>
                {formatTime(s.start)} - {formatTime(s.end)}
              </span>
              <div className="flex items-center space-x-2">
                {isActive && (
                  <span className="flex items-center space-x-1 text-indigo-600 dark:text-indigo-400 font-sans font-medium text-xs">
                    <Play className="w-3 h-3 fill-current animate-pulse" />
                    <span>Đang phát</span>
                  </span>
                )}
                {onAnalyzeSegment && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAnalyzeSegment(s);
                    }}
                    title="Phân tích từ vựng & ngữ pháp bằng AI (LLM)"
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-sans font-semibold bg-indigo-500/10 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white border border-indigo-500/20 transition"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Phân tích AI</span>
                  </button>
                )}
              </div>
            </div>

            <div
              style={
                jaFontSize
                  ? {
                      fontSize: `${Math.max(14, Math.round(jaFontSize * 0.65))}px`,
                      lineHeight: showFurigana ? 1.6 : 1.35,
                    }
                  : { lineHeight: showFurigana ? 1.6 : 1.35 }
              }
              className="text-base font-medium text-slate-900 dark:text-slate-100 flex flex-wrap items-baseline gap-x-0.5 gap-y-0.5"
            >
              {s.tokens && s.tokens.length > 0 ? (
                s.tokens.map((token, tIdx) => (
                  <span
                    key={tIdx}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(s.start);
                      onWordClick(token.surface, s);
                    }}
                    className="hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-0.5 py-0.5 rounded transition cursor-pointer"
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
                style={viFontSize ? { fontSize: `${Math.max(13, Math.round(viFontSize * 0.72))}px`, lineHeight: 1.4 } : undefined}
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
