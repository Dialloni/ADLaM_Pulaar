import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdToken } from '../lib/firebaseAdmin';
import { chatStream } from '../lib/llm';

// Streams a conversational answer (chat mode — no app generation) as SSE:
//   {type:"token", text}   — incremental answer text
//   {type:"done", text}    — full answer
//   {type:"error", error}  — failure
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers.authorization ?? '').split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { await verifyIdToken(token); } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }

  const { prompt, history, currentCode, preferredLanguage, provider } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (msg: unknown) => res.write(`data: ${JSON.stringify(msg)}\n\n`);

  try {
    const text = await chatStream(
      { prompt, history, currentCode, preferredLanguage, provider },
      (chunk) => send({ type: 'token', text: chunk })
    );
    send({ type: 'done', text });
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRate = /429|quota|rate|RESOURCE_EXHAUSTED|overloaded/i.test(msg);
    send({
      type: 'error',
      error: isRate ? "You've reached the AI limit. Please wait a minute and try again." : msg,
    });
    res.end();
  }
}
