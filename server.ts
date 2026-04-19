import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

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
- Text direction is LTR.

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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '25mb' }));

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

  app.post('/api/generate', async (req: Request, res: Response) => {
    const { prompt, preferredLanguage } = req.body ?? {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }
    try {
      const hint = preferredLanguage
        ? `Preferred output language (use unless the user's prompt is clearly in another language): ${preferredLanguage}\n\n`
        : '';
      const templateHint = buildTemplateHint(prompt);
      const result = await callGemini(`${hint}${templateHint}User Prompt:\n${prompt}`);
      res.json(result);
    } catch (err) {
      console.error('generate error:', err);
      sendGeminiError(res, err);
    }
  });

  app.post('/api/edit', async (req: Request, res: Response) => {
    const { prompt, currentCode, history, preferredLanguage } = req.body ?? {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }
    if (!currentCode || typeof currentCode !== 'string') {
      return res.status(400).json({ error: 'currentCode is required' });
    }
    try {
      const trimmedHistory = Array.isArray(history) ? history.slice(-6) : [];
      const historyText = trimmedHistory
        .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
        .join('\n');
      const hint = preferredLanguage
        ? `Preferred output language (unless the user's prompt is clearly in another language): ${preferredLanguage}\n\n`
        : '';
      const userContent = `${hint}Current Code:\n${currentCode}\n\nRecent Chat:\n${historyText}\n\nUser Request:\n${prompt}`;
      const result = await callGemini(userContent);
      res.json(result);
    } catch (err) {
      console.error('edit error:', err);
      sendGeminiError(res, err);
    }
  });

  app.post('/api/transcribe', async (req: Request, res: Response) => {
    const { audio, mimeType, language } = req.body ?? {};
    if (!audio || !mimeType) {
      return res.status(400).json({ error: 'audio and mimeType required' });
    }
    if (!ai) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: {
          parts: [
            { inlineData: { data: audio, mimeType } },
            {
              text: `Transcribe this audio exactly as spoken${language ? ` in ${language}` : ''}. Return only the transcribed text, no commentary.`,
            },
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
