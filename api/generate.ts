import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

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
- For catalogs/lists: generate AT LEAST 6 realistic mock items with names, descriptions, prices/metadata.
- Use real, culturally-appropriate example content. No "Product 1 / Product 2".
- Add working interactivity via vanilla JS.
- Design tokens: modern color palette, generous spacing, rounded corners, subtle shadows, responsive grid/flex layouts, mobile-first.

Code rules:
- One self-contained HTML file. Include <!DOCTYPE html>.
- Use Tailwind via CDN: <script src="https://cdn.tailwindcss.com"></script>
- No external backend, no Firebase, no API keys, no npm modules.

ADLaM (Fulani) rules — CRITICAL:
- If the detected language is Fulani/Pulaar, render ALL text using ONLY characters from the ADLaM Unicode block (U+1E900–U+1E95F).
- Include in <head>: <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Adlam&display=swap" rel="stylesheet">

Return strict JSON with keys: language, name, code, explanation. No markdown fences.`;

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

const TEMPLATE_HINTS: { keywords: RegExp; hint: string }[] = [
  { keywords: /\b(ecom|e-?commerce|shop|store|boutique|market)\b/i, hint: 'E-commerce starter: sticky nav with logo + cart badge, hero banner, product grid of 8 items, live cart counter, footer.' },
  { keywords: /\b(portfolio|designer|developer|resume|cv)\b/i, hint: 'Portfolio starter: hero with name + role, about section, skills grid, projects grid (4-6), contact form.' },
  { keywords: /\b(landing|saas|startup|product|launch)\b/i, hint: 'SaaS landing: nav, hero with CTA, features grid, pricing table (3 tiers), FAQ accordion, footer.' },
  { keywords: /\b(blog|articles?|news|magazine)\b/i, hint: 'Blog starter: masthead, featured article, 6-item article grid, sidebar with categories.' },
  { keywords: /\b(restaurant|menu|cafe|food|kitchen)\b/i, hint: 'Restaurant starter: hero with CTA, menu tabs with 4-6 items each, reservation form.' },
  { keywords: /\b(dashboard|admin|analytics|metrics)\b/i, hint: 'Dashboard: sidebar nav, 4 KPI cards, chart placeholders, recent activity table.' },
];

function buildTemplateHint(prompt: string): string {
  const matches = TEMPLATE_HINTS.filter((t) => t.keywords.test(prompt)).map((t) => t.hint);
  if (!matches.length) return '';
  return `Relevant starter structure:\n- ${matches.join('\n- ')}\n\n`;
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, preferredLanguage } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  try {
    const hint = preferredLanguage
      ? `Preferred output language: ${preferredLanguage}\n\n`
      : '';
    const templateHint = buildTemplateHint(prompt);
    const result = await callGemini(`${hint}${templateHint}User Prompt:\n${prompt}`);
    return res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRate = /429|quota|rate|RESOURCE_EXHAUSTED/i.test(msg);
    return res.status(isRate ? 429 : 500).json({
      error: isRate
        ? "You've reached the AI generation limit. Please wait a minute and try again."
        : msg,
    });
  }
}
