import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let aiStatus: 'ok' | 'degraded' | 'down' = 'down';
  let aiLatencyMs = 0;

  if (ai && GEMINI_API_KEY) {
    try {
      const t0 = Date.now();
      await ai.models.generateContent({
        model: MODEL,
        contents: 'ping',
        config: { maxOutputTokens: 4 },
      });
      aiLatencyMs = Date.now() - t0;
      aiStatus = aiLatencyMs < 5000 ? 'ok' : 'degraded';
    } catch {
      aiStatus = 'degraded';
    }
  }

  return res.json({
    server: 'ok',
    model: MODEL,
    hasKey: Boolean(GEMINI_API_KEY),
    ai: aiStatus,
    aiLatencyMs,
    timestamp: new Date().toISOString(),
  });
}
