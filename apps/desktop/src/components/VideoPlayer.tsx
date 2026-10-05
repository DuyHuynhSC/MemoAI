import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Repeat, Headphones } from "lucide-react";
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
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isLoopingSegment, setIsLoopingSegment] = useState(false);
  const [isShadowing, setIsShadowing] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const lastActiveIdxRef = useRef<number>(-1);

  const activeSegment = segments.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );
  const activeIdx = segments.findIndex(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  useEffect(() => {
    if (!videoRef.current || !activeSegment) return;

    if (isLoopingSegment && currentTime >= activeSegment.end - 0.1) {
      videoRef.current.currentTime = activeSegment.start;
      videoRef.current.play();
    }

    if (isShadowing && activeIdx !== -1 && activeIdx !== lastActiveIdxRef.current) {
      if (currentTime >= activeSegment.end - 0.15) {
        videoRef.current.pause();
        setIsPlaying(false);
        lastActiveIdxRef.current = activeIdx;
      }
    }
  }, [currentTime, isLoopingSegment, isShadowing, activeSegment, activeIdx]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    onTimeUpdate(time);
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const replayCurrentSegment = () => {
    if (!videoRef.current || !activeSegment) return;
    videoRef.current.currentTime = activeSegment.start;
    videoRef.current.play();
    setIsPlaying(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
      <div className="relative flex-1 bg-black flex items-center justify-center min-h-[360px]">
        <video
          ref={videoRef}
          src={getMediaUrl(project.id)}
          onTimeUpdate={() => {
            if (videoRef.current) onTimeUpdate(videoRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="w-full h-full max-h-[580px] object-contain cursor-pointer"
          onClick={togglePlay}
        />

        {activeSegment && (
          <div className="absolute bottom-6 inset-x-4 flex justify-center pointer-events-none">
            <div className="bg-black/75 backdrop-blur-md px-6 py-3 rounded-2xl max-w-2xl text-center shadow-2xl border border-white/10 pointer-events-auto transition duration-150">
              {showJapanese && (
                <div className="text-xl md:text-2xl font-semibold text-white tracking-wide flex flex-wrap justify-center items-end gap-x-1 gap-y-1">
                  {activeSegment.tokens && activeSegment.tokens.length > 0 ? (
                    activeSegment.tokens.map((token, idx) => (
                      <span
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          onWordClick(token.surface, activeSegment);
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
                    <span>{activeSegment.text}</span>
                  )}
                </div>
              )}

              {showRomaji && activeSegment.romanized && (
                <p className="text-xs text-indigo-300 font-mono mt-1 tracking-wider">
                  {activeSegment.romanized}
                </p>
              )}

              {showTranslation && activeSegment.translation && (
                <p className="text-sm md:text-base text-emerald-300 font-medium mt-1.5 drop-shadow">
                  {activeSegment.translation}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900/95 border-t border-slate-800 p-4 space-y-3">
        <div className="flex items-center space-x-3 text-xs font-mono text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />
          <span>{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between">
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
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsLoopingSegment(!isLoopingSegment)}
              title="Lặp lại câu này liên tục"
              className={`p-2.5 rounded-xl border transition flex items-center space-x-1.5 text-xs font-medium ${
                isLoopingSegment
                  ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                  : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white"
              }`}
            >
              <Repeat className="w-4 h-4" />
              <span>Lặp câu</span>
            </button>

            <button
              onClick={() => setIsShadowing(!isShadowing)}
              title="Chế độ Shadowing: tự dừng sau mỗi câu để bạn đọc theo"
              className={`p-2.5 rounded-xl border transition flex items-center space-x-1.5 text-xs font-medium ${
                isShadowing
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                  : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white"
              }`}
            >
              <Headphones className="w-4 h-4" />
              <span>Shadowing</span>
            </button>
          </div>

          <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            {[0.75, 1.0, 1.25].map((speed) => (
              <button
                key={speed}
                onClick={() => changeSpeed(speed)}
                className={`px-2.5 py-1 rounded-lg transition ${
                  playbackRate === speed
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white"
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
                  ? "bg-indigo-500/20 border-indigo-500/80 text-indigo-300"
                  : "bg-slate-800 border-slate-700 text-slate-500"
              }`}
            >
              Tiếng Nhật
            </button>

            <button
              onClick={() => setShowFurigana(!showFurigana)}
              className={`px-3 py-1.5 rounded-xl border transition font-medium ${
                showFurigana
                  ? "bg-indigo-500/20 border-indigo-500/80 text-indigo-300"
                  : "bg-slate-800 border-slate-700 text-slate-500"
              }`}
            >
              Furigana
            </button>

            <button
              onClick={() => setShowRomaji(!showRomaji)}
              className={`px-3 py-1.5 rounded-xl border transition font-medium ${
                showRomaji
                  ? "bg-indigo-500/20 border-indigo-500/80 text-indigo-300"
                  : "bg-slate-800 border-slate-700 text-slate-500"
              }`}
            >
              Romaji
            </button>

            <button
              onClick={() => setShowTranslation(!showTranslation)}
              className={`px-3 py-1.5 rounded-xl border transition font-medium ${
                showTranslation
                  ? "bg-emerald-500/20 border-emerald-500/80 text-emerald-300"
                  : "bg-slate-800 border-slate-700 text-slate-500"
              }`}
            >
              Tiếng Việt
            </button>
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
