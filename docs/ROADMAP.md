# 𞤘 Gando — Roadmap & How You Can Help

Gando is an **African-language-first AI app builder**: describe an app in Pulaar
(ADLaM script), French, or English and get a working, publishable website — no
code, no English required. Built by [Abubakar Diallo](https://github.com/Dialloni),
a Fulani CS student at NYU, for the 40M+ Pulaar speakers whose language barely
exists on the web.

**Status: live beta** at [gando-ai.up.railway.app](https://gando-ai.up.railway.app) · Free during beta

---

## ✅ Shipped (as of July 2026)

**Create**
- App generation from natural-language prompts in ADLaM/French/English (Claude Sonnet default, Gemini fallback, Groq free tier, BYOK for 5 providers)
- Live streaming builds with split chat/preview workspace
- Vision input (sketch → app) and **user photos embedded into the generated site** (in-browser downscale → Firebase Storage)
- Real multi-page navigation inside single-file apps (hash router, working Back button)
- Voice input (Whisper, ADLaM-aware) and TTS replies

**Share**
- **Publish to a live URL** — `/p/your-chosen-name`, custom link names, CSP-sandboxed serving
- **Working forms + owner Inbox** — contact/order forms on published apps deliver to the builder's dashboard (honeypot + rate caps)
- Community template gallery with admin curation and remix

**Iterate**
- **Surgical diff edits** (SEARCH/REPLACE patches — seconds instead of full rebuilds; malformed responses can never corrupt an app)
- **Self-healing** — runtime errors and blank screens surface a one-tap "Fix it" chip
- Version history with one-click revert; stop mid-build keeps partial work

**Foundation**
- Full ADLaM UI (RTL, joined/unjoined reading modes, verified translations)
- ADLaM corpus pipeline: PDF OCR, legacy-encoding decoder, Telegram/web harvester, field data collector with audio recording
- Security: sandboxed user-code everywhere, Firestore rules, secret scanning, per-user rate limits

---

## 🎯 Priorities — what we're working on next (in order)

### 1. ADLaM output quality — THE core problem *(now)*
Large models render ADLaM script correctly but often produce **fluent-looking
gibberish** — the script is right, the Pulaar isn't. They saw almost no real
Pulaar during training. Attack plan, in order:

| Step | What | Status |
|---|---|---|
| **Eval set** | 50–100 prompts with native-speaker-verified correct outputs, so every improvement is measurable instead of vibes | building — **native speakers needed** |
| **Verified glossary / few-shot** | inject human-verified English↔ADLaM pairs into prompts; models imitate in-context examples far better than they recall training data | worklist in review |
| **Corpus growth** | more real Pulaar text (harvester runs daily; books, radio transcripts, community submissions all welcome) | ongoing — **data leads needed** |

### 2. Product polish *(weeks)*
- Complete ADLaM translations for the newest UI strings (worklist under `docs/i18n/`)
- Auth polish (login flicker with browser autofill; faster first sign-in)
- Wire or remove the GitHub/Figma import stubs

### 3. Own model *(summer → fall 2026)*
The real fix for ADLaM quality — grammar has to live in the weights:
- **Tokenizer extension** — add ADLaM characters/subwords to an open model's vocabulary (ADLaM currently shatters into byte tokens: expensive and error-prone)
- **Continued pretraining** on the Pulaar corpus, then **SFT** on instruction pairs (Qwen/Llama/Gemma-class, small)
- Honest framing: a proof-of-concept specialist, not a frontier-model replacement. **Data is the bottleneck** — see #1.
- RAG only as translation-memory for fixed strings (it anchors phrasing; it does not teach grammar)

### 4. Later — toward the ADLaM everything-app
- **ADLaM answers/search** — search the web, fetch, summarize, and translate results into ADLaM so Pulaar speakers can research and learn in their own script (depends on #1/#3: translation quality must come first)
- First-class translation mode (any text → verified-quality ADLaM)
- Pulaar STT/TTS fine-tuned on collected recordings (needs ~1k–3k verified clips)
- Custom domains for published apps; GitHub export
- More African languages (Wolof, Hausa, Swahili, Yoruba, Bambara…) — the architecture is language-agnostic; each one needs native reviewers

---

## 🤝 Help wanted — in priority order

1. **Native Pulaar/ADLaM speakers** *(highest value, no coding needed)* — verify translations, judge model outputs for the eval set, contribute sentences. An hour of a fluent reader's time is worth more than a week of engineering right now.
2. **ADLaM text data** — books, articles, transcripts, social posts, anything in real ADLaM. Pointers to sources count too.
3. **ML engineers** — tokenizer extension, continued-pretraining/SFT experience with small open models, eval harness design.
4. **Frontend/full-stack** — React 19 + Vite + Tailwind + Firebase. Good first issues: i18n gaps, mobile polish, accessibility.
5. **Funding & compute** — GPU credits for fine-tuning, API credits for the free beta tier, or startup-program introductions (the beta currently runs on one student's budget).

**Get in touch:** open an issue on this repo, or email **gandoadlam25@gmail.com**.

## Contributing basics

- Stack, setup, and architecture: see [README](../README.md)
- `npm install && npm run dev` — you'll need your own Firebase project + at least one LLM key (`.env`, see README)
- `npm run lint` must pass; keep files under 500 lines; never commit secrets
- ADLaM strings must be verified by a native speaker before merging — **never ship machine-guessed ADLaM**
