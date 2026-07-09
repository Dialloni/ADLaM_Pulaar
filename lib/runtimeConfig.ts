import { adminDb } from './firebaseAdmin';

// Admin-flippable runtime switches, stored in Firestore config/runtime and
// toggled from the admin portal. Read on the hot path, so cached briefly —
// a flip takes effect within TTL_MS, no redeploy.
export type RuntimeConfig = {
  limitsEnabled: boolean;    // false = daily quotas OFF for everyone (open trial)
  sharedKeyEnabled: boolean; // false = our LLM keys paused; only BYOK works
  spendAlertUsd: number;     // daily $ ceiling for the Telegram spend alert
};

// Env is the fallback; the Firestore config/runtime doc (set via the /setlimit
// bot command or admin portal) overrides it with no redeploy.
const ENV_SPEND = Number((process.env.SPEND_ALERT_USD || '5').replace(/['"]/g, '')) || 5;
const DEFAULTS: RuntimeConfig = { limitsEnabled: true, sharedKeyEnabled: true, spendAlertUsd: ENV_SPEND };
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
      spendAlertUsd: typeof d.spendAlertUsd === 'number' && d.spendAlertUsd > 0 ? d.spendAlertUsd : ENV_SPEND,
    };
    cache = { at: Date.now(), cfg };
    return cfg;
  } catch {
    // Fail toward current behavior: reuse last good, else safe defaults.
    return cache?.cfg ?? DEFAULTS;
  }
}
