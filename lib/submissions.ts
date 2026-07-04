// Form submissions from PUBLISHED apps: a public endpoint (visitors are not
// Gando users) writing to projects/<id>/submissions via the Admin SDK.
// Client rules deny create — only this server path can write.
import crypto from 'crypto';
import { adminDb } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const MAX_FIELDS = 20;
const MAX_KEY = 40;
const MAX_VAL = 1000;
const MAX_TOTAL = 4096;      // whole payload cap (bytes, roughly)
const PER_IP_DAY = 20;       // per visitor per project
const PER_PROJECT_DAY = 200; // per project

export type SubmitResult = { ok: true } | { ok: false; status: number; error: string };

export async function storeSubmission(
  projectId: string,
  body: unknown,
  ip: string | undefined,
  userAgent: string | undefined,
): Promise<SubmitResult> {
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(projectId)) return { ok: false, status: 400, error: 'Bad project id' };
  const b = (body ?? {}) as Record<string, unknown>;

  // Honeypot: bots fill every input. Pretend success so they don't adapt.
  if (typeof b._gotcha === 'string' && b._gotcha.trim() !== '') return { ok: true };

  const raw = b.fields;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, status: 400, error: 'fields object is required' };
  }
  const fields: Record<string, string> = {};
  let total = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(fields).length >= MAX_FIELDS) break;
    const key = String(k).slice(0, MAX_KEY);
    const val = String(v ?? '').slice(0, MAX_VAL);
    total += key.length + val.length;
    if (total > MAX_TOTAL) return { ok: false, status: 413, error: 'Submission too large' };
    fields[key] = val;
  }
  if (Object.keys(fields).length === 0) return { ok: false, status: 400, error: 'Empty submission' };

  const db = adminDb();
  const proj = await db.collection('projects').doc(projectId).get();
  if (!proj.exists || proj.data()?.published !== true) {
    return { ok: false, status: 404, error: 'App is not published' };
  }

  // Daily caps (per visitor-IP and per project). Fail-open: a counter outage
  // must never eat a real customer's order. IPs stored only as a short hash.
  const day = new Date().toISOString().slice(0, 10);
  const ipHash = crypto.createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 16);
  try {
    const ipRef = db.collection('usage').doc(`submit_${projectId}_${ipHash}_${day}`);
    const allRef = db.collection('usage').doc(`submit_${projectId}_all_${day}`);
    const allowed = await db.runTransaction(async (tx) => {
      const [a, b2] = await Promise.all([tx.get(ipRef), tx.get(allRef)]);
      const na = ((a.data()?.count as number) ?? 0) + 1;
      const nb = ((b2.data()?.count as number) ?? 0) + 1;
      tx.set(ipRef, { count: na, day, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(allRef, { count: nb, day, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return na <= PER_IP_DAY && nb <= PER_PROJECT_DAY;
    });
    if (!allowed) return { ok: false, status: 429, error: 'Too many submissions today — try again tomorrow' };
  } catch { /* fail-open */ }

  await db.collection('projects').doc(projectId).collection('submissions').add({
    fields,
    createdAt: FieldValue.serverTimestamp(),
    ua: String(userAgent ?? '').slice(0, 200),
  });
  return { ok: true };
}
