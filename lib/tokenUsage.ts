import { adminDb } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import type { TokenUsage } from './llm';
import { sendAlert } from './alert';

// Rough blended $/1M tokens by model family — for the spend ALERT only, NOT
// billing. Deliberately on the high side so the warning fires early, not late.
const RATE_PER_MTOK: Array<[RegExp, number]> = [
  [/haiku/i, 2],
  [/sonnet/i, 9],
  [/opus/i, 45],
  [/gemini.*pro|2\.5-pro/i, 5],
  [/flash/i, 0.3],
  [/gpt|deepseek|groq|llama|qwen|mistral/i, 1],
];
const DEFAULT_RATE = 5;

function estimateUsd(byModel: Record<string, unknown>, total: number): number {
  const entries = byModel ? Object.entries(byModel) : [];
  if (entries.length === 0) return (total / 1e6) * DEFAULT_RATE;
  let usd = 0;
  for (const [model, toks] of entries) {
    const rate = RATE_PER_MTOK.find(([re]) => re.test(model))?.[1] ?? DEFAULT_RATE;
    usd += (Number(toks) / 1e6) * rate;
  }
  return usd;
}

// Daily spend ceiling (USD, our keys only). Alerts once/day when first crossed.
const SPEND_ALERT_USD = Number((process.env.SPEND_ALERT_USD || '5').replace(/['"]/g, '')) || 5;

async function maybeAlertSpend(day: string): Promise<void> {
  try {
    const ref = adminDb().collection('usage_tokens').doc(day);
    const usd = await adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const d = snap.data() || {};
      if (d.spendAlertSent) return null; // already warned today
      const est = estimateUsd(d.byModel as Record<string, unknown>, Number(d.total || 0));
      if (est < SPEND_ALERT_USD) return null;
      tx.set(ref, { spendAlertSent: true, spendAlertUsd: est }, { merge: true });
      return est;
    });
    if (usd != null) {
      await sendAlert(
        `⚠ Gando spend alert\nEstimated $${usd.toFixed(2)} in AI usage today (${day}) — over your $${SPEND_ALERT_USD} limit.\nOpen the admin Usage tab; flip the shared-key kill-switch in Controls if this is abuse.`,
      );
    }
  } catch (e) {
    console.error('maybeAlertSpend failed:', e);
  }
}

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
    // After the totals update, warn once if today crossed the spend ceiling.
    await maybeAlertSpend(day);
  } catch (e) {
    console.error('recordTokens failed:', e);
  }
}
