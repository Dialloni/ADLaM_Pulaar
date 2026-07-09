# Gando AI — Startup Program Application Kit

Reusable answers for NVIDIA Inception, Microsoft for Startups Founders Hub, Google for Startups Cloud, AWS Activate. Copy/paste per form. Keep one source of truth here.

---

## Quick facts (form fields)

| Field | Value |
|-------|-------|
| Company / project | Gando AI |
| Website / demo | (your deployed app URL) |
| Founded | 2026 |
| Stage | Pre-seed / early, building |
| Team size | 1 (founder) |
| Industry | Artificial Intelligence / Developer Tools / NLP |
| Use case | Generative AI app builder, low-resource language NLP |
| Location | New York, USA |
| Founder | Abubakar Diallo — NYU (CS), Fulani/Pulaar background |

---

## One-liner

Gando AI is an African-language-first AI app builder: users describe an app in natural language — including Pulaar in the ADLaM script — and Gando generates a complete working app, live.

## Problem (2–3 sentences)

40M+ Fulani/Pulaar speakers, and hundreds of millions across African languages, are locked out of modern AI tooling that assumes English and Latin script. Existing LLMs tokenize non-Latin scripts like ADLaM at 3–4x cost and hallucinate on under-represented languages. No-code/AI app builders ignore these languages entirely.

## Solution

Gando lets anyone build software by describing it in their own language. It streams a complete single-file app live, supports Pulaar/ADLaM (RTL, Unicode U+1E900–U+1E95F), French, and English, and is building toward a custom ADLaM-aware model: a corpus pipeline feeds a tokenizer extension + fine-tune that cuts token cost and hallucination for the language.

## Why now

- Open-weight frontier models (GLM-5.2 MIT, Qwen, Llama, Nemotron) make a specialized low-resource model feasible for a small team.
- ADLaM script adoption is growing fast among Fulani communities.
- Tooling (vLLM, LoRA, NIM) lets a solo founder fine-tune + serve an OpenAI-compatible model cheaply.

## Traction

- Live product: AI app generation, streaming preview, multimodal collector (text/image/audio), OCR corpus pipeline.
- Active corpus-collection pipeline (Telegram + web scrape → Firestore review queue) building Pulaar/ADLaM training data.
- Internal ADLaM eval: Claude Sonnet won 10/10; benchmarking open models as cheaper BYOK options.

## Tech stack (why we need GPU/credits)

React 19 + Vite frontend; Express/Vercel/Railway backend; Claude + Gemini + multi-provider BYOK (OpenAI-compatible) LLM layer. **The ask:** GPU + inference credits to (1) fine-tune an open base (Qwen/Llama/Gemma/GLM) on our ADLaM corpus with an extended tokenizer, and (2) self-host it as an OpenAI-compatible endpoint (vLLM/NIM) to serve users affordably.

## The ask (per program)

- **NVIDIA Inception:** DGX Cloud / NIM credits to fine-tune + serve the ADLaM model; GPU compute for tokenizer + LoRA training.
- **MS Founders Hub:** Azure + Azure OpenAI credits for inference + hosting.
- **Google for Startups:** GCP credits for training + serving.
- **AWS Activate:** EC2 GPU + Bedrock credits.

## Mission narrative (the hook — lead with this)

Most of the world's languages are invisible to AI. Gando starts with Pulaar/ADLaM — the founder's own language — to prove that a small team plus the right data can bring frontier AI to an under-served language, then generalize across African languages. This is digital inclusion for tens of millions who have been left out of the AI era.

---

## Tips
- Use a domain email (founder@yourdomain), not gmail — biggest legitimacy signal.
- Attach the live demo link + GitHub on every form.
- Mention NYU (student/research angle helps NVIDIA + Google).
- Apply order: NVIDIA Inception request form (+ the +4k NIM credit form first) → Founders Hub → Google for Startups → AWS Activate.

See [[gando-startup-credits-and-monetization]] in memory for program links + the sell-your-own-model stack.
