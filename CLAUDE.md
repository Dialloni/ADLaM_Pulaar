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

## House rules (learned the hard way — do not undo)

- **Never fabricate ADLaM.** New UI strings get English placeholders in the `ff-adlm` block of `src/translations.ts` + an entry in a `docs/i18n/` worklist; Abubakar (native speaker) verifies before they ship. Machine-guessed ADLaM is worse than English.
- **Never trust model output.** Anything saved as app code goes through `sanitizeHtml` (amputate before `<!DOCTYPE`/after `</html>`); a malformed edit response must fail loudly and change NOTHING (`finishEdit` in `lib/llm.ts`).
- **Test `lib/llm.ts` changes with a real model call** (`npx tsx` script hitting `runStream`) before handing over. An untested prompt/parser change once saved model narration into users' apps.
- **Every srcDoc iframe showing app code** must (a) be sandboxed WITHOUT `allow-same-origin` (user code + our origin = stolen BYOK keys), and (b) be wrapped with `injectReporter` from `Preview.tsx` (srcdoc hash links otherwise navigate the frame away → blank).
- **Published apps** are served with a `Content-Security-Policy: sandbox …` header (`lib/publishPage.ts`) — same reason. Don't remove it.
- **Safari (WebKit)**: can't wheel-scroll inside sandboxed iframes (Preview routes Safari to the parent-scroll variant); ignores SVG favicons (PNG fallbacks exist); Safari+localhost login is a known dead end — test Safari on Railway prod, develop on Chrome.

## Workflows

- **Push**: a protected-branch hook blocks Claude pushing `main`. Commit normally (small logical commits), then Abubakar runs `! git push origin main` himself.
- **Local review**: UI changes are shown on localhost and approved BEFORE commit/push.
- **Firebase deploys** (`npx -y firebase-tools deploy --only firestore:rules`): CLI must be logged in as **abubakarbdiallo6@gmail.com** (project owner). The Admin-SDK service account cannot deploy rules. `firebase.json` targets the NAMED database.
- **Named Firestore DB**: client uses `VITE_FIREBASE_FIRESTORE_DATABASE_ID`; server (`lib/firebaseAdmin.ts adminDb()`) honors `FIREBASE_FIRESTORE_DATABASE_ID`/`VITE_` variant. Bare `getFirestore()` hits the empty `(default)` DB — never use it directly.
- **Railway is the primary host** (`gando-ai.up.railway.app`); Vercel is the serverless mirror. Railway stores env values with literal quotes — strip them in code.

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

**Gando AI** — African-language-first AI app builder. Users describe an app in natural language (especially Pulaar/ADLaM script), get a complete single-file HTML app streamed live, and can **publish it to a live URL** with working forms. North star: the ADLaM everything-app — build, chat, translate, and eventually search/answers in ADLaM (see `docs/ROADMAP.md`).

### Server split

| Context | File | Role |
|---------|------|------|
| Dev | `server.ts` | Express + Vite middleware (SSR dev proxy, auth proxy, API routes) |
| Vercel | `api/*.ts` | Serverless functions (one per route) |
| Railway | `server.ts` | Same Express server, production mode |

Shared logic lives in `lib/`: `llm.ts` (providers + protocols), `publishPage.ts` (public app serving), `submissions.ts` (form inbox), `rateLimit.ts`, `firebaseAdmin.ts`.

### LLM layer (`lib/llm.ts`)

**Claude Sonnet 4.6 default** (won internal ADLaM eval); Gemini Flash fallback; Groq free tier; BYOK for `openai | anthropic | gemini | deepseek | groq`.

- **Generate** protocol: `STATUS:` lines → full HTML → `<<<GANDO_META>>>` → JSON meta. Streams live to the editor.
- **Edit** protocol: SEARCH/REPLACE blocks applied server-side (`finishEdit`/`applySearchReplace`) — full rewrite forbidden unless the user explicitly asks to redesign. Gemini fallback keeps a legacy JSON contract.
- Prompt rules enforce: in-file hash-router multi-page nav (no dead links), forms wired to `/api/submit/__GANDO_PROJECT_ID__` (placeholder bound at serve/preview time), readable code, zero commentary outside the protocol.

### API routes

| Route | Purpose |
|-------|---------|
| `POST /api/generate` | Generate new app (SSE) |
| `POST /api/edit` | Incremental diff edit (SSE) |
| `POST /api/chat` | Chat thread (non-generation) |
| `GET  /p/:idOrSlug` | **Public** published app (CSP sandbox, badge) |
| `POST /api/submit/:id` | **Public** form submissions (honeypot, daily caps) |
| `POST /api/transcribe` · `/api/ocr` · `/api/translate` · `/api/speak` | voice/OCR/translate |
| `GET  /api/status` | Health check |

Everything else requires `Authorization: Bearer <Firebase ID token>`.

### Publish & forms

- Publish flag + custom slug on the project doc; `slugs` collection (doc id = slug) claimed transactionally in `src/lib/slug.ts`. Old raw-id links work forever.
- Form submissions land in `projects/<id>/submissions` (server-only writes); owner reads them in the workspace **Inbox** tab.

### Frontend (`src/`)

React 19 + Vite 6 + Tailwind 4. Single-page app — routing in `App.tsx` via `NavPage` union + hash router. Key wiring:

- `src/components/Preview.tsx` — sandboxed double-buffered preview; exports `injectReporter` (error/blank reporting, hash-link interceptor, height reporter); Safari/mobile use the parent-scroll variant; **Fix-it chip** drives `runFix` in App.tsx
- `src/lib/appImages.ts` — attach-time downscale (≤1600px) + Storage upload + embed-URL prompt (photos go in generated apps; never into Firestore — 1MB doc limit)
- `src/lib/slug.ts` — publish link names
- `src/translations.ts` — `TRANSLATIONS` for `ff-adlm | en | fr`, single source of truth; ADLaM = U+1E900–U+1E95F only, RTL (`dir="rtl"` locally, layout stays LTR)
- `src/firebase.ts` — client init; first-party auth proxy hosts for Safari/iOS
- `src/contexts/AuthContext.tsx` — auth state

### Firebase

- Auth: Google OAuth (popup; redirect + first-party proxy on prod hosts for Safari)
- DB: Firestore — **named database** (see Workflows above)
- Storage: uploads under `collector/{uid}/` (avatars, app photos — rules already allow owner image writes; tokenized download URLs are public)
- Admin SDK: `lib/firebaseAdmin.ts` (token verify, named-DB-aware `adminDb()`)

### Corpus pipeline

`scraper/` (Python: Telethon + Playwright, separate Railway service) + AdminPortal OCR/decoder + GandoCollector field recordings. This corpus is the fuel for the ADLaM-quality plan (eval set → glossary injection → summer fine-tune) — see `docs/ROADMAP.md`.

### Brand tokens

Primary: `#3b82f6` (blue). Accent: `#fd8b00` (orange). Tertiary: `#bca2ff` (purple). Font: Manrope. Logo: real ADLaM 𞤘.
