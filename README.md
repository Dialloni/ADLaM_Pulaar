> 🚀 **[Try it live → gando-ai.vercel.app](https://gando-ai.vercel.app)**

# 𞤘𞤢𞤲𞤣𞤮 AI — Gando AI

## African-Language-First App Builder

**Build web apps by describing them in your African language.**
Powered by Google Gemini 2.5 · Built with React + TypeScript + Firebase

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org)
[![Firebase](https://img.shields.io/badge/Firebase-12-orange.svg)](https://firebase.google.com)

---

## What is Gando AI?

Gando AI is a **Bolt/Lovable/v0-style app builder** where the entire experience — landing page, prompts, explanations, and UI chrome — happens in **African languages first**.

Most AI coding tools are English-only, creating a barrier for people who think and create in languages like Fulani, Swahili, Yoruba, or Hausa. Gando removes that barrier:

- **Input** → describe your app in your language (Fulani ADLaM script, French, English, and more)
- **Output** → a working single-file web app with explanations in your language
- **Iterate** → keep chatting to refine, with full version history and one-click revert

---

## Features

### Core

- 🌍 African-language generation — describe your app in Fulani (ADLaM), English, French, and more
- ⚡ Single-call AI pipeline — one Gemini request detects language + generates app + writes explanation
- 👁 Live preview — generated HTML/CSS/JS renders in a sandboxed browser frame
- 💬 Iterative chat — refine your app through conversation; AI makes incremental edits
- 🔄 Version history + revert — every AI response saves a code snapshot; one click to go back

### UI / UX

- 🏠 Bolt-style marketing landing page — navbar, animated typewriter hero, templates grid, 3-column footer
- 𞤆𞤓𞤂𞤀𞥄𞤈 Full ADLaM script support — nav, buttons, landing page headline all switch to Fulani script
- 🔤 ADLaM Display font — Microsoft's OFL display typeface rendered in the hero heading
- 🔍 Live project search — header search with instant results dropdown
- 🎨 Nexus Builder design — dark obsidian theme, pink/orange neon gradients, Manrope font
- ✍️ Typewriter placeholder — animated cycling phrases on landing page and dashboard textarea

### Platform

- 🔐 Firebase Auth — Google sign-in + email/password
- 💾 Firestore persistence — projects and chat history saved automatically
- 📖 Documentation page — in-app translated docs (EN / FR / ADLaM)
- 🟢 System status page — real backend health check (server uptime, Gemini latency, Firebase)
- 🌐 Languages page — active language switcher, coming-soon languages, full ADLaM alphabet reference (28 core letters + 6 loan, with IPA)

### ADLaM Corpus Pipeline (Admin)

- 📄 PDF OCR — upload PDF books/documents; Gemini 2.0 Flash extracts ADLaM text as proper Unicode
- 📋 Paste Text — paste ADLaM text directly; auto-detects encoding, flags pre-Unicode Arabic-mapped text
- 🔍 Encoding inspector — shows Unicode range of pasted text (ADLaM block, Arabic block, or unknown)
- 🤖 AI decode — re-encodes pre-Unicode font text (Arabic codepoints) → correct ADLaM Unicode block
- ✅ Review queue — admin verification workflow; approve / reject / export as JSONL
- 📤 JSONL export — one-click download of verified corpus entries for fine-tuning

---

## Tech Stack

| Layer      | Technology                                               |
| ---------- | -------------------------------------------------------- |
| Frontend   | React 19, TypeScript, Vite 6, Tailwind CSS v4            |
| UI         | Manrope + Noto Sans Adlam + ADLaM Display, Lucide icons  |
| Backend    | Express + tsx (Node.js dev server)                       |
| AI         | Google Gemini 2.5 Flash + 2.0 Flash via `@google/genai` |
| Auth & DB  | Firebase Authentication + Firestore + Storage            |
| Deploy     | Vercel (frontend + serverless API)                       |

---

## Project Structure

```text
ADLaM_Pulaar/
├── server.ts                     # Express entry — mounts /api/* routes, serves Vite in dev
├── api/
│   ├── generate.ts               # POST /api/generate   — Gemini app generation
│   ├── edit.ts                   # POST /api/edit       — Gemini iterative edits
│   ├── ocr.ts                    # POST /api/ocr        — Gemini multimodal PDF/image OCR
│   ├── transcribe.ts             # POST /api/transcribe — voice-to-text
│   └── status.ts                 # GET  /api/status     — health check
├── lib/
│   └── firebaseAdmin.ts          # Firebase Admin SDK init (server-side)
├── public/
│   └── fonts/
│       └── ADLaMDisplay-Regular.woff2  # Microsoft ADLaM Display font (OFL-1.1)
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root — landing page, auth modal, all app pages
│   ├── index.css                 # Design tokens (CSS vars), Tailwind v4, global styles
│   ├── translations.ts           # UI strings in English, Français, Fulani ADLaM + twPhrases[]
│   ├── types.ts                  # TypeScript types (Project, Message, GenerationResult)
│   ├── firebase.ts               # Firebase client SDK init + Firestore helpers
│   ├── components/
│   │   ├── AdminPortal.tsx       # Corpus admin — PDF OCR, paste text, review queue, JSONL export
│   │   ├── GandoLogo.tsx         # SVG logo component (color + mono variants)
│   │   ├── Chat.tsx              # Chat panel (messages, input, voice, revert buttons)
│   │   ├── Preview.tsx           # Sandboxed iframe browser preview
│   │   ├── CodeEditor.tsx        # Syntax-highlighted code editor
│   │   ├── LanguageSelector.tsx  # Portal-based language dropdown
│   │   └── ErrorBoundary.tsx
│   ├── services/
│   │   └── geminiService.ts      # Fetch client → /api/generate, /api/edit, /api/transcribe
│   ├── contexts/
│   │   └── AuthContext.tsx       # Firebase auth state (Google + email/password)
│   └── lib/
│       └── utils.ts              # cn() Tailwind class helper
├── .env.example                  # Required env vars template
├── .firebaserc                   # Firebase project alias
├── firebase.json                 # Firebase config (Firestore rules path)
├── firestore.rules               # Firestore security rules
└── vite.config.ts                # Vite + Tailwind v4 plugin config
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com) account (free Gemini API key)
- A Firebase project with **Authentication** and **Firestore** enabled

### 1. Clone the repo

```bash
git clone https://github.com/Dialloni/ADLaM_Pulaar.git
cd ADLaM_Pulaar
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

> ⚠️ Never commit `.env` — it is already in `.gitignore`.

### 4. Configure Firebase

Add your Firebase client credentials to `.env`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

For server-side Firebase Admin (Firestore writes), also add:

```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

Enable **Google sign-in** in Firebase Console → Authentication → Sign-in method.

**Vercel deployment:** add `https://your-app.vercel.app` to:
1. Firebase Console → Authentication → Authorized Domains
2. Google Cloud Console → APIs & Services → Credentials → OAuth Web Client → Authorized JavaScript Origins + Redirect URIs (`/__/auth/handler`)

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How It Works

### AI Pipeline — one Gemini call

```text
User prompt (any language)
        ↓
POST /api/generate  (server.ts)
        ↓
Gemini 2.5 Flash
  · Detects input language (Fulani, Swahili, English …)
  · Generates full HTML / Tailwind / JS app
  · Writes explanation in detected language
  · Returns JSON: { language, name, code, explanation }
        ↓
Preview rendered in sandboxed iframe
Explanation shown in chat
```

No separate translation round-trips. Language detection, generation, and explanation happen in one structured JSON response.

### Corpus OCR Pipeline

```text
PDF upload (browser)
        ↓
Encode entire PDF → base64
        ↓
POST /api/ocr
        ↓
Gemini 2.0 Flash (multimodal)
  · Reads all pages in one call
  · Outputs ADLaM Unicode text (U+1E900–U+1E95F)
        ↓
Saved to Firestore corpus collection
Admin review → approve → JSONL export
```

### Template Intelligence

When a prompt mentions a known category (e-commerce, restaurant, portfolio, booking, blog, dashboard), the server injects a structural hint so the AI generates a complete, realistic app instead of a skeleton.

---

## Supported Languages

| Language                | Generation | UI                   |
| ----------------------- | ---------- | -------------------- |
| Fulani / Pulaar (ADLaM) | Yes        | Yes — full ADLaM UI  |
| English                 | Yes        | Yes                  |
| Français                | Yes        | Yes                  |
| Swahili                 | Yes        | Generation only      |
| Yoruba                  | Yes        | Generation only      |
| Hausa                   | Yes        | Generation only      |
| Wolof                   | Yes        | Generation only      |
| Amharic                 | Yes        | Generation only      |

---

## Environment Variables

| Variable                   | Required | Default            | Description                        |
| -------------------------- | -------- | ------------------ | ---------------------------------- |
| `GEMINI_API_KEY`           | Yes      | —                  | Google AI Studio API key           |
| `GEMINI_MODEL`             | No       | `gemini-2.5-flash` | Gemini model for app generation    |
| `GEMINI_MAX_OUTPUT_TOKENS` | No       | `32768`            | Max tokens per generation          |
| `PORT`                     | No       | `3000`             | Server port                        |

---

## Scripts

```bash
npm run dev      # Start development server (Express + Vite HMR)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # TypeScript type check
```

---

## Roadmap

- [ ] Streaming generation (show output as Gemini types)
- [ ] Public share URLs (deploy generated apps to a subdomain)
- [ ] Anonymous first-use (generate before login)
- [ ] More African language UI translations (Swahili, Yoruba, Hausa)
- [ ] Telethon scraper — pull ADLaM messages from Telegram groups for corpus
- [ ] RAG pipeline — inject verified ADLaM corpus into Gemini system prompt (Pinecone / pgvector)
- [ ] LoRA fine-tune on Llama 3.2 3B with verified ADLaM corpus
- [ ] GANDO Collector — in-app labeled image upload for real-world ADLaM data
- [ ] Mobile-responsive layout
- [ ] Export to GitHub Gist
- [x] Template gallery (landing page + dashboard)
- [x] Language switcher UI (ADLaM / FR / EN) with live landing page translation
- [x] ADLaM Display font (Microsoft OFL) in hero heading
- [x] PDF OCR via Gemini 2.0 Flash multimodal
- [x] Admin corpus portal — review queue, paste text, JSONL export
- [x] Pre-Unicode ADLaM font decoder (Arabic-mapped → Unicode ADLaM)
- [x] Vercel production deployment with Firebase Auth

---

## Contributing

Pull requests are welcome. For major changes please open an issue first.

1. Fork the repo
2. Create your branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m "Add my feature"`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

MIT © [Abubakar Diallo](https://github.com/Dialloni)

---

**𞤘𞤢𞤲𞤣𞤮 — Build apps in your language.**

Made with ❤️ for African language communities.
