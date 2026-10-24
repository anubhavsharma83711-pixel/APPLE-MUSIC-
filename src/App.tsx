import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Search, 
  X, 
  Compass, 
  Radio as RadioIcon, 
  Library as LibraryIcon, 
  Home, 
  Music, 
  SlidersHorizontal, 
  Sparkles, 
  Loader2, 
  Shuffle, 
  Star, 
  Maximize2,
  Tv,
  ListMusic,
  Disc3,
  Clock,
  Heart,
  Bot
} from 'lucide-react';
import { SongTrack, AppleMusicTab, AmbientSettings, RepeatMode, AIDJState } from './types';
import { BILLBOARD_TOP_TRACKS, CATEGORY_CARDS, RADIO_STATIONS } from './data/appleMusicSongs';
import { MiniPlayer } from './components/MiniPlayer';
import { ExpandedPlayer } from './components/ExpandedPlayer';
import { BackgroundYouTubePlayer } from './components/BackgroundYouTubePlayer';
import { SettingsModal } from './components/SettingsModal';
import { AppleWelcomeScreen } from './components/AppleWelcomeScreen';
import { MusicVisualizer } from './components/MusicVisualizer';
import { JarvisView } from './components/JarvisView';

export default function App() {
  // Screen Auto-Detection (phone, tablet, desktop)
  const [detectedType, setDetectedType] = useState<'phone' | 'tablet' | 'desktop'>(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      if (w < 768) return 'phone';
      if (w <= 1024) return 'tablet';
      return 'desktop';
    }
    return 'desktop';
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 768) {
        setDetectedType('phone');
      } else if (w <= 1024) {
        setDetectedType('tablet');
      } else {
        setDetectedType('desktop');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const isDesktop = detectedType === 'desktop';
  const isPhone = detectedType === 'phone';

  // Navigation & Player State
  const [activeTab, setActiveTab] = useState<AppleMusicTab>('listen-now');
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'favorites' | 'history' | 'lossless'>('all');

  // Animated Apple Welcome Screen state
  const [showWelcomeScreen, setShowWelcomeScreen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('apple_music_welcome_seen');
    } catch {
      return false;
    }
  });

  // Ambient Light Settings state
  const [ambientSettings, setAmbientSettings] = useState<AmbientSettings>(() => {
    try {
      const saved = localStorage.getItem('apple_music_ambient_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      enabled: true,
      blurLevel: 45,
      saturation: 200,
      brightness: 85,
      liveVideoBg: true,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('apple_music_ambient_settings', JSON.stringify(ambientSettings));
    } catch {}
  }, [ambientSettings]);

  // Audio Engine & Playback State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playlist, setPlaylist] = useState<SongTrack[]>(BILLBOARD_TOP_TRACKS);
  const [currentTrack, setCurrentTrack] = useState<SongTrack>(BILLBOARD_TOP_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(BILLBOARD_TOP_TRACKS[0].duration || 240);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [seekTime, setSeekTime] = useState<number | null>(null);
  const [isVideoMode, setIsVideoMode] = useState(false);

  // Spotify-Level Player Modes: Repeat and Shuffle
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState(false);

  // AI-Powered Smart Music Recommendation Agent State
  const [aidjState, setAidjState] = useState<AIDJState>({
    enabled: true,
    isLoading: false,
    vibeTag: 'Harmonic Flow',
    djCommentary: `Curating a seamless sonic mix matching "${BILLBOARD_TOP_TRACKS[0].title}".`,
    transitionNotes: {},
    isAIPowered: false,
  });

  // Search & YouTube
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SongTrack[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // User Library (Favorites & History)
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('apple_music_favorites');
      return saved ? JSON.parse(saved) : ['track-billie', 'track-ariana', 'track-weeknd'];
    } catch {
      return ['track-billie', 'track-ariana', 'track-weeknd'];
    }
  });

  const [recentlyPlayed, setRecentlyPlayed] = useState<SongTrack[]>(() => {
    try {
      const saved = localStorage.getItem('apple_music_history');
      return saved ? JSON.parse(saved) : [BILLBOARD_TOP_TRACKS[0]];
    } catch {
      return [BILLBOARD_TOP_TRACKS[0]];
    }
  });

  // Floating Toast Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('apple_music_favorites', JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem('apple_music_history', JSON.stringify(recentlyPlayed));
    } catch {}
  }, [recentlyPlayed]);

  // Request counter / AbortController to handle race conditions when rapidly changing songs
  const recommendationAbortController = useRef<AbortController | null>(null);

  // AI DJ Recommendation fetcher
  const fetchAIDJRecommendations = useCallback(
    async (track: SongTrack, history: SongTrack[]) => {
      if (!aidjState.enabled) return;

      if (recommendationAbortController.current) {
        recommendationAbortController.current.abort();
      }
      recommendationAbortController.current = new AbortController();

      setAidjState((prev) => ({ ...prev, isLoading: true }));

      try {
        const payload = {
          currentTrack: {
            id: track.id,
            title: track.title,
            artist: track.artist,
            genre: track.genre,
          },
          historyIds: history.map((t) => t.id),
          catalog: BILLBOARD_TOP_TRACKS.map((t) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            genre: t.genre,
            durationFormatted: t.durationFormatted,
          })),
        };

        const customKey = typeof window !== 'undefined' ? localStorage.getItem('jarvis_user_gemini_key') || undefined : undefined;
        const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (customKey && customKey.trim().length > 10) {
          reqHeaders['x-gemini-key'] = customKey.trim();
        }

        const res = await fetch('/api/ai/recommendations', {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify(payload),
          signal: recommendationAbortController.current.signal,
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.queueTrackIds) && data.queueTrackIds.length > 0) {
            const notesMap: Record<string, string> = {};
            if (Array.isArray(data.transitionNotes)) {
              data.transitionNotes.forEach((tn: any) => {
                if (tn.trackId && tn.reason) {
                  notesMap[tn.trackId] = tn.reason;
                }
              });
            }

            setAidjState((prev) => ({
              ...prev,
              isLoading: false,
              vibeTag: data.vibeTag || `${track.genre} Session`,
              djCommentary: data.djCommentary || `Flowing smoothly from ${track.title}.`,
              transitionNotes: notesMap,
              isAIPowered: Boolean(data.isAIPowered),
            }));

            // Dynamically reorder queue to place recommended tracks next
            setPlaylist((prevPlaylist) => {
              const catalogMap = new Map(BILLBOARD_TOP_TRACKS.map((s) => [s.id, s]));
              // Also map any search tracks in current playlist
              prevPlaylist.forEach((s) => catalogMap.set(s.id, s));

              const recommendedTracks: SongTrack[] = [];
              data.queueTrackIds.forEach((id: string) => {
                const s = catalogMap.get(id);
                if (s && s.id !== track.id) {
                  recommendedTracks.push(s);
                }
              });

              // Remaining tracks not in recommendations
              const recommendedSet = new Set(data.queueTrackIds);
              const remaining = BILLBOARD_TOP_TRACKS.filter(
                (s) => s.id !== track.id && !recommendedSet.has(s.id)
              );

              return [track, ...recommendedTracks, ...remaining];
            });
            return;
          }
        }
        throw new Error('Non-200 or empty recommendation');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('[AI DJ] Recommendation request notice:', err.message);
        }
      } finally {
        setAidjState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [aidjState.enabled]
  );

  // Play a selected track
  const handleSelectTrack = useCallback(
    (track: SongTrack) => {
      setCurrentTrack(track);
      setIsPlaying(true);
      setCurrentTime(0);
      setSeekTime(0);
      setDuration(track.duration || 240);

      // Audio element setup
      if (audioRef.current) {
        if (track.audioSrc) {
          audioRef.current.src = track.audioSrc;
          audioRef.current.currentTime = 0;
          audioRef.current.volume = volume / 100;
          audioRef.current.muted = isMuted;
          audioRef.current.play().catch((err) => {
            console.warn('HTML5 Audio autoplay waiting for interaction:', err);
          });
        } else {
          audioRef.current.pause();
          audioRef.current.removeAttribute('src');
          audioRef.current.load();
        }
      }

      setRecentlyPlayed((prev) => {
        const filtered = prev.filter((t) => t.id !== track.id);
        const updated = [track, ...filtered].slice(0, 30);
        // Automatically ask AI DJ to arrange the upcoming queue
        fetchAIDJRecommendations(track, updated);
        return updated;
      });

      showToast(`Playing: ${track.title}`);
    },
    [volume, isMuted, showToast, fetchAIDJRecommendations]
  );

  // Next / Prev track handlers with Repeat & Shuffle awareness
  const handleNextTrack = useCallback(() => {
    if (repeatMode === 'one') {
      // Replay current track from start
      if (audioRef.current && currentTrack.audioSrc) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      setCurrentTime(0);
      setSeekTime(0);
      return;
    }

    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex === -1 || currentIndex === playlist.length - 1) {
      if (repeatMode === 'all') {
        handleSelectTrack(playlist[0]);
      } else {
        // Repeat off and reached end of playlist: wrap smoothly or stay
        handleSelectTrack(playlist[0]);
      }
    } else {
      handleSelectTrack(playlist[currentIndex + 1]);
    }
  }, [playlist, currentTrack, repeatMode, handleSelectTrack]);

  const handlePrevTrack = useCallback(() => {
    // If playing past 3 seconds, previous restarts the song (Spotify-standard behavior)
    if (currentTime > 3) {
      if (audioRef.current && currentTrack.audioSrc) {
        audioRef.current.currentTime = 0;
      }
      setCurrentTime(0);
      setSeekTime(0);
      return;
    }

    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    handleSelectTrack(playlist[prevIndex]);
  }, [playlist, currentTrack, currentTime, handleSelectTrack]);

  // Play / Pause toggle
  const handleTogglePlayPause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      if (audioRef.current && currentTrack.audioSrc) {
        audioRef.current.pause();
      }
    } else {
      setIsPlaying(true);
      if (audioRef.current && currentTrack.audioSrc) {
        audioRef.current.play().catch((err) => {
          console.warn('Audio play request failed:', err);
        });
      }
    }
  }, [isPlaying, currentTrack.audioSrc]);

  // Scrubber Seek handler
  const handleSeek = useCallback(
    (time: number) => {
      setCurrentTime(time);
      setSeekTime(time);
      if (audioRef.current && currentTrack.audioSrc) {
        try {
          audioRef.current.currentTime = time;
        } catch (err) {
          console.warn('Seek error:', err);
        }
      }
    },
    [currentTrack.audioSrc]
  );

  // Volume slider handler
  const handleVolumeChange = useCallback(
    (newVol: number) => {
      setVolume(newVol);
      if (isMuted) setIsMuted(false);
      if (audioRef.current) {
        audioRef.current.volume = newVol / 100;
        audioRef.current.muted = false;
      }
    },
    [isMuted]
  );

  // Mute toggle handler
  const handleToggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
    }
  }, [isMuted]);

  // Toggle Repeat Mode (off -> all -> one)
  const handleToggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === 'off') {
        showToast('Repeat: All');
        return 'all';
      }
      if (prev === 'all') {
        showToast('Repeat: One Track 🔂');
        return 'one';
      }
      showToast('Repeat: Off');
      return 'off';
    });
  }, [showToast]);

  // Toggle Shuffle Mode
  const handleToggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const next = !prev;
      if (next) {
        // Shuffle all upcoming tracks while keeping current track first
        setPlaylist((curr) => {
          const others = curr.filter((t) => t.id !== currentTrack.id);
          const shuffled = [...others].sort(() => 0.5 - Math.random());
          return [currentTrack, ...shuffled];
        });
        showToast('Shuffle: Enabled 🔀');
      } else {
        // Restore catalog order with current track first
        setPlaylist((curr) => {
          const others = BILLBOARD_TOP_TRACKS.filter((t) => t.id !== currentTrack.id);
          return [currentTrack, ...others];
        });
        showToast('Shuffle: Disabled');
      }
      return next;
    });
  }, [currentTrack, showToast]);

  // Audio Ducking handler (for JARVIS voice assistant speaking & listening)
  const handleDuckAudio = useCallback(
    (duck: boolean) => {
      if (audioRef.current) {
        const targetVol = duck ? (volume * 0.22) / 100 : volume / 100;
        audioRef.current.volume = Math.max(0.04, Math.min(1, targetVol));
      }
    },
    [volume]
  );

  // Toggle AI DJ Autoplay
  const handleToggleAIDJ = useCallback(() => {
    setAidjState((prev) => {
      const next = !prev.enabled;
      if (next) {
        showToast('✨ Gemini AI DJ Queue Enabled');
        fetchAIDJRecommendations(currentTrack, recentlyPlayed);
      } else {
        showToast('Gemini AI DJ Queue Disabled');
      }
      return { ...prev, enabled: next };
    });
  }, [currentTrack, recentlyPlayed, showToast, fetchAIDJRecommendations]);

  // Force Refresh AI DJ Mix
  const handleRefreshAIDJ = useCallback(() => {
    showToast('✨ AI DJ mixing a fresh upcoming queue...');
    fetchAIDJRecommendations(currentTrack, recentlyPlayed);
  }, [currentTrack, recentlyPlayed, showToast, fetchAIDJRecommendations]);

  // Toggle Favorite
  const toggleFavorite = (trackId: string) => {
    setFavorites((prev) => {
      const exists = prev.includes(trackId);
      if (exists) {
        showToast('Removed from Favorites');
        return prev.filter((id) => id !== trackId);
      } else {
        showToast('Added to Favorites ❤️');
        return [trackId, ...prev];
      }
    });
  };

  // Play first & Shuffle for hero header
  const handlePlayFirst = () => {
    handleSelectTrack(BILLBOARD_TOP_TRACKS[0]);
  };

  const handleShuffleAll = () => {
    const shuffled = [...BILLBOARD_TOP_TRACKS].sort(() => 0.5 - Math.random());
    setPlaylist(shuffled);
    handleSelectTrack(shuffled[0]);
    setIsShuffle(true);
    showToast('Shuffling Billboard Top Hits');
  };

  // Autocomplete suggestions
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube/suggestions?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
            setSuggestions(data.suggestions);
            return;
          }
        }
      } catch {
        // Fall back to local track suggestions
      }
      const qLower = searchQuery.toLowerCase().trim();
      const localSugg = BILLBOARD_TOP_TRACKS
        .filter((t) => t.title.toLowerCase().includes(qLower) || t.artist.toLowerCase().includes(qLower))
        .map((t) => `${t.title} - ${t.artist}`)
        .slice(0, 6);
      setSuggestions(localSugg);
    }, 180);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Real-time YouTube Search
  const executeSearch = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    setIsSearching(true);
    setShowSuggestions(false);

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(q)}&limit=16`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.videos) && data.videos.length > 0) {
          const mapped: SongTrack[] = data.videos.map((v: any, idx: number) => ({
            id: `yt-${v.id}-${idx}`,
            youtubeId: v.id,
            title: v.title,
            artist: v.channel,
            album: 'YouTube Live Search',
            duration: 240,
            durationFormatted: v.duration || '3:45',
            artwork: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
            artworkBgColor: '#301b44',
            genre: 'YouTube Music',
          }));
          setSearchResults(mapped);
          setPlaylist(mapped);
          handleSelectTrack(mapped[0]);
          showToast(`Found ${mapped.length} tracks on YouTube`);
          return;
        }
      }
      throw new Error('No videos returned from API');
    } catch (err: any) {
      console.warn('Search fallback active:', err.message);
      const qLower = q.toLowerCase();
      const localMatches = BILLBOARD_TOP_TRACKS.filter(
        (t) =>
          t.title.toLowerCase().includes(qLower) ||
          t.artist.toLowerCase().includes(qLower) ||
          t.genre.toLowerCase().includes(qLower)
      );
      const resultsToUse = localMatches.length > 0 ? localMatches : BILLBOARD_TOP_TRACKS.slice(0, 8);
      setSearchResults(resultsToUse);
      setPlaylist(resultsToUse);
      if (resultsToUse.length > 0) {
        handleSelectTrack(resultsToUse[0]);
        showToast(`Showing ${resultsToUse.length} tracks`);
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Ticker for tracks playing via YouTube without HTML5 audio
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && !currentTrack.audioSrc) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            handleNextTrack();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration, handleNextTrack, currentTrack.audioSrc]);

  // Native OS Media Session API Integration for Spotify-level Lockscreen & Background Controls
  useEffect(() => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album || 'Apple Music',
          artwork: [
            { src: currentTrack.artwork, sizes: '96x96', type: 'image/jpeg' },
            { src: currentTrack.artwork, sizes: '128x128', type: 'image/jpeg' },
            { src: currentTrack.artwork, sizes: '256x256', type: 'image/jpeg' },
            { src: currentTrack.artwork, sizes: '512x512', type: 'image/jpeg' },
          ],
        });

        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

        navigator.mediaSession.setActionHandler('play', () => handleTogglePlayPause());
        navigator.mediaSession.setActionHandler('pause', () => handleTogglePlayPause());
        navigator.mediaSession.setActionHandler('previoustrack', () => handlePrevTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => handleNextTrack());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined) {
            handleSeek(details.seekTime);
          }
        });

        if (duration > 0 && currentTime >= 0) {
          navigator.mediaSession.setPositionState?.({
            duration: duration,
            playbackRate: 1,
            position: Math.min(currentTime, duration),
          });
        }
      } catch (err) {
        console.warn('MediaSession notice:', err);
      }
    }
  }, [currentTrack, isPlaying, duration, currentTime, handleTogglePlayPause, handlePrevTrack, handleNextTrack, handleSeek]);

  const todayDateString = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  return (
    <div className="relative w-full h-screen h-[100dvh] bg-black text-slate-100 flex flex-col overflow-hidden font-sans select-none">
      {/* HTML5 Audio Player Element for Instant High-Fidelity Studio Audio */}
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={(e) => {
          if (currentTrack.audioSrc) {
            setCurrentTime(Math.floor(e.currentTarget.currentTime));
          }
        }}
        onDurationChange={(e) => {
          if (e.currentTarget.duration && !isNaN(e.currentTarget.duration)) {
            setDuration(Math.floor(e.currentTarget.duration));
          }
        }}
        onEnded={() => {
          handleNextTrack();
        }}
        onError={(e) => {
          console.warn('HTML5 Audio playback notice:', e);
        }}
      />

      {/* Full-Screen Ambient Blurred Live Video & YouTube Engine */}
      <BackgroundYouTubePlayer
        track={currentTrack}
        isPlaying={isPlaying}
        volume={volume}
        isMuted={isMuted}
        seekTime={seekTime}
        onEnded={handleNextTrack}
        onTimeUpdate={(c, d) => {
          if (!currentTrack.audioSrc) {
            setCurrentTime(Math.floor(c));
            if (d && d > 0) setDuration(Math.floor(d));
          }
        }}
        onStateChange={(playing) => setIsPlaying(playing)}
        ambientEnabled={ambientSettings.enabled}
        blurLevel={ambientSettings.blurLevel}
        saturation={ambientSettings.saturation}
        brightness={ambientSettings.brightness}
        liveVideoBg={ambientSettings.liveVideoBg}
        isLocalAudioActive={Boolean(currentTrack.audioSrc)}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-2xl bg-neutral-900/90 text-white text-xs font-semibold border border-white/20 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-200 flex items-center gap-2 pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-[#FA2D48]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Root Scaling Container */}
      <div
        className={`w-full h-full flex flex-col overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isSheetExpanded 
            ? 'scale-[0.94] translate-y-3 rounded-t-[32px] brightness-75 pointer-events-none' 
            : 'scale-100 translate-y-0 rounded-none brightness-100'
        }`}
      >
        {/* DESKTOP LAYOUT vs MOBILE/TABLET LAYOUT */}
        {isDesktop ? (
          /* DESKTOP APPLE MUSIC FULL-SCREEN LAYOUT */
          <div className="flex-1 flex overflow-hidden">
            {/* Left Desktop Sidebar */}
            <aside className="w-60 border-r border-white/10 bg-[#121214] flex flex-col p-4 shrink-0 justify-between select-none">
              <div className="space-y-6">
                {/* Apple Music Wordmark */}
                <div 
                  onClick={() => setActiveTab('listen-now')}
                  className="flex items-center gap-2.5 px-2 cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#FA2D48] flex items-center justify-center shadow-lg shadow-red-600/30">
                    <Music className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                    Apple Music <span className="text-[10px] text-[#FA2D48] font-mono px-1 py-0.2 rounded bg-red-950/80 border border-red-800/40">PRO</span>
                  </span>
                </div>

                {/* Navigation Links */}
                <nav className="space-y-1">
                  <button
                    onClick={() => setActiveTab('listen-now')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'listen-now'
                        ? 'bg-[#FA2D48] text-white shadow-md'
                        : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Home className="w-4 h-4" />
                    <span>Listen Now</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('browse')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'browse'
                        ? 'bg-[#FA2D48] text-white shadow-md'
                        : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Compass className="w-4 h-4" />
                    <span>Browse</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('radio')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'radio'
                        ? 'bg-[#FA2D48] text-white shadow-md'
                        : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <RadioIcon className="w-4 h-4" />
                    <span>Radio</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('library')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'library'
                        ? 'bg-[#FA2D48] text-white shadow-md'
                        : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <LibraryIcon className="w-4 h-4" />
                    <span>Library</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('search')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'search'
                        ? 'bg-[#FA2D48] text-white shadow-md'
                        : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Search className="w-4 h-4" />
                    <span>Search</span>
                  </button>

                  {/* Dedicated AI Assistant Navigation Item */}
                  <button
                    onClick={() => setActiveTab('ai')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'ai'
                        ? 'bg-[#FA2D48] text-white shadow-md'
                        : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>AI</span>
                  </button>
                </nav>

                {/* AI DJ & Quick Playlists */}
                <div className="space-y-1 pt-2">
                  <div className="px-3 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Smart DJ Mix</span>
                    {aidjState.isAIPowered && (
                      <span className="text-[9px] text-purple-400 bg-purple-950/70 border border-purple-800/40 px-1 py-0.2 rounded font-mono">
                        AI
                      </span>
                    )}
                  </div>

                  {/* AI DJ Quick Card */}
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-950/40 via-red-950/30 to-white/5 border border-purple-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>DJ Session</span>
                      </span>
                      <button
                        onClick={handleToggleAIDJ}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                          aidjState.enabled ? 'bg-[#FA2D48] text-white' : 'bg-white/10 text-neutral-400'
                        }`}
                      >
                        {aidjState.enabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    <div className="text-[11px] text-purple-300 font-semibold truncate">
                      {aidjState.vibeTag}
                    </div>
                    <button
                      onClick={handleRefreshAIDJ}
                      disabled={aidjState.isLoading}
                      className="w-full py-1 px-2 rounded-xl bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      {aidjState.isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin text-[#FA2D48]" />
                      ) : (
                        <Disc3 className="w-3 h-3 text-rose-300" />
                      )}
                      <span>Remix Upcoming Queue</span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setActiveTab('library');
                      setLibraryFilter('favorites');
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer mt-2"
                  >
                    <span className="flex items-center gap-2">
                      <Heart className="w-3.5 h-3.5 text-rose-400" />
                      Favorite Tracks
                    </span>
                    <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full font-mono">{favorites.length}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('library');
                      setLibraryFilter('lossless');
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Disc3 className="w-3.5 h-3.5 text-amber-400" />
                      Studio Lossless MP3
                    </span>
                    <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-700/40 px-1.5 py-0.5 rounded-full font-mono">9</span>
                  </button>

                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-[#FA2D48]" />
                    <span>Ambient Light Settings</span>
                  </button>
                </div>
              </div>

              {/* Bottom Profile Info */}
              <div 
                onClick={() => setIsSettingsOpen(true)}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center gap-3 cursor-pointer transition-colors"
                title="Configure Ambient Light & Settings"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FA2D48] to-purple-600 p-[1.5px] shrink-0">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"
                    alt="Profile"
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">Spotify Pro</div>
                  <div className="text-[10px] text-neutral-400">Ambient Lighting Settings</div>
                </div>
              </div>
            </aside>

            {/* Main Desktop View Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0c]">
              {/* Desktop Top Header Bar with Search Input */}
              <header className="h-14 px-8 border-b border-white/10 flex items-center justify-between gap-6 shrink-0 bg-[#0a0a0c]/80 backdrop-blur-xl">
                {/* Search Bar on Desktop */}
                <div className="relative flex-1 max-w-md">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setActiveTab('search');
                      executeSearch(searchQuery);
                    }}
                    className="relative flex items-center"
                  >
                    <Search className="w-4 h-4 absolute left-3.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search artists, songs, lyrics (YouTube powered)..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      className="w-full h-9 pl-10 pr-20 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#FA2D48] transition-colors"
                    />
                    {isSearching && (
                      <Loader2 className="w-3.5 h-3.5 text-[#FA2D48] animate-spin absolute right-16" />
                    )}
                    <button
                      type="submit"
                      className="absolute right-1.5 px-2.5 py-1 rounded-lg bg-[#FA2D48] text-[11px] font-bold text-white hover:bg-rose-600 transition-colors cursor-pointer"
                    >
                      Search
                    </button>
                  </form>

                  {/* Autocomplete Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-11 left-0 right-0 p-2 rounded-xl bg-neutral-900 border border-white/15 shadow-2xl z-50 space-y-1">
                      {suggestions.map((s, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSearchQuery(s);
                            setActiveTab('search');
                            executeSearch(s);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs hover:bg-white/10 cursor-pointer flex items-center justify-between text-white"
                        >
                          <span>{s}</span>
                          <Search className="w-3 h-3 text-neutral-500" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top Right Header Controls */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsVideoMode(!isVideoMode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      isVideoMode
                        ? 'bg-[#FA2D48] text-white shadow-md'
                        : 'bg-white/10 text-neutral-300 hover:text-white hover:bg-white/15'
                    }`}
                    title={isVideoMode ? 'Video Mode: Active' : 'Switch to Live YouTube Video'}
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>{isVideoMode ? 'Video Active' : 'Live Video'}</span>
                  </button>

                  <button
                    onClick={() => setShowWelcomeScreen(true)}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-all flex items-center gap-1.5 cursor-pointer border border-white/10"
                    title="Apple Welcome Experience"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                    <span>Welcome Intro</span>
                  </button>

                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-all flex items-center gap-1.5 cursor-pointer border border-white/10"
                    title="Ambient Light & Player Settings"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#FA2D48]" />
                    <span>Ambient Settings</span>
                  </button>

                  <button
                    onClick={() => setIsSheetExpanded(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#FA2D48] hover:bg-rose-600 text-xs font-semibold text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-white" />
                    <span>Now Playing</span>
                  </button>
                </div>
              </header>

              {/* Desktop Tab Body with Responsive Multi-Column Layout */}
              <div className="flex-1 overflow-y-auto p-8">
                {renderTabContent(true)}
              </div>
            </div>
          </div>
        ) : (
          /* MOBILE & TABLET LAYOUT */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Scrollable Tab Content Area */}
            <div className="flex-1 overflow-y-auto pb-32">
              <div className="p-4 sm:p-6 space-y-6 pt-8 md:pt-10 max-w-4xl mx-auto">
                {renderTabContent(false)}
              </div>
            </div>

            {/* Mobile / Tablet Floating MiniPlayer */}
            <MiniPlayer
              track={currentTrack}
              isPlaying={isPlaying}
              onPlayPause={(e) => {
                e.stopPropagation();
                handleTogglePlayPause();
              }}
              onNext={(e) => {
                e.stopPropagation();
                handleNextTrack();
              }}
              onExpand={() => setIsSheetExpanded(true)}
              currentTime={currentTime}
              duration={duration}
              aidjState={aidjState}
              bottomOffset={isPhone ? 72 : 68}
            />

            {/* Bottom 5-Tab Bar */}
            <nav 
              className="h-16 px-6 border-t border-white/15 apple-glass-material flex items-center justify-around z-30 shrink-0"
              style={{
                paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom, 0.25rem))',
              }}
            >
              <button
                onClick={() => setActiveTab('listen-now')}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  activeTab === 'listen-now' ? 'text-rose-400 font-bold' : 'text-zinc-200 hover:text-white'
                }`}
              >
                <Home className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Listen Now</span>
              </button>

              <button
                onClick={() => setActiveTab('browse')}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  activeTab === 'browse' ? 'text-rose-400 font-bold' : 'text-zinc-200 hover:text-white'
                }`}
              >
                <Compass className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Browse</span>
              </button>

              <button
                onClick={() => setActiveTab('radio')}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  activeTab === 'radio' ? 'text-rose-400 font-bold' : 'text-zinc-200 hover:text-white'
                }`}
              >
                <RadioIcon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Radio</span>
              </button>

              <button
                onClick={() => setActiveTab('library')}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  activeTab === 'library' ? 'text-rose-400 font-bold' : 'text-zinc-200 hover:text-white'
                }`}
              >
                <LibraryIcon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Library</span>
              </button>

              <button
                onClick={() => setActiveTab('search')}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  activeTab === 'search' ? 'text-rose-400 font-bold' : 'text-zinc-200 hover:text-white'
                }`}
              >
                <Search className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Search</span>
              </button>

              {/* Dedicated AI Assistant Bottom Tab */}
              <button
                onClick={() => setActiveTab('ai')}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  activeTab === 'ai' ? 'text-rose-400 font-bold' : 'text-zinc-200 hover:text-white'
                }`}
              >
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span className="text-[10px] font-semibold">AI</span>
              </button>
            </nav>
          </div>
        )}

        {/* Persistent Desktop Bottom Playback Bar */}
        {isDesktop && (
          <MiniPlayer
            track={currentTrack}
            isPlaying={isPlaying}
            onPlayPause={(e) => {
              e.stopPropagation();
              handleTogglePlayPause();
            }}
            onNext={(e) => {
              e.stopPropagation();
              handleNextTrack();
            }}
            onPrev={(e) => {
              e.stopPropagation();
              handlePrevTrack();
            }}
            onExpand={() => setIsSheetExpanded(true)}
            isDesktop={true}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            repeatMode={repeatMode}
            isShuffle={isShuffle}
            aidjState={aidjState}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
            onToggleRepeat={handleToggleRepeat}
            onToggleShuffle={handleToggleShuffle}
            isVideoMode={isVideoMode}
            onToggleVideoMode={() => setIsVideoMode(!isVideoMode)}
          />
        )}
      </div>

      {/* Expanded Bottom Sheet Player with Spotify-grade Scrubber and Gemini AI DJ Queue */}
      {isSheetExpanded && (
        <ExpandedPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          isMuted={isMuted}
          isFavorite={favorites.includes(currentTrack.id)}
          repeatMode={repeatMode}
          isShuffle={isShuffle}
          aidjState={aidjState}
          isVideoMode={isVideoMode}
          onTogglePlay={handleTogglePlayPause}
          onPrev={handlePrevTrack}
          onNext={handleNextTrack}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onToggleMute={handleToggleMute}
          onToggleRepeat={handleToggleRepeat}
          onToggleShuffle={handleToggleShuffle}
          onToggleAIDJ={handleToggleAIDJ}
          onRefreshAIDJ={handleRefreshAIDJ}
          onToggleFavorite={() => toggleFavorite(currentTrack.id)}
          onToggleVideoMode={() => setIsVideoMode(!isVideoMode)}
          onDismiss={() => setIsSheetExpanded(false)}
          playlist={playlist}
          onSelectTrack={handleSelectTrack}
          showToast={showToast}
        />
      )}

      {/* Ambient Settings & Liquid Glass Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        ambientSettings={ambientSettings}
        onUpdateAmbientSettings={setAmbientSettings}
        showToast={showToast}
        onOpenWelcome={() => setShowWelcomeScreen(true)}
      />

      {/* Animated Apple Welcome Screen */}
      <AppleWelcomeScreen
        isOpen={showWelcomeScreen}
        onDismiss={() => {
          setShowWelcomeScreen(false);
          try {
            localStorage.setItem('apple_music_welcome_seen', 'true');
          } catch {}
        }}
      />
    </div>
  );

  // Helper renderer for tab content
  function renderTabContent(forDesktop: boolean) {
    if (activeTab === 'listen-now') {
      return (
        <div className="space-y-6">
          {/* Header Title on Mobile */}
          {!forDesktop && (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                  {todayDateString}
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
                  Listen Now
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowWelcomeScreen(true)}
                  className="p-2 rounded-2xl bg-white/10 hover:bg-white/15 text-rose-400 hover:text-white transition-colors border border-white/15 shadow-sm"
                  title="Apple Welcome Experience"
                >
                  <Sparkles className="w-4 h-4 text-rose-400" />
                </button>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white transition-colors border border-white/15 shadow-sm"
                  title="Ambient Light Settings"
                >
                  <SlidersHorizontal className="w-4 h-4 text-[#FA2D48]" />
                </button>
                <div 
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#FA2D48] to-purple-600 p-[1.5px] cursor-pointer shadow-md"
                  title="Settings"
                >
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120"
                    alt="Profile"
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Hero Featured Card with Play & Shuffle Buttons */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#FA2D48]/85 via-purple-900 to-black p-6 sm:p-8 shadow-2xl border border-white/10 space-y-4">
            <div className="max-w-xl space-y-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/40 text-white backdrop-blur-md">
                Billboard Top 20 Global &amp; Studio Lossless
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                Billie Eilish, Ariana Grande &amp; Top 100 Hits
              </h2>
              <p className="text-xs sm:text-sm text-white/80">
                Stream verified high-definition studio audio and YouTube live streams with full-screen blurred ambient video and liquid glass aesthetics.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handlePlayFirst}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-white text-black font-bold text-sm shadow-lg hover:bg-neutral-200 transition-all active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Play Now</span>
              </button>

              <button
                onClick={handleShuffleAll}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-sm backdrop-blur-md border border-white/20 transition-all active:scale-95 cursor-pointer"
              >
                <Shuffle className="w-4 h-4 text-white" />
                <span>Shuffle</span>
              </button>
            </div>
          </div>

          {/* Billboard Top Tracks List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Top Chart Hits</span>
                <span className="text-[10px] font-mono text-zinc-400 bg-white/10 px-2 py-0.5 rounded-full">
                  {BILLBOARD_TOP_TRACKS.length} tracks
                </span>
              </h3>
              <span 
                onClick={handleShuffleAll}
                className="text-xs font-semibold text-[#FA2D48] hover:underline cursor-pointer flex items-center gap-1"
              >
                <Shuffle className="w-3 h-3" />
                Shuffle All
              </span>
            </div>

            <div className={`grid gap-1.5 ${forDesktop ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {BILLBOARD_TOP_TRACKS.map((track, index) => {
                const isItemActive = currentTrack.id === track.id;
                const isFav = favorites.includes(track.id);

                return (
                  <div
                    key={track.id}
                    onClick={() => handleSelectTrack(track)}
                    className={`group flex items-center gap-3.5 p-2.5 rounded-2xl cursor-pointer transition-all border ${
                      isItemActive
                        ? 'bg-white/15 border-white/25 shadow-lg'
                        : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <span className="w-5 text-center text-xs font-mono font-bold text-zinc-300">
                      {index + 1}
                    </span>

                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md shrink-0 bg-neutral-900 border border-white/15">
                      <img
                        src={track.artwork}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                      {isItemActive && (
                        <MusicVisualizer isPlaying={isPlaying} barColor="#FA2D48" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pr-2">
                      <div className={`text-sm font-bold truncate leading-snug flex items-center gap-1.5 ${
                        isItemActive ? 'text-rose-400' : 'text-white'
                      }`}>
                        <span className="truncate">{track.title}</span>
                        {track.audioSrc && (
                          <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-700/40 px-1 py-0.2 rounded font-mono shrink-0">
                            HQ
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-200 font-medium truncate mt-0.5">
                        {track.artist}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(track.id);
                        }}
                        className="p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-[#FA2D48] transition-colors cursor-pointer"
                        title="Favorite"
                      >
                        <Star className={`w-4 h-4 ${isFav ? 'fill-[#FA2D48] text-[#FA2D48]' : ''}`} />
                      </button>
                      <span className="text-xs text-zinc-300 font-mono font-medium hidden sm:inline">
                        {track.durationFormatted}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'browse') {
      return (
        <div className="space-y-6">
          {!forDesktop && (
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Explore Trends
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
                Browse &amp; Categories
              </h1>
            </div>
          )}

          {/* Category Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {CATEGORY_CARDS.map((cat) => (
              <div
                key={cat.id}
                onClick={() => {
                  setActiveTab('search');
                  setSearchQuery(cat.title);
                  executeSearch(cat.query);
                }}
                className="relative aspect-[1.4] rounded-2xl p-4 overflow-hidden cursor-pointer transition-transform hover:scale-[1.03] active:scale-95 shadow-lg flex flex-col justify-end"
                style={{ backgroundColor: cat.bg }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="relative text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                  {cat.title}
                </span>
              </div>
            ))}
          </div>

          {/* Featured Releases */}
          <div className="space-y-3 pt-2">
            <h3 className="text-lg font-bold text-white">Featured Releases</h3>
            <div className={`grid gap-3 ${forDesktop ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
              {BILLBOARD_TOP_TRACKS.slice(0, 8).map((track) => (
                <div
                  key={track.id}
                  onClick={() => handleSelectTrack(track)}
                  className="group p-2.5 rounded-2xl bg-neutral-900/80 border border-white/15 hover:border-white/30 cursor-pointer transition-all space-y-2 shadow-sm"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-neutral-800 shadow-md">
                    <img
                      src={track.artwork}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {currentTrack.id === track.id && (
                      <MusicVisualizer isPlaying={isPlaying} barColor="#FA2D48" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white truncate">{track.title}</div>
                    <div className="text-[11px] text-zinc-200 font-medium truncate mt-0.5">{track.artist}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'radio') {
      return (
        <div className="space-y-6">
          {!forDesktop && (
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Live Broadcasts
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
                Radio Stations
              </h1>
            </div>
          )}

          <div className={`grid gap-4 ${forDesktop ? 'grid-cols-3' : 'grid-cols-1'}`}>
            {RADIO_STATIONS.map((st) => (
              <div
                key={st.id}
                onClick={() => {
                  const radioTrack: SongTrack = {
                    id: st.id,
                    youtubeId: st.youtubeId,
                    title: st.title,
                    artist: st.subtitle,
                    album: 'Apple Music Radio Live',
                    duration: 3600,
                    durationFormatted: 'LIVE',
                    artwork: st.artwork,
                    artworkBgColor: st.color,
                    genre: 'Radio',
                  };
                  handleSelectTrack(radioTrack);
                }}
                className="group p-4 rounded-3xl bg-neutral-900/85 border border-white/15 hover:border-white/30 cursor-pointer transition-all flex items-center gap-4 shadow-xl"
              >
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-white/15">
                  <img
                    src={st.artwork}
                    alt={st.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded bg-[#FA2D48] text-white text-[9px] font-bold uppercase tracking-wider animate-pulse">
                    LIVE
                  </span>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="text-base font-bold text-white group-hover:text-rose-400 transition-colors">
                    {st.title}
                  </h3>
                  <p className="text-xs text-zinc-200 font-medium leading-relaxed line-clamp-2">
                    {st.subtitle}
                  </p>
                </div>

                <button className="p-3 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-transform shadow-md shrink-0 cursor-pointer">
                  <Play className="w-4 h-4 fill-black ml-0.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeTab === 'library') {
      let displayTracks: SongTrack[] = [];
      if (libraryFilter === 'favorites') {
        displayTracks = BILLBOARD_TOP_TRACKS.filter((t) => favorites.includes(t.id));
      } else if (libraryFilter === 'history') {
        displayTracks = recentlyPlayed;
      } else if (libraryFilter === 'lossless') {
        displayTracks = BILLBOARD_TOP_TRACKS.filter((t) => Boolean(t.audioSrc));
      } else {
        displayTracks = BILLBOARD_TOP_TRACKS;
      }

      return (
        <div className="space-y-6">
          {!forDesktop && (
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Your Collection
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
                Library
              </h1>
            </div>
          )}

          {/* Interactive Library Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'all', label: 'All Catalog', icon: ListMusic, count: BILLBOARD_TOP_TRACKS.length },
              { id: 'favorites', label: 'Favorites', icon: Heart, count: favorites.length },
              { id: 'lossless', label: 'Studio MP3s', icon: Disc3, count: 9 },
              { id: 'history', label: 'Recently Played', icon: Clock, count: recentlyPlayed.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = libraryFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setLibraryFilter(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#FA2D48] text-white shadow-md'
                      : 'bg-white/10 text-neutral-300 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-black/30 text-white' : 'bg-white/10 text-zinc-300'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filtered Track Results List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-base font-bold text-white">
                {libraryFilter === 'favorites' ? 'Favorite Tracks' :
                 libraryFilter === 'history' ? 'Recently Played' :
                 libraryFilter === 'lossless' ? 'Studio Lossless Audio Tracks' : 'All Available Songs'} ({displayTracks.length})
              </h3>
              {displayTracks.length > 0 && (
                <button
                  onClick={() => {
                    setPlaylist(displayTracks);
                    handleSelectTrack(displayTracks[0]);
                  }}
                  className="text-xs font-semibold text-[#FA2D48] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Play All
                </button>
              )}
            </div>

            {displayTracks.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center space-y-2">
                <Heart className="w-8 h-8 text-neutral-500 mx-auto" />
                <p className="text-sm font-semibold text-white">No tracks in this view yet</p>
                <p className="text-xs text-neutral-400">Click the star icon on any song to add it to your favorites!</p>
              </div>
            ) : (
              <div className={`grid gap-2 ${forDesktop ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {displayTracks.map((track) => {
                  const isItemActive = currentTrack.id === track.id;
                  const isFav = favorites.includes(track.id);

                  return (
                    <div
                      key={track.id}
                      onClick={() => handleSelectTrack(track)}
                      className={`flex items-center gap-3.5 p-2.5 rounded-2xl cursor-pointer transition-all border ${
                        isItemActive
                          ? 'bg-white/15 border-white/25 shadow-lg'
                          : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md shrink-0 bg-neutral-900 border border-white/15">
                        <img
                          src={track.artwork}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                        {isItemActive && (
                          <MusicVisualizer isPlaying={isPlaying} barColor="#FA2D48" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pr-2">
                        <div className={`text-sm font-bold truncate leading-snug flex items-center gap-1.5 ${
                          isItemActive ? 'text-rose-400' : 'text-white'
                        }`}>
                          <span className="truncate">{track.title}</span>
                          {track.audioSrc && (
                            <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-700/40 px-1 py-0.2 rounded font-mono shrink-0">
                              HQ
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-200 font-medium truncate mt-0.5">
                          {track.artist}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(track.id);
                          }}
                          className="p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-[#FA2D48] transition-colors cursor-pointer"
                          title="Favorite"
                        >
                          <Star className={`w-4 h-4 ${isFav ? 'fill-[#FA2D48] text-[#FA2D48]' : ''}`} />
                        </button>
                        <span className="text-xs text-zinc-300 font-mono font-medium hidden sm:inline">
                          {track.durationFormatted}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'search') {
      return (
        <div className="space-y-6">
          {!forDesktop && (
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Global Discovery
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
                Search
              </h1>
            </div>
          )}

          {!forDesktop && (
            <div className="relative">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  executeSearch(searchQuery);
                }}
                className="relative flex items-center"
              >
                <Search className="w-4 h-4 absolute left-3.5 text-zinc-300" />
                <input
                  type="text"
                  placeholder="Artists, Songs, Lyrics (YouTube Powered)..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full h-11 pl-10 pr-24 rounded-2xl bg-neutral-900/90 border border-white/20 text-sm text-white placeholder-zinc-300 focus:outline-none focus:border-[#FA2D48] transition-colors shadow-inner font-medium"
                />
                {isSearching && (
                  <Loader2 className="w-4 h-4 text-[#FA2D48] animate-spin absolute right-20" />
                )}
                {searchQuery && !isSearching && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSuggestions([]);
                    }}
                    className="p-1 rounded-full text-zinc-300 hover:text-white absolute right-18 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!searchQuery.trim() || isSearching}
                  className="absolute right-2 px-3 py-1.5 rounded-xl bg-[#FA2D48] hover:bg-rose-600 disabled:opacity-40 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer shadow-md"
                >
                  Search
                </button>
              </form>

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-13 left-0 right-0 p-2 rounded-2xl bg-neutral-900/95 border border-white/20 shadow-2xl z-50 space-y-1 backdrop-blur-2xl">
                  {suggestions.map((s, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSearchQuery(s);
                        executeSearch(s);
                      }}
                      className="px-3 py-2 rounded-xl text-xs hover:bg-white/15 cursor-pointer flex items-center justify-between text-white font-semibold"
                    >
                      <span>{s}</span>
                      <Search className="w-3.5 h-3.5 text-rose-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {searchResults.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400">
                YouTube Results ({searchResults.length})
              </h3>
              <div className={`grid gap-2 ${forDesktop ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {searchResults.map((track) => {
                  const isItemActive = currentTrack.id === track.id;
                  return (
                    <div
                      key={track.id}
                      onClick={() => handleSelectTrack(track)}
                      className={`flex items-center gap-3.5 p-2 rounded-2xl cursor-pointer transition-all border ${
                        isItemActive
                          ? 'bg-white/15 border-white/25 shadow-md'
                          : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <img
                        src={track.artwork}
                        alt={track.title}
                        className="w-12 h-12 rounded-xl object-cover shadow-md shrink-0 border border-white/10"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-bold truncate leading-snug ${isItemActive ? 'text-rose-400' : 'text-white'}`}>
                          {track.title}
                        </div>
                        <div className="text-xs text-zinc-200 font-medium truncate mt-0.5">
                          {track.artist}
                        </div>
                      </div>
                      <span className="text-xs text-zinc-300 font-mono font-medium">
                        {track.durationFormatted}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400">
                Browse Popular Categories
              </h3>
              <div className={`grid gap-3 ${forDesktop ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
                {CATEGORY_CARDS.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setSearchQuery(cat.title);
                      executeSearch(cat.query);
                    }}
                    className="aspect-[1.5] rounded-2xl p-4 flex flex-col justify-end font-bold text-white shadow-lg cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform border border-white/10"
                    style={{ backgroundColor: cat.bg }}
                  >
                    <span className="text-base font-extrabold tracking-tight drop-shadow-sm">{cat.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'ai') {
      return (
        <JarvisView
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          catalog={BILLBOARD_TOP_TRACKS}
          onPlayTrack={handleSelectTrack}
          onTogglePlayPause={handleTogglePlayPause}
          onNextTrack={handleNextTrack}
          onPrevTrack={handlePrevTrack}
          onShuffleToggle={handleToggleShuffle}
          onRemixQueue={handleRefreshAIDJ}
          onDuckAudio={handleDuckAudio}
        />
      );
    }

    return null;
  }
}
