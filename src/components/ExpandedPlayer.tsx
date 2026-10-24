import React, { useState, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Star, 
  MessageSquare, 
  Airplay, 
  ListMusic, 
  ChevronDown, 
  Check, 
  Share2, 
  ExternalLink, 
  Shuffle, 
  Repeat,
  Repeat1,
  Tv,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Disc3,
  Bot
} from 'lucide-react';
import { SongTrack, RepeatMode, AIDJState } from '../types';

interface ExpandedPlayerProps {
  track: SongTrack;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFavorite: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  aidjState?: AIDJState;
  isVideoMode?: boolean;
  onToggleVideoMode?: () => void;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleFavorite: () => void;
  onToggleRepeat: () => void;
  onToggleShuffle: () => void;
  onToggleAIDJ?: () => void;
  onRefreshAIDJ?: () => void;
  onDismiss: () => void;
  playlist: SongTrack[];
  onSelectTrack: (track: SongTrack) => void;
  showToast: (msg: string) => void;
}

export const ExpandedPlayer: React.FC<ExpandedPlayerProps> = ({
  track,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isFavorite,
  repeatMode,
  isShuffle,
  aidjState,
  isVideoMode = false,
  onToggleVideoMode,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleFavorite,
  onToggleRepeat,
  onToggleShuffle,
  onToggleAIDJ,
  onRefreshAIDJ,
  onDismiss,
  playlist,
  onSelectTrack,
  showToast,
}) => {
  const [activeSheetTab, setActiveSheetTab] = useState<'main' | 'lyrics' | 'queue'>('main');
  const [showAirPlayModal, setShowAirPlayModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState('AirPods Pro (2nd gen)');

  // Real-time smooth drag state for scrubber
  const [isDraggingScrubber, setIsDraggingScrubber] = useState(false);
  const [scrubberDragTime, setScrubberDragTime] = useState<number>(0);

  // Swipe-down to dismiss gesture
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current !== null) {
      const deltaY = e.touches[0].clientY - touchStartY.current;
      if (deltaY > 80) {
        touchStartY.current = null;
        onDismiss();
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartY.current = null;
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Compute smooth effective time and progress percent
  const effectiveCurrentTime = isDraggingScrubber ? scrubberDragTime : currentTime;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (effectiveCurrentTime / duration) * 100)) : 0;
  const remainingTime = duration > effectiveCurrentTime ? duration - effectiveCurrentTime : 0;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseFloat(e.target.value);
    const targetSec = (percent / 100) * duration;
    setScrubberDragTime(targetSec);
    if (!isDraggingScrubber) {
      onSeek(targetSec);
    }
  };

  const handleSliderStart = () => {
    setIsDraggingScrubber(true);
    setScrubberDragTime(currentTime);
  };

  const handleSliderEnd = () => {
    setIsDraggingScrubber(false);
    onSeek(scrubberDragTime);
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(`https://youtu.be/${track.youtubeId}`);
    showToast('Track link copied to clipboard!');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto transition-opacity duration-300"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(35px)',
        WebkitBackdropFilter: 'blur(35px)',
      }}
    >
      {/* Dynamic Animated Ambient Mesh Backdrop */}
      <div className="absolute inset-0 -z-20 overflow-hidden pointer-events-none transition-all duration-700">
        <div 
          className="absolute -top-32 -left-32 w-[150%] h-[150%] opacity-70 animate-ambient-aurora transition-opacity duration-700"
          style={{
            background: `radial-gradient(circle at 50% 28%, ${track.artworkBgColor} 0%, rgba(250, 45, 72, 0.4) 35%, transparent 70%)`,
          }}
        />
        <div 
          className="absolute -bottom-24 inset-x-0 h-72 opacity-30 blur-[75px] pointer-events-none"
          style={{
            background: `linear-gradient(to top, ${track.artworkBgColor}, transparent)`,
          }}
        />
      </div>

      {/* Main Liquid Glass Sheet Container */}
      <div 
        className="relative w-full h-[94vh] max-h-[920px] rounded-t-[36px] sm:rounded-t-[44px] bg-[#121217]/90 backdrop-blur-3xl border-t border-white/25 shadow-[0_-25px_80px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden max-w-2xl mx-auto transition-transform duration-300 ease-out"
        style={{
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))',
        }}
      >
        {/* Drag Handle Top Bar */}
        <div 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={onDismiss}
          className="h-9 w-full flex items-center justify-center cursor-pointer shrink-0 group hover:bg-white/5 transition-colors touch-none"
          title="Swipe down or tap to dismiss"
        >
          <div className="w-12 h-1.5 rounded-full bg-white/40 group-hover:bg-white/80 transition-colors shadow-sm" />
        </div>

        {/* Clean Top Header Row */}
        <div 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="px-6 h-11 flex items-center justify-between shrink-0 text-white"
        >
          <button 
            onClick={onDismiss}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
            title="Collapse Player"
          >
            <ChevronDown className="w-6 h-6" />
          </button>

          {/* Top Center: Tab Switcher Indicator */}
          <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-xl border border-white/10 text-xs font-semibold">
            <button
              onClick={() => setActiveSheetTab('main')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                activeSheetTab === 'main' ? 'bg-white text-black shadow-sm' : 'text-neutral-300 hover:text-white'
              }`}
            >
              Player
            </button>
            <button
              onClick={() => setActiveSheetTab('lyrics')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                activeSheetTab === 'lyrics' ? 'bg-white text-black shadow-sm' : 'text-neutral-300 hover:text-white'
              }`}
            >
              Lyrics
            </button>
            <button
              onClick={() => setActiveSheetTab('queue')}
              className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                activeSheetTab === 'queue' ? 'bg-white text-black shadow-sm' : 'text-neutral-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 text-[#FA2D48]" />
              <span>Queue</span>
            </button>
          </div>

          <button 
            onClick={handleShare}
            className="p-2 -mr-2 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
            title="Share Track"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Center Stage: Main Artwork View / Lyrics / Queue */}
        <div className="flex-1 overflow-y-auto px-6 py-2 flex flex-col justify-between">
          {activeSheetTab === 'lyrics' ? (
            /* SYNCHRONIZED LYRICS VIEW */
            <div className="flex-1 overflow-y-auto py-4 px-4 space-y-5 text-center no-scrollbar">
              <div className="text-xs font-bold uppercase tracking-widest text-[#FA2D48] mb-2 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Apple Music High-Fidelity Lyrics</span>
              </div>
              {(track.lyrics && track.lyrics.length > 0 ? track.lyrics : [
                "Enjoy the rhythm and high-fidelity sound.",
                "Streamed directly with liquid glass acoustics.",
                "Full-screen ambient lighting in the background."
              ]).map((line, idx) => (
                <p 
                  key={idx} 
                  className={`text-lg sm:text-xl font-bold transition-all cursor-pointer ${
                    idx === Math.floor((effectiveCurrentTime / (duration || 240)) * (track.lyrics?.length || 3))
                      ? 'text-white scale-105 drop-shadow-[0_0_20px_rgba(250,45,72,0.6)] font-extrabold'
                      : 'text-white/40 hover:text-white/80'
                  }`}
                  onClick={() => {
                    const estimatedTime = (idx / (track.lyrics?.length || 1)) * duration;
                    onSeek(estimatedTime);
                  }}
                >
                  {line || '♫'}
                </p>
              ))}
            </div>
          ) : activeSheetTab === 'queue' ? (
            /* SMART AI DJ QUEUE VIEW */
            <div className="flex-1 overflow-y-auto py-2 space-y-3 no-scrollbar">
              {/* AI DJ Header Banner */}
              <div className="p-4 rounded-3xl bg-gradient-to-br from-purple-900/40 via-red-950/40 to-neutral-900/60 border border-purple-500/30 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#FA2D48] to-purple-600 flex items-center justify-center shadow-md">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        Gemini AI DJ
                        {aidjState?.isAIPowered && (
                          <span className="text-[9px] bg-purple-500/30 text-purple-300 border border-purple-400/40 px-1.5 py-0.2 rounded-full font-mono">
                            ACTIVE
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-rose-300 font-semibold block">
                        {aidjState?.vibeTag || 'Harmonic DJ Flow'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {onRefreshAIDJ && (
                      <button
                        onClick={onRefreshAIDJ}
                        disabled={aidjState?.isLoading}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer disabled:opacity-40"
                        title="Regenerate AI Queue"
                      >
                        {aidjState?.isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FA2D48]" />
                        ) : (
                          <Disc3 className="w-3.5 h-3.5 text-rose-300" />
                        )}
                      </button>
                    )}

                    {onToggleAIDJ && (
                      <button
                        onClick={onToggleAIDJ}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-xl transition-all cursor-pointer border ${
                          aidjState?.enabled
                            ? 'bg-[#FA2D48] text-white border-red-500 shadow-sm'
                            : 'bg-white/10 text-neutral-400 border-white/10'
                        }`}
                      >
                        {aidjState?.enabled ? 'AI Autoplay ON' : 'AI Autoplay OFF'}
                      </button>
                    )}
                  </div>
                </div>

                {aidjState?.djCommentary && (
                  <p className="text-xs text-white/80 leading-relaxed font-medium bg-black/30 p-2.5 rounded-2xl border border-white/5">
                    "{aidjState.djCommentary}"
                  </p>
                )}
              </div>

              {/* Up Next List */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-white/70 px-2 py-1 flex items-center justify-between">
                  <span>Up Next ({playlist.length} Tracks)</span>
                  <span className="text-[10px] font-normal text-neutral-400">Click any track to jump</span>
                </div>

                {playlist.map((item, idx) => {
                  const isItemPlaying = item.id === track.id;
                  const transitionReason = aidjState?.transitionNotes?.[item.id];

                  return (
                    <div
                      key={`${item.id}-${idx}`}
                      onClick={() => onSelectTrack(item)}
                      className={`p-2.5 rounded-2xl flex items-center gap-3 cursor-pointer transition-all border ${
                        isItemPlaying 
                          ? 'bg-[#FA2D48]/25 border-[#FA2D48]/50 shadow-md' 
                          : 'bg-white/5 hover:bg-white/10 border-white/5'
                      }`}
                    >
                      <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow bg-neutral-900 border border-white/10">
                        <img 
                          src={item.artwork} 
                          alt={item.title} 
                          className="w-full h-full object-cover"
                        />
                        {isItemPlaying && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-[#FA2D48] animate-ping" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className={`text-sm font-bold truncate flex items-center gap-1.5 ${isItemPlaying ? 'text-rose-400' : 'text-white'}`}>
                          <span className="truncate">{item.title}</span>
                          {item.audioSrc && (
                            <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-700/40 px-1 py-0.2 rounded font-mono shrink-0">
                              HQ
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/60 truncate">
                          {item.artist}
                        </div>
                        {transitionReason && (
                          <div className="text-[10px] text-purple-300 font-medium truncate flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 shrink-0 text-purple-400" />
                            <span className="truncate">{transitionReason}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-white/40 font-mono shrink-0">
                        {item.durationFormatted}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* DEFAULT CENTER STAGE: Album Art or Video */
            <div className="flex-1 flex flex-col items-center justify-center my-auto py-2 relative">
              <div className="relative flex flex-col items-center justify-center">
                {/* Dynamic Ambient Light Glow radiating from behind the album artwork */}
                <div 
                  className={`absolute -inset-6 rounded-3xl opacity-85 blur-3xl transition-all duration-700 pointer-events-none ${
                    isPlaying ? 'scale-110 opacity-90 animate-ambient-glow' : 'scale-95 opacity-40'
                  }`}
                  style={{
                    background: `radial-gradient(circle, ${track.artworkBgColor} 0%, rgba(250, 45, 72, 0.55) 50%, transparent 80%)`,
                  }}
                />

                {/* Main Player Display: Live Video vs Apple Music High-Res Artwork */}
                {isVideoMode ? (
                  /* Live Embedded Video Player inside the music player section */
                  <div className="w-[280px] sm:w-[340px] md:w-[380px] aspect-video rounded-3xl overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.95)] border border-white/20 relative z-10 bg-black flex items-center justify-center animate-in zoom-in-95 duration-300">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${track.youtubeId}?autoplay=1&rel=0&controls=1&modestbranding=1&playsinline=1`}
                      title={track.title}
                      className="w-full h-full border-none"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  /* Crisp High-Res Apple Music Artwork with Spring Elevation */
                  <div 
                    className={`w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-3xl overflow-hidden transition-all duration-500 relative z-10 ${
                      isPlaying 
                        ? 'scale-100 shadow-[0_30px_70px_rgba(0,0,0,0.9)] border border-white/20' 
                        : 'scale-[0.92] opacity-85 shadow-[0_15px_30px_rgba(0,0,0,0.5)] border border-white/10'
                    }`}
                  >
                    <img 
                      src={track.artwork} 
                      alt={track.title} 
                      className="w-full h-full object-cover select-none"
                    />
                  </div>
                )}

                {/* Interactive Mode Switcher Pill */}
                {onToggleVideoMode && (
                  <button
                    onClick={onToggleVideoMode}
                    className="mt-3 relative z-10 flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-white/90 backdrop-blur-md transition-all border border-white/10 shadow-lg cursor-pointer"
                    title={isVideoMode ? 'Show Artwork' : 'Play Live Video In Player'}
                  >
                    {isVideoMode ? (
                      <>
                        <ImageIcon className="w-3.5 h-3.5 text-[#FA2D48]" />
                        <span>Artwork Mode</span>
                      </>
                    ) : (
                      <>
                        <Tv className="w-3.5 h-3.5 text-[#FA2D48]" />
                        <span>Play Video In Player</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Track Details & Star Toggle */}
          <div className="mt-2 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-3">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate leading-tight drop-shadow-sm flex items-center gap-2">
                  <span className="truncate">{track.title}</span>
                  {track.audioSrc && (
                    <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-700/40 px-1.5 py-0.5 rounded font-mono shrink-0">
                      LOSSLESS
                    </span>
                  )}
                </h2>
                <p className="text-sm sm:text-base font-bold text-zinc-100 truncate mt-0.5">
                  {track.artist}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={onToggleFavorite}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                  title="Favorite Track"
                >
                  <Star className={`w-5 h-5 transition-transform active:scale-125 ${
                    isFavorite ? 'fill-[#FA2D48] text-[#FA2D48]' : 'text-zinc-200'
                  }`} />
                </button>
                <a 
                  href={`https://www.youtube.com/watch?v=${track.youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white transition-colors inline-flex items-center justify-center cursor-pointer"
                  title="Open on YouTube"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Spotify-Grade Microsecond Accurate Scrubber Bar */}
            <div className="space-y-1.5">
              <div className="relative w-full h-2.5 rounded-full bg-white/25 overflow-hidden cursor-pointer group">
                <div 
                  className="h-full bg-white group-hover:bg-[#FA2D48] rounded-full transition-all duration-75 shadow-sm"
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

              <div className="flex items-center justify-between text-xs font-mono font-bold text-zinc-200">
                <span>{formatTime(effectiveCurrentTime)}</span>
                <span>-{formatTime(remainingTime)}</span>
              </div>
            </div>

            {/* Transport Controls (Shuffle, Previous, Play/Pause, Next, Repeat) */}
            <div className="flex items-center justify-between max-w-sm mx-auto py-1">
              {/* Shuffle Button */}
              <button 
                onClick={onToggleShuffle}
                className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                  isShuffle ? 'bg-white/20 text-[#FA2D48] font-bold shadow' : 'text-zinc-300 hover:text-white'
                }`}
                title={isShuffle ? 'Shuffle: On' : 'Shuffle: Off'}
              >
                <Shuffle className="w-4 h-4" />
              </button>

              {/* Prev Button */}
              <button 
                onClick={onPrev}
                className="p-3 text-white hover:text-rose-300 transition-transform active:scale-90 cursor-pointer"
                title="Previous Track"
              >
                <SkipBack className="w-7 h-7 fill-current" />
              </button>

              {/* Big Play/Pause Master Button */}
              <button 
                onClick={onTogglePlay}
                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transition-transform active:scale-90 hover:scale-105 cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current ml-1" />
                )}
              </button>

              {/* Next Button */}
              <button 
                onClick={onNext}
                className="p-3 text-white hover:text-rose-300 transition-transform active:scale-90 cursor-pointer"
                title="Next Track"
              >
                <SkipForward className="w-7 h-7 fill-current" />
              </button>

              {/* Repeat Button (Cycles off -> all -> one) */}
              <button 
                onClick={onToggleRepeat}
                className={`p-2.5 rounded-full transition-colors cursor-pointer relative ${
                  repeatMode !== 'off' ? 'bg-white/20 text-[#FA2D48] font-bold shadow' : 'text-zinc-300 hover:text-white'
                }`}
                title={`Repeat: ${repeatMode.toUpperCase()}`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
                {repeatMode === 'one' && (
                  <span className="absolute -top-1 -right-1 text-[8px] bg-[#FA2D48] text-white px-1 rounded-full font-bold">
                    1
                  </span>
                )}
              </button>
            </div>

            {/* Volume Control Slider */}
            <div className="flex items-center gap-3 px-2">
              <button 
                onClick={onToggleMute}
                className="text-zinc-200 hover:text-white transition-colors cursor-pointer"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <div className="flex-1 relative h-2 bg-white/25 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full shadow-sm"
                  style={{ width: `${isMuted ? 0 : volume}%` }}
                />
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={isMuted ? 0 : volume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
              <Volume2 className="w-4 h-4 text-zinc-200" />
            </div>

            {/* Bottom Apple Music Utility Toolbar */}
            <div className="flex items-center justify-around pt-2.5 border-t border-white/15 text-zinc-200">
              {/* Lyrics Toggle */}
              <button 
                onClick={() => setActiveSheetTab(activeSheetTab === 'lyrics' ? 'main' : 'lyrics')}
                className={`p-2.5 rounded-2xl transition-all cursor-pointer ${
                  activeSheetTab === 'lyrics' 
                    ? 'bg-white/20 text-[#FA2D48] shadow-md' 
                    : 'hover:bg-white/10 text-zinc-200 hover:text-white'
                }`}
                title="Show Lyrics"
              >
                <MessageSquare className="w-5 h-5" />
              </button>

              {/* AirPlay / Route Output */}
              <button 
                onClick={() => setShowAirPlayModal(!showAirPlayModal)}
                className={`p-2.5 rounded-2xl flex items-center gap-1.5 transition-all cursor-pointer ${
                  showAirPlayModal 
                    ? 'bg-white/20 text-white shadow-md' 
                    : 'hover:bg-white/10 text-white/70 hover:text-white'
                }`}
                title="Audio Output Device"
              >
                <Airplay className="w-5 h-5" />
                <span className="text-[11px] font-semibold hidden sm:inline">{selectedRoute.split(' ')[0]}</span>
              </button>

              {/* Queue List Toggle */}
              <button 
                onClick={() => setActiveSheetTab(activeSheetTab === 'queue' ? 'main' : 'queue')}
                className={`p-2.5 rounded-2xl transition-all cursor-pointer ${
                  activeSheetTab === 'queue' 
                    ? 'bg-white/20 text-[#FA2D48] shadow-md' 
                    : 'hover:bg-white/10 text-white/70 hover:text-white'
                }`}
                title="Show Queue & AI DJ"
              >
                <ListMusic className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* AirPlay Device Route Modal Popup */}
        {showAirPlayModal && (
          <div className="absolute inset-x-4 bottom-24 p-4 rounded-3xl bg-neutral-900/95 border border-white/20 backdrop-blur-2xl shadow-2xl space-y-2 text-white animate-in fade-in slide-in-from-bottom-2 duration-150 z-50">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                <Airplay className="w-3.5 h-3.5 text-[#FA2D48]" />
                Audio Output Route
              </span>
              <button 
                onClick={() => setShowAirPlayModal(false)}
                className="text-xs text-white/50 hover:text-white cursor-pointer"
              >
                Done
              </button>
            </div>
            {['AirPods Pro (2nd gen)', 'MacBook Pro Speakers', 'Studio Display Audio', 'Living Room HomePod'].map((route) => (
              <div 
                key={route}
                onClick={() => {
                  setSelectedRoute(route);
                  setShowAirPlayModal(false);
                  showToast(`Connected to ${route}`);
                }}
                className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                  selectedRoute === route ? 'bg-[#FA2D48]/20 text-[#FA2D48] font-bold' : 'hover:bg-white/10 text-white/80'
                }`}
              >
                <span className="text-xs">{route}</span>
                {selectedRoute === route && <Check className="w-4 h-4 text-[#FA2D48]" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
