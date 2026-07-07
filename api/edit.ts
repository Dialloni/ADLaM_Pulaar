import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdToken, isAdminEmail } from '../lib/firebaseAdmin';
import { runStream } from '../lib/llm';
import { recordTokens } from '../lib/tokenUsage';
import { checkRateLimit, RATE_LIMIT_MESSAGE } from '../lib/rateLimit';

// Streams an incremental edit as Server-Sent Events (same protocol as /api/generate).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers.authorization ?? '').split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  let uid: string; let email: string | undefined;
  try { const d = await verifyIdToken(token); uid = d.uid; email = d.email; } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }

  const { prompt, currentCode, history, preferredLanguage, provider, byok, images } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }
  if (!currentCode || typeof currentCode !== 'string') {
    return res.status(400).json({ error: 'currentCode is required' });
  }

  // BYOK runs on the user's own key/quota; admins are exempt — only meter requests we pay for.
  if (!byok?.apiKey && !(await isAdminEmail(email))) {
    const { ok } = await checkRateLimit(uid, 'edit');
    if (!ok) return res.status(429).json({ error: RATE_LIMIT_MESSAGE });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (msg: unknown) => res.write(`data: ${JSON.stringify(msg)}\n\n`);

  try {
    const result = await runStream(
      { kind: 'edit', prompt, currentCode, history, preferredLanguage, provider, byok, images },
      (chunk) => send({ type: 'code', chunk }),
      (text) => send({ type: 'status', text })
    );
    if (!byok?.apiKey) await recordTokens(uid, 'edit', result.usage);
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
