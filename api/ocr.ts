import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { verifyIdToken } from '../lib/firebaseAdmin';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const OCR_PROMPT = `Extract ALL text from this document. It may contain ADLaM script (Fulani/Pulaar, Unicode block U+1E900–U+1E95F), French, Arabic, or Latin text.

Output the extracted text exactly as it appears, preserving:
- ADLaM characters in Unicode (𞤀-𞥋 range) — do NOT convert to Latin
- Line breaks where they occur in the document
- Paragraph structure

If the document contains a mix of scripts, include all of it.
Output ONLY the extracted text, nothing else.`;

async function callWithRetry(imageBase64: string, mimeType: string, retries = 3): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: imageBase64 } },
              { text: OCR_PROMPT },
            ],
          },
        ],
      });
      return result.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = /429|quota|rate|RESOURCE_EXHAUSTED|Too Many/i.test(msg);
      if (is429 && attempt < retries) {
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

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await verifyIdToken(auth.slice(7));
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { imageBase64, mimeType = 'image/png' } = req.body as {
    imageBase64: string;
    mimeType?: string;
  };

  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

  try {
    const text = await callWithRetry(imageBase64, mimeType);
    res.json({ text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = /429|quota|rate|RESOURCE_EXHAUSTED|Too Many/i.test(msg);
    const isTooLarge = /too large|size|413|payload/i.test(msg);
    const isTimeout = /timeout|deadline/i.test(msg);
    let friendly = msg;
    if (is429)     friendly = 'Gemini rate limit hit — wait 30 seconds and try again.';
    if (isTooLarge) friendly = 'PDF too large for OCR — try splitting into smaller files (under 15MB).';
    if (isTimeout)  friendly = 'OCR timed out — PDF may be too long. Try fewer pages at once.';
    res.status(is429 ? 429 : 500).json({ error: friendly });
  }
}
