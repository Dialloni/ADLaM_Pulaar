import { adminDb } from './firebaseAdmin';

// Admin-flippable runtime switches, stored in Firestore config/runtime and
// toggled from the admin portal. Read on the hot path, so cached briefly —
// a flip takes effect within TTL_MS, no redeploy.
export type RuntimeConfig = {
  limitsEnabled: boolean;    // false = daily quotas OFF for everyone (open trial)
  sharedKeyEnabled: boolean; // false = our LLM keys paused; only BYOK works
};

const DEFAULTS: RuntimeConfig = { limitsEnabled: true, sharedKeyEnabled: true };
const TTL_MS = 20_000;
let cache: { at: number; cfg: RuntimeConfig } | null = null;

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.cfg;
  try {
    const snap = await adminDb().collection('config').doc('runtime').get();
    const d = snap.data() ?? {};
    // Default-on: a missing doc or field keeps limits + shared key active (safe).
    const cfg: RuntimeConfig = {
      limitsEnabled: d.limitsEnabled !== false,
      sharedKeyEnabled: d.sharedKeyEnabled !== false,
    };
    cache = { at: Date.now(), cfg };
    return cfg;
  } catch {
    // Fail toward current behavior: reuse last good, else safe defaults.
    return cache?.cfg ?? DEFAULTS;
  }
}
