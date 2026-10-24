export interface SongTrack {
  id: string;
  youtubeId: string;
  audioSrc?: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  durationFormatted: string;
  artwork: string;
  artworkBgColor: string;
  genre: string;
  lyrics?: string[];
  isExplicit?: boolean;
}

export type AppleMusicTab = 'listen-now' | 'browse' | 'radio' | 'library' | 'search' | 'ai' | 'settings';

export interface AmbientSettings {
  enabled: boolean;
  blurLevel: number; // in px: 25, 45, 65, 85
  saturation: number; // in %: 120, 180, 240
  brightness: number; // in %: 40, 60, 80
  liveVideoBg: boolean;
}

export type DeviceMode = 'phone' | 'tablet' | 'desktop';

export type RepeatMode = 'off' | 'all' | 'one';

export interface AIDJState {
  enabled: boolean;
  isLoading: boolean;
  vibeTag: string;
  djCommentary: string;
  transitionNotes: Record<string, string>; // trackId -> reason
  isAIPowered: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actionTaken?: {
    type: 'play_track' | 'pause' | 'resume' | 'next' | 'prev' | 'shuffle' | 'recommend_queue' | 'none';
    targetTrackId?: string;
    details?: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

export interface JarvisSettings {
  wakePhrase: string; // default "Jarvis"
  voiceName: string; // selected TTS voice
  voiceVolume: number; // 0 - 100
  speechRate: number; // 0.8 - 1.4
  speechPitch: number; // 0.8 - 1.2
  voiceOutputEnabled: boolean; // speak response aloud
  language: string; // e.g. "en-US"
  personality: 'butler' | 'dj' | 'witty' | 'minimal';
  audioDuckingEnabled: boolean; // lower music volume when speaking
  musicCommandAutoExecute: boolean; // automatically trigger play/pause etc.
}

export interface CommentItem {
  id: string;
  author: string;
  avatar: string;
  content: string;
  timestamp: string;
  likes: number;
  isLiked?: boolean;
}
