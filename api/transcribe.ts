import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { audio, mimeType, language } = req.body ?? {};
  if (!audio || !mimeType) {
    return res.status(400).json({ error: 'audio and mimeType required' });
  }
  if (!ai) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: {
        parts: [
          { inlineData: { data: audio, mimeType } },
          {
            text: `Transcribe this audio exactly as spoken${language ? ` in ${language}` : ''}. Return only the transcribed text, no commentary.`,
          },
        ],
      },
    });
    return res.json({ text: response.text?.trim() || '' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
}
