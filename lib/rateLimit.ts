import { adminDb } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// Daily per-user quotas for routes that spend our LLM credits.
// BYOK requests (user's own API key) are exempt — callers skip the check.
const DAILY_LIMITS = {
  generate: 30,
  edit: 100,
  chat: 150,
} as const;

export type RateKind = keyof typeof DAILY_LIMITS;

export const RATE_LIMIT_MESSAGE =
  'Daily free limit reached. It resets at midnight UTC — or add your own API key (BYOK) for unlimited use.';

// One Firestore doc per user/day/kind, atomically incremented.
// Fail-open: a quota-check outage must never block legitimate use.
export async function checkRateLimit(
  uid: string,
  kind: RateKind,
): Promise<{ ok: boolean; remaining: number }> {
  const day = new Date().toISOString().slice(0, 10);
  const ref = adminDb().collection('usage').doc(`${uid}_${day}_${kind}`);
  try {
    const count = await adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const n = ((snap.data()?.count as number) ?? 0) + 1;
      tx.set(ref, { uid, day, kind, count: n, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return n;
    });
    const limit = DAILY_LIMITS[kind];
    return { ok: count <= limit, remaining: Math.max(0, limit - count) };
  } catch {
    return { ok: true, remaining: -1 };
  }
}
