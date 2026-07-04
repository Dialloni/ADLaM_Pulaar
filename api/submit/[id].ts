import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storeSubmission } from '../../lib/submissions';

// Public form endpoint for published apps: POST /api/submit/<projectId>.
// The published page runs in a CSP-sandboxed opaque origin, so requests
// arrive with Origin: null — CORS must be wide open (no credentials involved).
function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket?.remoteAddress;
    const result = await storeSubmission(String(req.query.id ?? ''), req.body, ip, String(req.headers['user-agent'] ?? ''));
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('submit error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
