import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 32768;

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const SYSTEM_PROMPT = `You are Gando AI, an African-language-first AI app builder.

Given a user prompt in ANY language (especially African languages like Fulani/Pulaar in ADLaM script, Swahili, Yoruba, Wolof, Amharic, Zulu, Hausa, Igbo, Bambara, Fon):

1. DETECT the language of the user's prompt.
2. GENERATE a complete, polished, production-looking single-file web app (HTML + Tailwind CSS via CDN + vanilla JavaScript).
3. All user-facing TEXT MUST be in the detected language.
4. Produce a short catchy project NAME in the detected language.
5. Produce a short beginner-friendly EXPLANATION in the detected language (3-5 sentences).

Incremental edits:
- If "Current Code" is provided, make MINIMAL changes. Preserve layout, colors, structure. Only change what the user asked for.

ADLaM (Fulani) rules — CRITICAL:
- If the detected language is Fulani/Pulaar, render ALL text using ONLY characters from the ADLaM Unicode block (U+1E900–U+1E95F).
- Include in <head>: <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Adlam&display=swap" rel="stylesheet">

Return strict JSON with keys: language, name, code, explanation. No markdown fences.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    language: { type: Type.STRING },
    name: { type: Type.STRING },
    code: { type: Type.STRING },
    explanation: { type: Type.STRING },
  },
  required: ['language', 'name', 'code', 'explanation'],
};

async function callGemini(userContent: string) {
  if (!ai) throw new Error('GEMINI_API_KEY is not configured on the server.');
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: userContent,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.8,
    },
  });
  const text = response.text?.trim() || '';
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, currentCode, history, preferredLanguage } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }
  if (!currentCode || typeof currentCode !== 'string') {
    return res.status(400).json({ error: 'currentCode is required' });
  }

  try {
    const trimmedHistory = Array.isArray(history) ? history.slice(-6) : [];
    const historyText = trimmedHistory
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join('\n');
    const hint = preferredLanguage
      ? `Preferred output language: ${preferredLanguage}\n\n`
      : '';
    const userContent = `${hint}Current Code:\n${currentCode}\n\nRecent Chat:\n${historyText}\n\nUser Request:\n${prompt}`;
    const result = await callGemini(userContent);
    return res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRate = /429|quota|rate|RESOURCE_EXHAUSTED/i.test(msg);
    return res.status(isRate ? 429 : 500).json({
      error: isRate
        ? "You've reached the AI generation limit. Please wait a minute and try again."
        : msg,
    });
  }
}
