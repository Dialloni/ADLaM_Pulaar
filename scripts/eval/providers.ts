// Provider adapters. Both return the same shape so the eval can compare apples-to-apples.
// Same SYSTEM_PROMPT, same user-content assembly. Differences in output = the model, not the harness.

import { GoogleGenAI, Type } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './system-prompt.js';
import type { EvalPrompt } from './prompts.js';

export interface GenResult {
  language: string;
  name: string;
  code: string;
  explanation: string;
}

export interface ProviderRun extends Partial<GenResult> {
  ok: boolean;
  error?: string;
  ms: number;
  raw?: string;
}

const MAX_TOKENS = 32768;

function buildUserContent(p: EvalPrompt): string {
  const hint = p.preferredLanguage ? `Preferred output language: ${p.preferredLanguage}\n\n` : '';
  return `${hint}User Prompt:\n${p.prompt}`;
}

function parseJson(text: string): GenResult {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned) as GenResult;
}

// ---- Gemini ----
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

export async function runGemini(p: EvalPrompt, model: string): Promise<ProviderRun> {
  const t0 = Date.now();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  let lastErr = '';
  // One retry on transient 500/INTERNAL — large ADLaM outputs sometimes flake.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: buildUserContent(p),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_SCHEMA,
          maxOutputTokens: MAX_TOKENS,
          temperature: 0.8,
        },
      });
      const raw = res.text?.trim() || '';
      return { ok: true, ms: Date.now() - t0, raw, ...parseJson(raw) };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      if (!/500|INTERNAL|503|UNAVAILABLE/i.test(lastErr)) break;
    }
  }
  return { ok: false, ms: Date.now() - t0, error: lastErr };
}

// ---- Claude ----
export async function runClaude(p: EvalPrompt, model: string): Promise<ProviderRun> {
  const t0 = Date.now();
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
    // Stream: SDK blocks non-streaming requests whose max_tokens could exceed 10 min.
    const stream = client.messages.stream({
      model,
      max_tokens: MAX_TOKENS,
      temperature: 0.8,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserContent(p) }],
    });
    const msg = await stream.finalMessage();
    const block = msg.content.find((b) => b.type === 'text');
    const raw = block && 'text' in block ? block.text : '';
    return { ok: true, ms: Date.now() - t0, raw, ...parseJson(raw) };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, error: err instanceof Error ? err.message : String(err) };
  }
}
