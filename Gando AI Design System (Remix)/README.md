# Gando AI — Design System

> **𞤘𞤢𞤲𞤣𞤮 𞤀𞤋** — *"Build apps in your language."*
> African-language-first AI app builder. Pink/orange neon on obsidian dark, heavy Manrope display type, full ADLaM script support for Fulani/Pulaar.

This design system captures the brand foundations and UI vocabulary of **Gando AI** so designers and prototyping agents can produce on-brand screens, mocks, slides, and production code.

---

## Sources

This system was reverse-engineered from a single attached codebase:

- **Codebase:** `gando-ai_Design/` — React 19 + TypeScript + Vite 6 + Tailwind v4. Main entry `src/App.tsx` (1046 lines, all pages in one file). Supporting components in `src/components/`. Brand tokens in `src/index.css`.
- **Product metadata:** `gando-ai_Design/metadata.json`
- **Upstream repo (for reference only, not required):** https://github.com/Dialloni/ADLaM_Pulaar

No Figma files, logo assets, or slide decks were attached. The wordmark is typographic (Manrope Black + gradient text) — no bitmap logo exists in the source.

---

## Product context

**Gando AI** is a Replit/Lovable-style AI app builder whose entire UX — prompts, explanations, UI chrome — happens in African languages first. A user describes an app in Fulani (ADLaM script), Swahili, Yoruba, Hausa, English, or French, and a single Gemini 2.5 Flash call returns a working single-file HTML/Tailwind/JS app plus an explanation in the detected language. Projects and chat history persist in Firestore; users can iterate via chat, revert to any snapshot, and download the result as a standalone `.html`.

### Products / surfaces in this system

Gando is a **single web product** with five main surfaces (no separate mobile app, no marketing site as of this snapshot):

| Surface | What it is |
|---|---|
| **Login** | Dark hero with gradient wordmark, Google-or-email auth, language selector |
| **Dashboard** | Stats chips, donut chart, token gauge, recent projects grid |
| **Projects** | Searchable grid of saved projects |
| **Workspace** | Split view — chat panel (left) + preview/code panel (right), each project opens here |
| **Docs & Status** | In-app docs (translated EN/FR/ADLaM) and a live system-health page |

The UI kit in this design system (`ui_kits/web/`) recreates the principal components for all five surfaces.

---

## Index

Root of this project:

- [`README.md`](./README.md) — this file
- [`SKILL.md`](./SKILL.md) — Agent Skill front matter for `claude-code` reuse
- [`colors_and_type.css`](./colors_and_type.css) — base + semantic CSS vars for color, type, spacing, motion, radii
- [`assets/`](./assets/) — logo specimen, icon-usage notes. Gando uses Lucide icons via CDN; no bitmap logo exists upstream
- [`preview/`](./preview/) — one HTML card per design-system concept (colors, type, components, spacing, brand). Each card is registered in the project so the Design System tab renders it
- [`ui_kits/web/`](./ui_kits/web/) — high-fidelity React/JSX recreation of the Gando web app. Run `ui_kits/web/index.html`

### UI kits

- **`ui_kits/web/`** — all five surfaces. Click-through prototype: Login → Dashboard → create project → Workspace with chat + preview tabs.

### Slides

No slide template was provided upstream, so no `slides/` directory exists. If a deck is needed, reuse the Visual Foundations below (obsidian bg, gradient titles, Manrope Black, eyebrow chips).

---

## Content Fundamentals

Copy is **bilingual-first, action-oriented, and celebratory of African languages**. The wordmark and hero headline always render in the user's selected language — ADLaM script, French, or English — with the same weight and gradient treatment.

### Voice & tone

- **Celebratory, empowering, short.** "Build apps in your language." "Describe your vision in your native tongue." The product's thesis IS the copy; marketing language is kept minimal because the interface is in the user's language.
- **Second-person ("you / your")** in English/French. Commands in imperative for CTAs ("Open Project", "Generate", "Revert").
- **No jargon, no apology.** Docs speak in plain lines ("Press Enter to send, Shift+Enter for a new line"). No "Oops!" / "Uh-oh!" — errors are functional: *"You've reached the AI limit. Please wait a minute."*
- **Status strings are one word.** `Healthy · Excellent · Operational · Degraded · Down · Checking`. Same pattern in every language.

### Casing

- **Page titles:** Title Case with tracking-tighter, Manrope Black. *"Your Projects"*, *"Gando View"*, *"System Status"*.
- **Eyebrows / chips / badges:** `ALL CAPS WITH 0.2EM TRACKING`, 10–11px, font-black. *"GANDO BETA"*, *"PROJECTS"*, *"TIPS"*.
- **Button labels:** Usually Title Case (`+ New Project`, `Sign In`). Destructive actions use sentence case with a verb (`Delete Project`).
- **Nav items:** Title Case in English. ADLaM preserves its own case rules.
- **Code / filenames:** lowercase, hyphenated (`gando-preview.app`).

### Emoji usage

**Sparingly, contextual, always paired with a Lucide icon.** Observed: 🌍 ⚡ 👁 💬 🔄 🎨 🔐 💾 📖 🟢 📥 in the *README/marketing* context, and ❤️ in the signoff. In the **product UI**, emoji appears only in docs quick-tips (`💡 Quick Tips`) and never on buttons, chips, or nav. Treat emoji as *marketing garnish*, not interface vocabulary.

### Concrete examples

| Where | English | French | ADLaM (Fulani) |
|---|---|---|---|
| Hero | *"Build apps in your language."* | *"Créez des apps avec Gando AI."* | *"𞤃𞤢𞤸𞤵 𞤢𞤨𞥆𞤧 𞤫 𞤘𞤢𞤲𞤣𞤮."* |
| Placeholder | *"Describe your app in English…"* | *"Décrivez votre app en Français…"* | *"𞤖𞤢𞥄𞤤𞤵 𞤢𞤨𞥆 𞤥𞤢𞥄𞤯𞤢 𞤫 𞤆𞤵𞤤𞤢𞥄𞤪…"* |
| Error (rate limit) | *"You've reached the AI limit. Please wait a minute."* | — | — |
| Eyebrow chip | `GANDO BETA` | `BÊTA PUBLIQUE` | `𞤘𞤢𞤲𞤣𞤮 𞤄𞤫𞤼𞤢` |
| CTA | `+ New Project` | `+ Nouveau Projet` | `+ 𞤆𞤮𞤪𞤮𞤶𞤫 𞤳𞤫𞤧𞤮` |
| Docs quick tip | *"Type in your native language — Gando understands Fulani, Swahili, Yoruba, Hausa, and more."* | — | — |

### The vibe

Confident, warm, cosmopolitan. Feels like a studio product, not a library demo. Never condescending about "emerging markets." The African-language-first positioning is load-bearing — the *interface is the manifesto*.

---

## Visual Foundations

### Palette — "Nexus Builder" neon

| Role | Hex | Notes |
|---|---|---|
| **Primary (rose)** | `#ff8b9b` | The brand's anchor. Gradient start, links, focused borders, active nav underlines, accent dots |
| Primary dim | `#e31754` | Pressed state only; rarely visible |
| **Secondary (orange)** | `#fd8b00` | Gradient end, status-degraded, warm side of glows |
| **Tertiary (lavender)** | `#bca2ff` | Reserved for language chips on project cards — the only cool hue on-brand |
| Blue accent | `#3b82f6` | User avatar, "Globe" language badge |
| Green / red | `#4ade80` / `#f87171` | Status ok / down — only in Status page |

The app is essentially **two-color (primary + secondary) plus neutrals**. Tertiary lavender is a small surprise. Everything else is dark surface or white text.

Surfaces form a tight 6-step obsidian scale: `#0a0a0a → #0e0e0e (app bg) → #131313 (cards) → #1a1a1a → #20201f → #262626 → #2c2c2c`. There is **no pure black** and **no mid-gray elevation** — all lifted surfaces are near-black with a hint of warmth.

### Type

- **Display / headline:** Manrope 900 (black). Used for everything large — hero, page titles, stat values, card titles.
- **Body / UI:** Inter 400–500, with feature settings `cv02 cv03 cv04 cv11`.
- **Mono:** JetBrains Mono 400–500. Code blocks, language chips, numbers in gauges.
- **ADLaM:** Noto Sans Adlam 400–700. Auto-applied to all interface strings when language is `ff-adlm`. Lives alongside Manrope — no swap of Manrope to an ADLaM display face exists; the ADLaM fallback simply kicks in when glyphs are absent.

Weight is almost always `700` or `900`. There is essentially no `400` display type. This is the single most distinctive type choice: **Gando is a black-weight product**.

Eyebrows are small (10–11px), uppercase, tracked to `0.2em`, and typically colored `#767575` or the primary. They appear ABOVE titles as status/section labels.

### Backgrounds

- **Flat `#0e0e0e`** app bg — never pure black.
- **Ambient radial gradients** baked into `<body>`: a 5%-opacity rose glow top-left and 5%-opacity orange glow bottom-right, `background-attachment: fixed`.
- **Glow orbs** — large blurred `<div>`s sized 40–55% of viewport, `filter: blur(80–120px)`, opacity `0.05–0.12`, in rose/orange. Used on login and workspace.
- **SVG grain overlay** on the login screen — fractal noise at 1.8% opacity, fixed position, on top. Gives the whole app a subtle film grain.
- **Grid overlay** — 32×32 px transparent grid (`rgba(128,128,128,0.024)` lines) on the login hero only.
- **No photography, no illustration, no hand-drawn motifs** in the current product. An `adinkra-mask` utility exists in CSS (tiny star pattern as mask-image) but is not used anywhere in the app — reserved for future texture.

### Animation

- **Easing:** default is `cubic-bezier(0.16, 1, 0.3, 1)` — smooth, decelerating, no bounce. Implemented via Motion/Framer `ease: [0.16, 1, 0.3, 1]`.
- **Springs** used on card hovers (`whileHover={{ y: -4 }}` with spring stiffness 400 damping 25) and on AnimatePresence panel swaps (damping 30, stiffness 200).
- **Bounces** only on the Send button (`animate={{ x: [0, 2, 0] }}` when input is non-empty).
- **Fades:** entry/exit on toasts, dropdowns, message actions. Durations 150–500ms.
- **Shimmer progress bar** while generating: an infinite `width: 0 → 70%` loop over 2s.
- **No parallax, no scroll-triggered effects, no page transitions.**

### Hover & press states

- **Buttons with solid fill** (gradient primary): hover = `filter: brightness(1.08)` + glow intensifies from `var(--glow-primary-sm)` to `var(--glow-primary-lg)`. Press = `scale(0.98)` or `0.95`.
- **Ghost / glass buttons**: hover = bg steps up (`white/5 → white/10`) and text `zinc-400 → white`. Press = `scale(0.95)`.
- **Nav items**: active state adds a left/bottom accent border in primary (`4px solid #ff8b9b` for sidebar; `2px solid` underline for top nav) plus a `linear-gradient(to right, #ff8b9b18, transparent)` wash. Inactive is just gray text, no bg.
- **Cards**: hover = `y: -4` lift, border steps `white/8 → white/15`.

### Borders, shadows, glow

- **Borders are always white-on-dark with alpha.** Never a solid line. Scale: `5% / 8% / 10% / 15%` alpha for default → hover → focus. Accent borders use `rgba(255,139,155,0.25–0.50)`.
- **Shadows** are either very soft (`shadow-2xl` ambient) OR neon glows (box-shadow with rose/orange rgba at 25–45% opacity). The signature "glow" is functional — it indicates primary / interactive state — not decorative.
- **No inner shadows.** No skeuomorphic depth.
- **No "protection gradients"** (like dark overlays on imagery) — there's no imagery to protect.

### Transparency & blur

Used heavily but consistently:

- **Fixed header:** `rgba(14,14,14,0.92)` + `backdrop-blur-xl`. The header floats over content.
- **Workspace top bar:** same pattern, slightly higher blur.
- **Modal/dropdown surfaces:** `rgba(255,255,255,0.03)` + `backdrop-blur-xl` + `border: 1px solid var(--line-3)`. Classic glassmorphism.
- **Chat input container:** double-layer — soft gradient blur background + solid `rgba(255,255,255,0.02)` card with `border: 1px solid var(--line-3)` inside.

Blur is *always* paired with a faint light border and a small alpha background. Never a naked blur.

### Corner radii

Gando is a **big-radius product**. There is no 4px or 2px radius anywhere.

- Pills, avatars: `9999px`
- Small chips, scrollbars: `6–8px`
- Buttons, inputs: `12–16px`
- Cards, panels: `16–24px`
- Hero input, modal corners: `32px`
- Browser-frame preview: `40px`

The bigger the container, the bigger the radius. **Inputs and buttons on the same surface share the same radius** (usually 16px).

### Cards — anatomy

```
┌─────────────────────────────────┐  ← 0.5px gradient bar, primary → secondary (often)
│                                 │
│   [icon chip]       [hover btn] │  ← icon in rounded-xl with primary/18% bg
│                                 │
│   Card Title                    │  ← Manrope 900, 14–18px
│   Supporting line of body copy  │  ← Inter 400, 12px, zinc-500
│                                 │
│   [chip pill]         [CTA →]   │  ← lavender language chip left; gradient CTA right
└─────────────────────────────────┘
  bg:       #131313
  border:   1px solid rgba(255,255,255,0.08)
  radius:   16–24px
  shadow:   inherited (ambient only)
  hover:    y-4 lift + border white/15
```

### Layout rules

- **Fixed 20-unit (80px) top header**, spans full width, blurred.
- **Sidebar: 288px (w-72)**, flush-left, no padding-left (nav items use a 4px accent border and 28px left padding so active items "plug in").
- **Main content**: fluid, padded 32–40px.
- **Content grid** usually `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`, gap-5.
- **Hero/login** is centered vertically, max-width 28rem.
- **No dense data tables, no gray zebra rows.** All lists are cards.

### Imagery vibe

There is no product photography or illustration shipped. If imagery were added, the palette requires **warm, high-contrast, filmic, slight-grain** treatment to sit on `#0e0e0e`. Avoid cool neutral stock; avoid bright white backgrounds. A full-bleed hero image, if added, should be darkened 40% with a warm radial gradient overlay tinted `#ff8b9b` at 5%.

---

## Iconography

**Lucide React** (`lucide-react@0.546`) is the ONLY icon system used. Every icon in the product comes from this library.

- **Stroke-based, rounded joins, 24×24 viewbox, 1.5–2px stroke.** Lucide's defaults match Manrope's geometry.
- **Rendered at 3–6 sizes:** `w-3 h-3` (12px, chip decoration), `w-3.5` (14px, muted actions), `w-4` (16px, default UI), `w-5` (20px, buttons), `w-6` (24px, suggestion-card icons), `w-8 h-8` (empty-state hero icons).
- **Color:** `#adaaaa` (zinc-400, default), `#767575` (zinc-500, muted), primary `#ff8b9b` for emphasis, secondary `#fd8b00` for status-degraded.
- **Icons sit inside "chip" containers** on suggestion cards and project cards: `w-10 h-10 rounded-xl` with `background: <color>/18` (i.e. color at 18% alpha) and the icon in full-opacity matching color.

### Actual icons used (from `App.tsx`, `Chat.tsx`, `Preview.tsx`)

Navigation & chrome: `LayoutDashboard, FolderKanban, Globe2, Settings, Users, BookOpen, Activity, LogOut, ChevronRight, ChevronLeft, ChevronDown, RotateCcw, X, Search, Bell, Lock, Globe`

Actions: `Send, Sparkles, Download, Trash2, Eye, Code, Copy, ThumbsUp, ThumbsDown, Mic, MicOff`

Status: `Loader2, CheckCircle2, XCircle, AlertCircle, AlertTriangle`

Messages: `User, Bot, ArrowRight, Layout, GraduationCap`

### Logos / wordmark

**There is no bitmap or SVG logo.** The "logo" is a typographic wordmark — the word `GANDO` (or `𞤘𞤢𞤲𞤣𞤮` in ADLaM) set in Manrope 900, tracking-tight, with the primary→secondary gradient applied as `background-clip: text`. A specimen lives at [`assets/wordmark.html`](./assets/wordmark.html). If a pictorial logomark is needed later, ask the user.

### Emoji as icons

Not in the product UI. Docs body copy uses 💡 once. The README uses decorative emoji. **Rule: never replace a Lucide glyph with an emoji.**

### Unicode characters as icons

The only Unicode glyphs load-bearing in the product are **ADLaM script codepoints** (U+1E900–U+1E95F) rendered in Noto Sans Adlam. These appear in the brand wordmark, nav, and all user-facing strings when ADLaM is selected. ADLaM is a REAL script, not decoration — do not substitute it with Latinized Fulani ("Pulaar") when ADLaM is active.

---

## Substitutions flagged

- **Fonts:** The upstream codebase loads Manrope, Inter, JetBrains Mono, and Noto Sans Adlam from Google Fonts via a `<link>` tag. No `.ttf` or `.woff` files are bundled. This design system preserves that pattern — `colors_and_type.css` `@import`s directly from `fonts.googleapis.com`. If you need offline use, ask the user for the ttf files and drop them in `fonts/`.
- **Icons:** No SVG sprite or icon font in the upstream source. Lucide is loaded via React component imports in the app. For vanilla-HTML mocks, use `https://unpkg.com/lucide-static@latest/icons/<name>.svg` or the Lucide CDN script.
- **Logo bitmap:** None exists upstream. The wordmark is the logo.

## Caveats

- No marketing site, no mobile app, no slide template were provided. The UI kit covers the web product only.
- No custom illustration, mascot, or brand imagery exists. Gando's visual identity is purely typographic + gradient + neon.
