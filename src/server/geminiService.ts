import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

export interface CatalogSongInput {
  id: string;
  title: string;
  artist: string;
  genre: string;
  durationFormatted?: string;
}

export interface RecommendationResponse {
  djCommentary: string;
  vibeTag: string;
  queueTrackIds: string[];
  transitionNotes: { trackId: string; reason: string }[];
  isAIPowered: boolean;
}

export interface JarvisAction {
  type: 'play_track' | 'pause' | 'resume' | 'next' | 'prev' | 'shuffle' | 'recommend_queue' | 'none';
  targetTrackId?: string;
  details?: string;
}

export interface JarvisChatResponse {
  reply: string;
  action: JarvisAction;
  isAIPowered: boolean;
}

interface CacheEntry {
  data: RecommendationResponse;
  expiresAt: number;
}

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private cache = new Map<string, CacheEntry>();
  private cacheTtlMs = 15 * 60 * 1000; // 15 minutes cache

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && !apiKey.startsWith('MY_') && apiKey.trim().length > 10) {
      try {
        this.ai = new GoogleGenAI({
          apiKey: apiKey.trim(),
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
      } catch {
        // Fallback to algorithmic flow silently
      }
    }
  }

  private getClient(apiKeyOverride?: string): GoogleGenAI | null {
    if (apiKeyOverride && apiKeyOverride.trim().length > 10 && !apiKeyOverride.startsWith('MY_')) {
      try {
        return new GoogleGenAI({
          apiKey: apiKeyOverride.trim(),
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
      } catch {
        return this.ai;
      }
    }
    return this.ai;
  }

  // 1. DJ Queue Recommendation Generator
  public async getSmartRecommendations(
    currentTrack: { id: string; title: string; artist: string; genre: string },
    historyIds: string[] = [],
    catalog: CatalogSongInput[] = [],
    apiKeyOverride?: string
  ): Promise<RecommendationResponse> {
    const historySample = historyIds.slice(0, 6).join(',');
    const cacheKey = `${currentTrack.id}_${historySample}_${apiKeyOverride ? 'custom' : 'default'}`;

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const recentSet = new Set(historyIds);
    const pool = catalog.filter((song) => song.id !== currentTrack.id);
    const unplayedPool = pool.filter((song) => !recentSet.has(song.id));
    const usablePool = unplayedPool.length >= 3 ? unplayedPool : pool;
    const client = this.getClient(apiKeyOverride);

    if (!client) {
      const fallback = this.generateFallbackRecommendations(currentTrack, usablePool, recentSet);
      this.cache.set(cacheKey, { data: fallback, expiresAt: Date.now() + this.cacheTtlMs });
      return fallback;
    }

    try {
      const simplifiedPool = usablePool.slice(0, 16).map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        genre: s.genre,
      }));

      const prompt = `You are an elite Spotify DJ and AI music curator.
Current Track: "${currentTrack.title}" by ${currentTrack.artist} (${currentTrack.genre}).
Recent History: ${historyIds.join(', ') || 'None'}.
Available Tracks: ${JSON.stringify(simplifiedPool)}.

Select 4 to 8 tracks from Available Tracks that create the smoothest musical progression.
Provide:
- djCommentary (1 short sentence describing the flow)
- vibeTag (2-3 words)
- queueTrackIds (list of IDs from Available Tracks)
- transitionNotes (array of {trackId, reason})`;

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 10000)
      );

      const generatePromise = client.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              djCommentary: {
                type: Type.STRING,
                description: 'A punchy 1-sentence DJ commentary about the sonic flow.',
              },
              vibeTag: {
                type: Type.STRING,
                description: 'A 2-3 word vibe tag.',
              },
              queueTrackIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Ordered list of track IDs.',
              },
              transitionNotes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    trackId: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ['trackId', 'reason'],
                },
              },
            },
            required: ['djCommentary', 'vibeTag', 'queueTrackIds'],
          },
        },
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const responseText = response.text?.trim();
      if (!responseText) throw new Error('Empty text');

      const parsed = JSON.parse(responseText);
      const catalogIdSet = new Set(catalog.map((c) => c.id));
      const validQueueIds = (parsed.queueTrackIds || []).filter((id: string) => catalogIdSet.has(id));

      if (validQueueIds.length >= 2) {
        const result: RecommendationResponse = {
          djCommentary: parsed.djCommentary || `Flowing smoothly from ${currentTrack.artist}'s ${currentTrack.title}.`,
          vibeTag: parsed.vibeTag || `${currentTrack.genre} Flow`,
          queueTrackIds: validQueueIds,
          transitionNotes: parsed.transitionNotes || [],
          isAIPowered: true,
        };
        this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + this.cacheTtlMs });
        return result;
      }

      throw new Error('Insufficient valid queue');
    } catch {
      const fallback = this.generateFallbackRecommendations(currentTrack, usablePool, recentSet);
      this.cache.set(cacheKey, { data: fallback, expiresAt: Date.now() + 120000 });
      return fallback;
    }
  }

  // 2. JARVIS Intelligent Voice & Conversational Assistant
  public async chatWithJarvis(
    userMessage: string,
    history: { role: string; content: string }[] = [],
    currentTrack: { id: string; title: string; artist: string; genre: string } | null,
    isPlaying: boolean,
    catalog: CatalogSongInput[] = [],
    personality: string = 'butler',
    apiKeyOverride?: string
  ): Promise<JarvisChatResponse> {
    const cleanMsg = userMessage.trim();
    const client = this.getClient(apiKeyOverride);

    // Fast-path command parser for instant action execution if Gemini is offline
    if (!client) {
      return this.ruleBasedJarvisFallback(cleanMsg, currentTrack, isPlaying, catalog, personality);
    }

    try {
      const recentTurns = history.slice(-6).map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      }));

      const simplifiedCatalog = catalog.slice(0, 18).map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        genre: s.genre,
      }));

      const currentStatusStr = currentTrack
        ? `Currently playing: "${currentTrack.title}" by ${currentTrack.artist} (${currentTrack.genre}). Playback status: ${isPlaying ? 'Active Playing' : 'Paused'}.`
        : 'No track currently active.';

      const personalityInstruction =
        personality === 'dj'
          ? 'Speak with an upbeat, energetic music curator persona, full of passion for rhythm and sonic textures.'
          : personality === 'witty'
          ? 'Speak with quick, clever humor, playful charm, and intelligent wit.'
          : personality === 'minimal'
          ? 'Be extremely concise, direct, and efficient with no fluff.'
          : 'Speak with the refined, polite, smooth elegance of Jarvis, the loyal AI assistant.';

      const systemInstruction = `You are JARVIS, an advanced AI music assistant integrated into Apple Music / Spotify Pro.
${personalityInstruction}
${currentStatusStr}

Playable Catalog:
${JSON.stringify(simplifiedCatalog)}

Capabilities:
1. Playback Control Actions:
   - If the user asks to play a specific song or artist, match the track in the Playable Catalog and set action.type to 'play_track' with targetTrackId.
   - If the user asks for a vibe or mood (e.g. "play something chill", "play relaxing music"), pick the best matching song ID from the catalog and set action.type to 'play_track'.
   - If user asks to pause/stop: action.type = 'pause'.
   - If user asks to resume/continue: action.type = 'resume'.
   - If user asks to skip/next: action.type = 'next'.
   - If user asks to go back/previous: action.type = 'prev'.
   - If user asks to shuffle: action.type = 'shuffle'.
   - If user asks to arrange/remix the queue: action.type = 'recommend_queue'.
   - Otherwise, action.type = 'none'.
2. Respond with natural, articulate spoken English. Keep the spoken reply under 2-3 sentences.`;

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      );

      const generatePromise = client.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [
          ...recentTurns,
          {
            role: 'user',
            parts: [{ text: cleanMsg }],
          },
        ],
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: "Jarvis's spoken conversational reply to the user.",
              },
              action: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description: "One of: 'play_track', 'pause', 'resume', 'next', 'prev', 'shuffle', 'recommend_queue', 'none'.",
                  },
                  targetTrackId: {
                    type: Type.STRING,
                    description: 'Matching song ID from the catalog if playing a track.',
                  },
                  details: {
                    type: Type.STRING,
                    description: 'Brief detail or reason for the action.',
                  },
                },
                required: ['type'],
              },
            },
            required: ['reply', 'action'],
          },
        },
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const text = response.text?.trim();
      if (!text) throw new Error('Empty text from Jarvis');

      const parsed = JSON.parse(text);
      return {
        reply: parsed.reply || "Right away. Let's enjoy the music.",
        action: parsed.action || { type: 'none' },
        isAIPowered: true,
      };
    } catch {
      return this.ruleBasedJarvisFallback(cleanMsg, currentTrack, isPlaying, catalog, personality);
    }
  }

  // 3. Connection Test
  public async testConnection(apiKeyOverride?: string): Promise<{ status: string; model: string; latencyMs: number; error?: string }> {
    const client = this.getClient(apiKeyOverride);
    if (!client) {
      return {
        status: 'offline',
        model: 'gemini-3.1-flash-lite',
        latencyMs: 0,
        error: apiKeyOverride ? 'Invalid or empty custom API key provided' : 'No Gemini API Key found in server environment',
      };
    }

    const start = Date.now();
    try {
      await client.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: 'Ping test',
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      });
      return {
        status: 'connected',
        model: 'gemini-3.1-flash-lite',
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        status: 'error',
        model: 'gemini-3.1-flash-lite',
        latencyMs: Date.now() - start,
        error: err.message || 'API connection test failed',
      };
    }
  }

  // Fallback rule-based parsing so playback commands never fail
  private ruleBasedJarvisFallback(
    msg: string,
    currentTrack: { id: string; title: string; artist: string; genre: string } | null,
    isPlaying: boolean,
    catalog: CatalogSongInput[],
    personality: string
  ): JarvisChatResponse {
    const lower = msg.toLowerCase();

    // Check pause
    if (lower.includes('pause') || lower.includes('stop music') || lower.includes('hold on')) {
      return {
        reply: personality === 'butler' ? 'Pausing playback for you, sir.' : 'Playback paused.',
        action: { type: 'pause' },
        isAIPowered: false,
      };
    }

    // Check resume / play
    if (lower === 'play' || lower.includes('resume') || lower.includes('continue playing')) {
      return {
        reply: personality === 'butler' ? 'Resuming playback now.' : 'Resuming music.',
        action: { type: 'resume' },
        isAIPowered: false,
      };
    }

    // Check next / skip
    if (lower.includes('next') || lower.includes('skip')) {
      return {
        reply: personality === 'butler' ? 'Skipping to the next track in your queue.' : 'Playing next track.',
        action: { type: 'next' },
        isAIPowered: false,
      };
    }

    // Check prev / back
    if (lower.includes('previous') || lower.includes('go back') || lower.includes('prev song')) {
      return {
        reply: 'Heading back to the previous track.',
        action: { type: 'prev' },
        isAIPowered: false,
      };
    }

    // Check shuffle
    if (lower.includes('shuffle')) {
      return {
        reply: 'Shuffling your upcoming queue.',
        action: { type: 'shuffle' },
        isAIPowered: false,
      };
    }

    // Check specific song or artist request in catalog
    for (const song of catalog) {
      const titleLower = song.title.toLowerCase();
      const artistLower = song.artist.toLowerCase();
      if (lower.includes(titleLower) || (lower.includes('play') && lower.includes(artistLower))) {
        return {
          reply: `Playing "${song.title}" by ${song.artist}. Enjoy the sound.`,
          action: { type: 'play_track', targetTrackId: song.id, details: song.title },
          isAIPowered: false,
        };
      }
    }

    // Check mood match
    if (lower.includes('relax') || lower.includes('chill') || lower.includes('lofi') || lower.includes('calm')) {
      const chillSong = catalog.find((s) => s.genre.toLowerCase().includes('chill') || s.genre.toLowerCase().includes('lo-fi') || s.title.toLowerCase().includes('blue')) || catalog[0];
      return {
        reply: `Here is something soothing: "${chillSong.title}" by ${chillSong.artist}.`,
        action: { type: 'play_track', targetTrackId: chillSong.id, details: 'Relaxing vibe' },
        isAIPowered: false,
      };
    }

    if (lower.includes('party') || lower.includes('dance') || lower.includes('energy') || lower.includes('upbeat')) {
      const upbeatSong = catalog.find((s) => s.genre.toLowerCase().includes('disco') || s.genre.toLowerCase().includes('pop') || s.genre.toLowerCase().includes('funk')) || catalog[1];
      return {
        reply: `Turning up the energy with "${upbeatSong.title}" by ${upbeatSong.artist}.`,
        action: { type: 'play_track', targetTrackId: upbeatSong.id, details: 'Upbeat vibe' },
        isAIPowered: false,
      };
    }

    // Generic answer
    const currentName = currentTrack ? `"${currentTrack.title}" by ${currentTrack.artist}` : 'nothing at the moment';
    return {
      reply: `At your service. You are currently listening to ${currentName}. Let me know if you would like me to play a specific song, remix the queue, or adjust your sound.`,
      action: { type: 'none' },
      isAIPowered: false,
    };
  }

  // Algorithmic musical flow fallback
  private generateFallbackRecommendations(
    current: { id: string; title: string; artist: string; genre: string },
    pool: CatalogSongInput[],
    recentSet: Set<string>
  ): RecommendationResponse {
    const currentGenreLower = current.genre.toLowerCase();

    const scored = pool.map((track) => {
      let score = 0;
      const trackGenreLower = track.genre.toLowerCase();

      if (trackGenreLower === currentGenreLower) score += 5;
      else if (
        (currentGenreLower.includes('pop') && trackGenreLower.includes('pop')) ||
        (currentGenreLower.includes('r&b') && trackGenreLower.includes('r&b')) ||
        (currentGenreLower.includes('indie') && trackGenreLower.includes('rock')) ||
        (currentGenreLower.includes('chill') && trackGenreLower.includes('lo-fi'))
      ) {
        score += 3;
      }

      if (track.artist.toLowerCase() === current.artist.toLowerCase()) score += 2;
      if (recentSet.has(track.id)) score -= 4;

      return { track, score: score + Math.random() * 0.8 };
    });

    scored.sort((a, b) => b.score - a.score);
    const chosen = scored.slice(0, 6).map((s) => s.track);

    return {
      djCommentary: `Curating a seamless ${current.genre} mix matching the energy of "${current.title}".`,
      vibeTag: `${current.genre} Session`,
      queueTrackIds: chosen.map((c) => c.id),
      transitionNotes: chosen.map((c) => ({
        trackId: c.id,
        reason: `Harmonizes with ${current.artist}'s tempo and ${current.genre} rhythm.`,
      })),
      isAIPowered: false,
    };
  }
}
