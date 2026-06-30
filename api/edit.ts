import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdToken } from '../lib/firebaseAdmin';
import { runStream } from '../lib/llm';

// Streams an incremental edit as Server-Sent Events (same protocol as /api/generate).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers.authorization ?? '').split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { await verifyIdToken(token); } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }

  const { prompt, currentCode, history, preferredLanguage, provider, images } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }
  if (!currentCode || typeof currentCode !== 'string') {
    return res.status(400).json({ error: 'currentCode is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (msg: unknown) => res.write(`data: ${JSON.stringify(msg)}\n\n`);

  try {
    const result = await runStream(
      { kind: 'edit', prompt, currentCode, history, preferredLanguage, provider, images },
      (chunk) => send({ type: 'code', chunk }),
      (text) => send({ type: 'status', text })
    );
    send({ type: 'done', result });
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRate = /429|quota|rate|RESOURCE_EXHAUSTED|overloaded/i.test(msg);
    send({
      type: 'error',
      error: isRate
        ? "You've reached the AI generation limit. Please wait a minute and try again."
        : msg,
    });
    res.end();
  }
}
