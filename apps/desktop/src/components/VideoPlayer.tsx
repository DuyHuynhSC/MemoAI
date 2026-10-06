import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Repeat, Headphones, Sliders, Type } from "lucide-react";
import type { Project, Segment } from "../types";
import { getMediaUrl } from "../api/client";

interface VideoPlayerProps {
  project: Project;
  segments: Segment[];
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onWordClick: (word: string, context: Segment) => void;
  showFurigana: boolean;
  setShowFurigana: (v: boolean) => void;
  showRomaji: boolean;
  setShowRomaji: (v: boolean) => void;
  showTranslation: boolean;
  setShowTranslation: (v: boolean) => void;
  showJapanese: boolean;
  setShowJapanese: (v: boolean) => void;
  jaFontSize: number;
  setJaFontSize: (v: number) => void;
  viFontSize: number;
  setViFontSize: (v: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  project,
  segments,
  currentTime,
  onTimeUpdate,
  onWordClick,
  showFurigana,
  setShowFurigana,
  showRomaji,
  setShowRomaji,
  showTranslation,
  setShowTranslation,
  showJapanese,
  setShowJapanese,
  jaFontSize,
  setJaFontSize,
  viFontSize,
  setViFontSize,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isLoopingSegment, setIsLoopingSegment] = useState(false);
  const [isShadowing, setIsShadowing] = useState(false);
  const [isShadowingPaused, setIsShadowingPaused] = useState(false);
  const [shadowingSegment, setShadowingSegment] = useState<Segment | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isFontPopoverOpen, setIsFontPopoverOpen] = useState(false);
  const shadowedIdxRef = useRef<number>(-1);

  const activeSegment = segments.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  // During shadowing pause, lock to the sentence that just finished so its subtitles remain visible!
  const displaySegment = (isShadowingPaused && shadowingSegment) ? shadowingSegment : activeSegment;

  const checkPlaybackRules = (curr: number) => {
    if (!videoRef.current) return;

    // 1. Looping Segment Mode
    if (isLoopingSegment) {
      const curSeg = segments.find((s) => curr >= s.start && curr <= s.end);
      if (curSeg && curr >= curSeg.end - 0.1) {
        videoRef.current.currentTime = curSeg.start;
        videoRef.current.play();
        return;
      }
    }

    // 2. Shadowing Mode: Detect sentence end with generous buffer to prevent 250ms timeupdate skips
    if (isShadowing && !isShadowingPaused) {
      const segIdx = segments.findIndex(
        (s) => curr >= s.start - 0.1 && curr <= s.end + 0.35
      );
      if (segIdx !== -1 && segIdx !== shadowedIdxRef.current) {
        const seg = segments[segIdx];
        if (curr >= seg.end - 0.15) {
          videoRef.current.pause();
          videoRef.current.currentTime = Math.min(curr, seg.end);
          setIsPlaying(false);
          setIsShadowingPaused(true);
          setShadowingSegment(seg);
          shadowedIdxRef.current = segIdx;
        }
      }
    }
  };

  // High-frequency interval (50ms) to ensure sentence boundaries are NEVER missed by browser timeupdate throttling
  useEffect(() => {
    if (!isPlaying || (!isShadowing && !isLoopingSegment)) return;

    const timer = setInterval(() => {
      if (videoRef.current) {
        checkPlaybackRules(videoRef.current.currentTime);
      }
    }, 50);

    return () => clearInterval(timer);
  }, [isPlaying, isShadowing, isShadowingPaused, isLoopingSegment, segments]);

  const resumeShadowing = () => {
    if (!videoRef.current) return;
    setIsShadowingPaused(false);
    setShadowingSegment(null);

    const currIdx = shadowedIdxRef.current;
    if (currIdx >= 0 && currIdx < segments.length - 1) {
      const nextSeg = segments[currIdx + 1];
      videoRef.current.currentTime = nextSeg.start;
      onTimeUpdate(nextSeg.start);
    }
    videoRef.current.play();
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (isShadowingPaused) {
        resumeShadowing();
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleShadowing = () => {
    if (isShadowing) {
      setIsShadowing(false);
      setIsShadowingPaused(false);
      setShadowingSegment(null);
      shadowedIdxRef.current = -1;
    } else {
      setIsShadowing(true);
      setIsShadowingPaused(false);
      setShadowingSegment(null);
      shadowedIdxRef.current = -1;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setIsShadowingPaused(false);
    setShadowingSegment(null);
    shadowedIdxRef.current = -1;
    onTimeUpdate(time);
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const replayCurrentSegment = () => {
    const targetSeg = shadowingSegment || activeSegment;
    if (!videoRef.current || !targetSeg) return;
    setIsShadowingPaused(false);
    setShadowingSegment(null);
    shadowedIdxRef.current = -1;
    videoRef.current.currentTime = targetSeg.start;
    onTimeUpdate(targetSeg.start);
    videoRef.current.play();
    setIsPlaying(true);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-black rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-800 shadow-2xl relative">
      <div className="relative flex-1 bg-black flex items-center justify-center min-h-[360px]">
        <video
          ref={videoRef}
          src={getMediaUrl(project.id)}
          onTimeUpdate={() => {
            if (videoRef.current) {
              const curr = videoRef.current.currentTime;
              onTimeUpdate(curr);
              checkPlaybackRules(curr);
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="w-full h-full max-h-[calc(100vh-230px)] object-contain cursor-pointer"
          onClick={togglePlay}
        />

        {displaySegment && (
          <div className="absolute bottom-6 inset-x-4 flex flex-col items-center pointer-events-none">
            {isShadowing && isShadowingPaused && (
              <div className="mb-3 inline-flex items-center space-x-2 bg-emerald-600/95 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-2xl backdrop-blur-md pointer-events-auto border border-emerald-400/40 animate-pulse">
                <Headphones className="w-3.5 h-3.5" />
                <span>Tạm dừng Shadowing · Luyện đọc nhại lại câu này</span>
                <button
                  onClick={resumeShadowing}
                  className="ml-2 px-3 py-0.5 bg-white text-emerald-800 rounded-md font-bold hover:bg-emerald-50 text-[11px] shadow-sm transition"
                >
                  Tiếp tục câu sau ➔
                </button>
              </div>
            )}

            <div className="bg-black/80 backdrop-blur-md px-6 py-3.5 rounded-2xl max-w-3xl text-center shadow-2xl border border-white/10 pointer-events-auto transition duration-150">
              {showJapanese && (
                <div
                  style={{ fontSize: `${jaFontSize || 26}px`, lineHeight: 1.35 }}
                  className="font-semibold text-white tracking-wide flex flex-wrap justify-center items-end gap-x-1.5 gap-y-1.5"
                >
                  {displaySegment.tokens && displaySegment.tokens.length > 0 ? (
                    displaySegment.tokens.map((token, idx) => (
                      <span
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          onWordClick(token.surface, displaySegment);
                        }}
                        className="hover:text-indigo-400 hover:bg-white/10 px-1 py-0.5 rounded cursor-pointer transition select-none"
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
                    <span>{displaySegment.text}</span>
                  )}
                </div>
              )}

              {showRomaji && displaySegment.romanized && (
                <p className="text-xs md:text-sm text-indigo-300 font-mono mt-1 tracking-wider">
                  {displaySegment.romanized}
                </p>
              )}

              {showTranslation && displaySegment.translation && (
                <p
                  style={{ fontSize: `${viFontSize || 20}px`, lineHeight: 1.35 }}
                  className="font-medium mt-2 drop-shadow text-emerald-400 dark:text-emerald-300"
                >
                  {displaySegment.translation}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-100 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex items-center space-x-3 text-xs font-mono text-slate-500 dark:text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 accent-indigo-600 dark:accent-indigo-500 cursor-pointer h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg"
          />
          <span>{formatTime(duration)}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={togglePlay}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            <button
              onClick={replayCurrentSegment}
              title="Phát lại câu hiện tại"
              className="p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl border border-slate-200 dark:border-transparent transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsLoopingSegment(!isLoopingSegment)}
              title="Lặp lại câu này liên tục"
              className={`p-2.5 rounded-xl border transition flex items-center space-x-1.5 text-xs font-medium ${
                isLoopingSegment
                  ? "bg-indigo-50 dark:bg-indigo-500/20 border-indigo-500 text-indigo-700 dark:text-indigo-300"
                  : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Repeat className="w-4 h-4" />
              <span>Lặp câu</span>
            </button>

            <button
              onClick={toggleShadowing}
              title="Chế độ Shadowing: tự dừng sau mỗi câu để bạn đọc theo"
              className={`p-2.5 rounded-xl border transition flex items-center space-x-1.5 text-xs font-medium ${
                isShadowing
                  ? "bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500"
                  : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Headphones className="w-4 h-4" />
              <span>Shadowing {isShadowing && (isShadowingPaused ? "(Đang dừng)" : "(Bật)")}</span>
            </button>
          </div>

          <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            {[0.75, 1.0, 1.25].map((speed) => (
              <button
                key={speed}
                onClick={() => changeSpeed(speed)}
                className={`px-2.5 py-1 rounded-lg transition ${
                  playbackRate === speed
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <button
              onClick={() => setShowJapanese(!showJapanese)}
              className={`px-3 py-1.5 rounded-xl border transition font-medium ${
                showJapanese
                  ? "bg-indigo-50 dark:bg-indigo-500/20 border-indigo-400 dark:border-indigo-500/80 text-indigo-700 dark:text-indigo-300"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
              }`}
            >
              Tiếng Nhật
            </button>

            <button
              onClick={() => setShowFurigana(!showFurigana)}
              className={`px-3 py-1.5 rounded-xl border transition font-medium ${
                showFurigana
                  ? "bg-indigo-50 dark:bg-indigo-500/20 border-indigo-400 dark:border-indigo-500/80 text-indigo-700 dark:text-indigo-300"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
              }`}
            >
              Furigana
            </button>

            <button
              onClick={() => setShowRomaji(!showRomaji)}
              className={`px-3 py-1.5 rounded-xl border transition font-medium ${
                showRomaji
                  ? "bg-indigo-50 dark:bg-indigo-500/20 border-indigo-400 dark:border-indigo-500/80 text-indigo-700 dark:text-indigo-300"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
              }`}
            >
              Romaji
            </button>

            <button
              onClick={() => setShowTranslation(!showTranslation)}
              className={`px-3 py-1.5 rounded-xl border transition font-medium ${
                showTranslation
                  ? "bg-emerald-50 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500/80 text-emerald-700 dark:text-emerald-300"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
              }`}
            >
              Tiếng Việt
            </button>

            {/* Subtitle Font Size Popover Button */}
            <div className="relative">
              <button
                onClick={() => setIsFontPopoverOpen(!isFontPopoverOpen)}
                title="Cài đặt cỡ chữ phụ đề"
                className={`px-3 py-1.5 rounded-xl border transition font-medium flex items-center space-x-1.5 ${
                  isFontPopoverOpen
                    ? "bg-indigo-600 text-white border-indigo-600 shadow"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Cỡ chữ</span>
              </button>

              {isFontPopoverOpen && (
                <div className="absolute bottom-full right-0 mb-3 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-2xl z-30 space-y-3.5 text-xs text-slate-800 dark:text-slate-200">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Cỡ chữ phụ đề</span>
                    </span>
                    <button
                      onClick={() => {
                        setJaFontSize(26);
                        setViFontSize(20);
                      }}
                      className="text-[10px] text-slate-400 hover:text-indigo-500"
                    >
                      Mặc định
                    </button>
                  </div>

                  {/* Japanese Font Size */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">🇯🇵 Tiếng Nhật</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{jaFontSize}px</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setJaFontSize(Math.max(16, jaFontSize - 2))}
                        className="w-7 h-7 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-bold border border-slate-200 dark:border-slate-700"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min={18}
                        max={42}
                        step={2}
                        value={jaFontSize}
                        onChange={(e) => setJaFontSize(parseInt(e.target.value))}
                        className="flex-1 accent-indigo-600 dark:accent-indigo-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded"
                      />
                      <button
                        onClick={() => setJaFontSize(Math.min(42, jaFontSize + 2))}
                        className="w-7 h-7 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-bold border border-slate-200 dark:border-slate-700"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Vietnamese Font Size */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">🇻🇳 Tiếng Việt</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{viFontSize}px</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setViFontSize(Math.max(14, viFontSize - 2))}
                        className="w-7 h-7 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-bold border border-slate-200 dark:border-slate-700"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min={14}
                        max={36}
                        step={2}
                        value={viFontSize}
                        onChange={(e) => setViFontSize(parseInt(e.target.value))}
                        className="flex-1 accent-emerald-600 dark:accent-emerald-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded"
                      />
                      <button
                        onClick={() => setViFontSize(Math.min(36, viFontSize + 2))}
                        className="w-7 h-7 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-bold border border-slate-200 dark:border-slate-700"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Quick presets */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-800 text-[10px]">
                    <button
                      onClick={() => { setJaFontSize(20); setViFontSize(16); }}
                      className="py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium border border-slate-200 dark:border-slate-700"
                    >
                      Nhỏ
                    </button>
                    <button
                      onClick={() => { setJaFontSize(26); setViFontSize(20); }}
                      className="py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium border border-slate-200 dark:border-slate-700"
                    >
                      Vừa
                    </button>
                    <button
                      onClick={() => { setJaFontSize(34); setViFontSize(26); }}
                      className="py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium border border-slate-200 dark:border-slate-700"
                    >
                      Lớn
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
