import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdToken } from '../lib/firebaseAdmin';
import { translateText } from '../lib/llm';

// Translates short UI text (e.g. a community template's prompt) into a target
// language. Non-streaming JSON: { translation }.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers.authorization ?? '').split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { await verifyIdToken(token); } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }

  const { text, targetLanguage } = req.body ?? {};
  if (!text || typeof text !== 'string' || !targetLanguage || typeof targetLanguage !== 'string') {
    return res.status(400).json({ error: 'text and targetLanguage are required' });
  }

  try {
    const translation = await translateText(text, targetLanguage);
    res.json({ translation });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
