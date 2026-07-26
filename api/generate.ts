import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runStream } from '../lib/llm';
import { recordTokens } from '../lib/tokenUsage';
import { guardApi } from '../lib/apiRateGuard';

// Streams a new app generation as Server-Sent Events:
//   {type:"code", chunk}   — incremental HTML (forward to the live preview)
//   {type:"done", result}  — final {language,name,code,explanation}
//   {type:"error", error}  — failure
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, preferredLanguage, provider, byok, images } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  // Auth + wallet kill switch + daily quota, shared with server.ts meter().
  const uid = await guardApi(req, res, 'generate', !!byok?.apiKey);
  if (!uid) return;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (msg: unknown) => res.write(`data: ${JSON.stringify(msg)}\n\n`);

  try {
    const result = await runStream(
      { kind: 'generate', prompt, preferredLanguage, provider, byok, images },
      (chunk) => send({ type: 'code', chunk }),
      (text) => send({ type: 'status', text })
    );
    if (!byok?.apiKey) await recordTokens(uid, 'generate', result.usage);
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
