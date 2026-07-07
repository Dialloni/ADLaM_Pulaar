import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { verifyIdToken } from '../lib/firebaseAdmin.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
// OCR uses a stronger vision model — flash hallucinates on ADLaM.
const MODEL = (process.env.GEMINI_OCR_MODEL || 'gemini-2.5-pro').replace(/['"]/g, '');

const OCR_PROMPT = `You are a precise OCR engine. Transcribe the text in this image EXACTLY as printed.

The image/PDF may contain ADLaM script (Fulani/Pulaar, Unicode block U+1E900–U+1E95F), French, Arabic, or Latin text. ADLaM is right-to-left with rounded/curved glyphs.

Rules:
- Output ADLaM as real Unicode codepoints in U+1E900–U+1E95F (𞤀 𞤁 𞤂 … 𞥋). Do NOT romanize/transliterate to Latin, and do NOT output Arabic codepoints or presentation forms.
- Transcribe ONLY what is clearly visible. Do NOT guess, autocomplete, correct, translate, or invent words. If a word or line is blurry or unreadable, skip it rather than making something up.
- Preserve line breaks and paragraph structure. Keep French/Latin/Arabic passages as-is.

Output ONLY the transcribed text. If the image has no readable text, output nothing.`;

async function generateOcr(base64: string, mimeType: string): Promise<string> {
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: MODEL,
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: OCR_PROMPT },
          ],
        }],
        config: {
          // temperature 0 = deterministic transcription, less hallucination.
          // (Pro is the accuracy path; let it think as needed.)
          temperature: 0,
        },
      });
      // @google/genai: text is a getter on the response, NOT response.candidates
      return result.text?.trim() ?? '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = /429|quota|rate|RESOURCE_EXHAUSTED|Too Many/i.test(msg);
      if (is429 && attempt < 3) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  return '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await verifyIdToken(auth.slice(7));
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { fileUrl, imageBase64, mimeType = 'application/pdf' } = req.body as {
    fileUrl?: string;
    imageBase64?: string;
    mimeType?: string;
  };

  try {
    let base64: string;

    if (fileUrl) {
      // Server-side fetch from Firebase Storage — no Vercel inbound body limit
      const fetchRes = await fetch(fileUrl);
      if (!fetchRes.ok) {
        throw new Error(`Could not fetch file from Storage (${fetchRes.status} ${fetchRes.statusText})`);
      }
      const buffer = Buffer.from(await fetchRes.arrayBuffer());
      const sizeMB = buffer.length / (1024 * 1024);
      if (sizeMB > 18) {
        throw new Error(`PDF is ${sizeMB.toFixed(1)}MB — too large for inline OCR (max ~18MB). Split into smaller files.`);
      }
      base64 = buffer.toString('base64');
    } else if (imageBase64) {
      base64 = imageBase64;
    } else {
      return res.status(400).json({ error: 'fileUrl or imageBase64 required' });
    }

    const text = await generateOcr(base64, mimeType);
    if (!text) {
      return res.status(422).json({ error: 'Gemini returned no text — document may have no readable content.' });
    }
    res.json({ text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[OCR] error:', msg);
    const is429 = /429|quota|rate|RESOURCE_EXHAUSTED|Too Many/i.test(msg);
    const isTimeout = /timeout|deadline/i.test(msg);
    let friendly = msg || 'Unknown OCR error';
    if (is429)     friendly = 'Gemini rate limit hit — wait 30 seconds and try again.';
    if (isTimeout) friendly = 'OCR timed out — PDF may be too long. Try fewer pages.';
    res.status(is429 ? 429 : 500).json({ error: friendly });
  }
}
