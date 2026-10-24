import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Music, 
  Tv, 
  Layers, 
  Zap, 
  ChevronRight, 
  Radio, 
  CheckCircle2, 
  X,
  Volume2
} from 'lucide-react';

interface AppleWelcomeScreenProps {
  isOpen: boolean;
  onDismiss: () => void;
}

export const AppleWelcomeScreen: React.FC<AppleWelcomeScreenProps> = ({
  isOpen,
  onDismiss,
}) => {
  const [step, setStep] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      const timer = setTimeout(() => setStep(1), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  return (
    <div 
      className={`fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-2xl transition-opacity duration-300 select-none ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))',
      }}
    >
      {/* Background Animated Gradient Mesh */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-gradient-to-br from-[#FA2D48]/50 via-rose-600/30 to-transparent blur-3xl animate-ambient-glow" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-gradient-to-tl from-purple-600/50 via-blue-600/25 to-transparent blur-3xl animate-ambient-aurora" />
      </div>

      {/* Main Apple Modal Card */}
      <div 
        className={`relative w-full max-w-lg rounded-[32px] sm:rounded-[38px] bg-[#16161b]/90 border border-white/25 shadow-[0_25px_80px_rgba(0,0,0,0.95)] backdrop-blur-3xl flex flex-col max-h-[92vh] overflow-hidden transform transition-all duration-300 ${
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* Top Dismiss Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer border border-white/10"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Scrollable Content */}
        <div className="p-6 sm:p-8 overflow-y-auto no-scrollbar space-y-6">
          {/* Animated Apple Music Hero Icon */}
          <div className="flex flex-col items-center text-center space-y-3 pt-2">
            <div className="relative group">
              {/* Outer pulsing radiant ring */}
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-[#FA2D48] via-rose-500 to-purple-600 opacity-75 blur-xl group-hover:opacity-100 animate-pulse transition-opacity" />
              
              {/* Apple Music Logo Box */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-[#FA2D48] via-[#FF3355] to-rose-700 flex items-center justify-center shadow-2xl border border-white/30 transform transition-transform group-hover:scale-105">
                <Music className="w-10 h-10 sm:w-12 sm:h-12 text-white fill-white drop-shadow-md" />
                <Sparkles className="w-5 h-5 text-amber-300 absolute -top-1.5 -right-1.5 animate-bounce" />
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-bold tracking-widest uppercase text-rose-400 bg-rose-950/70 px-3 py-1 rounded-full border border-rose-800/40 inline-block">
                Apple Music Experience
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                Welcome to <span className="bg-gradient-to-r from-white via-rose-100 to-rose-400 bg-clip-text text-transparent">Music</span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-200 max-w-sm mx-auto font-medium leading-relaxed">
                Experience high-fidelity streaming, full-screen ambient lighting, and liquid glass design crafted for any device.
              </p>
            </div>
          </div>

          {/* Feature Highlights Grid */}
          <div className="space-y-3 pt-1">
            {/* Feature 1 */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.08] border border-white/15 hover:border-white/25 transition-all flex items-start gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#FA2D48] flex items-center justify-center shrink-0 shadow-md">
                <Music className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Over 100 Million Songs &amp; Hits
                </h3>
                <p className="text-xs text-zinc-300 leading-snug mt-0.5">
                  Stream Billboard Hot 100 hits, curated radio stations, and search anything instantly powered by YouTube.
                </p>
              </div>
            </div>

            {/* Feature 2: Ambient Lighting */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.08] border border-white/15 hover:border-white/25 transition-all flex items-start gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shrink-0 shadow-md">
                <Tv className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                  Full-Screen Ambient Lighting
                  <span className="text-[9px] font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-700/40">NEW</span>
                </h3>
                <p className="text-xs text-zinc-300 leading-snug mt-0.5">
                  Real-time video plays blurred in the background with bright, dynamic liquid glass reflections that match the beat.
                </p>
              </div>
            </div>

            {/* Feature 3: Liquid Glass on Any Screen */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.08] border border-white/15 hover:border-white/25 transition-all flex items-start gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Liquid Glass for Any Screen
                </h3>
                <p className="text-xs text-zinc-300 leading-snug mt-0.5">
                  Ultra-smooth on phones, tablets, and desktops with bright high-contrast typography and fluid gestures.
                </p>
              </div>
            </div>

            {/* Feature 4: Netlify Ready */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.08] border border-white/15 hover:border-white/25 transition-all flex items-start gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-md">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Netlify Ready &amp; Offline Resilient
                </h3>
                <p className="text-xs text-zinc-300 leading-snug mt-0.5">
                  Instant catalog caching and fallback so your listening experience is completely uninterrupted.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA Bar */}
        <div className="p-5 sm:p-6 border-t border-white/15 bg-white/[0.04] flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleClose}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#FA2D48] via-rose-600 to-[#FA2D48] hover:opacity-95 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span>Start Listening Now</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
