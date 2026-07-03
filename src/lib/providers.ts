import type { Provider, ByokProvider } from '../services/geminiService';

export const PROVIDER_LABEL: Record<Provider, string> = {
  'claude': 'Claude',
  'gemini': 'Gemini',
  'groq-llama': 'Llama 3.3',
  'groq-scout': 'Llama 4 Scout',
  'byok-openai': 'OpenAI',
  'byok-anthropic': 'Claude',
  'byok-gemini': 'Gemini',
  'byok-deepseek': 'DeepSeek',
  'byok-groq': 'Groq',
};

export const PROVIDER_COLOR: Record<Provider, string> = {
  'claude': '#3b82f6',
  'gemini': '#5b9bff',
  'groq-llama': '#22c55e',
  'groq-scout': '#f59e0b',
  'byok-openai': '#10a37f',
  'byok-anthropic': '#d97757',
  'byok-gemini': '#5b9bff',
  'byok-deepseek': '#4d6bfe',
  'byok-groq': '#f55036',
};

export const MODEL_OPTIONS: { id: Provider; label: string; sub: string }[] = [
  { id: 'claude', label: 'Claude Sonnet 4.6', sub: 'Best ADLaM quality' },
  { id: 'gemini', label: 'Gemini 2.5 Flash', sub: 'Free tier · Google' },
  { id: 'groq-llama', label: 'Llama 3.3 70B', sub: 'Free · Groq · Fast' },
  { id: 'groq-scout', label: 'Llama 4 Scout', sub: 'Free · Groq · Multimodal' },
];

// BYOK provider registry — used by the "Bring your own key" settings modal and to
// build dynamic model-picker entries for any provider the user has saved a key for.
export const BYOK_PROVIDERS: { id: ByokProvider; label: string; model: string; placeholder: string; keysUrl: string }[] = [
  { id: 'openai',    label: 'OpenAI (ChatGPT)',   model: 'gpt-4o',                  placeholder: 'sk-...',     keysUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', label: 'Claude (Anthropic)', model: 'claude-sonnet-4-6',       placeholder: 'sk-ant-...', keysUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'gemini',    label: 'Gemini (Google)',    model: 'gemini-2.5-flash',        placeholder: 'AIza...',    keysUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 'deepseek',  label: 'DeepSeek',           model: 'deepseek-chat',           placeholder: 'sk-...',     keysUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'groq',      label: 'Groq (Llama)',       model: 'llama-3.3-70b-versatile', placeholder: 'gsk_...',    keysUrl: 'https://console.groq.com/keys' },
];

export const BYOK_STORAGE_KEY = 'gando_byok';

export function loadByokKeys(): Partial<Record<ByokProvider, string>> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(BYOK_STORAGE_KEY) || '{}'); } catch { return {}; }
}
