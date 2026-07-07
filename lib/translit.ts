// ADLaM ↔ Latin transliteration for Pulaar. Pure rules, no ML.
// ADLaM is phonemic, so the mapping is (nearly) 1:1:
//   capitals U+1E900–1E921, small letters at +0x22, marks U+1E944–1E94B,
//   digits U+1E950–1E959, initial punctuation U+1E95E/1E95F.
// Used at the edges of audio pipelines: ADLaM text → Latin for TTS/STT models,
// model Latin output → ADLaM for display.
//
// Conventions follow "Fula Language in Adlam Script" (July 2023, Adlam_book/adlam39.pdf):
// - long vowels: aa = 𞤢 + U+1E944 (alif lengthener); ee/ii/oo/uu = vowel + U+1E945
// - gemination mark U+1E946 doubles the FIRST Latin char (𞤤𞥆 = ll, 𞤿𞥆 = kkh)
// - nasalization mark U+1E94B (nyondal) = homorganic nasal prefix (n, but m before b/p);
//   prenasalized also written as plain letter pairs (𞤲𞤣 = nd) — no special case needed
// - 𞤿 = "kh" per the book ("x" accepted as input alias)
// - hamza U+1E947 = right single quote ’ (U+2019); vowel’vowel keeps the plain quote
// - question sentences open 𞥟, close with Arabic ؟ (U+061F) — both → "?"
// - "ñ" ↔ 𞤻 (nya); Latin "ny" is left as n+y to stay reversible
// - loan-sound modifiers U+1E948/1E949/1E94A drop to the base letter (Ḍ→d, Ɛ→e …)

const CAP_BASE = 0x1e900;
const SMALL_BASE = 0x1e922;
const LETTER_COUNT = 0x22;

// Index = code point − base. Order per Unicode chart.
const LATIN: string[] = [
  'a', 'd', 'l', 'm', 'b', 's', 'p', 'ɓ', 'r', 'e', 'f', 'i', 'o', 'ɗ', 'ƴ', 'w',
  'n', 'k', 'y', 'u', 'j', 'c', 'h', 'q', 'g', 'ñ', 't', 'ŋ', 'v', 'kh', 'gb', 'z',
  'kp', 'sh',
];
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

const ALIF_LEN = 0x1e944; // lengthens a
const VOWEL_LEN = 0x1e945; // lengthens e/i/o/u
const GEMINATION = 0x1e946;
const HAMZA = 0x1e947;
const MODIFIERS = new Set([0x1e948, 0x1e949, 0x1e94a]); // loan-sound tweaks: keep base letter
const NASALIZATION = 0x1e94b;
const DIGIT_BASE = 0x1e950;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Enforce ADLaM orthography on model-generated text (LLMs glue the wrong marks on letters):
 * lengthener/gemination marks are corrected to the only mark legal on the preceding letter
 * (𞤢→𞥄, other vowels→𞥅, consonants→𞥆); orphaned or doubled marks are dropped.
 * Word choice is untouched — this fixes spelling structure only.
 */
export function normalizeAdlam(text: string): string {
  const FIXABLE = new Set([ALIF_LEN, VOWEL_LEN, GEMINATION]);
  let out = '';
  let prevLetter = 0; // code point of the ADLaM letter the next mark would attach to
  let prevWasFixable = false;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (FIXABLE.has(cp)) {
      if (!prevLetter || prevWasFixable) continue; // orphan or duplicated mark
      const base = prevLetter >= SMALL_BASE ? SMALL_BASE : CAP_BASE;
      const latin = LATIN[prevLetter - base];
      out += String.fromCodePoint(latin === 'a' ? ALIF_LEN : VOWELS.has(latin) ? VOWEL_LEN : GEMINATION);
      prevWasFixable = true;
      continue;
    }
    prevWasFixable = false;
    const isLetter = (cp >= CAP_BASE && cp < CAP_BASE + LETTER_COUNT) || (cp >= SMALL_BASE && cp < SMALL_BASE + LETTER_COUNT);
    const isOtherMark = cp >= HAMZA && cp <= NASALIZATION;
    if (isLetter) prevLetter = cp;
    else if (!isOtherMark) prevLetter = 0; // marks (hamza/nukta/nyondal) keep the letter context
    out += ch;
  }
  return out;
}

/** ADLaM text → Latin (Pulaar orthography). Non-ADLaM characters pass through. */
export function adlamToLatin(text: string): string {
  const cps = [...normalizeAdlam(text)];
  let out = '';
  let lastLatin = ''; // romanization of the most recent letter, for gemination
  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i].codePointAt(0)!;
    const isCap = cp >= CAP_BASE && cp < CAP_BASE + LETTER_COUNT;
    const isSmall = cp >= SMALL_BASE && cp < SMALL_BASE + LETTER_COUNT;
    if (isCap || isSmall) {
      const latin = LATIN[cp - (isCap ? CAP_BASE : SMALL_BASE)];
      // Nasalization mark (nyondal) follows the consonant it prenasalizes: emit nasal first.
      if (cps[i + 1]?.codePointAt(0) === NASALIZATION) {
        out += latin === 'b' || latin === 'p' ? 'm' : 'n';
        i++;
      }
      lastLatin = isCap ? cap(latin) : latin;
      out += lastLatin;
      continue;
    }
    if (cp === ALIF_LEN || cp === VOWEL_LEN) {
      const prev = out.slice(-1);
      if (VOWELS.has(prev.toLowerCase())) out += prev.toLowerCase();
      continue;
    }
    if (cp === GEMINATION) {
      // Doubles the first char of the letter's romanization: k → kk, kh → kkh, Kh → Kkh.
      if (lastLatin) {
        out = out.slice(0, -lastLatin.length) + lastLatin[0] + lastLatin[0].toLowerCase() + lastLatin.slice(1);
      }
      continue;
    }
    if (cp === HAMZA) { out += '’'; continue; }
    if (MODIFIERS.has(cp)) continue;
    if (cp >= DIGIT_BASE && cp <= DIGIT_BASE + 9) { out += String(cp - DIGIT_BASE); continue; }
    if (cp === 0x1e95e) { out += '!'; continue; }
    if (cp === 0x1e95f || cp === 0x061f) { out += '?'; continue; } // 𞥟 opens, ؟ closes
    out += cps[i];
  }
  return out;
}

// Map full Pulaar-Latin orthography down to the alphabet the MMS TTS model
// (facebook/mms-tts-ful) actually knows. Chars outside its vocab are silently
// dropped by the model — so a common letter like ñ turns "ñaam" into "aam".
// This runs ONLY on the TTS path (after adlamToLatin, before the model); it does
// NOT touch display transliteration or ADLaM↔Latin reversibility.
// MMS vocab: a b c d e f g h i j k l m n o p r s t u w y ŋ ƴ ɓ ɗ ' + digits/space.
const VOICE_SUBS: [RegExp, string][] = [
  [/ñ/g, 'ny'],          // 𞤻 nya — common; model has no ñ
  [/[’‘‛´`]/g, "'"],      // hamza/glottal stop → the straight quote the model has
  [/q/g, 'k'],           // uvular → velar (loans)
  [/v/g, 'w'],           // labiodental → closest vocab sound (loans)
  [/z/g, 'j'],           // voiced sibilant → closest vocab sound (loans)
];
const VOICE_VOCAB = new Set("abcdefghijklmnoprstuwyŋƴɓɗ'0123456789 ".split(''));

export function toVoiceLatin(latin: string): string {
  let s = latin.toLowerCase();
  for (const [re, rep] of VOICE_SUBS) s = s.replace(re, rep);
  // Drop anything still outside the model's alphabet (stray punctuation, etc.)
  // so it can't confuse the tokenizer; keep spaces between words.
  return [...s].filter(c => VOICE_VOCAB.has(c)).join('').replace(/\s+/g, ' ').trim();
}

// Latin lookup: longest match first (kh/gb/kp/sh before k/g/s).
const TO_ADLAM = new Map<string, number>();
LATIN.forEach((l, i) => TO_ADLAM.set(l, SMALL_BASE + i));
TO_ADLAM.set('x', TO_ADLAM.get('kh')!); // input alias
const KEYS = [...TO_ADLAM.keys()].sort((a, b) => b.length - a.length);
const DIGRAPHS = KEYS.filter(k => k.length > 1);

/** Latin (Pulaar orthography) → ADLaM. Unknown characters pass through. */
export function latinToAdlam(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch >= '0' && ch <= '9') { out += String.fromCodePoint(DIGIT_BASE + Number(ch)); i++; continue; }
    // Geminated digraph letter: kkh/ssh/ggb/kkp → letter + gemination mark.
    const gem = DIGRAPHS.find(k => ch.toLowerCase() === k[0] && text.slice(i + 1, i + 1 + k.length).toLowerCase() === k);
    if (gem) {
      const isUpper = ch !== ch.toLowerCase();
      out += String.fromCodePoint(TO_ADLAM.get(gem)! - (isUpper ? SMALL_BASE - CAP_BASE : 0), GEMINATION);
      i += 1 + gem.length;
      continue;
    }
    let matched = '';
    for (const k of KEYS) {
      if (text.slice(i, i + k.length).toLowerCase() === k) { matched = k; break; }
    }
    if (!matched) { out += ch; i++; continue; }
    const isUpper = ch !== ch.toLowerCase();
    const base = TO_ADLAM.get(matched)! - (isUpper ? SMALL_BASE - CAP_BASE : 0);
    out += String.fromCodePoint(base);
    i += matched.length;
    const low = matched.toLowerCase();
    // Long vowel: aa → 𞤢 + alif lengthener; ee/ii/oo/uu → vowel + vowel lengthener.
    if (VOWELS.has(low) && text[i]?.toLowerCase() === low) {
      out += String.fromCodePoint(low === 'a' ? ALIF_LEN : VOWEL_LEN);
      i++;
      continue;
    }
    // Geminate consonant: ll → 𞤤 + gemination mark.
    if (!VOWELS.has(low) && matched.length === 1 && text[i]?.toLowerCase() === low) {
      out += String.fromCodePoint(GEMINATION);
      i++;
    }
  }
  return out;
}
