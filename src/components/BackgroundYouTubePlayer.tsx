import React, { useEffect, useRef } from 'react';
import { SongTrack } from '../types';

interface BackgroundYouTubePlayerProps {
  track: SongTrack;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  seekTime?: number | null;
  onEnded: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onStateChange?: (playing: boolean) => void;
  ambientEnabled?: boolean;
  blurLevel?: number;
  saturation?: number;
  brightness?: number;
  liveVideoBg?: boolean;
  isLocalAudioActive?: boolean;
}

export const BackgroundYouTubePlayer: React.FC<BackgroundYouTubePlayerProps> = ({
  track,
  isPlaying,
  volume,
  isMuted,
  seekTime,
  onEnded,
  onTimeUpdate,
  onStateChange,
  ambientEnabled = true,
  blurLevel = 50,
  saturation = 180,
  brightness = 65,
  liveVideoBg = true,
  isLocalAudioActive = false,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Send commands to YouTube iframe via postMessage API
  const sendCommand = (func: string, args: any[] = []) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func,
            args,
          }),
          '*'
        );
      } catch {
        // Cross-origin safe guard
      }
    }
  };

  // Play / Pause sync
  useEffect(() => {
    if (isPlaying) {
      sendCommand('playVideo');
    } else {
      sendCommand('pauseVideo');
    }
  }, [isPlaying]);

  // Volume & Mute sync
  // If local audio is playing, always keep YouTube video muted to avoid audio collision/echo!
  useEffect(() => {
    if (isLocalAudioActive || isMuted) {
      sendCommand('mute');
    } else {
      sendCommand('unMute');
      sendCommand('setVolume', [volume]);
    }
  }, [volume, isMuted, isLocalAudioActive]);

  // Seek sync
  useEffect(() => {
    if (typeof seekTime === 'number' && !isNaN(seekTime)) {
      sendCommand('seekTo', [seekTime, true]);
    }
  }, [seekTime]);

  // Listen for YouTube IFrame player events
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      try {
        if (typeof e.data === 'string') {
          const data = JSON.parse(e.data);
          // Player state changed: 0 = ended, 1 = playing, 2 = paused
          if (data.event === 'onStateChange') {
            if (data.info === 0) {
              onEnded();
            } else if (data.info === 1) {
              onStateChange?.(true);
            } else if (data.info === 2) {
              onStateChange?.(false);
            }
          }
          // Info delivery with currentTime (only update if local audio is not the authority)
          if (data.event === 'infoDelivery' && data.info && !isLocalAudioActive) {
            if (typeof data.info.currentTime === 'number') {
              onTimeUpdate?.(data.info.currentTime, data.info.duration || track.duration);
            }
          }
        }
      } catch {
        // Non-JSON message from other origins
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onEnded, onStateChange, onTimeUpdate, track.duration, isLocalAudioActive]);

  // Mute flag in URL if local audio is active
  const muteParam = isLocalAudioActive || isMuted ? '&mute=1' : '';
  const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : '';
  const embedUrl = `https://www.youtube-nocookie.com/embed/${track.youtubeId}?enablejsapi=1&autoplay=1&rel=0&controls=0&playsinline=1&modestbranding=1&loop=1${muteParam}${originParam}`;

  return (
    <div 
      className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 
        FULL-SCREEN BLURRED LIVE VIDEO CANVAS:
        Ambient video covering the entire screen with liquid glass blur & luminosity
      */}
      {ambientEnabled && liveVideoBg ? (
        <div className="absolute inset-[-15%] w-[130%] h-[130%] overflow-hidden transition-all duration-700 pointer-events-none">
          <iframe
            ref={iframeRef}
            key={track.youtubeId}
            src={embedUrl}
            title={`YouTube Ambient Stream: ${track.title}`}
            className="w-full h-full border-none pointer-events-none transform scale-125"
            style={{
              filter: `blur(${blurLevel}px) saturate(${saturation}%) brightness(${brightness}%)`,
              willChange: 'filter, transform',
            }}
            allow="autoplay; encrypted-media"
          />
          {/* Luminous Apple Liquid Glass Vignette Overlay */}
          <div className="absolute inset-0 bg-black/15 backdrop-blur-[1px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/25" />
          {/* Radiant Ambient Radial Lighting tint matching track color */}
          <div 
            className="absolute inset-0 opacity-60 mix-blend-screen pointer-events-none transition-all duration-700"
            style={{
              background: `radial-gradient(circle at 50% 35%, ${track.artworkBgColor} 0%, rgba(250, 45, 72, 0.45) 45%, transparent 80%)`,
            }}
          />
        </div>
      ) : (
        /* Hidden background playback container when live video ambient is off */
        <div className="fixed -bottom-96 -right-96 w-32 h-32 opacity-0 pointer-events-none z-[-100] overflow-hidden">
          <iframe
            ref={iframeRef}
            key={track.youtubeId}
            src={embedUrl}
            title={`YouTube Stream: ${track.title}`}
            className="w-full h-full border-none"
            allow="autoplay; encrypted-media"
          />
        </div>
      )}
      {/* Supplemental soft radiant ambient aurora for warm illumination across entire viewport */}
      <div 
        className="absolute inset-0 opacity-25 pointer-events-none transition-colors duration-1000 -z-10"
        style={{
          background: `radial-gradient(circle at 75% 20%, ${track.artworkBgColor} 0%, transparent 60%)`,
        }}
      />
    </div>
  );
};
