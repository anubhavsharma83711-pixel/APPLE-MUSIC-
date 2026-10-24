import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Tv, 
  ChevronUp,
  Shuffle,
  Repeat,
  Repeat1,
  Sparkles
} from 'lucide-react';
import { SongTrack, RepeatMode, AIDJState } from '../types';
import { MusicVisualizer } from './MusicVisualizer';

interface MiniPlayerProps {
  track: SongTrack;
  isPlaying: boolean;
  onPlayPause: (e: React.MouseEvent) => void;
  onNext: (e: React.MouseEvent) => void;
  onPrev?: (e: React.MouseEvent) => void;
  onExpand: () => void;
  isDesktop?: boolean;
  currentTime?: number;
  duration?: number;
  volume?: number;
  isMuted?: boolean;
  repeatMode?: RepeatMode;
  isShuffle?: boolean;
  aidjState?: AIDJState;
  onSeek?: (time: number) => void;
  onVolumeChange?: (vol: number) => void;
  onToggleMute?: () => void;
  onToggleRepeat?: () => void;
  onToggleShuffle?: () => void;
  isVideoMode?: boolean;
  onToggleVideoMode?: () => void;
  bottomOffset?: number;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  track,
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  onExpand,
  isDesktop = false,
  currentTime = 0,
  duration = 240,
  volume = 85,
  isMuted = false,
  repeatMode = 'off',
  isShuffle = false,
  aidjState,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleRepeat,
  onToggleShuffle,
  isVideoMode = false,
  onToggleVideoMode,
  bottomOffset = 68,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const effectiveTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (effectiveTime / duration) * 100)) : 0;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseFloat(e.target.value);
    const target = (percent / 100) * duration;
    setDragTime(target);
    if (!isDragging) {
      onSeek?.(target);
    }
  };

  const handleSliderStart = () => {
    setIsDragging(true);
    setDragTime(currentTime);
  };

  const handleSliderEnd = () => {
    setIsDragging(false);
    onSeek?.(dragTime);
  };

  // 1. DESKTOP PLAYBACK BAR
  if (isDesktop) {
    return (
      <div className="relative w-full z-40 shrink-0">
        {/* Ambient light glow behind the desktop player bar */}
        <div 
          className="absolute -top-6 inset-x-0 h-16 opacity-35 blur-2xl pointer-events-none transition-colors duration-700"
          style={{
            background: `radial-gradient(ellipse at 50% 100%, ${track.artworkBgColor} 0%, rgba(250, 45, 72, 0.4) 40%, transparent 80%)`,
          }}
        />

        <div className="h-[78px] w-full border-t border-white/10 bg-[#141416]/95 backdrop-blur-3xl px-6 flex items-center justify-between relative shadow-2xl">
          {/* Left: Track Information & Artwork */}
          <div 
            onClick={onExpand}
            className="flex items-center gap-3.5 w-1/4 min-w-[220px] cursor-pointer group"
            title="Click to expand Now Playing view"
          >
            <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg shrink-0 bg-neutral-900 border border-white/10">
              <img
                src={track.artwork}
                alt={track.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <MusicVisualizer isPlaying={isPlaying} barColor="#FA2D48" />
            </div>

            <div className="min-w-0 pr-2 space-y-0.5">
              <div className="text-sm font-bold text-white truncate leading-tight group-hover:text-rose-400 transition-colors drop-shadow-sm flex items-center gap-1.5">
                <span className="truncate">{track.title}</span>
                {track.audioSrc && (
                  <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-700/40 px-1 py-0.2 rounded font-mono shrink-0">
                    HQ
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-300 font-medium truncate">
                {track.artist}
              </div>
              {aidjState?.vibeTag && (
                <div className="text-[10px] text-purple-300 font-medium truncate flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                  <span className="truncate">{aidjState.vibeTag}</span>
                </div>
              )}
            </div>
          </div>

          {/* Center: Transport Controls & Scrubber */}
          <div className="flex-1 max-w-xl flex flex-col items-center gap-1.5 px-4">
            <div className="flex items-center gap-4">
              {/* Shuffle Button */}
              {onToggleShuffle && (
                <button
                  onClick={onToggleShuffle}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    isShuffle ? 'text-[#FA2D48] font-bold' : 'text-zinc-400 hover:text-white'
                  }`}
                  title={isShuffle ? 'Shuffle: On' : 'Shuffle: Off'}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Prev Button */}
              <button
                onClick={onPrev}
                className="p-1.5 rounded-full text-zinc-200 hover:text-white transition-transform active:scale-90 cursor-pointer"
                title="Previous"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>

              {/* Master Play / Pause */}
              <button
                onClick={onPlayPause}
                className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-md transition-transform active:scale-95 hover:scale-105 cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              {/* Next Button */}
              <button
                onClick={onNext}
                className="p-1.5 rounded-full text-zinc-200 hover:text-white transition-transform active:scale-90 cursor-pointer"
                title="Next"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>

              {/* Repeat Button */}
              {onToggleRepeat && (
                <button
                  onClick={onToggleRepeat}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer relative ${
                    repeatMode !== 'off' ? 'text-[#FA2D48] font-bold' : 'text-zinc-400 hover:text-white'
                  }`}
                  title={`Repeat: ${repeatMode.toUpperCase()}`}
                >
                  {repeatMode === 'one' ? (
                    <Repeat1 className="w-3.5 h-3.5" />
                  ) : (
                    <Repeat className="w-3.5 h-3.5" />
                  )}
                  {repeatMode === 'one' && (
                    <span className="absolute -top-1 -right-1 text-[8px] bg-[#FA2D48] text-white px-1 rounded-full font-bold">
                      1
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Microsecond Smooth Scrubber Bar */}
            <div className="w-full flex items-center gap-2.5 text-[10px] font-mono text-zinc-200 font-semibold">
              <span className="w-8 text-right">{formatTime(effectiveTime)}</span>
              <div className="flex-1 relative h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer group">
                <div 
                  className="h-full bg-white group-hover:bg-[#FA2D48] rounded-full transition-all duration-75"
                  style={{ width: `${progressPercent}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={progressPercent}
                  onChange={handleSliderChange}
                  onMouseDown={handleSliderStart}
                  onMouseUp={handleSliderEnd}
                  onTouchStart={handleSliderStart}
                  onTouchEnd={handleSliderEnd}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
              <span className="w-8">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Volume, Live Video Toggle, Expand Sheet */}
          <div className="flex items-center justify-end gap-3 w-1/4 min-w-[220px]">
            {onToggleVideoMode && (
              <button
                onClick={onToggleVideoMode}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isVideoMode ? 'bg-[#FA2D48] text-white' : 'text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
                title={isVideoMode ? 'Video Mode: Active' : 'Switch to Live YouTube Video'}
              >
                <Tv className="w-4 h-4" />
              </button>
            )}

            {/* Volume Control */}
            <div className="flex items-center gap-2 w-28">
              <button
                onClick={onToggleMute}
                className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <div className="flex-1 relative h-1 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full"
                  style={{ width: `${isMuted ? 0 : volume}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => onVolumeChange?.(parseFloat(e.target.value))}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
            </div>

            {/* Expand Full Sheet Button */}
            <button
              onClick={onExpand}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors ml-1 cursor-pointer"
              title="Open Apple Music Sheet Player"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. MOBILE & TABLET FLOATING LIQUID GLASS PILL WITH MICRO PROGRESS BAR
  return (
    <div
      onClick={onExpand}
      style={{ bottom: `${bottomOffset}px` }}
      className="fixed left-2.5 right-2.5 sm:left-4 sm:right-4 md:left-6 md:right-6 h-15 rounded-2xl apple-glass-material flex flex-col justify-between px-3 pt-2 pb-1.5 z-40 cursor-pointer shadow-[0_12px_40px_rgba(0,0,0,0.85)] transition-all duration-200 active:scale-[0.99] group max-w-2xl mx-auto border border-white/20 overflow-hidden"
    >
      {/* Dynamic radiant ambient glow */}
      <div 
        className="absolute -inset-1 rounded-2xl opacity-60 blur-lg pointer-events-none transition-colors duration-700 -z-10"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, ${track.artworkBgColor} 0%, rgba(250, 45, 72, 0.5) 60%, transparent 100%)`,
        }}
      />

      <div className="flex items-center justify-between w-full min-w-0">
        {/* Left: Artwork with Visualizer */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-md shrink-0 bg-neutral-900 border border-white/20">
            <img
              src={track.artwork}
              alt={track.title}
              className="w-full h-full object-cover"
            />
            <MusicVisualizer isPlaying={isPlaying} barColor="#FA2D48" />
          </div>

          {/* Title and Artist */}
          <div className="min-w-0 flex-1 pr-2">
            <div className="text-xs sm:text-sm font-bold text-white truncate leading-tight group-hover:text-rose-400 transition-colors drop-shadow-sm flex items-center gap-1.5">
              <span className="truncate">{track.title}</span>
              {track.audioSrc && (
                <span className="text-[8px] bg-amber-950/80 text-amber-300 border border-amber-700/40 px-1 py-0.2 rounded font-mono shrink-0">
                  HQ
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-300 font-medium truncate mt-0.5 flex items-center gap-1.5">
              <span className="truncate">{track.artist}</span>
              {aidjState?.vibeTag && (
                <span className="text-[9px] text-purple-300 font-semibold truncate">
                  • {aidjState.vibeTag}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Controls: Play/Pause and Next */}
        <div 
          className="flex items-center gap-1 shrink-0" 
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <button
            onClick={onPlayPause}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-transform active:scale-90 cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={onNext}
            className="p-2.5 rounded-full hover:bg-white/15 text-white transition-transform active:scale-90 cursor-pointer"
            title="Next Track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>
      </div>

      {/* Micro Progress Bar along bottom of mobile pill */}
      <div className="w-full h-[2.5px] bg-white/15 rounded-full overflow-hidden mt-1">
        <div 
          className="h-full bg-gradient-to-r from-[#FA2D48] to-rose-400 transition-all duration-150"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
