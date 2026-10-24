import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { YouTubeService } from './src/server/youtubeService';
import { GeminiService } from './src/server/geminiService';
import { RateLimiter } from './src/server/security';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Security & Rate Limiting
  const rateLimiter = new RateLimiter(60000, 120); // 120 req / min

  // Initialize YouTube core service & Gemini AI DJ
  const youtubeService = new YouTubeService();
  const geminiService = new GeminiService();

  // 1. Health Status Endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      system: 'YouTube Application Service',
      version: '3.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // 2. YouTube Search Autocomplete / Suggestions Endpoint
  app.get('/api/youtube/suggestions', rateLimiter.middleware(120), async (req: Request, res: Response) => {
    const query = (req.query.q as string) || '';
    if (!query.trim()) {
      return res.json({ suggestions: [] });
    }
    try {
      const suggestUrl = `https://suggestqueries-clients6.youtube.com/complete/search?client=chrome&q=${encodeURIComponent(
        query.trim()
      )}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(suggestUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && Array.isArray(data[1])) {
          return res.json({ suggestions: data[1].slice(0, 8) });
        }
      }
      return res.json({ suggestions: [] });
    } catch {
      return res.json({ suggestions: [] });
    }
  });

  // 3. YouTube Real-time Video Search Endpoint
  app.get('/api/youtube/search', rateLimiter.middleware(80), async (req: Request, res: Response) => {
    const rawQuery = (req.query.q as string) || '';
    const limit = parseInt((req.query.limit as string) || '24', 10);

    try {
      const videos = await youtubeService.search(rawQuery, isNaN(limit) ? 24 : limit);
      res.setHeader('Cache-Control', 'public, max-age=180');
      return res.json({ query: rawQuery, videos });
    } catch (err: any) {
      console.error('[API /api/youtube/search Error]:', err.message);
      return res.status(500).json({
        error: 'YouTube Search Failed',
        message: err.message || 'Failed to search YouTube videos.',
        videos: [],
      });
    }
  });

  // 4. YouTube Real-time Trending & Category Feed Endpoint
  app.get('/api/youtube/trending', rateLimiter.middleware(80), async (req: Request, res: Response) => {
    const category = (req.query.category as string) || 'trending';

    try {
      const videos = await youtubeService.getTrending(category);
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.json({ category, videos });
    } catch (err: any) {
      console.error('[API /api/youtube/trending Error]:', err.message);
      return res.status(500).json({
        error: 'YouTube Trending Failed',
        message: err.message || 'Failed to retrieve YouTube trending videos.',
        videos: [],
      });
    }
  });

  // 5. Gemini AI Music Recommendation Agent Endpoint
  app.post('/api/ai/recommendations', rateLimiter.middleware(60), async (req: Request, res: Response) => {
    const { currentTrack, historyIds, catalog } = req.body;
    const customKey = (req.headers['x-gemini-key'] as string) || undefined;
    if (!currentTrack || !currentTrack.id) {
      return res.status(400).json({ error: 'currentTrack with id is required' });
    }

    try {
      const recommendations = await geminiService.getSmartRecommendations(
        currentTrack,
        Array.isArray(historyIds) ? historyIds : [],
        Array.isArray(catalog) ? catalog : [],
        customKey
      );
      res.setHeader('Cache-Control', 'public, max-age=180');
      return res.json(recommendations);
    } catch (err: any) {
      console.error('[API /api/ai/recommendations Error]:', err.message);
      return res.status(500).json({
        error: 'Recommendation Generation Failed',
        message: err.message || 'Failed to generate recommendations.',
      });
    }
  });

  // 6. JARVIS Conversational AI & Voice Command Endpoint
  app.post('/api/ai/chat', rateLimiter.middleware(60), async (req: Request, res: Response) => {
    const { message, history, currentTrack, isPlaying, catalog, personality } = req.body;
    const customKey = (req.headers['x-gemini-key'] as string) || undefined;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message string is required' });
    }

    try {
      const result = await geminiService.chatWithJarvis(
        message,
        Array.isArray(history) ? history : [],
        currentTrack || null,
        Boolean(isPlaying),
        Array.isArray(catalog) ? catalog : [],
        typeof personality === 'string' ? personality : 'butler',
        customKey
      );
      return res.json(result);
    } catch (err: any) {
      console.error('[API /api/ai/chat Error]:', err.message);
      return res.status(500).json({
        error: 'Jarvis Assistant Failed',
        message: err.message || 'Failed to process assistant request.',
      });
    }
  });

  // 7. Gemini API Connection Test & Diagnostics Endpoint
  app.get('/api/ai/test', rateLimiter.middleware(30), async (req: Request, res: Response) => {
    const customKey = (req.headers['x-gemini-key'] as string) || undefined;
    try {
      const testResult = await geminiService.testConnection(customKey);
      return res.json(testResult);
    } catch (err: any) {
      return res.status(500).json({
        status: 'error',
        model: 'gemini-3.1-flash-lite',
        latencyMs: 0,
        error: err.message || 'Test execution error',
      });
    }
  });

  // Serve Frontend
  if (!isProduction) {
    // Development mode: Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: static dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[YouTube App Server] Running on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`
    );
  });
}

startServer().catch((err) => {
  console.error('[YouTube App Server] Fatal initialization error:', err);
  process.exit(1);
});
