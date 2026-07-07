import { adminDb } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import type { TokenUsage } from './llm';

// Persist token spend so the admin portal can show what's happening in the
// backend without digging through provider dashboards. Two docs per write:
//   usage_tokens/<day>          — global daily totals (by model, by route)
//   usage_tokens/<day>_<uid>    — per-user daily totals
// Best-effort: a logging failure must never break the user's request.
export async function recordTokens(
  uid: string,
  kind: string,
  usage: TokenUsage | undefined,
): Promise<void> {
  if (!usage) return;
  const { inTok = 0, outTok = 0, model = 'unknown' } = usage;
  if (inTok === 0 && outTok === 0) return;
  const total = inTok + outTok;
  const day = new Date().toISOString().slice(0, 10);
  try {
    const col = adminDb().collection('usage_tokens');
    await Promise.all([
      col.doc(day).set({
        day,
        inTok: FieldValue.increment(inTok),
        outTok: FieldValue.increment(outTok),
        total: FieldValue.increment(total),
        calls: FieldValue.increment(1),
        byModel: { [model]: FieldValue.increment(total) },
        byKind: { [kind]: FieldValue.increment(total) },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
      col.doc(`${day}_${uid}`).set({
        day,
        uid,
        inTok: FieldValue.increment(inTok),
        outTok: FieldValue.increment(outTok),
        total: FieldValue.increment(total),
        calls: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
    ]);
  } catch (e) {
    console.error('recordTokens failed:', e);
  }
}
