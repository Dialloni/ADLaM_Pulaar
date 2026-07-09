import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdToken, isAdminEmail } from './firebaseAdmin';
import { checkRateLimit, RATE_LIMIT_MESSAGE, type RateKind } from './rateLimit';

// Auth + daily quota for the Vercel serverless AI routes (ocr/translate/
// transcribe/speak). These spend our Gemini/Anthropic credits, so they need the
// same protection server.ts gives every route via meter(). Without this, the
// Vercel deployment is an unmetered mirror of the paid endpoints.
//
// On success returns the caller's uid; on failure it writes the HTTP response
// (401/429) and returns null — the handler must `return` when it gets null.
export async function guardApi(
  req: VercelRequest,
  res: VercelResponse,
  kind: RateKind,
): Promise<string | null> {
  const token = (req.headers.authorization ?? '').split('Bearer ')[1];
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null; }

  let uid: string;
  let email: string | undefined;
  try {
    const d = await verifyIdToken(token);
    uid = d.uid;
    email = d.email;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }

  // Admins are exempt from the free-tier cap (parity with server.ts meter()).
  if (!(await isAdminEmail(email))) {
    const { ok } = await checkRateLimit(uid, kind);
    if (!ok) { res.status(429).json({ error: RATE_LIMIT_MESSAGE }); return null; }
  }

  return uid;
}
