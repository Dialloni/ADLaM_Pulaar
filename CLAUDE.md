# Gando AI — Claude Context

## Who I Am
Abubakar Diallo — junior CS student at NYU (abd9735@nyu.edu). Building Gando AI solo.
West African (Fulani/Pulaar background). Native understanding of ADLaM script context.

## What Gando AI Is
Bolt/Lovable/v0-style app builder where the entire UX is in African languages first.
Users describe apps in Fulani ADLaM script → Gemini 2.5 Flash generates working HTML/CSS/JS → live preview.
Live at: https://gando-ai.vercel.app

## Tech Stack
- Frontend: React 19 + TypeScript + Vite 6 + Tailwind CSS v4
- Backend: Express + tsx (Node.js)
- AI: Google Gemini 2.5 Flash via @google/genai
- Auth + DB: Firebase Auth + Firestore
- Deploy: Vercel (frontend) + Firebase (auth/db)
- Fonts: Manrope (display), Noto Sans Adlam (ADLaM script), JetBrains Mono (code)

## Key Files
- `src/App.tsx` — ALL pages rendered here (landing, dashboard, projects, templates, docs, status, assets/languages)
- `src/translations.ts` — UI strings for EN / FR / ff-adlm (ADLaM), includes twPhrases[]
- `src/index.css` — design tokens (CSS vars), Tailwind v4
- `api/generate.ts` — POST /api/generate → Gemini app generation
- `api/edit.ts` — POST /api/edit → iterative edits
- `server.ts` — Express entry, mounts /api/*, serves Vite in dev

## Pages (NavPage type)
`'dashboard' | 'projects' | 'assets' | 'templates' | 'docs' | 'status'`
- `assets` = Languages page (ADLaM alphabet reference + language switcher)
- `dashboard` = main builder (chat + preview + code editor)

## Design System ("Nexus Builder" aesthetic)
- Primary: #ff8b9b (rose/flamingo)
- Secondary: #fd8b00 (orange)
- Tertiary: #bca2ff (lavender)
- Background: #0e0e0e (obsidian)
- All design tokens in `src/index.css` as CSS vars
- Gradient text: `ds-gradient-text` class
- ADLaM font class: `ds-adlam` or `font-adlam`

## ADLaM Unicode
Block: U+1E900–U+1E95F
28 core letters + 6 loan letters
RTL script. Use `dir="rtl"` on ADLaM containers.
Noto Sans Adlam font required.

## Languages Supported
- ff-adlm (Fulani ADLaM) — full UI + generation
- fr (Français) — full UI + generation
- en (English) — full UI + generation
- Swahili / Yoruba / Hausa / Wolof — generation only (no UI translation yet)

## Data / AI Research Direction
Building ADLaM corpus for fine-tuning. Three data sources:
1. Telethon Telegram scraper (ADLaM messages from Pulaar groups)
2. PDF OCR on NYU Greene HPC (digitizing ADLaM books)
3. GANDO Collector (in-app feature: users upload + label real-world photos in ADLaM)

Pipeline plan: collect → scrub (adlam_ratio ≥ 0.70) → admin verify → RAG (inject into Gemini) → eventually LoRA fine-tune on Llama 3.2 3B

NYU Greene HPC access: /scratch/abd9735/ for large datasets. SLURM job arrays for parallelization.

## What NOT to Do
- Never commit .env (Firebase keys, Gemini key, service account private key)
- Don't add unnecessary comments to code
- Don't over-abstract — keep it simple, no premature patterns
- Don't mock Firebase in tests — use real DB

## Current Priorities (as of May 2026)
1. GANDO Collector page (in-app labeled data collection)
2. Technical ADLaM dictionary (JSON) → inject into Gemini system prompt
3. 50-example eval set (hand-verified ADLaM → code benchmarks)
4. Telethon scraper running on Greene
5. Admin verification dashboard
6. RAG pipeline (Pinecone or pgvector)
