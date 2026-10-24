import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  Settings,
  History,
  MessageSquare,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Disc3,
  Sliders,
  ShieldCheck,
  Key,
  Eye,
  EyeOff,
  Radio,
  ExternalLink,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { SongTrack, ChatMessage, ChatSession, JarvisSettings } from '../types';

interface JarvisViewProps {
  currentTrack: SongTrack | null;
  isPlaying: boolean;
  catalog: SongTrack[];
  onPlayTrack: (track: SongTrack) => void;
  onTogglePlayPause: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onShuffleToggle: () => void;
  onRemixQueue: () => void;
  onDuckAudio: (duck: boolean) => void;
}

const DEFAULT_SETTINGS: JarvisSettings = {
  wakePhrase: 'Jarvis',
  voiceName: '',
  voiceVolume: 90,
  speechRate: 1.05,
  speechPitch: 1.05,
  voiceOutputEnabled: true,
  language: 'en-US',
  personality: 'butler',
  audioDuckingEnabled: true,
  musicCommandAutoExecute: true,
};

const INITIAL_MESSAGE: ChatMessage = {
  id: 'init-msg',
  role: 'assistant',
  content: "Greetings. I am JARVIS, your intelligent music concierge. How may I arrange your listening experience today?",
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

export const JarvisView: React.FC<JarvisViewProps> = ({
  currentTrack,
  isPlaying,
  catalog,
  onPlayTrack,
  onTogglePlayPause,
  onNextTrack,
  onPrevTrack,
  onShuffleToggle,
  onRemixQueue,
  onDuckAudio,
}) => {
  // Navigation within the AI Section: 'chat' | 'history' | 'settings' | 'gemini'
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'history' | 'settings' | 'gemini'>('chat');

  // Chat & Session State
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('jarvis_active_chat');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [INITIAL_MESSAGE];
  });

  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('jarvis_chat_sessions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    return 'session-' + Date.now();
  });

  // Settings State
  const [settings, setSettings] = useState<JarvisSettings>(() => {
    try {
      const saved = localStorage.getItem('jarvis_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  // Custom User Gemini API Key (stored securely in localStorage)
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('jarvis_user_gemini_key') || '';
    } catch {
      return '';
    }
  });
  const [tempApiKey, setTempApiKey] = useState(customApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [keySavedToast, setKeySavedToast] = useState(false);

  // Connection diagnostics
  const [apiTestStatus, setApiTestStatus] = useState<{
    tested: boolean;
    loading: boolean;
    status: 'connected' | 'offline' | 'error' | 'idle';
    model: string;
    latencyMs: number;
    error?: string;
  }>({
    tested: false,
    loading: false,
    status: 'idle',
    model: 'gemini-3.1-flash-lite',
    latencyMs: 0,
  });

  // Voice & Input State
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Refs
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sync active chat to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('jarvis_active_chat', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Sync settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('jarvis_settings', JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // Save/update session in chatSessions list
  const persistSession = useCallback((msgs: ChatMessage[], sId: string) => {
    if (msgs.length <= 1) return;
    setChatSessions((prev) => {
      const title = msgs.find((m) => m.role === 'user')?.content.slice(0, 32) || 'Music Consultation';
      const existingIdx = prev.findIndex((s) => s.id === sId);
      const updatedSession: ChatSession = {
        id: sId,
        title,
        createdAt: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        messages: msgs,
      };

      let newSessions: ChatSession[];
      if (existingIdx >= 0) {
        newSessions = [...prev];
        newSessions[existingIdx] = updatedSession;
      } else {
        newSessions = [updatedSession, ...prev].slice(0, 20); // Keep last 20
      }

      try {
        localStorage.setItem('jarvis_chat_sessions', JSON.stringify(newSessions));
      } catch {}
      return newSessions;
    });
  }, []);

  // Web Speech API: Voices loader
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);

      // Select soft female voice by default if none configured
      if (!settings.voiceName && voices.length > 0) {
        const preferred = voices.find((v) =>
          /female|woman|samantha|victoria|karen|zira|jenny|moira|tessa/i.test(v.name)
        ) || voices.find((v) => v.lang.startsWith('en')) || voices[0];

        if (preferred) {
          setSettings((prev) => ({ ...prev, voiceName: preferred.name }));
        }
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, [settings.voiceName]);

  // Web Speech API: SpeechRecognition setup
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = settings.language || 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        if (settings.audioDuckingEnabled) {
          onDuckAudio(true);
        }
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('[Speech Recognition Error]:', e);
        setIsListening(false);
        if (settings.audioDuckingEnabled) {
          onDuckAudio(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (!isSpeaking && settings.audioDuckingEnabled) {
          onDuckAudio(false);
        }
      };

      recognitionRef.current = recognition;
    }
  }, [settings.language, settings.audioDuckingEnabled, onDuckAudio]);

  // Scroll to bottom on message change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // TTS Voice Output
  const speakReply = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      if (!settings.voiceOutputEnabled) return;

      window.speechSynthesis.cancel();

      // Duck audio while Jarvis is speaking
      if (settings.audioDuckingEnabled) {
        onDuckAudio(true);
      }
      setIsSpeaking(true);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = settings.speechRate;
      utterance.pitch = settings.speechPitch;
      utterance.volume = settings.voiceVolume / 100;

      if (settings.voiceName) {
        const voice = availableVoices.find((v) => v.name === settings.voiceName);
        if (voice) utterance.voice = voice;
      }

      utterance.onend = () => {
        setIsSpeaking(false);
        if (settings.audioDuckingEnabled) {
          onDuckAudio(false);
        }
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        if (settings.audioDuckingEnabled) {
          onDuckAudio(false);
        }
      };

      window.speechSynthesis.speak(utterance);
    },
    [settings, availableVoices, onDuckAudio]
  );

  // Execute structured playback action returned by JARVIS
  const executeJarvisAction = useCallback(
    (action?: { type: string; targetTrackId?: string; details?: string }) => {
      if (!action || !settings.musicCommandAutoExecute) return;

      switch (action.type) {
        case 'play_track': {
          if (action.targetTrackId) {
            const track = catalog.find((t) => t.id === action.targetTrackId);
            if (track) {
              onPlayTrack(track);
            }
          }
          break;
        }
        case 'pause': {
          if (isPlaying) onTogglePlayPause();
          break;
        }
        case 'resume': {
          if (!isPlaying) onTogglePlayPause();
          break;
        }
        case 'next': {
          onNextTrack();
          break;
        }
        case 'prev': {
          onPrevTrack();
          break;
        }
        case 'shuffle': {
          onShuffleToggle();
          break;
        }
        case 'recommend_queue': {
          onRemixQueue();
          break;
        }
        default:
          break;
      }
    },
    [catalog, isPlaying, settings.musicCommandAutoExecute, onPlayTrack, onTogglePlayPause, onNextTrack, onPrevTrack, onShuffleToggle, onRemixQueue]
  );

  // Send message to JARVIS backend
  const handleSendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isProcessing) return;

    // Check for wake phrase removal if provided at start
    let cleanedText = trimmed;
    const wakePrefix = new RegExp(`^${settings.wakePhrase}[,! ]*`, 'i');
    cleanedText = cleanedText.replace(wakePrefix, '').trim() || trimmed;

    const userMessage: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsProcessing(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (customApiKey && customApiKey.trim().length > 10) {
        headers['x-gemini-key'] = customApiKey.trim();
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: cleanedText,
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          currentTrack: currentTrack
            ? {
                id: currentTrack.id,
                title: currentTrack.title,
                artist: currentTrack.artist,
                genre: currentTrack.genre,
              }
            : null,
          isPlaying,
          catalog: catalog.map((s) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            genre: s.genre,
            durationFormatted: s.durationFormatted,
          })),
          personality: settings.personality,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const reply = data.reply || "Understood. Adjusting your sonic flow.";
      const action = data.action;

      const assistantMessage: ChatMessage = {
        id: 'msg-reply-' + Date.now(),
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionTaken: action,
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      persistSession(finalMessages, currentSessionId);

      // Execute playback actions
      executeJarvisAction(action);

      // Speak aloud if enabled
      speakReply(reply);
    } catch (err: any) {
      console.error('[Jarvis Chat Error]:', err);
      const errorMessage: ChatMessage = {
        id: 'msg-err-' + Date.now(),
        role: 'assistant',
        content: "I've encountered a temporary connection glitch, but your music playback continues seamlessly.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      const finalMessages = [...newMessages, errorMessage];
      setMessages(finalMessages);
      persistSession(finalMessages, currentSessionId);
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle Voice Mic
  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      if (settings.audioDuckingEnabled) {
        onDuckAudio(false);
      }
    } else {
      try {
        recognitionRef.current.start();
      } catch {
        recognitionRef.current.stop();
        setTimeout(() => {
          try {
            recognitionRef.current.start();
          } catch {}
        }, 150);
      }
    }
  };

  // Start a fresh conversation
  const handleStartNewChat = () => {
    if (messages.length > 1) {
      persistSession(messages, currentSessionId);
    }
    const newId = 'session-' + Date.now();
    setCurrentSessionId(newId);
    setMessages([INITIAL_MESSAGE]);
    setActiveSubTab('chat');
  };

  // Load a prior session
  const handleLoadSession = (session: ChatSession) => {
    persistSession(messages, currentSessionId);
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setActiveSubTab('chat');
  };

  // Delete a session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = chatSessions.filter((s) => s.id !== sessionId);
    setChatSessions(updated);
    try {
      localStorage.setItem('jarvis_chat_sessions', JSON.stringify(updated));
    } catch {}
  };

  // Test Gemini API Key
  const handleTestApiKey = async () => {
    setApiTestStatus((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const headers: Record<string, string> = {};
      const keyToTest = tempApiKey.trim() || customApiKey.trim();
      if (keyToTest) {
        headers['x-gemini-key'] = keyToTest;
      }

      const res = await fetch('/api/ai/test', { headers });
      const data = await res.json();

      setApiTestStatus({
        tested: true,
        loading: false,
        status: data.status === 'connected' ? 'connected' : 'error',
        model: data.model || 'gemini-3.1-flash-lite',
        latencyMs: data.latencyMs || 0,
        error: data.error,
      });
    } catch (err: any) {
      setApiTestStatus({
        tested: true,
        loading: false,
        status: 'error',
        model: 'gemini-3.1-flash-lite',
        latencyMs: 0,
        error: err.message || 'Connection failed',
      });
    }
  };

  // Save Custom Gemini Key
  const handleSaveApiKey = () => {
    const clean = tempApiKey.trim();
    setCustomApiKey(clean);
    try {
      if (clean) {
        localStorage.setItem('jarvis_user_gemini_key', clean);
      } else {
        localStorage.removeItem('jarvis_user_gemini_key');
      }
    } catch {}
    setKeySavedToast(true);
    setTimeout(() => setKeySavedToast(false), 3000);
    handleTestApiKey();
  };

  // Clear Custom Gemini Key
  const handleClearApiKey = () => {
    setTempApiKey('');
    setCustomApiKey('');
    try {
      localStorage.removeItem('jarvis_user_gemini_key');
    } catch {}
    setKeySavedToast(true);
    setTimeout(() => setKeySavedToast(false), 3000);
    setApiTestStatus({
      tested: false,
      loading: false,
      status: 'idle',
      model: 'gemini-3.1-flash-lite',
      latencyMs: 0,
    });
  };

  // Test current TTS voice
  const handlePreviewVoice = () => {
    speakReply(`Hello! I am ${settings.wakePhrase}. Ready to orchestrate your music experience.`);
  };

  const QUICK_PROMPTS = [
    { label: 'Play something relaxing', text: 'Jarvis, play something relaxing and peaceful' },
    { label: 'What is playing right now?', text: 'What song is currently playing and who is the artist?' },
    { label: 'Remix upcoming queue', text: 'Arrange a fresh upcoming queue with great transitions' },
    { label: 'Play Billie Eilish', text: 'Play Billie Eilish' },
    { label: 'Shuffle music', text: 'Shuffle my music tracks' },
    { label: isPlaying ? 'Pause music' : 'Resume music', text: isPlaying ? 'Pause music' : 'Resume music' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0c] text-white overflow-hidden relative">
      {/* Top AI Navigation Bar */}
      <div className="h-14 px-4 sm:px-8 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#0a0a0c]/80 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FA2D48] via-purple-600 to-indigo-600 p-[1.5px] flex items-center justify-center shadow-lg shadow-purple-900/30">
            <div className="w-full h-full rounded-[10px] bg-black/80 backdrop-blur-sm flex items-center justify-center">
              <Bot className="w-4 h-4 text-rose-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-white">JARVIS AI</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/40 font-semibold">
                v3.1 Pro
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 hidden sm:block">
              Voice-Activated Intelligent Music Concierge
            </p>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
          <button
            onClick={() => setActiveSubTab('chat')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'chat'
                ? 'bg-[#FA2D48] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-[#FA2D48] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">History</span>
            {chatSessions.length > 0 && (
              <span className="text-[10px] bg-white/20 px-1 rounded-full font-mono">
                {chatSessions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('settings')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'settings'
                ? 'bg-[#FA2D48] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Voice & Persona</span>
          </button>

          <button
            onClick={() => setActiveSubTab('gemini')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'gemini'
                ? 'bg-[#FA2D48] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>API</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col">
        {/* SUB-TAB 1: CHAT & VOICE INTERFACE */}
        {activeSubTab === 'chat' && (
          <div className="flex-1 flex flex-col justify-between max-w-4xl w-full mx-auto p-4 sm:p-6 pb-28">
            {/* Context Badge: Active Audio Playback state */}
            {currentTrack && (
              <div className="mb-4 p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={currentTrack.artwork}
                    alt={currentTrack.title}
                    className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                      <span>{isPlaying ? 'Playing in Background' : 'Paused in Background'}</span>
                    </div>
                    <div className="text-xs font-bold text-white truncate">{currentTrack.title}</div>
                    <div className="text-[11px] text-neutral-400 truncate">{currentTrack.artist}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={onTogglePlayPause}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                  </button>
                  <button
                    onClick={onNextTrack}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                    title="Skip Next"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Conversation Stream */}
            <div className="flex-1 space-y-4 mb-4">
              {messages.map((msg) => {
                const isAssistant = msg.role === 'assistant';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                  >
                    {isAssistant && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FA2D48] to-purple-600 p-[1px] shrink-0 mt-0.5">
                        <div className="w-full h-full rounded-[11px] bg-black/80 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-rose-300" />
                        </div>
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-lg text-sm leading-relaxed transition-all ${
                        isAssistant
                          ? 'bg-neutral-900/90 border border-white/15 text-neutral-100 rounded-tl-sm'
                          : 'bg-gradient-to-r from-[#FA2D48] to-rose-600 text-white font-medium rounded-tr-sm shadow-rose-950/40'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* Action Notification Card if Jarvis executed a player command */}
                      {msg.actionTaken && msg.actionTaken.type !== 'none' && (
                        <div className="mt-2.5 pt-2 border-t border-white/15 flex items-center gap-2 text-xs font-semibold text-purple-300 bg-purple-950/40 px-2.5 py-1.5 rounded-xl border border-purple-800/30">
                          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span>
                            {msg.actionTaken.type === 'play_track' && '🎵 Queued & Playing track selection'}
                            {msg.actionTaken.type === 'pause' && '⏸️ Paused music playback'}
                            {msg.actionTaken.type === 'resume' && '▶️ Resumed music playback'}
                            {msg.actionTaken.type === 'next' && '⏭️ Skipped to next track'}
                            {msg.actionTaken.type === 'prev' && '⏮️ Returned to previous track'}
                            {msg.actionTaken.type === 'shuffle' && '🔀 Shuffled playback queue'}
                            {msg.actionTaken.type === 'recommend_queue' && '✨ AI curated upcoming queue'}
                          </span>
                        </div>
                      )}

                      <div className="mt-1 text-[10px] text-white/50 text-right font-mono">
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isProcessing && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FA2D48] to-purple-600 p-[1px] shrink-0">
                    <div className="w-full h-full rounded-[11px] bg-black/80 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-rose-300 animate-pulse" />
                    </div>
                  </div>
                  <div className="bg-neutral-900/90 border border-white/15 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-xs text-neutral-300 font-medium">JARVIS is thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Chips */}
            <div className="mb-4">
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Quick Prompts</span>
                <span className="text-[10px] text-neutral-500">Tap to ask</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {QUICK_PROMPTS.map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(qp.text)}
                    className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-neutral-300 hover:text-white whitespace-nowrap transition-all cursor-pointer font-medium active:scale-95 shrink-0"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Bar & Voice Mic */}
            <div className="sticky bottom-0 bg-[#0a0a0c]/95 backdrop-blur-2xl p-2 rounded-2xl border border-white/15 shadow-2xl space-y-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(inputValue);
                }}
                className="flex items-center gap-2"
              >
                {/* Voice Mic Input Button */}
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={!speechSupported}
                  title={
                    !speechSupported
                      ? 'Speech recognition not supported in this browser'
                      : isListening
                      ? 'Listening... Click to stop'
                      : 'Speak to Jarvis'
                  }
                  className={`p-3 rounded-xl transition-all cursor-pointer relative shrink-0 ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-900/50'
                      : 'bg-white/10 text-neutral-300 hover:text-white hover:bg-white/15'
                  }`}
                >
                  {isListening ? <Mic className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4" />}
                  {isListening && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-400 animate-ping" />
                  )}
                </button>

                {/* Text Message Input */}
                <input
                  type="text"
                  placeholder={
                    isListening
                      ? 'Listening... say "Jarvis, play..."'
                      : `Message ${settings.wakePhrase} ("play relaxing music", "who made this song?")...`
                  }
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none"
                />

                {/* Audio Output Status Indicator */}
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, voiceOutputEnabled: !prev.voiceOutputEnabled }))
                  }
                  className={`p-2 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    settings.voiceOutputEnabled ? 'text-purple-400 hover:text-purple-300' : 'text-neutral-500 hover:text-neutral-400'
                  }`}
                  title={settings.voiceOutputEnabled ? 'Voice output enabled' : 'Voice output muted'}
                >
                  {settings.voiceOutputEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isProcessing}
                  className="p-3 rounded-xl bg-[#FA2D48] hover:bg-rose-600 disabled:opacity-40 text-white transition-all cursor-pointer shrink-0 active:scale-95 shadow-md shadow-rose-950/40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              {/* Listening Notice */}
              {isListening && (
                <div className="flex items-center justify-between text-xs px-2 text-rose-300 bg-rose-950/40 py-1 rounded-lg border border-rose-900/30">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                    Listening for voice command... (Background music ducked)
                  </span>
                  <button
                    type="button"
                    onClick={toggleListening}
                    className="font-bold underline text-[11px] cursor-pointer"
                  >
                    Finish
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUB-TAB 2: CONVERSATION HISTORY */}
        {activeSubTab === 'history' && (
          <div className="max-w-3xl w-full mx-auto p-4 sm:p-6 pb-28 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white">Conversation History</h2>
                <p className="text-xs text-neutral-400">
                  Review past interactions with JARVIS or start a new consultation
                </p>
              </div>
              <button
                onClick={handleStartNewChat}
                className="px-3.5 py-2 rounded-xl bg-[#FA2D48] hover:bg-rose-600 text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>New Consultation</span>
              </button>
            </div>

            {chatSessions.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white/5 mx-auto flex items-center justify-center text-neutral-500">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-neutral-300">No Past Sessions Yet</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  When you converse with JARVIS about music curation or play commands, your sessions will be preserved here.
                </p>
                <button
                  onClick={handleStartNewChat}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all cursor-pointer"
                >
                  Start First Chat
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {chatSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleLoadSession(session)}
                    className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="text-sm font-semibold text-white truncate group-hover:text-rose-400 transition-colors">
                        {session.title}
                      </div>
                      <div className="text-xs text-neutral-400 flex items-center gap-3 mt-1">
                        <span>{session.createdAt}</span>
                        <span>•</span>
                        <span>{session.messages.length} messages</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="p-2 rounded-xl hover:bg-white/10 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete Session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 3: AI CUSTOMISATION (VOICE & PERSONA) */}
        {activeSubTab === 'settings' && (
          <div className="max-w-3xl w-full mx-auto p-4 sm:p-6 pb-28 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">AI Customisation</h2>
              <p className="text-xs text-neutral-400">
                Tailor JARVIS's voice, responsiveness, and personality to your personal taste
              </p>
            </div>

            {/* Wake-up Phrase */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <label className="text-xs font-bold text-neutral-200 block">
                Wake-Up Phrase
              </label>
              <p className="text-xs text-neutral-400">
                The name or trigger phrase JARVIS listens for during voice commands (default: "Jarvis")
              </p>
              <input
                type="text"
                value={settings.wakePhrase}
                onChange={(e) => setSettings({ ...settings, wakePhrase: e.target.value || 'Jarvis' })}
                placeholder="Jarvis"
                className="w-full sm:w-64 h-10 px-3.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white font-medium focus:outline-none focus:border-[#FA2D48]"
              />
            </div>

            {/* Voice Selection & Soft Natural Female Voice */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-neutral-200">Natural Voice Engine</h3>
                  <p className="text-xs text-neutral-400">
                    Select a soft, natural speech voice for audio responses
                  </p>
                </div>
                <button
                  onClick={handlePreviewVoice}
                  className="px-3 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-700/40 text-purple-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Preview Voice</span>
                </button>
              </div>

              {availableVoices.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-neutral-400">Available Voices</label>
                  <select
                    value={settings.voiceName}
                    onChange={(e) => setSettings({ ...settings, voiceName: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-neutral-900 border border-white/15 text-xs text-white focus:outline-none focus:border-[#FA2D48]"
                  >
                    {availableVoices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-xs text-amber-300 bg-amber-950/40 p-3 rounded-xl border border-amber-800/30">
                  Synthesizing voices are loading or unavailable in this browser session. Default system audio will be used.
                </div>
              )}

              {/* Sliders: Volume, Rate, Pitch */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Voice Volume</span>
                    <span className="text-white font-mono font-bold">{settings.voiceVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={settings.voiceVolume}
                    onChange={(e) => setSettings({ ...settings, voiceVolume: parseInt(e.target.value, 10) })}
                    className="w-full accent-[#FA2D48] cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Speaking Rate</span>
                    <span className="text-white font-mono font-bold">{settings.speechRate.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.4"
                    step="0.05"
                    value={settings.speechRate}
                    onChange={(e) => setSettings({ ...settings, speechRate: parseFloat(e.target.value) })}
                    className="w-full accent-[#FA2D48] cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Speech Pitch</span>
                    <span className="text-white font-mono font-bold">{settings.speechPitch.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.25"
                    step="0.05"
                    value={settings.speechPitch}
                    onChange={(e) => setSettings({ ...settings, speechPitch: parseFloat(e.target.value) })}
                    className="w-full accent-[#FA2D48] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Personality Selector */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <h3 className="text-xs font-bold text-neutral-200">JARVIS Personality Mode</h3>
              <p className="text-xs text-neutral-400">
                Choose the conversational tone and style for assistant responses
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {[
                  {
                    id: 'butler',
                    name: 'Classic Butler',
                    badge: 'Recommended',
                    desc: 'Refined, articulate, ultra-polite concierge dedicated to your musical comfort.',
                  },
                  {
                    id: 'dj',
                    name: 'Vibrant DJ',
                    badge: 'Energetic',
                    desc: 'Passionate music curator with upbeat rhythmic flair and infectious vibe analysis.',
                  },
                  {
                    id: 'witty',
                    name: 'Witty & Sharp',
                    badge: 'Playful',
                    desc: 'Clever, playful humor and intelligent banter while controlling your music seamlessly.',
                  },
                  {
                    id: 'minimal',
                    name: 'Minimal & Direct',
                    badge: 'Fast',
                    desc: 'Short, precise acknowledgments without pleasantries for ultra-fast action execution.',
                  },
                ].map((mode) => {
                  const isSelected = settings.personality === mode.id;
                  return (
                    <div
                      key={mode.id}
                      onClick={() => setSettings({ ...settings, personality: mode.id as any })}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-rose-950/40 border-[#FA2D48] shadow-lg shadow-rose-950/30'
                          : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{mode.name}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                            isSelected ? 'bg-[#FA2D48] text-white' : 'bg-white/10 text-neutral-400'
                          }`}
                        >
                          {mode.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">{mode.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Smart Audio Ducking & Execution */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <h3 className="text-xs font-bold text-neutral-200">Playback Integration Controls</h3>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">Smart Audio Ducking</div>
                  <div className="text-xs text-neutral-400">
                    Automatically lower background music volume when JARVIS speaks or listens
                  </div>
                </div>
                <button
                  onClick={() =>
                    setSettings({ ...settings, audioDuckingEnabled: !settings.audioDuckingEnabled })
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    settings.audioDuckingEnabled ? 'bg-[#FA2D48]' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.audioDuckingEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <div>
                  <div className="text-xs font-semibold text-white">Auto-Execute Voice Commands</div>
                  <div className="text-xs text-neutral-400">
                    Immediately execute play, pause, shuffle, and skip actions on command
                  </div>
                </div>
                <button
                  onClick={() =>
                    setSettings({
                      ...settings,
                      musicCommandAutoExecute: !settings.musicCommandAutoExecute,
                    })
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    settings.musicCommandAutoExecute ? 'bg-[#FA2D48]' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.musicCommandAutoExecute ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 4: GEMINI API SETTINGS & DIAGNOSTICS */}
        {activeSubTab === 'gemini' && (
          <div className="max-w-3xl w-full mx-auto p-4 sm:p-6 pb-28 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Gemini API Settings</h2>
              <p className="text-xs text-neutral-400">
                Configure your Gemini credentials for JARVIS intelligence and Spotify-level smart DJ queue generation
              </p>
            </div>

            {/* Active Status Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 to-neutral-900 border border-purple-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Active Provider:</span>
                    <span className="text-purple-300">
                      {customApiKey ? 'Custom User API Key' : 'Built-in Server Environment'}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    Model: <span className="font-mono text-neutral-200">gemini-3.1-flash-lite</span> (Ultra-low latency)
                  </div>
                </div>
              </div>

              <button
                onClick={handleTestApiKey}
                disabled={apiTestStatus.loading}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                {apiTestStatus.loading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Radio className="w-3.5 h-3.5" />
                )}
                <span>Test Ping</span>
              </button>
            </div>

            {/* Diagnostic Result */}
            {apiTestStatus.tested && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
                  apiTestStatus.status === 'connected'
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      apiTestStatus.status === 'connected' ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                  <span>
                    {apiTestStatus.status === 'connected'
                      ? `Successfully connected! Latency: ${apiTestStatus.latencyMs}ms`
                      : `Connection Issue: ${apiTestStatus.error || 'Check key and permissions'}`}
                  </span>
                </div>
                <span className="font-mono text-[10px] opacity-80">{apiTestStatus.model}</span>
              </div>
            )}

            {/* Key Entry Form */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-neutral-200 block">
                    Custom Gemini API Key
                  </label>
                  <p className="text-xs text-neutral-400">
                    Enter your Gemini API key to override default rate limits and power JARVIS
                  </p>
                </div>
                {customApiKey && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                    Custom Key Saved
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="AIzaSy..."
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className="w-full h-11 pl-4 pr-12 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-[#FA2D48]"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3.5 top-3 text-neutral-400 hover:text-white cursor-pointer"
                  title={showApiKey ? 'Hide key' : 'Show key'}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {keySavedToast && (
                <div className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  <span>API Key settings updated successfully.</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveApiKey}
                  className="px-4 py-2 rounded-xl bg-[#FA2D48] hover:bg-rose-600 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
                >
                  Save & Apply Key
                </button>

                {customApiKey && (
                  <button
                    onClick={handleClearApiKey}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer"
                  >
                    Remove Custom Key
                  </button>
                )}
              </div>
            </div>

            {/* Security Notice */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 text-xs text-neutral-400">
              <div className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Security & Privacy Protocol</span>
              </div>
              <p className="leading-relaxed text-[11px]">
                Your API keys are stored in your private local browser storage and communicated securely to your private backend service via encrypted headers. All music playback continues seamlessly even if your API key expires or is temporarily offline.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
