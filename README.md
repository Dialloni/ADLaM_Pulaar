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

Gando AI is a **Replit/Lovable-style app builder** where the entire experience — prompts, explanations, and UI chrome — happens in **African languages first**.

Most AI coding tools are English-only, creating a barrier for people who think and create in languages like Fulani, Swahili, Yoruba, or Hausa. Gando removes that barrier:

- **Input** → describe your app in your language (Fulani ADLaM script, Swahili, English, French, and more)
- **Output** → a working single-file web app with explanations in your language
- **Iterate** → keep chatting to refine, with full version history and one-click revert

---

## Features

### Core

- 🌍 African-language generation — describe your app in Fulani (ADLaM), Swahili, Yoruba, Hausa, Wolof, and more
- ⚡ Single-call AI pipeline — one Gemini request detects language + generates app + writes explanation
- 👁 Live preview — generated HTML/CSS/JS renders in a sandboxed browser frame
- 💬 Iterative chat — refine your app through conversation; AI makes incremental edits
- 🔄 Version history + revert — every AI response saves a code snapshot; one click to go back

### UI / UX

- 𞤆𞤓𞤂𞤀𞥄𞤈 Full ADLaM script support — all nav, buttons, and labels switch to Fulani script (Noto Sans Adlam)
- 🔍 Live project search — header search with instant results dropdown
- 📊 Real-time dashboard — project completion donut, token usage gauge, performance metrics
- 🎨 Nexus Builder design — dark theme, pink/orange neon gradients, Manrope font

### Platform

- 🔐 Firebase Auth — Google sign-in + email/password
- 💾 Firestore persistence — projects and chat history saved automatically
- 📖 Documentation page — in-app translated docs (EN / FR / ADLaM)
- 🟢 System status page — real backend health check (server uptime, Gemini latency, Firebase)
- 📥 Download — export any generated app as a standalone `.html` file

---

## Tech Stack

| Layer      | Technology                                               |
| ---------- | -------------------------------------------------------- |
| Frontend   | React 19, TypeScript, Vite 6, Tailwind CSS v4            |
| UI         | Manrope + Noto Sans Adlam, Lucide icons, Motion (Framer) |
| Backend    | Express + tsx (Node.js dev server)                       |
| AI         | Google Gemini 2.5 Flash via `@google/genai`              |
| Auth & DB  | Firebase Authentication + Firestore                      |

---

## Project Structure

```text
gando-ai_coA/
├── server.ts                     # Express + Gemini proxy (/api/generate, /api/edit, /api/status)
├── src/
│   ├── App.tsx                   # Root — all pages (Dashboard, Projects, Docs, Status, Workspace)
│   ├── translations.ts           # UI strings in English, Français, Fulani (ADLaM)
│   ├── types.ts                  # TypeScript types (Project, Message, GenerationResult)
│   ├── firebase.ts               # Firebase init + helpers
│   ├── components/
│   │   ├── Chat.tsx              # Chat panel (messages, input, voice, revert buttons)
│   │   ├── Preview.tsx           # Sandboxed iframe browser preview
│   │   ├── CodeEditor.tsx        # Syntax-highlighted code editor
│   │   ├── LanguageSelector.tsx  # Portal-based dropdown (escapes CSS transforms)
│   │   └── ErrorBoundary.tsx
│   ├── services/
│   │   └── geminiService.ts      # Fetch client → /api/generate, /api/edit, /api/transcribe
│   ├── contexts/
│   │   └── AuthContext.tsx       # Firebase auth state
│   └── lib/
│       └── utils.ts              # cn() helper
├── .env.example                  # Required env vars template
├── firebase-applet-config.json
├── firestore.rules
└── vite.config.ts
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

Copy `.env.example` to `.env` and fill in your key:

```bash
cp .env.example .env
```

Open `.env` and add:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

> ⚠️ Never commit `.env` — it is already in `.gitignore`.

### 4. Configure Firebase

Edit `firebase-applet-config.json` with your Firebase project credentials. Enable **Google sign-in** in Firebase Console → Authentication → Sign-in method.

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

### Template Intelligence

When a prompt mentions a known category (e-commerce, restaurant, portfolio, booking, blog, dashboard), the server injects a structural hint — similar to Lovable/Framer starter templates — so the AI generates a complete, realistic app instead of a skeleton.

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

| Variable                   | Required | Default            | Description               |
| -------------------------- | -------- | ------------------ | ------------------------- |
| `GEMINI_API_KEY`           | Yes      | —                  | Google AI Studio API key  |
| `GEMINI_MODEL`             | No       | `gemini-2.5-flash` | Gemini model to use       |
| `GEMINI_MAX_OUTPUT_TOKENS` | No       | `32768`            | Max tokens per generation |
| `PORT`                     | No       | `3000`             | Server port               |

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
- [ ] Template gallery on empty state
- [ ] Mobile-responsive layout
- [ ] Voice-to-text polish with visual waveform feedback
- [ ] Export to GitHub Gist

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
