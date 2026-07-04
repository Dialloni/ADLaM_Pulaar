import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadPublishedApp, NOT_FOUND_HTML, PUBLISH_CSP } from '../../lib/publishPage';

// Public page for a published app: GET /p/<projectId> (rewritten here).
// No auth — that's the point. CSP sandbox isolates the user-generated HTML.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  const id = String(req.query.id ?? '');
  try {
    const html = await loadPublishedApp(id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (!html) return res.status(404).send(NOT_FOUND_HTML);
    res.setHeader('Content-Security-Policy', PUBLISH_CSP);
    // edge-cache 60s: republish/unpublish visible within a minute
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).send(html);
  } catch (err) {
    console.error('publish serve error:', err);
    return res.status(500).send('Server error');
  }
}
