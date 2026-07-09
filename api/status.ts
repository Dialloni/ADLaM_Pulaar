import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// This endpoint is intentionally unauthenticated (a public health check), so it
// must NOT call the model — an anonymous flood would otherwise spend our key and
// exhaust the shared Gemini quota. Report readiness from config only.
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return res.json({
    server: 'ok',
    model: MODEL,
    hasKey: Boolean(GEMINI_API_KEY),
    ai: GEMINI_API_KEY ? 'ok' : 'down',
    aiLatencyMs: 0,
    timestamp: new Date().toISOString(),
  });
}
