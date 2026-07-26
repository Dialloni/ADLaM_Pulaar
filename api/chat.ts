import type { VercelRequest, VercelResponse } from '@vercel/node';
import { chatStream } from '../lib/llm';
import type { TokenUsage } from '../lib/llm';
import { recordTokens } from '../lib/tokenUsage';
import { guardApi } from '../lib/apiRateGuard';

// Streams a conversational answer (chat mode — no app generation) as SSE:
//   {type:"token", text}   — incremental answer text
//   {type:"done", text}    — full answer
//   {type:"error", error}  — failure
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, history, currentCode, preferredLanguage, provider, byok, images } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  // Auth + wallet kill switch + daily quota, shared with server.ts meter().
  const uid = await guardApi(req, res, 'chat', !!byok?.apiKey);
  if (!uid) return;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (msg: unknown) => res.write(`data: ${JSON.stringify(msg)}\n\n`);

  try {
    let usage: TokenUsage | undefined;
    const text = await chatStream(
      { prompt, history, currentCode, preferredLanguage, provider, byok, images },
      (chunk) => send({ type: 'token', text: chunk }),
      (u) => { usage = u; },
    );
    if (!byok?.apiKey) await recordTokens(uid, 'chat', usage);
    send({ type: 'done', text, usage });
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
