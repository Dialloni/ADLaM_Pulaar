# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- NEVER save working files or tests to root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts`
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- NEVER add a `Co-Authored-By` trailer to commits
- Keep files under 500 lines
- Validate input at system boundaries

## Commands

```bash
npm run dev        # dev server (Express + Vite via tsx server.ts)
npm run build      # Vite production build → dist/
npm run start      # production Express server
npm run lint       # tsc --noEmit (type-check only, no test suite)
```

Individual scripts:
```bash
npx tsx scripts/dump-i18n.ts          # export translation worklist
npx tsx scripts/apply-adlam.ts <file> # apply ADLaM translations from JSON
npx tsx scripts/remaining-i18n.ts     # show untranslated keys
```

## Architecture

**Gando AI** — African-language-first AI app builder. Users describe an app in natural language (especially Pulaar/ADLaM script) and the system generates a complete single-file HTML app, streamed live.

### Server split

| Context | File | Role |
|---------|------|------|
| Dev | `server.ts` | Express + Vite middleware (SSR dev proxy, auth proxy, API routes) |
| Vercel | `api/*.ts` | Serverless functions (one per route) |
| Railway | `server.ts` | Same Express server, production mode |

`server.ts` and `api/*.ts` share logic from `lib/llm.ts` and `lib/firebaseAdmin.ts`.

### LLM layer (`lib/llm.ts`)

**Claude Sonnet 4.6 is the default** (won internal ADLaM eval 10/10). Gemini Flash is the fallback. Both providers normalize to this output protocol:

```
<!DOCTYPE html>...app HTML...
<<<GANDO_META>>>
{"language":"...","name":"...","explanation":"..."}
```

Code streams first (live preview), metadata arrives at end. BYOK supported for: `openai`, `anthropic`, `gemini`, `deepseek`, `groq`.

### Frontend (`src/`)

React 19 + Vite 6 + Tailwind 4. Single-page app — all routing is in `App.tsx` via `NavPage` union type. Key wiring:

- `src/firebase.ts` — Firebase client init; first-party auth proxy for Safari/iOS (see comment block)
- `src/contexts/AuthContext.tsx` — auth state
- `src/services/geminiService.ts` — fetch wrapper for SSE streams from `/api/*`
- `src/translations.ts` — i18n strings for `ff-adlm | en | fr`; `TRANSLATIONS` object is the single source of truth

### API routes

| Route | Purpose |
|-------|---------|
| `POST /api/generate` | Generate new app from prompt |
| `POST /api/edit` | Incremental edit of existing app |
| `POST /api/chat` | Chat thread (non-generation) |
| `POST /api/transcribe` | Whisper audio → text |
| `POST /api/ocr` | PDF/image → text via Gemini |
| `POST /api/translate` | Text translation |
| `GET  /api/status` | Health check |

All routes require `Authorization: Bearer <Firebase ID token>` (verified via `lib/firebaseAdmin.ts`).

### i18n / ADLaM localization

`src/translations.ts` exports `TRANSLATIONS` with keys `'ff-adlm' | 'en' | 'fr'`. The ADLaM locale uses Unicode block U+1E900–U+1E95F exclusively — **never** substitute Arabic, Extended Latin, or Mathematical lookalikes.

ADLaM text is RTL. Any UI element rendering ADLaM must set `dir="rtl"`. Use `Noto Sans Adlam` font.

Translation workflow:
1. `dump-i18n.ts` → generates `docs/i18n/english-source.json` + worklist CSV
2. Human translates to ADLaM
3. `apply-adlam.ts <updated.json>` → patches `src/translations.ts` in-place

### Firebase

- Auth: Google OAuth via `signInWithPopup`
- DB: Firestore — named database (`VITE_FIREBASE_FIRESTORE_DATABASE_ID` env var, not `(default)`)
- Storage: Firebase Storage for file uploads (OCR, audio)
- Admin SDK: `lib/firebaseAdmin.ts` for server-side token verification

### Deployment

| Host | Config |
|------|--------|
| Vercel | `vercel.json` — rewrites `/api/*` to serverless functions, proxies `/__/auth/*` for first-party auth |
| Railway (web) | `railway.toml` — nixpacks, `npm run start` |
| Railway (scraper) | `railway.scraper.toml` — separate service |

**Railway env var gotcha**: Railway stores values with surrounding quotes literally — `"value"` in the dashboard becomes `"value"` in the process. Strip quotes when setting vars.

### Scraper (`scraper/`)

Python (Telethon + Playwright) corpus collection pipeline. Separate Railway service. Scrapes Telegram groups and web for Pulaar/ADLaM text, uploads to Firestore.

### Brand tokens

Primary: `#3b82f6` (blue). Accent: `#fd8b00` (orange). Tertiary: `#bca2ff` (purple). Font: Manrope.
