import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { verifyIdToken } from './lib/firebaseAdmin';
import { runStream, translateText, chatStream } from './lib/llm';

dotenv.config();

// Firebase first-party auth proxy target (same as the Vercel rewrite).
const FIREBASE_AUTH_PROXY_TARGET =
  process.env.FIREBASE_AUTH_PROXY_TARGET ||
  'https://ai-studio-applet-webapp-28b0a.firebaseapp.com';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 32768;

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const SYSTEM_PROMPT = `You are Gando AI, an African-language-first AI app builder.

Given a user prompt in ANY language (especially African languages like Fulani/Pulaar in ADLaM script, Swahili, Yoruba, Wolof, Amharic, Zulu, Hausa, Igbo, Bambara, Fon):

1. DETECT the language of the user's prompt.
2. GENERATE a complete, polished, production-looking single-file web app (HTML + Tailwind CSS via CDN + vanilla JavaScript).
3. All user-facing TEXT (labels, buttons, headings, placeholders, messages, alt text, mock data) MUST be in the detected language.
4. Produce a short catchy project NAME in the detected language.
5. Produce a short beginner-friendly EXPLANATION in the detected language (3-5 sentences).

Quality bar — non-negotiable:
- The app MUST look like a real, finished product. NOT a placeholder, NOT a skeleton, NOT a single heading.
- Include multiple sections with real visual hierarchy: header/nav, hero, main content, and footer at minimum.
- For catalogs/lists (products, articles, services, courses, menu items, events): generate AT LEAST 6 realistic mock items with names, descriptions, prices/metadata, and emoji or placeholder images.
- Use real, culturally-appropriate example content — local business names, African products, regional examples when context suggests. No "Product 1 / Product 2".
- Add working interactivity via vanilla JS: cart counters, filters, tabs, modal open/close, form validation — whatever fits the app. No dead buttons.
- Design tokens: modern color palette, generous spacing, rounded corners, subtle shadows, responsive grid/flex layouts, mobile-first.
- Use semantic HTML and accessible contrast.
- Aim for a substantial page (typically 300+ lines of well-formatted HTML). Do NOT return a 30-line stub.

Code rules:
- One self-contained HTML file. Include <!DOCTYPE html>.
- Use Tailwind via CDN: <script src="https://cdn.tailwindcss.com"></script>
- You may use Lucide icons via https://unpkg.com/lucide@latest.
- No external backend, no Firebase, no API keys, no npm modules.
- Inline any small amounts of CSS/JS you need.

ADLaM (Fulani) rules — CRITICAL:
- If the detected language is Fulani/Pulaar, render ALL text using ONLY characters from the ADLaM Unicode block (U+1E900–U+1E95F).
- NEVER substitute with Arabic, Mathematical, or Extended Latin lookalikes (e.g. "ݰ", "ń", "đ", "ġ", "ı", "ā", "ł", "š", "ħ" are WRONG).
- Correct ADLaM characters look like: 𞤆, 𞤢, 𞤯, 𞤫, 𞤲, 𞤺.
- Include in <head>: <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Adlam&display=swap" rel="stylesheet">
- Apply font-family: 'Noto Sans Adlam', sans-serif to the body.
- Text direction is RTL. Set dir="rtl" on the body or ADLaM text containers.

Incremental edits:
- If "Current Code" is provided, make MINIMAL changes. Preserve layout, colors, structure. Only change what the user asked for.

Return strict JSON with keys: language, name, code, explanation. No markdown fences.`;

const TEMPLATE_HINTS: { keywords: RegExp; hint: string }[] = [
  {
    keywords: /\b(ecom|e-?commerce|shop|store|boutique|market|biashara|duka|onigbese|ọjà|marché)\b/i,
    hint: 'E-commerce starter: sticky nav with logo + cart badge, hero banner with CTA, category chips, product grid of 8 items (image/emoji, name, short description, price, "Add to cart" button), live cart counter in JS, testimonials row, newsletter signup, footer with social links.',
  },
  {
    keywords: /\b(portfolio|designer|developer|resume|cv|creative)\b/i,
    hint: 'Portfolio starter: intro hero with name + role + photo placeholder, about section, skills grid (6-8 skills), projects grid (4-6 real-sounding projects with role, stack, outcome), testimonials, contact form with client-side validation.',
  },
  {
    keywords: /\b(landing|saas|startup|product|launch|waitlist)\b/i,
    hint: 'SaaS landing starter: nav, hero with headline + subhead + primary CTA + screenshot/mock, logos strip, 3-column feature grid, "how it works" 3 steps, pricing table (3 tiers), FAQ accordion (5 Qs), final CTA, footer.',
  },
  {
    keywords: /\b(blog|articles?|news|magazine|posts?|journal)\b/i,
    hint: 'Blog starter: masthead with title + tagline, featured article card, 6-item article grid with category, thumbnail, title, excerpt, author, date, read time; sidebar with categories list + search; pagination stub.',
  },
  {
    keywords: /\b(restaurant|menu|cafe|café|food|kitchen|bistro|chakula|nyama|jollof)\b/i,
    hint: 'Restaurant starter: hero with restaurant name + tagline + "Reserve a table" CTA, about blurb, menu tabs (Starters/Mains/Drinks/Desserts) with 4-6 items each (name, description, price), photo gallery strip, hours + address + map placeholder, reservation form with client-side validation.',
  },
  {
    keywords: /\b(booking|reservation|appointment|schedule|calendar|reservations?)\b/i,
    hint: 'Booking starter: service list (4-6 services with duration + price), date picker stub, time-slot grid, user details form, confirmation modal triggered by JS.',
  },
  {
    keywords: /\b(dashboard|admin|analytics|metrics|stats)\b/i,
    hint: 'Dashboard starter: sidebar nav, top bar with user avatar, 4 KPI stat cards, 2 chart placeholders (use CSS/SVG bars), recent activity table with 8 rows, responsive collapse on mobile.',
  },
  {
    keywords: /\b(school|learn|course|education|class|tutor|elimu)\b/i,
    hint: 'Learning platform starter: hero with search, category pills, course grid (6-8 courses with thumbnail, title, instructor, duration, level, rating), enrolled count, "Start learning" CTA per card.',
  },
  {
    keywords: /\b(hotel|lodge|accommodation|stay|hoteli)\b/i,
    hint: 'Hotel starter: hero with search (destination/dates/guests), room type cards (5 rooms with photos, amenities, prices), amenities grid, gallery, testimonials, booking CTA, footer with contact/address.',
  },
];

function buildTemplateHint(prompt: string): string {
  const matches = TEMPLATE_HINTS.filter((t) => t.keywords.test(prompt)).map((t) => t.hint);
  if (!matches.length) return '';
  return `Relevant starter structure for this kind of app (use as guidance, not a copy):\n- ${matches.join('\n- ')}\n\n`;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    language: { type: Type.STRING },
    name: { type: Type.STRING },
    code: { type: Type.STRING },
    explanation: { type: Type.STRING },
  },
  required: ['language', 'name', 'code', 'explanation'],
};

async function callGemini(userContent: string) {
  if (!ai) throw new Error('GEMINI_API_KEY is not configured on the server.');
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: userContent,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.8,
    },
  });
  const text = response.text?.trim() || '';
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned);
}

function sendGeminiError(res: Response, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const isRate = /429|quota|rate|RESOURCE_EXHAUSTED/i.test(msg);
  const status = isRate ? 429 : 500;
  res.status(status).json({
    error: isRate
      ? "You've reached the AI generation limit for now. Please wait a minute and try again."
      : msg,
  });
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await verifyIdToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // First-party Firebase auth: proxy /__/auth/* and /__/firebase/* to the Firebase
  // handler so Google sign-in cookies are first-party on this domain (fixes the
  // login bounce on Safari redirect + Chrome partitioned storage). Mounted at ROOT
  // with pathFilter (NOT app.use('/__', ...) — that strips the /__ prefix and
  // forwards the wrong path). cookieDomainRewrite:'' makes cookies host-only.
  app.use(
    createProxyMiddleware({
      pathFilter: ['/__/auth/**', '/__/firebase/**'],
      target: FIREBASE_AUTH_PROXY_TARGET,
      changeOrigin: true,
      cookieDomainRewrite: '',
      xfwd: true,
    })
  );

  app.use(express.json({ limit: '50mb' }));

  const startTime = Date.now();

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', hasKey: Boolean(GEMINI_API_KEY), model: MODEL });
  });

  app.get('/api/status', async (_req, res) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    let aiStatus: 'ok' | 'degraded' | 'down' = 'down';
    let aiLatencyMs = 0;

    if (ai && GEMINI_API_KEY) {
      try {
        const t0 = Date.now();
        await ai.models.generateContent({
          model: MODEL,
          contents: 'ping',
          config: { maxOutputTokens: 4 },
        });
        aiLatencyMs = Date.now() - t0;
        aiStatus = aiLatencyMs < 5000 ? 'ok' : 'degraded';
      } catch {
        aiStatus = 'degraded';
      }
    }

    res.json({
      server: 'ok',
      uptime,
      model: MODEL,
      hasKey: Boolean(GEMINI_API_KEY),
      ai: aiStatus,
      aiLatencyMs,
      timestamp: new Date().toISOString(),
    });
  });

  // SSE streaming — mirrors api/generate.ts (Vercel). Local dev === production.
  const sseHeaders = (res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
  };

  app.post('/api/generate', requireAuth, async (req: Request, res: Response) => {
    const { prompt, preferredLanguage, provider, byok } = req.body ?? {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }
    sseHeaders(res);
    const send = (msg: unknown) => res.write(`data: ${JSON.stringify(msg)}\n\n`);
    try {
      const result = await runStream(
        { kind: 'generate', prompt, preferredLanguage, provider, byok },
        (chunk) => send({ type: 'code', chunk }),
        (text) => send({ type: 'status', text })
      );
      send({ type: 'done', result });
      res.end();
    } catch (err) {
      console.error('generate error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      const isRate = /429|quota|rate|RESOURCE_EXHAUSTED|overloaded/i.test(msg);
      send({ type: 'error', error: isRate ? "You've reached the AI generation limit. Please wait a minute and try again." : msg });
      res.end();
    }
  });

  app.post('/api/edit', requireAuth, async (req: Request, res: Response) => {
    const { prompt, currentCode, history, preferredLanguage, provider, byok } = req.body ?? {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }
    if (!currentCode || typeof currentCode !== 'string') {
      return res.status(400).json({ error: 'currentCode is required' });
    }
    sseHeaders(res);
    const send = (msg: unknown) => res.write(`data: ${JSON.stringify(msg)}\n\n`);
    try {
      const result = await runStream(
        { kind: 'edit', prompt, currentCode, history, preferredLanguage, provider, byok },
        (chunk) => send({ type: 'code', chunk }),
        (text) => send({ type: 'status', text })
      );
      send({ type: 'done', result });
      res.end();
    } catch (err) {
      console.error('edit error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      const isRate = /429|quota|rate|RESOURCE_EXHAUSTED|overloaded/i.test(msg);
      send({ type: 'error', error: isRate ? "You've reached the AI generation limit. Please wait a minute and try again." : msg });
      res.end();
    }
  });

  app.post('/api/chat', requireAuth, async (req: Request, res: Response) => {
    const { prompt, history, currentCode, preferredLanguage, provider, byok } = req.body ?? {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }
    sseHeaders(res);
    const send = (msg: unknown) => res.write(`data: ${JSON.stringify(msg)}\n\n`);
    try {
      const text = await chatStream(
        { prompt, history, currentCode, preferredLanguage, provider, byok },
        (chunk) => send({ type: 'token', text: chunk })
      );
      send({ type: 'done', text });
      res.end();
    } catch (err) {
      console.error('chat error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      const isRate = /429|quota|rate|RESOURCE_EXHAUSTED|overloaded/i.test(msg);
      send({ type: 'error', error: isRate ? "You've reached the AI limit. Please wait a minute and try again." : msg });
      res.end();
    }
  });

  app.post('/api/decode', requireAuth, async (req: Request, res: Response) => {
    const { text } = req.body ?? {};
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text required' });
    if (!ai) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `You are a Unicode expert for the ADLaM script (Fulani/Pulaar language).

The following text was typed or exported from a document using a pre-Unicode ADLaM font. In these fonts, ADLaM glyphs were mapped to Arabic Unicode codepoints (U+0600–U+06FF) or Arabic Presentation Forms (U+FB50–U+FEFF) instead of the official ADLaM Unicode block (U+1E900–U+1E95F).

Your task: re-encode this text so every character uses the correct ADLaM Unicode block (U+1E900–U+1E95F). The language is Fulani/Pulaar.

Rules:
- Map each Arabic character to its phonetically equivalent ADLaM character
- Preserve spaces, punctuation, and line breaks exactly
- Output ONLY the re-encoded ADLaM Unicode text — no explanation, no transliteration, no Latin

Input text:
${text}`,
      });
      const decoded = response.text?.trim() ?? '';
      res.json({ decoded });
    } catch (err) {
      console.error('decode error:', err);
      sendGeminiError(res, err);
    }
  });

  app.post('/api/translate', requireAuth, async (req: Request, res: Response) => {
    const { text, targetLanguage } = req.body ?? {};
    if (!text || typeof text !== 'string' || !targetLanguage || typeof targetLanguage !== 'string') {
      return res.status(400).json({ error: 'text and targetLanguage are required' });
    }
    try {
      const translation = await translateText(text, targetLanguage);
      res.json({ translation });
    } catch (err) {
      console.error('translate error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ocr', requireAuth, async (req: Request, res: Response) => {
    const { imageBase64, mimeType = 'image/png' } = req.body ?? {};
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });
    if (!ai) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    const OCR_PROMPT = `Extract ALL text from this document. It may contain ADLaM script (Fulani/Pulaar, Unicode block U+1E900–U+1E95F), French, Arabic, or Latin text.

Output the extracted text exactly as it appears, preserving:
- ADLaM characters in Unicode (𞤀-𞥋 range) — do NOT convert to Latin
- Line breaks where they occur in the document
- Paragraph structure

If the document contains a mix of scripts, include all of it.
Output ONLY the extracted text, nothing else.`;

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: { parts: [{ inlineData: { data: imageBase64, mimeType } }, { text: OCR_PROMPT }] },
        });
        return res.json({ text: response.text?.trim() || '' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const is429 = /429|quota|rate|RESOURCE_EXHAUSTED|Too Many/i.test(msg);
        if (is429 && attempt < 3) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        console.error('ocr error:', err);
        sendGeminiError(res, err);
        return;
      }
    }
  });

  app.post('/api/transcribe', requireAuth, async (req: Request, res: Response) => {
    const { audio, mimeType, language, languageCode } = req.body ?? {};
    if (!audio || !mimeType) {
      return res.status(400).json({ error: 'audio and mimeType required' });
    }
    if (!ai) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    const isAdlam = languageCode === 'ff-adlm';
    const prompt = isAdlam
      ? `Transcribe this spoken Pulaar (Fulani/Fulfulde) audio. You MUST output the transcription exclusively in ADLaM script (Unicode block U+1E900–U+1E95F). Do NOT use Latin letters, romanized Pulaar, or any other script. ADLaM is written right-to-left. If a word is unclear, approximate it in ADLaM characters. Return only the ADLaM transcription, nothing else.`
      : `Transcribe this audio exactly as spoken${language ? ` in ${language}` : ''}. Return only the transcribed text, no commentary.`;
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: {
          parts: [
            { inlineData: { data: audio, mimeType } },
            { text: prompt },
          ],
        },
      });
      res.json({ text: response.text?.trim() || '' });
    } catch (err) {
      console.error('transcribe error:', err);
      sendGeminiError(res, err);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (!GEMINI_API_KEY) {
      console.warn('⚠️  GEMINI_API_KEY is not set. Generation endpoints will fail.');
    }
  });
}

startServer();
