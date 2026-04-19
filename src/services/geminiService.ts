import { GenerationResult, Message } from '../types';

export interface GenerationResponse extends GenerationResult {
  language: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function generateProject(
  prompt: string,
  preferredLanguage: string,
  onStatus?: (status: string) => void
): Promise<GenerationResponse> {
  onStatus?.('Generating your app...');
  return postJson<GenerationResponse>('/api/generate', { prompt, preferredLanguage });
}

export async function editProject(
  prompt: string,
  currentCode: string,
  history: Message[],
  preferredLanguage: string,
  onStatus?: (status: string) => void
): Promise<GenerationResponse> {
  onStatus?.('Applying your changes...');
  const trimmed = history.slice(-6).map((m) => ({ role: m.role, content: m.content }));
  return postJson<GenerationResponse>('/api/edit', {
    prompt,
    currentCode,
    history: trimmed,
    preferredLanguage,
  });
}

export async function transcribeAudio(
  base64Audio: string,
  mimeType: string,
  language: string
): Promise<string> {
  const data = await postJson<{ text: string }>('/api/transcribe', {
    audio: base64Audio,
    mimeType,
    language,
  });
  return data.text;
}
