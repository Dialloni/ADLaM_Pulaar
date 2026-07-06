import { GenerationResult, Message } from '../types';
import { auth } from '../firebase';

export interface GenerationResponse extends GenerationResult {
  language: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * POST to an SSE endpoint and consume the stream. Forwards accumulated code to onCode
 * (so the caller can render a live preview) and resolves with the final result.
 */
async function streamGeneration(
  url: string,
  body: unknown,
  onCode?: (codeSoFar: string) => void,
  onStatus?: (text: string) => void,
  signal?: AbortSignal,
): Promise<GenerationResponse & { wasAborted?: boolean }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') return { code: '', language: '', name: '', explanation: '', wasAborted: true };
    throw err;
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let code = '';
  let result: GenerationResponse | null = null;
  let streamError: string | null = null;

  const handle = (msg: { type: string; chunk?: string; text?: string; result?: GenerationResponse; error?: string }) => {
    if (msg.type === 'code' && msg.chunk) {
      code += msg.chunk;
      onCode?.(code);
    } else if (msg.type === 'status' && msg.text) {
      onStatus?.(msg.text);
    } else if (msg.type === 'done' && msg.result) {
      result = msg.result;
    } else if (msg.type === 'error') {
      streamError = msg.error || 'Generation failed';
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const line = frame.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        try { handle(JSON.parse(line.slice(5).trim())); } catch { /* skip malformed frame */ }
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // Stopped mid-stream — return whatever code was built so far.
      return { code, language: '', name: '', explanation: '', wasAborted: true };
    }
    throw err;
  }

  if (streamError) throw new Error(streamError);
  if (!result) throw new Error('Generation ended without a result.');
  // Ensure the final code reflects the full streamed output.
  const final = result as GenerationResponse;
  return { ...final, code: final.code || code };
}

export type FreeProvider = 'claude' | 'gemini' | 'groq-llama' | 'groq-scout';
export type ByokProvider = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'groq';
export type Provider = FreeProvider | `byok-${ByokProvider}`;

export interface Byok { provider: ByokProvider; apiKey: string; }

// A user-attached image for vision. `data` is RAW base64 (no data-URL prefix).
// `name` is client-side only (labels the embed-URL prompt); server ignores it.
export interface ImageInput { data: string; mediaType: string; name?: string }

// When the selected provider is a BYOK one, resolve {provider, apiKey} from the
// saved keys so the request can carry the user's own key. Returns undefined for
// free models (server uses its shared keys).
export function resolveByok(provider: Provider | undefined, keys: Partial<Record<ByokProvider, string>>): Byok | undefined {
  if (!provider || !provider.startsWith('byok-')) return undefined;
  const p = provider.slice('byok-'.length) as ByokProvider;
  const apiKey = keys[p];
  return apiKey ? { provider: p, apiKey } : undefined;
}

export async function generateProject(
  prompt: string,
  preferredLanguage: string,
  onStatus?: (status: string) => void,
  onCode?: (codeSoFar: string) => void,
  provider?: Provider,
  byok?: Byok,
  signal?: AbortSignal,
  images?: ImageInput[],
): Promise<GenerationResponse & { wasAborted?: boolean }> {
  onStatus?.('Generating your app...');
  return streamGeneration('/api/generate', { prompt, preferredLanguage, provider, byok, images }, onCode, onStatus, signal);
}

export async function editProject(
  prompt: string,
  currentCode: string,
  history: Message[],
  preferredLanguage: string,
  onStatus?: (status: string) => void,
  onCode?: (codeSoFar: string) => void,
  provider?: Provider,
  byok?: Byok,
  signal?: AbortSignal,
  images?: ImageInput[],
): Promise<GenerationResponse & { wasAborted?: boolean }> {
  onStatus?.('Applying your changes...');
  const trimmed = history.slice(-6).map((m) => ({ role: m.role, content: m.content }));
  return streamGeneration(
    '/api/edit',
    { prompt, currentCode, history: trimmed, preferredLanguage, provider, byok, images },
    onCode,
    onStatus,
    signal,
  );
}

/**
 * Chat mode — stream a conversational answer (no app generation). Calls onToken with
 * each chunk and resolves with the full answer text.
 */
export async function chatStream(
  prompt: string,
  history: Message[],
  currentCode: string | undefined,
  preferredLanguage: string,
  onToken: (chunk: string) => void,
  provider?: Provider,
  byok?: Byok,
  images?: ImageInput[],
): Promise<string> {
  const trimmed = history.slice(-8).map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ prompt, history: trimmed, currentCode, preferredLanguage, provider, byok, images }),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  let streamError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const line = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      try {
        const msg = JSON.parse(line.slice(5).trim()) as { type: string; text?: string; error?: string };
        if (msg.type === 'token' && msg.text) { answer += msg.text; onToken(answer); }
        else if (msg.type === 'done' && typeof msg.text === 'string') { answer = msg.text || answer; }
        else if (msg.type === 'error') { streamError = msg.error || 'Chat failed'; }
      } catch { /* skip malformed frame */ }
    }
  }
  if (streamError) throw new Error(streamError);
  return answer;
}

export async function speakText(
  text: string,
  languageCode: string
): Promise<{ audioUrl?: string; useBrowser?: boolean; text?: string }> {
  const rate = Number(localStorage.getItem('gando-tts-rate')) || 0.8;
  const res = await fetch('/api/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ text, languageCode, rate }),
  });
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('audio')) {
    const blob = await res.blob();
    return { audioUrl: URL.createObjectURL(blob) };
  }
  const data = await res.json().catch(() => ({ error: res.statusText })) as { useBrowser?: boolean; text?: string; error?: string; retryAfter?: number };
  if (!res.ok) throw new Error(data.error || `TTS failed: ${res.status}`);
  if (data.useBrowser) return { useBrowser: true, text: data.text };
  throw new Error(data.error || 'TTS failed');
}

export async function transcribeAudio(
  base64Audio: string,
  mimeType: string,
  language: string,
  languageCode?: string
): Promise<string> {
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ audio: base64Audio, mimeType, language, languageCode }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  const data = (await res.json()) as { text: string };
  return data.text;
}
