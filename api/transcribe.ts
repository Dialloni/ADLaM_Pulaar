import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { verifyIdToken } from '../lib/firebaseAdmin';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers.authorization ?? '').split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { await verifyIdToken(token); } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }

  const { audio, mimeType, language, languageCode } = req.body ?? {};
  if (!audio || !mimeType) {
    return res.status(400).json({ error: 'audio and mimeType required' });
  }
  if (!ai) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const isAdlam = languageCode === 'ff-adlm';
  const prompt = isAdlam
    ? `Transcribe this spoken Pulaar (Fulani/Fulfulde) audio. You MUST output the transcription exclusively in ADLaM script (Unicode block U+1E900–U+1E95F). Do NOT use Latin letters, romanized Pulaar, or any other script. ADLaM is written right-to-left. If a word is unclear, approximate it in ADLaM characters. Return only the ADLaM transcription, nothing else.`
    : `Transcribe this audio exactly as spoken${language ? ` in ${language}` : ''}. Return only the transcribed text, no commentary.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: {
        parts: [
          { inlineData: { data: audio, mimeType } },
          { text: prompt },
        ],
      },
    });
    return res.json({ text: response.text?.trim() || '' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
}
