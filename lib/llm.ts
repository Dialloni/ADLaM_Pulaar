// Unified LLM layer for Gando generation/editing.
// Claude Sonnet 4.6 is the default (won the ADLaM eval 10/10 on reliability + quality);
// Gemini Flash is the fallback. Claude streams token-by-token so the UI can show the app
// building live; Gemini falls back to a single non-streamed JSON response.
//
// Output protocol (both providers normalize to this): the model emits the full HTML CODE
// first, then a delimiter line, then a JSON object with language/name/explanation:
//
//   <!DOCTYPE html> ... </html>
//   <<<GANDO_META>>>
//   {"language":"...","name":"...","explanation":"..."}
//
// This lets the code stream straight to the preview while metadata arrives at the end.

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI, Type } from '@google/genai';

export const META_DELIM = '<<<GANDO_META>>>';

// Compress message content via headroom-ai before sending to the LLM.
// Dynamic import + full fallback: if headroom-ai is not installed or fails, original content used.
async function compressContent(content: string): Promise<string> {
  try {
    const { compress } = await import('headroom-ai');
    const input = [{ role: 'user', content }];
    const result = await compress(input);
    // Handle both return shapes: raw array or { messages: array }
    const msgs: { role: string; content: unknown }[] = Array.isArray(result)
      ? result
      : (result as { messages: { role: string; content: unknown }[] }).messages ?? [];
    const out = msgs[0];
    return typeof out?.content === 'string' ? out.content : content;
  } catch {
    return content;
  }
}

// Read env LAZILY (inside functions), never at module load. server.ts calls dotenv.config()
// after this module is imported, so top-level reads would capture empty values.
const claudeModel = () => process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const geminiModel = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';
// Ceiling, not a fixed cost — you only pay for tokens actually generated, so a higher
// cap is free for small apps and only kicks in for large ones. Edits re-emit the ENTIRE
// HTML file; 16k truncated rich apps mid-file (broke buttons, empty metadata → blank
// reply bubble). 32k fits a whole single-file app plus the trailing metadata JSON.
// Sonnet 4.6 supports up to 64k output tokens.
const maxTokens = () => Number(process.env.GANDO_MAX_OUTPUT_TOKENS) || 32000;
const anthropicKey = () => process.env.ANTHROPIC_API_KEY || '';
const geminiKey = () => process.env.GEMINI_API_KEY || '';
const groqKey = () => process.env.GROQ_API_KEY || '';

const GROQ_MODEL_IDS: Record<string, string> = {
  'groq-llama': 'llama-3.3-70b-versatile',
  'groq-scout': 'meta-llama/llama-4-scout-17b-16e-instruct',
};

// ── BYOK (Bring Your Own Key) ───────────────────────────────────────────────
// Users can paste their OWN provider key in Settings; it's sent per-request and
// used transiently here (never stored server-side, never logged). Each user's
// key has its own quota — independent of the shared free-tier pool.
export type ByokProvider = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'groq';
export interface Byok { provider: ByokProvider; apiKey: string; }

// kind decides the transport: 'openai' = OpenAI-compatible /chat/completions,
// 'anthropic' = Anthropic SDK, 'gemini' = Google GenAI SDK.
const BYOK_DEFAULTS: Record<ByokProvider, { kind: 'openai' | 'anthropic' | 'gemini'; baseUrl?: string; model: string }> = {
  openai:    { kind: 'openai',    baseUrl: 'https://api.openai.com/v1',     model: 'gpt-4o' },
  deepseek:  { kind: 'openai',    baseUrl: 'https://api.deepseek.com/v1',   model: 'deepseek-chat' },
  groq:      { kind: 'openai',    baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  anthropic: { kind: 'anthropic', model: 'claude-sonnet-4-6' },
  gemini:    { kind: 'gemini',    model: 'gemini-2.5-flash' },
};

const BASE_RULES = `You are Gando AI, an African-language-first AI app builder.

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
- Include in <head>: <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Adlam&display=swap" rel="stylesheet">`;

const OUTPUT_PROTOCOL = `OUTPUT FORMAT — follow EXACTLY:
- FIRST output a short list of the build STEPS you will take, ONE per line, each line beginning with "STATUS: ", written in the SAME language as the app. 2-5 steps, in the order you'll do them (e.g. "STATUS: Building the navigation and hero", "STATUS: Creating the product grid", "STATUS: Wiring the cart counter", "STATUS: Adding the footer"). For edits, output ONE STATUS line per change the user requested.
- Then output the COMPLETE HTML file, starting with <!DOCTYPE html> and ending with </html>. No markdown fences.
- Then output a line containing exactly: ${META_DELIM}
- Then output a single JSON object: {"language":"<detected language>","name":"<short name>","explanation":"<3-5 sentence explanation>"}
- Output nothing after the JSON.`;

const STATUS_PREFIX = 'STATUS:';

/** Strip ALL leading "STATUS: ..." lines, returning the remaining code+meta. */
function stripStatusLines(full: string): string {
  let s = full;
  while (true) {
    const nl = s.indexOf('\n');
    if (nl !== -1 && s.slice(0, nl).trimStart().startsWith(STATUS_PREFIX)) {
      s = s.slice(nl + 1);
    } else break;
  }
  return s;
}

export const GENERATE_SYSTEM = `${BASE_RULES}\n\n${OUTPUT_PROTOCOL}`;

export const EDIT_SYSTEM = `${BASE_RULES}

Incremental edits:
- If "Current Code" is provided, make MINIMAL changes. Preserve layout, colors, structure. Only change what the user asked for.

${OUTPUT_PROTOCOL}`;

export interface GenResult {
  language: string;
  name: string;
  code: string;
  explanation: string;
}

// A user-attached image for vision. `data` is RAW base64 (no "data:...;base64," prefix).
export interface ImageInput { data: string; mediaType: string }

const CLAUDE_MEDIA = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

// Build a Claude `content` field: plain string when no images, else an array of
// image blocks followed by the text block (Anthropic vision format).
function claudeContent(text: string, images?: ImageInput[]) {
  const ok = (images ?? []).filter(i => CLAUDE_MEDIA.has(i.mediaType));
  if (!ok.length) return text;
  return [
    ...ok.map(img => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: img.mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data: img.data },
    })),
    { type: 'text' as const, text },
  ];
}

// Build Gemini `contents`: plain string when no images, else parts with inlineData.
function geminiContents(text: string, images?: ImageInput[]) {
  if (!images?.length) return text;
  return [{ role: 'user' as const, parts: [
    ...images.map(img => ({ inlineData: { mimeType: img.mediaType, data: img.data } })),
    { text },
  ] }];
}

export interface RunStreamOpts {
  kind: 'generate' | 'edit';
  prompt: string;
  preferredLanguage?: string;
  currentCode?: string;
  history?: { role: string; content: string }[];
  provider?: 'claude' | 'gemini' | 'groq-llama' | 'groq-scout';
  byok?: Byok;
  images?: ImageInput[];
}

function buildUserContent(o: RunStreamOpts): string {
  const hint = o.preferredLanguage ? `Preferred output language: ${o.preferredLanguage}\n\n` : '';
  if (o.kind === 'edit') {
    const historyText = (o.history ?? [])
      .slice(-6)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
    return `${hint}Current Code:\n${o.currentCode ?? ''}\n\nRecent Chat:\n${historyText}\n\nUser Request:\n${o.prompt}`;
  }
  return `${hint}User Prompt:\n${o.prompt}`;
}

/** Split accumulated model output into code + parsed metadata (status lines stripped). */
function splitOutput(raw: string): GenResult {
  const full = stripStatusLines(raw);
  const idx = full.indexOf(META_DELIM);
  const code = (idx === -1 ? full : full.slice(0, idx)).trim();
  let language = '', name = '', explanation = '';
  if (idx !== -1) {
    const metaRaw = full.slice(idx + META_DELIM.length).trim();
    try {
      const m = JSON.parse(metaRaw.replace(/^```json\s*/i, '').replace(/```$/, '').trim());
      language = m.language ?? ''; name = m.name ?? ''; explanation = m.explanation ?? '';
    } catch { /* metadata best-effort */ }
  }
  return { code, name, language, explanation };
}

/**
 * Stream a generation. Calls onCode with each new CHUNK of code (delimiter-aware: stops
 * emitting once metadata begins). Resolves with the full structured result.
 */
export async function runStream(
  opts: RunStreamOpts,
  onCode: (chunk: string) => void,
  onStatus?: (text: string) => void
): Promise<GenResult> {
  // BYOK takes priority — user's own key, used transiently, no fallback to our keys.
  if (opts.byok?.apiKey) {
    const d = BYOK_DEFAULTS[opts.byok.provider];
    if (!d) throw new Error(`Unknown provider: ${opts.byok.provider}`);
    if (d.kind === 'openai') return runOpenAICompatible(opts, d.baseUrl!, opts.byok.apiKey, d.model, onCode, onStatus);
    if (d.kind === 'anthropic') return runClaude(opts, onCode, onStatus, opts.byok.apiKey, d.model);
    return runGemini(opts, onCode, opts.byok.apiKey, d.model);
  }
  const provider = opts.provider || 'claude';
  if (provider === 'groq-llama' || provider === 'groq-scout') {
    return runOpenAICompatible(opts, 'https://api.groq.com/openai/v1', groqKey(), GROQ_MODEL_IDS[provider], onCode, onStatus);
  }
  if (provider === 'claude' && anthropicKey()) {
    try {
      return await runClaude(opts, onCode, onStatus);
    } catch (err) {
      // Fall back to Gemini if available; otherwise rethrow.
      if (!geminiKey()) throw err;
    }
  }
  return runGemini(opts, onCode);
}

async function runClaude(
  opts: RunStreamOpts,
  onCode: (chunk: string) => void,
  onStatus?: (text: string) => void,
  apiKey: string = anthropicKey(),
  model: string = claudeModel()
): Promise<GenResult> {
  const client = new Anthropic({ apiKey });
  const userContent = await compressContent(buildUserContent(opts));
  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens(),
    system: opts.kind === 'edit' ? EDIT_SYSTEM : GENERATE_SYSTEM,
    messages: [{ role: 'user', content: claudeContent(userContent, opts.images) }],
  });

  let buf = '';
  let statusDone = false; // have we resolved the leading STATUS: line yet?
  let codeStart = 0;      // index in buf where code begins (after the status line)
  let codeEmitted = 0;    // chars of code already forwarded
  let inMeta = false;

  for await (const ev of stream) {
    if (ev.type !== 'content_block_delta' || ev.delta.type !== 'text_delta') continue;
    buf += ev.delta.text;

    if (!statusDone) {
      // Consume consecutive leading "STATUS:" lines, emitting one step each.
      while (true) {
        const nl = buf.indexOf('\n', codeStart);
        if (nl === -1) break; // need more data before this line is complete
        const line = buf.slice(codeStart, nl).trimStart();
        if (line.startsWith(STATUS_PREFIX)) {
          onStatus?.(line.slice(STATUS_PREFIX.length).trim());
          codeStart = nl + 1;
          codeEmitted = codeStart;
        } else {
          statusDone = true; // non-status line → code starts here
          break;
        }
      }
      if (!statusDone) continue; // still mid status-list; wait for more
    }

    if (inMeta) continue;
    const idx = buf.indexOf(META_DELIM, codeStart);
    if (idx === -1) {
      // Hold back the last (delim.length-1) chars so we never split the delimiter mid-chunk.
      const safe = buf.length - (META_DELIM.length - 1);
      if (safe > codeEmitted) {
        onCode(buf.slice(codeEmitted, safe));
        codeEmitted = safe;
      }
    } else {
      if (idx > codeEmitted) onCode(buf.slice(codeEmitted, idx));
      codeEmitted = idx;
      inMeta = true;
    }
  }
  await stream.finalMessage();
  return splitOutput(buf);
}

// Works with any OpenAI-compatible /chat/completions endpoint: Groq (free), and
// BYOK OpenAI / DeepSeek / Groq. Streams SSE token-by-token via the shared protocol.
async function runOpenAICompatible(
  opts: RunStreamOpts,
  baseUrl: string,
  apiKey: string,
  modelId: string,
  onCode: (chunk: string) => void,
  onStatus?: (text: string) => void
): Promise<GenResult> {
  if (!apiKey) throw new Error('API key not configured for this provider.');
  const isGroq = baseUrl.includes('groq.com');

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: opts.kind === 'edit' ? EDIT_SYSTEM : GENERATE_SYSTEM },
        { role: 'user', content: buildUserContent(opts) },
      ],
      max_tokens: maxTokens(),
      temperature: 0.8,
      // reasoning_format is Groq-only; sending it to OpenAI/DeepSeek would 400.
      ...(isGroq ? { reasoning_format: 'hidden' } : {}),
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error((err as { error?: { message?: string } })?.error?.message || `Provider error: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let buf = '';
  let statusDone = false;
  let codeStart = 0;
  let codeEmitted = 0;
  let inMeta = false;

  const processToken = (token: string) => {
    buf += token;
    if (!statusDone) {
      while (true) {
        const nl = buf.indexOf('\n', codeStart);
        if (nl === -1) break;
        const line = buf.slice(codeStart, nl).trimStart();
        if (line.startsWith(STATUS_PREFIX)) {
          onStatus?.(line.slice(STATUS_PREFIX.length).trim());
          codeStart = nl + 1;
          codeEmitted = codeStart;
        } else { statusDone = true; break; }
      }
      if (!statusDone) return;
    }
    if (inMeta) return;
    const idx = buf.indexOf(META_DELIM, codeStart);
    if (idx === -1) {
      const safe = buf.length - (META_DELIM.length - 1);
      if (safe > codeEmitted) { onCode(buf.slice(codeEmitted, safe)); codeEmitted = safe; }
    } else {
      if (idx > codeEmitted) onCode(buf.slice(codeEmitted, idx));
      codeEmitted = idx;
      inMeta = true;
    }
  };

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = sseBuffer.indexOf('\n')) !== -1) {
      const line = sseBuffer.slice(0, nl).trim();
      sseBuffer = sseBuffer.slice(nl + 1);
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') break outer;
      try {
        const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
        const token = json.choices?.[0]?.delta?.content ?? '';
        if (token) processToken(token);
      } catch { /* skip malformed SSE frame */ }
    }
  }

  return splitOutput(buf);
}

// Gemini fallback: non-streaming structured JSON, emitted as one code chunk.
const GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    language: { type: Type.STRING },
    name: { type: Type.STRING },
    code: { type: Type.STRING },
    explanation: { type: Type.STRING },
  },
  required: ['language', 'name', 'code', 'explanation'],
};

async function runGemini(
  opts: RunStreamOpts,
  onCode: (chunk: string) => void,
  apiKey: string = geminiKey(),
  model: string = geminiModel()
): Promise<GenResult> {
  if (!apiKey) throw new Error('No LLM provider configured (set ANTHROPIC_API_KEY or GEMINI_API_KEY).');
  const ai = new GoogleGenAI({ apiKey });
  // Gemini still uses the legacy JSON-schema contract (it doesn't follow the delimiter as reliably).
  const sys = (opts.kind === 'edit' ? EDIT_SYSTEM : GENERATE_SYSTEM).replace(OUTPUT_PROTOCOL,
    'Return strict JSON with keys: language, name, code, explanation. No markdown fences.');
  const res = await ai.models.generateContent({
    model,
    contents: geminiContents(buildUserContent(opts), opts.images),
    config: {
      systemInstruction: sys,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_SCHEMA,
      maxOutputTokens: 32768,
      temperature: 0.8,
    },
  });
  const text = (res.text || '').trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  const m = JSON.parse(text) as GenResult;
  if (m.code) onCode(m.code);
  return { code: m.code ?? '', name: m.name ?? '', language: m.language ?? '', explanation: m.explanation ?? '' };
}

// ── Chat mode ─────────────────────────────────────────────────────────────
// Plain conversational answers (NO app generation, NO code protocol). Can see the
// current project's code as context so the user can ask about what they built.
const CHAT_SYSTEM = `You are Gando AI, a friendly, knowledgeable assistant for an African-language-first app builder.

- Answer the user's question conversationally and helpfully. Do NOT build or output a full app unless explicitly asked; this is a chat, not a build request.
- ALWAYS reply in the SAME language the user wrote in (especially African languages like Fulani/Pulaar in ADLaM script, Swahili, Yoruba, Wolof, Hausa, etc.).
- If Fulani/Pulaar: write using ONLY characters from the ADLaM Unicode block (U+1E900–U+1E95F), plus spaces, digits and basic punctuation.
- If "Current Code" is provided, you may reference and explain it. You can suggest changes in words; if the user wants you to actually apply them, tell them to switch to Build mode.
- Keep answers focused. Use short markdown when helpful (lists, code snippets).`;

export interface ChatOpts {
  prompt: string;
  history?: { role: string; content: string }[];
  currentCode?: string;
  preferredLanguage?: string;
  provider?: 'claude' | 'gemini' | 'groq-llama' | 'groq-scout';
  byok?: Byok;
  images?: ImageInput[];
}

function buildChatContent(o: ChatOpts): string {
  const hint = o.preferredLanguage ? `Preferred reply language: ${o.preferredLanguage}\n\n` : '';
  const codeCtx = o.currentCode ? `Current Code (for reference only):\n${o.currentCode}\n\n` : '';
  const historyText = (o.history ?? []).slice(-8).map((m) => `${m.role}: ${m.content}`).join('\n');
  const hist = historyText ? `Recent conversation:\n${historyText}\n\n` : '';
  return `${hint}${codeCtx}${hist}User: ${o.prompt}`;
}

/** Stream a chat answer token-by-token. Resolves with the full answer text. */
export async function chatStream(opts: ChatOpts, onToken: (chunk: string) => void): Promise<string> {
  // BYOK takes priority — user's own key, no fallback to our keys.
  if (opts.byok?.apiKey) {
    const d = BYOK_DEFAULTS[opts.byok.provider];
    if (!d) throw new Error(`Unknown provider: ${opts.byok.provider}`);
    if (d.kind === 'openai') return chatOpenAICompatible(opts, d.baseUrl!, opts.byok.apiKey, d.model, onToken);
    if (d.kind === 'anthropic') return chatClaude(opts, onToken, opts.byok.apiKey, d.model);
    return chatGeminiOnce(opts, onToken, opts.byok.apiKey, d.model);
  }
  const provider = opts.provider || 'claude';
  if (provider === 'groq-llama' || provider === 'groq-scout') {
    return chatOpenAICompatible(opts, 'https://api.groq.com/openai/v1', groqKey(), GROQ_MODEL_IDS[provider], onToken);
  }
  if (provider === 'claude' && anthropicKey()) {
    try {
      return await chatClaude(opts, onToken);
    } catch (err) {
      if (!geminiKey()) throw err;
    }
  }
  return chatGeminiOnce(opts, onToken);
}

async function chatClaude(
  opts: ChatOpts,
  onToken: (chunk: string) => void,
  apiKey: string = anthropicKey(),
  model: string = claudeModel()
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const chatContent = await compressContent(buildChatContent(opts));
  const stream = client.messages.stream({
    model,
    max_tokens: 4096,
    system: CHAT_SYSTEM,
    messages: [{ role: 'user', content: claudeContent(chatContent, opts.images) }],
  });
  let full = '';
  for await (const ev of stream) {
    if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
      full += ev.delta.text;
      onToken(ev.delta.text);
    }
  }
  await stream.finalMessage();
  return full;
}

// Gemini chat — non-streaming, emit the whole answer as one chunk.
async function chatGeminiOnce(
  opts: ChatOpts,
  onToken: (chunk: string) => void,
  apiKey: string = geminiKey(),
  model: string = geminiModel()
): Promise<string> {
  if (!apiKey) throw new Error('No LLM provider configured (set ANTHROPIC_API_KEY or GEMINI_API_KEY).');
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model,
    contents: geminiContents(buildChatContent(opts), opts.images),
    config: { systemInstruction: CHAT_SYSTEM, maxOutputTokens: 4096, temperature: 0.7 },
  });
  const out = (res.text || '').trim();
  if (out) onToken(out);
  return out;
}

// Works with any OpenAI-compatible endpoint: Groq (free) and BYOK OpenAI/DeepSeek/Groq.
async function chatOpenAICompatible(
  opts: ChatOpts,
  baseUrl: string,
  apiKey: string,
  modelId: string,
  onToken: (chunk: string) => void
): Promise<string> {
  if (!apiKey) throw new Error('API key not configured for this provider.');
  const isGroq = baseUrl.includes('groq.com');

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: CHAT_SYSTEM },
        { role: 'user', content: buildChatContent(opts) },
      ],
      max_tokens: 4096,
      temperature: 0.7,
      ...(isGroq ? { reasoning_format: 'hidden' } : {}),
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error((err as { error?: { message?: string } })?.error?.message || `Provider error: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let full = '';

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = sseBuffer.indexOf('\n')) !== -1) {
      const line = sseBuffer.slice(0, nl).trim();
      sseBuffer = sseBuffer.slice(nl + 1);
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') break outer;
      try {
        const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
        const token = json.choices?.[0]?.delta?.content ?? '';
        if (token) { full += token; onToken(token); }
      } catch { /* skip */ }
    }
  }

  return full;
}

// Lightweight non-streaming translation for UI text (e.g. community template
// prompts). Gemini primary (fast/cheap for short text), Claude fallback.
// Output is the translation only.
export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const adlam = /adlam|fulani|fulfulde|pulaar|ff-adlm|𞤀/i.test(targetLanguage);
  const sys = `You are a precise translator. Translate the user's text into ${targetLanguage}. `
    + `Output ONLY the translation — no quotes, no notes, no preamble. Keep meaning and tone natural. `
    + `CRITICAL: The input is a description/prompt. Do NOT build, generate, or output any code, HTML, CSS, `
    + `JSON, or markup. If the text asks to build something, translate the REQUEST itself — never fulfil it. `
    + `Never include code fences or tags.`
    + (adlam
      ? ` Write the translation in ADLaM script using ONLY characters from the Unicode ADLaM block `
        + `(U+1E900 to U+1E95F), plus spaces, digits and basic punctuation. NEVER use Latin letters or `
        + `styled/bold/italic Unicode letters — output must be genuine ADLaM Unicode.`
      : '');

  if (geminiKey()) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey() });
      const res = await ai.models.generateContent({
        model: geminiModel(),
        contents: `${sys}\n\nTEXT:\n${text}`,
      });
      const out = (res.text || '').trim();
      if (out) return out;
    } catch (err) {
      if (!anthropicKey()) throw err;
    }
  }
  if (anthropicKey()) {
    const client = new Anthropic({ apiKey: anthropicKey() });
    const msg = await client.messages.create({
      model: claudeModel(),
      max_tokens: 2048,
      system: sys,
      messages: [{ role: 'user', content: text }],
    });
    const out = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
    if (out) return out;
  }
  throw new Error('No LLM provider configured (set ANTHROPIC_API_KEY or GEMINI_API_KEY).');
}
