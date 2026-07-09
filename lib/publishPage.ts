// Public serving of published Gando apps (gando.../p/<projectId>).
// Shared by server.ts (dev + Railway) and api/p/[id].ts (Vercel).
import { adminDb } from './firebaseAdmin';

// Published code is USER-GENERATED HTML served from our own origin. The CSP
// sandbox directive gives the page an opaque origin: scripts run, but the page
// cannot read gando localStorage/cookies (BYOK keys, auth) of visitors who
// also use the app. Trade-off: the published page's own localStorage is
// unavailable too (in-app persistence doesn't survive on the public URL).
// NOTE: no `allow-popups-to-escape-sandbox`. With it, a published app could open
// a popup on our real origin (address bar shows the genuine domain) and phish a
// visitor's login/API key. Without it, popups stay inside the sandbox.
export const PUBLISH_CSP =
  'sandbox allow-scripts allow-forms allow-modals allow-popups';

// Small attribution badge injected at serve time — links back to the Gando
// origin the page is hosted on (domain-agnostic).
const BADGE =
  '<a href="/" target="_blank" rel="noopener" ' +
  'style="position:fixed;bottom:12px;right:12px;z-index:2147483647;display:flex;align-items:center;gap:6px;' +
  'padding:6px 12px;border-radius:9999px;background:rgba(10,10,10,0.85);color:#fff;font:600 11px/1 ' +
  "'Manrope',system-ui,sans-serif;text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,0.35);backdrop-filter:blur(8px)\">" +
  '<span style="color:#3b82f6;font-size:13px">\u{1E902}</span> Built with Gando</a>';

export const NOT_FOUND_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>App not found – Gando</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0e0e0e;color:#fff;font-family:system-ui,sans-serif">
<div style="text-align:center;padding:24px">
<p style="font-size:40px;margin:0 0 8px">&#x1E902;</p>
<h1 style="font-size:20px;margin:0 0 8px">This app isn't published</h1>
<p style="color:#767575;font-size:14px;margin:0 0 20px">The link is wrong, or the owner unpublished it.</p>
<a href="/" style="color:#3b82f6;text-decoration:none;font-weight:600;font-size:14px">Build your own with Gando →</a>
</div></body></html>`;

/**
 * Load a published project's HTML (with badge), or null if not published.
 * `idOrSlug` may be a raw project id (old links) or a custom slug — the
 * project id is tried first, then the slugs/<slug> reservation doc.
 */
export async function loadPublishedApp(idOrSlug: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(idOrSlug)) return null;
  const db = adminDb();
  let snap = await db.collection('projects').doc(idOrSlug).get();
  if (!snap.exists) {
    const slugSnap = await db.collection('slugs').doc(idOrSlug.toLowerCase()).get();
    const projectId = slugSnap.data()?.projectId;
    if (typeof projectId !== 'string' || !projectId) return null;
    snap = await db.collection('projects').doc(projectId).get();
  }
  const d = snap.data();
  if (!snap.exists || d?.published !== true || typeof d.code !== 'string' || !d.code.trim()) return null;
  // generated forms POST to /api/submit/__GANDO_PROJECT_ID__ — bind the real id
  const code = (d.code as string).replaceAll('__GANDO_PROJECT_ID__', snap.id);
  return code.includes('</body>') ? code.replace('</body>', `${BADGE}</body>`) : code + BADGE;
}
