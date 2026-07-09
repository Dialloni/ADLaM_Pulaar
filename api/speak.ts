import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { guardApi } from '../lib/apiRateGuard';

const HF_TOKEN = process.env.HUGGINGFACE_API_KEY || '';
const HF_MODEL = 'facebook/mms-tts-fuv';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s/gm, '')
    .trim();
}

async function toRomanized(adlamText: string): Promise<string> {
  if (!anthropic) return adlamText;
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Convert this ADLaM script text to romanized Pulaar (Latin letters only, phonetic). Return only the romanized text, nothing else.\n\n${adlamText}`,
    }],
  });
  const block = msg.content[0];
  return block.type === 'text' ? block.text.trim() : adlamText;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await guardApi(req, res, 'speak'))) return;

  const { text, languageCode } = req.body ?? {};
  if (!text) return res.status(400).json({ error: 'text required' });

  // For English/French — tell client to use browser speechSynthesis
  if (languageCode !== 'ff-adlm') {
    return res.json({ useBrowser: true, text: stripMarkdown(text).slice(0, 800) });
  }

  if (!HF_TOKEN) return res.status(500).json({ error: 'HUGGINGFACE_API_KEY not configured' });

  try {
    const clean = stripMarkdown(text).slice(0, 500);
    const romanized = await toRomanized(clean);

    const hfRes = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: romanized }),
    });

    // Model not found or not available — fall back to browser TTS with romanized text
    if (hfRes.status === 404 || hfRes.status === 400) {
      return res.json({ useBrowser: true, text: romanized, note: 'Pulaar TTS model not yet available; using browser voice with romanized text' });
    }

    if (hfRes.status === 503) {
      const data = await hfRes.json() as { estimated_time?: number };
      return res.status(503).json({
        error: 'Model loading',
        retryAfter: Math.ceil(data.estimated_time ?? 20),
      });
    }

    if (!hfRes.ok) {
      // Any other failure — fall back to browser TTS rather than silent error
      return res.json({ useBrowser: true, text: romanized });
    }

    const buf = await hfRes.arrayBuffer();
    const ct = hfRes.headers.get('content-type') || 'audio/flac';
    res.setHeader('Content-Type', ct);
    res.setHeader('Content-Length', buf.byteLength);
    return res.send(Buffer.from(buf));
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
