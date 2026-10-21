import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Repeat, Headphones, Sliders, Type, Maximize2, Minimize2 } from "lucide-react";
import type { Project, Segment } from "../types";
import { getMediaUrl } from "../api/client";

interface VideoPlayerProps {
  project: Project;
  segments: Segment[];
  currentTime: number;
  seekTarget?: number | null;
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
  isWordPopupOpen?: boolean;
  onSeekHandled?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  project,
  segments,
  currentTime,
  seekTarget,
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
  onSeekHandled,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fontPopoverRef = useRef<HTMLDivElement | null>(null);
  const lastActiveSegmentRef = useRef<Segment | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isLoopingSegment, setIsLoopingSegment] = useState(false);
  const [isShadowing, setIsShadowing] = useState(false);
  const [isShadowingPaused, setIsShadowingPaused] = useState(false);
  const [shadowingSegment, setShadowingSegment] = useState<Segment | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isFontPopoverOpen, setIsFontPopoverOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [seekBadge, setSeekBadge] = useState<"-5s" | "+5s" | null>(null);
  const shadowedIdxRef = useRef<number>(-1);

  const activeSegment = segments.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  if (activeSegment) {
    lastActiveSegmentRef.current = activeSegment;
  }

  const displaySegment = activeSegment || (
    !isPlaying
      ? (isShadowing && isShadowingPaused && shadowingSegment ? shadowingSegment : lastActiveSegmentRef.current)
      : null
  );

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

    // 2. Shadowing Mode
    if (isShadowing && !isShadowingPaused) {
      const segIdx = segments.findIndex(
        (s) => curr >= s.start - 0.1 && curr <= s.end + 0.35
      );
      if (segIdx !== -1 && segIdx !== shadowedIdxRef.current) {
        const seg = segments[segIdx];
        if (curr >= seg.end - 0.15) {
          videoRef.current.pause();
          setIsPlaying(false);
          setIsShadowingPaused(true);
          setShadowingSegment(seg);
          shadowedIdxRef.current = segIdx;
        }
      }
    }
  };

  useEffect(() => {
    if (seekTarget !== undefined && seekTarget !== null && videoRef.current) {
      videoRef.current.currentTime = seekTarget;
      onTimeUpdate(seekTarget);
      if (isShadowing) {
        setIsShadowingPaused(false);
        setShadowingSegment(null);
        shadowedIdxRef.current = -1;
      }
      if (onSeekHandled) {
        onSeekHandled();
      }
    }
  }, [seekTarget, isShadowing, onSeekHandled, onTimeUpdate]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleTouchVideo = (e: React.TouchEvent<HTMLDivElement>) => {
    const now = Date.now();
    const touch = e.changedTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const isLeft = x < rect.width / 2;

    if (now - lastTapRef.current.time < 300) {
      // Double tap detected: Seek -5s or +5s
      if (videoRef.current) {
        if (isLeft) {
          const target = Math.max(0, videoRef.current.currentTime - 5);
          videoRef.current.currentTime = target;
          onTimeUpdate(target);
          setSeekBadge("-5s");
        } else {
          const target = Math.min(duration, videoRef.current.currentTime + 5);
          videoRef.current.currentTime = target;
          onTimeUpdate(target);
          setSeekBadge("+5s");
        }
        setTimeout(() => setSeekBadge(null), 700);
      }
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x };
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      if (isShadowing && isShadowingPaused) {
        resumeShadowing();
      } else {
        videoRef.current.play();
      }
    }
  };

  const resumeShadowing = () => {
    if (!videoRef.current) return;
    setIsShadowingPaused(false);
    setShadowingSegment(null);

    const curr = videoRef.current.currentTime;
    const nextSeg = segments.find((s) => s.start > curr);
    if (nextSeg) {
      videoRef.current.currentTime = nextSeg.start;
      onTimeUpdate(nextSeg.start);
    }
    videoRef.current.play();
    setIsPlaying(true);
  };

  const toggleShadowing = () => {
    const nextState = !isShadowing;
    setIsShadowing(nextState);
    setIsShadowingPaused(false);
    setShadowingSegment(null);
    shadowedIdxRef.current = -1;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      onTimeUpdate(time);
      if (isShadowing) {
        setIsShadowingPaused(false);
        setShadowingSegment(null);
        shadowedIdxRef.current = -1;
      }
    }
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
  };

  const replayCurrentSegment = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    let targetSeg = segments.find((s) => curr >= s.start && curr <= s.end);
    if (!targetSeg) {
      for (let i = segments.length - 1; i >= 0; i--) {
        if (segments[i].end <= curr) {
          targetSeg = segments[i];
          break;
        }
      }
    }
    if (!targetSeg && segments.length > 0) {
      targetSeg = segments[0];
    }
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
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full bg-black rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-800 shadow-2xl relative select-none"
    >
      {/* Video Display Area with double-tap gesture */}
      <div
        onTouchEnd={handleTouchVideo}
        className="relative flex-1 bg-black flex items-center justify-center min-h-[200px] sm:min-h-[340px]"
      >
        <video
          ref={videoRef}
          src={getMediaUrl(project.id)}
          playsInline
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
          onPlay={() => {
            setIsPlaying(true);
            setIsShadowingPaused(false);
            setShadowingSegment(null);
          }}
          onPause={() => setIsPlaying(false)}
          onSeeked={() => {
            setIsShadowingPaused(false);
            setShadowingSegment(null);
          }}
          className="w-full h-full max-h-[calc(100vh-230px)] object-contain cursor-pointer"
          onClick={togglePlay}
        />

        {/* Double-tap seek badge */}
        {seekBadge && (
          <div
            className={`absolute top-1/2 ${
              seekBadge === "-5s" ? "left-8 sm:left-16" : "right-8 sm:right-16"
            } -translate-y-1/2 z-20 pointer-events-none bg-black/85 text-white px-4 py-2 rounded-full text-xs sm:text-sm font-bold border border-white/20 shadow-2xl animate-pulse`}
          >
            {seekBadge === "-5s" ? "⏪ -5s" : "+5s ⏩"}
          </div>
        )}

        {/* Subtitle Overlay */}
        {displaySegment && (
          <div className="absolute bottom-4 sm:bottom-6 inset-x-2 sm:inset-x-4 flex flex-col items-center pointer-events-none z-10">
            {isShadowing && isShadowingPaused && (
              <div className="mb-2 sm:mb-3 inline-flex items-center space-x-1.5 sm:space-x-2 bg-emerald-600/95 text-white text-[11px] sm:text-xs font-semibold px-3 sm:px-4 py-1.5 rounded-full shadow-2xl backdrop-blur-md pointer-events-auto border border-emerald-400/40 animate-pulse">
                <Headphones className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate max-w-[200px] sm:max-w-none">Tạm dừng Shadowing · Đọc nhại lại câu này</span>
                <button
                  onClick={resumeShadowing}
                  className="ml-1 sm:ml-2 px-2.5 sm:px-3 py-0.5 bg-white text-emerald-800 rounded-md font-bold hover:bg-emerald-50 text-[10px] sm:text-[11px] shadow-sm transition whitespace-nowrap"
                >
                  Tiếp ➔
                </button>
              </div>
            )}

            <div
              onClick={togglePlay}
              className="bg-black/80 backdrop-blur-md px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-2xl max-w-3xl text-center shadow-2xl border border-white/10 pointer-events-auto transition duration-150 cursor-pointer"
            >
              {showJapanese && (
                <div
                  style={{ fontSize: `${jaFontSize || 26}px`, lineHeight: 1.35 }}
                  className="font-semibold text-white tracking-wide flex flex-wrap justify-center items-end gap-x-1 sm:gap-x-1.5 gap-y-1"
                >
                  {displaySegment.tokens && displaySegment.tokens.length > 0 ? (
                    displaySegment.tokens.map((token, idx) => (
                      <span
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (videoRef.current && !videoRef.current.paused) {
                            videoRef.current.pause();
                            setIsPlaying(false);
                          }
                          onWordClick(token.surface, displaySegment);
                        }}
                        className="hover:text-indigo-400 hover:bg-white/10 active:bg-white/20 px-1 py-0.5 rounded cursor-pointer transition select-none"
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
                <p className="text-[11px] sm:text-xs text-slate-300 font-mono tracking-wider uppercase mt-1">
                  {displaySegment.romanized}
                </p>
              )}

              {showTranslation && displaySegment.translation && (
                <p
                  style={{ fontSize: `${viFontSize || 20}px` }}
                  className="text-amber-200/90 font-medium mt-1 leading-snug drop-shadow"
                >
                  {displaySegment.translation}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Responsive Player Controls */}
      <div className="bg-slate-100 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 space-y-2.5">
        {/* Timeline Slider */}
        <div className="flex items-center space-x-2.5 text-xs font-mono text-slate-500 dark:text-slate-400">
          <span className="min-w-[40px] text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 accent-indigo-600 dark:accent-indigo-500 cursor-pointer h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg"
          />
          <span className="min-w-[40px]">{formatTime(duration)}</span>
        </div>

        {/* Row 1: Playback Controls */}
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <button
              onClick={togglePlay}
              className="p-2 sm:p-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl shadow-lg transition"
              aria-label={isPlaying ? "Tạm dừng" : "Phát"}
            >
              {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
            </button>

            <button
              onClick={replayCurrentSegment}
              title="Phát lại câu hiện tại"
              className="p-2 sm:p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-transparent transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsLoopingSegment(!isLoopingSegment)}
              title="Lặp lại câu này liên tục"
              className={`p-2 sm:p-2.5 rounded-xl border transition flex items-center space-x-1 sm:space-x-1.5 text-xs font-medium ${
                isLoopingSegment
                  ? "bg-indigo-50 dark:bg-indigo-500/20 border-indigo-500 text-indigo-700 dark:text-indigo-300"
                  : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
              }`}
            >
              <Repeat className="w-4 h-4" />
              <span className="hidden sm:inline">Lặp câu</span>
            </button>

            <button
              onClick={toggleShadowing}
              title="Chế độ Shadowing: tự dừng sau mỗi câu để bạn đọc theo"
              className={`p-2 sm:p-2.5 rounded-xl border transition flex items-center space-x-1 sm:space-x-1.5 text-xs font-medium ${
                isShadowing
                  ? "bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500"
                  : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
              }`}
            >
              <Headphones className="w-4 h-4" />
              <span>
                Shadowing
                {isShadowing && (isShadowingPaused ? " (Dừng)" : " (Bật)")}
              </span>
            </button>
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Speed pills */}
            <div className="flex items-center space-x-0.5 bg-slate-200 dark:bg-slate-800 p-0.5 sm:p-1 rounded-xl text-xs font-semibold">
              {[0.75, 1.0, 1.25].map((speed) => (
                <button
                  key={speed}
                  onClick={() => changeSpeed(speed)}
                  className={`px-1.5 sm:px-2.5 py-1 rounded-lg transition text-[11px] sm:text-xs ${
                    playbackRate === speed
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
              className="p-2 sm:p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-transparent transition"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Row 2: Subtitle Layer Toggles (Touch-scrollable on mobile) */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-nowrap">
          <button
            onClick={() => setShowJapanese(!showJapanese)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl border transition font-medium whitespace-nowrap ${
              showJapanese
                ? "bg-indigo-50 dark:bg-indigo-500/20 border-indigo-400 dark:border-indigo-500/80 text-indigo-700 dark:text-indigo-300"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"
            }`}
          >
            Tiếng Nhật
          </button>

          <button
            onClick={() => setShowFurigana(!showFurigana)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl border transition font-medium whitespace-nowrap ${
              showFurigana
                ? "bg-indigo-50 dark:bg-indigo-500/20 border-indigo-400 dark:border-indigo-500/80 text-indigo-700 dark:text-indigo-300"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"
            }`}
          >
            Furigana
          </button>

          <button
            onClick={() => setShowRomaji(!showRomaji)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl border transition font-medium whitespace-nowrap ${
              showRomaji
                ? "bg-indigo-50 dark:bg-indigo-500/20 border-indigo-400 dark:border-indigo-500/80 text-indigo-700 dark:text-indigo-300"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"
            }`}
          >
            Romaji
          </button>

          <button
            onClick={() => setShowTranslation(!showTranslation)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl border transition font-medium whitespace-nowrap ${
              showTranslation
                ? "bg-emerald-50 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500/80 text-emerald-700 dark:text-emerald-300"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"
            }`}
          >
            Tiếng Việt
          </button>

          {/* Subtitle Font Size Popover Button */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setIsFontPopoverOpen(!isFontPopoverOpen)}
              title="Cài đặt cỡ chữ phụ đề"
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl border transition font-medium flex items-center space-x-1 whitespace-nowrap ${
                isFontPopoverOpen
                  ? "bg-indigo-600 text-white border-indigo-600 shadow"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Cỡ chữ</span>
            </button>

            {isFontPopoverOpen && (
              <div
                ref={fontPopoverRef}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-full right-0 mb-3 w-64 sm:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-2xl z-30 space-y-3.5 text-xs text-slate-800 dark:text-slate-200"
              >
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
  );
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
