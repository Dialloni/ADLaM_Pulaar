import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdToken, isAdminEmail } from './firebaseAdmin';
import { checkRateLimit, RATE_LIMIT_MESSAGE, type RateKind } from './rateLimit';
import { getRuntimeConfig } from './runtimeConfig';

export const SHARED_KEY_PAUSED_MESSAGE =
  'Gando is paused for maintenance. Add your own API key (BYOK) in Settings to keep building.';

// Auth + kill switches + daily quota for the Vercel serverless AI routes. These
// spend our Gemini/Anthropic credits, so they need the same protection server.ts
// gives every route via meter(). Without this, the Vercel deployment is an
// unmetered mirror of the paid endpoints — and, before the runtime-config check
// below, one the admin wallet kill switch could not stop.
//
// On success returns the caller's uid; on failure it writes the HTTP response
// (401/429/503) and returns null — the handler must `return` when it gets null.
export async function guardApi(
  req: VercelRequest,
  res: VercelResponse,
  kind: RateKind,
  byok = false,
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

  // Runtime kill switches (config/runtime), same order as server.ts meter():
  // our keys off + not BYOK blocks everyone — that is the wallet kill switch,
  // and it has to hold on BOTH deployments or flipping it just moves the spend.
  const cfg = await getRuntimeConfig();
  if (!cfg.sharedKeyEnabled && !byok) {
    res.status(503).json({ error: SHARED_KEY_PAUSED_MESSAGE });
    return null;
  }
  if (byok) return uid;

  // Admins are exempt from the free-tier cap (parity with server.ts meter()).
  if (!cfg.limitsEnabled) return uid; // caps globally lifted
  if (!(await isAdminEmail(email))) {
    const { ok } = await checkRateLimit(uid, kind);
    if (!ok) { res.status(429).json({ error: RATE_LIMIT_MESSAGE }); return null; }
  }

  return uid;
}
