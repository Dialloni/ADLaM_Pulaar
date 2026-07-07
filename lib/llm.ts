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
- Readable code: clear section comments (<!-- ===== NAVBAR ===== -->, // ── router ──), consistent 2-space indentation, descriptive names, CSS grouped in one <style>, all JS in one <script> at the end. A curious beginner should be able to follow the file top to bottom.

Navigation & multi-page apps — CRITICAL (the app is ONE file; there are no other files):
- NEVER link to another file or path (about.html, /contact, page2.html, …). Those pages do not exist — clicking shows a blank dead end.
- NEVER use placeholder links: no href="#", no dead buttons. Every clickable element must do something real.
- To give the app multiple "pages" (up to ~5: e.g. home / menu / about / contact): put each page in its own <section data-page="home"> etc., and use a tiny hash router:
  nav links: <a href="#/menu">...</a>
  router: on load and on 'hashchange', show ONLY the section whose data-page matches location.hash.slice(2) (default "home"), hide the others, and scroll to top. This makes the browser Back/Forward buttons work between pages.
- Highlight the active nav link so users know where they are.
- External links (WhatsApp, phone, email, maps) use real URLs: https://wa.me/<number>, tel:, mailto: — with target="_blank" rel="noopener" for web links.

Forms (contact / order / booking / feedback) — make them REAL:
- Every form must actually submit to the Gando submissions API. On submit (preventDefault):
  fetch('/api/submit/__GANDO_PROJECT_ID__', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { /* one entry per form input, named meaningfully */ }, _gotcha: document.querySelector('[name=_gotcha]')?.value || '' }) })
- Use the literal placeholder __GANDO_PROJECT_ID__ exactly as written — it is replaced with the real id automatically. Never invent an id.
- Add a hidden spam-trap input to each form: <input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off">
- On success: clear the form and show a confirmation message IN THE APP'S LANGUAGE. On failure: show a polite error in the same language. Never leave a form that does nothing.

ADLaM (Fulani) rules — CRITICAL:
- If the detected language is Fulani/Pulaar, render ALL text using ONLY characters from the ADLaM Unicode block (U+1E900–U+1E95F).
- Include in <head>: <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Adlam&display=swap" rel="stylesheet">`;

const OUTPUT_PROTOCOL = `OUTPUT FORMAT — follow EXACTLY:
- FIRST output a short list of the build STEPS you will take, ONE per line, each line beginning with "STATUS: ", written in the SAME language as the app. 2-5 steps, in the order you'll do them (e.g. "STATUS: Building the navigation and hero", "STATUS: Creating the product grid", "STATUS: Wiring the cart counter", "STATUS: Adding the footer"). For edits, output ONE STATUS line per change the user requested.
- Then output the COMPLETE HTML file, starting with <!DOCTYPE html> and ending with </html>. No markdown fences.
- Then output a line containing exactly: ${META_DELIM}
- Then output a single JSON object: {"language":"<detected language>","name":"<short name>","explanation":"<3-5 sentence explanation>"}
- ABSOLUTELY NO other text: no analysis, no commentary before or after — stray prose ends up rendered inside the user's app.`;

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

// Edits use SEARCH/REPLACE blocks instead of re-emitting the whole file:
// ~10x fewer output tokens, much faster, and no more mid-file truncation
// breaking apps. Full rewrite stays available for total redesigns.
const EDIT_PROTOCOL = `OUTPUT FORMAT for edits — follow EXACTLY:
- FIRST output the build STEPS ("STATUS: ..." lines, one per requested change, in the app's language) as usual.
- Then output one SEARCH/REPLACE block per change:
<<<<<<< SEARCH
(lines copied VERBATIM from Current Code — character-for-character, including whitespace)
=======
(the replacement lines)
>>>>>>> REPLACE
- The SEARCH text MUST be an exact copy from Current Code or the edit fails. Keep blocks small: the changed lines plus 1-3 surrounding lines so the match is unique. Multiple blocks allowed, in file order.
- Full rewrite is FORBIDDEN unless the user EXPLICITLY asks to redesign/rebuild the whole app. Bug fixes, tweaks, additions, "X doesn't work" requests → SEARCH/REPLACE blocks ONLY, changing the minimum. Never restructure, rename, or "improve" things the user didn't mention.
- In the rare explicit-redesign case: output the complete new HTML starting with <!DOCTYPE html> and ending with </html>.
- Then output a line containing exactly: ${META_DELIM}
- Then a single JSON object: {"language":"<detected language>","name":"<short name>","explanation":"<2-4 sentence explanation of what you changed>"}
- ABSOLUTELY NO other text: no analysis, no reasoning, no commentary before, between, or after — the output is parsed by a machine and stray prose ends up rendered inside the user's app.`;

export const EDIT_SYSTEM = `${BASE_RULES}

Incremental edits:
- "Current Code" is the source of truth. Make MINIMAL changes. Preserve layout, colors, structure. Only change what the user asked for.

${EDIT_PROTOCOL}`;

export interface TokenUsage { inTok: number; outTok: number; model: string }

export interface GenResult {
  language: string;
  name: string;
  code: string;
  explanation: string;
  usage?: TokenUsage;
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

/**
 * Defensive cleanup: models occasionally leak narration around the HTML
 * ("Let me fix...", stray STATUS lines, post-</html> commentary). Whatever
 * ships to the user's project must be exactly one document — amputate
 * anything before <!DOCTYPE and after </html>.
 */
function sanitizeHtml(code: string): string {
  let c = code;
  const start = c.search(/<!doctype html/i);
  if (start > 0) c = c.slice(start);
  const end = c.toLowerCase().lastIndexOf('</html>');
  if (end !== -1) c = c.slice(0, end + '</html>'.length);
  return c.trim();
}

function parseMeta(metaRaw: string): { language: string; name: string; explanation: string } {
  try {
    const m = JSON.parse(metaRaw.replace(/^```json\s*/i, '').replace(/```$/, '').trim());
    return { language: m.language ?? '', name: m.name ?? '', explanation: m.explanation ?? '' };
  } catch { return { language: '', name: '', explanation: '' }; }
}

/** Split accumulated model output into code + parsed metadata (status lines stripped). */
function splitOutput(raw: string): GenResult {
  const full = stripStatusLines(raw);
  const idx = full.indexOf(META_DELIM);
  const code = sanitizeHtml((idx === -1 ? full : full.slice(0, idx)).trim());
  const meta = idx === -1
    ? { language: '', name: '', explanation: '' }
    : parseMeta(full.slice(idx + META_DELIM.length).trim());
  return { code, ...meta };
}

const SR_BLOCK = /<{7} SEARCH\n([\s\S]*?)\n={7}\n([\s\S]*?)\n>{7} REPLACE/g;

/**
 * Apply SEARCH/REPLACE blocks to the current code. Exact match first, then a
 * whitespace-tolerant retry (models sometimes normalize indentation). Any
 * block that matches nothing aborts the edit — half-applied edits are worse
 * than a clean retry.
 */
function applySearchReplace(current: string, diffText: string): string {
  let out = current;
  let applied = 0;
  let m: RegExpExecArray | null;
  SR_BLOCK.lastIndex = 0;
  while ((m = SR_BLOCK.exec(diffText))) {
    const [, search, replace] = m;
    if (out.includes(search)) {
      out = out.replace(search, replace);
      applied++;
      continue;
    }
    const fuzzy = new RegExp(
      search
        .split('\n')
        .map(l => l.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .filter(l => l.length > 0)
        .join('[ \\t]*\\n[ \\t]*'),
    );
    if (fuzzy.test(out)) {
      out = out.replace(fuzzy, replace);
      applied++;
      continue;
    }
    throw new Error('The edit could not be applied cleanly — please try again.');
  }
  if (applied === 0) throw new Error('The edit could not be applied cleanly — please try again.');
  return out;
}

/**
 * Finalize an EDIT response. Diff mode (SEARCH/REPLACE blocks) patches the
 * current code and emits the result as one final chunk; full mode falls back
 * to the classic whole-file path. HARD RULE: never save garbage — a response
 * that is neither valid blocks nor a complete HTML document FAILS LOUDLY
 * instead of replacing the user's app with raw diff text or prose.
 */
function finishEdit(buf: string, currentCode: string, onCode: (chunk: string) => void): GenResult {
  const stripped = stripStatusLines(buf).replace(/```[a-z]*\n?/gi, ''); // models fence output despite instructions
  SR_BLOCK.lastIndex = 0;
  const hasBlocks = SR_BLOCK.test(stripped);
  const hasFullDoc = /<!doctype html/i.test(stripped);
  if (!hasBlocks && !hasFullDoc) {
    throw new Error('The edit response was malformed — nothing was changed. Please try again.');
  }
  if (!hasBlocks) return splitOutput(stripped); // explicit full rewrite (sanitized inside)
  const idx = stripped.indexOf(META_DELIM);
  const diffText = idx === -1 ? stripped : stripped.slice(0, idx);
  const meta = idx === -1
    ? { language: '', name: '', explanation: '' }
    : parseMeta(stripped.slice(idx + META_DELIM.length).trim());
  const patched = applySearchReplace(currentCode, diffText);
  onCode(patched); // single final chunk → editor/preview update once, instantly
  return { code: patched, ...meta };
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
  // Edits may answer with SEARCH/REPLACE blocks — never stream those to the
  // live editor (raw diff text is not HTML); they're applied at the end.
  let mode: 'unknown' | 'full' | 'diff' = opts.kind === 'edit' ? 'unknown' : 'full';

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

    if (mode === 'unknown') {
      // strip a leading code fence before classifying — models fence diff output
      const head = buf.slice(codeStart).trimStart().replace(/^`{3,}[a-z]*\s*/i, '');
      if (head.length < 8) continue; // not enough to classify yet
      mode = head.startsWith('<<<<<<<') ? 'diff' : 'full';
    }
    if (mode === 'diff') continue; // buffer silently; patched at the end

    if (inMeta) continue;
    // The document ends at </html> — anything after (leaked narration) never streams.
    const endTag = buf.toLowerCase().indexOf('</html>', codeStart);
    if (endTag !== -1) {
      const stop = endTag + '</html>'.length;
      if (stop > codeEmitted) onCode(buf.slice(codeEmitted, stop));
      codeEmitted = stop;
      inMeta = true;
      continue;
    }
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
  const final = await stream.finalMessage();
  const usage: TokenUsage = {
    inTok: final.usage?.input_tokens ?? 0,
    outTok: final.usage?.output_tokens ?? 0,
    model,
  };
  const result = opts.kind === 'edit' ? finishEdit(buf, opts.currentCode ?? '', onCode) : splitOutput(buf);
  return { ...result, usage };
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
      stream: true,
      stream_options: { include_usage: true }, // final chunk carries token counts
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error((err as { error?: { message?: string } })?.error?.message || `Provider error: ${res.status}`);
  }

  let usage: TokenUsage = { inTok: 0, outTok: 0, model: modelId };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let buf = '';
  let statusDone = false;
  let codeStart = 0;
  let codeEmitted = 0;
  let inMeta = false;
  let mode: 'unknown' | 'full' | 'diff' = opts.kind === 'edit' ? 'unknown' : 'full';

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
    if (mode === 'unknown') {
      const head = buf.slice(codeStart).trimStart().replace(/^`{3,}[a-z]*\s*/i, '');
      if (head.length < 8) return;
      mode = head.startsWith('<<<<<<<') ? 'diff' : 'full';
    }
    if (mode === 'diff') return; // applied at the end, never streamed raw
    if (inMeta) return;
    const endTag = buf.toLowerCase().indexOf('</html>', codeStart);
    if (endTag !== -1) {
      const stop = endTag + '</html>'.length;
      if (stop > codeEmitted) onCode(buf.slice(codeEmitted, stop));
      codeEmitted = stop;
      inMeta = true;
      return;
    }
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
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const token = json.choices?.[0]?.delta?.content ?? '';
        if (token) processToken(token);
        if (json.usage) usage = { inTok: json.usage.prompt_tokens ?? 0, outTok: json.usage.completion_tokens ?? 0, model: modelId };
      } catch { /* skip malformed SSE frame */ }
    }
  }

  const result = opts.kind === 'edit' ? finishEdit(buf, opts.currentCode ?? '', onCode) : splitOutput(buf);
  return { ...result, usage };
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
  const usage: TokenUsage = {
    inTok: res.usageMetadata?.promptTokenCount ?? 0,
    outTok: res.usageMetadata?.candidatesTokenCount ?? 0,
    model,
  };
  return { code: m.code ?? '', name: m.name ?? '', language: m.language ?? '', explanation: m.explanation ?? '', usage };
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

/** Stream a chat answer token-by-token. Resolves with the full answer text.
 * onUsage (optional) fires once at the end with the token counts. */
export async function chatStream(
  opts: ChatOpts,
  onToken: (chunk: string) => void,
  onUsage?: (u: TokenUsage) => void,
): Promise<string> {
  // BYOK takes priority — user's own key, no fallback to our keys.
  if (opts.byok?.apiKey) {
    const d = BYOK_DEFAULTS[opts.byok.provider];
    if (!d) throw new Error(`Unknown provider: ${opts.byok.provider}`);
    if (d.kind === 'openai') return chatOpenAICompatible(opts, d.baseUrl!, opts.byok.apiKey, d.model, onToken, onUsage);
    if (d.kind === 'anthropic') return chatClaude(opts, onToken, onUsage, opts.byok.apiKey, d.model);
    return chatGeminiOnce(opts, onToken, onUsage, opts.byok.apiKey, d.model);
  }
  const provider = opts.provider || 'claude';
  if (provider === 'groq-llama' || provider === 'groq-scout') {
    return chatOpenAICompatible(opts, 'https://api.groq.com/openai/v1', groqKey(), GROQ_MODEL_IDS[provider], onToken, onUsage);
  }
  if (provider === 'claude' && anthropicKey()) {
    try {
      return await chatClaude(opts, onToken, onUsage);
    } catch (err) {
      if (!geminiKey()) throw err;
    }
  }
  return chatGeminiOnce(opts, onToken, onUsage);
}

async function chatClaude(
  opts: ChatOpts,
  onToken: (chunk: string) => void,
  onUsage?: (u: TokenUsage) => void,
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
  const final = await stream.finalMessage();
  onUsage?.({ inTok: final.usage?.input_tokens ?? 0, outTok: final.usage?.output_tokens ?? 0, model });
  return full;
}

// Gemini chat — non-streaming, emit the whole answer as one chunk.
async function chatGeminiOnce(
  opts: ChatOpts,
  onToken: (chunk: string) => void,
  onUsage?: (u: TokenUsage) => void,
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
  onUsage?.({ inTok: res.usageMetadata?.promptTokenCount ?? 0, outTok: res.usageMetadata?.candidatesTokenCount ?? 0, model });
  return out;
}

// Works with any OpenAI-compatible endpoint: Groq (free) and BYOK OpenAI/DeepSeek/Groq.
async function chatOpenAICompatible(
  opts: ChatOpts,
  baseUrl: string,
  apiKey: string,
  modelId: string,
  onToken: (chunk: string) => void,
  onUsage?: (u: TokenUsage) => void
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
      stream: true,
      stream_options: { include_usage: true },
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
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const token = json.choices?.[0]?.delta?.content ?? '';
        if (token) { full += token; onToken(token); }
        if (json.usage) onUsage?.({ inTok: json.usage.prompt_tokens ?? 0, outTok: json.usage.completion_tokens ?? 0, model: modelId });
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
