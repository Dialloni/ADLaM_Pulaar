// Automated checks for generated outputs. These catch GARBAGE (no ADLaM, broken
// structure, hallucinated words) cheaply. They do NOT judge whether the ADLaM is
// *good* — that's the by-ear grading in review.html. Treat scores as signal, not truth.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ADLAM_START = 0x1e900;
const ADLAM_END = 0x1e95f;

const isAdlam = (cp: number) => cp >= ADLAM_START && cp <= ADLAM_END;
const isLatinLetter = (cp: number) =>
  (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a);

/** Build a vocabulary Set of known-good ADLaM tokens from the corpus + dictionary. */
export function buildAdlamVocab(repoRoot: string): Set<string> {
  const vocab = new Set<string>();
  const addTokens = (text: string) => {
    for (const tok of text.split(/\s+/)) {
      const clean = [...tok].filter((c) => isAdlam(c.codePointAt(0)!)).join('');
      if (clean.length >= 2) vocab.add(clean);
    }
  };

  // Corpus (JSONL: { text: "..." })
  try {
    const corpus = readFileSync(resolve(repoRoot, 'scraper/output/corpus_clean.jsonl'), 'utf8');
    for (const line of corpus.split('\n')) {
      if (!line.trim()) continue;
      try { addTokens(JSON.parse(line).text ?? ''); } catch { /* skip bad line */ }
    }
  } catch { /* corpus optional */ }

  // Technical dictionary ({ terms: [{ adlam }] })
  try {
    const dict = JSON.parse(readFileSync(resolve(repoRoot, 'adlam_dict.json'), 'utf8'));
    for (const t of dict.terms ?? []) if (t.adlam) addTokens(t.adlam);
  } catch { /* dict optional */ }

  return vocab;
}

/** Strip script/style blocks and tags to approximate visible text. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ');
}

export interface CheckResult {
  adlamRatio: number;        // ADLaM letters / (ADLaM + Latin letters) in visible text
  adlamWordCount: number;    // distinct ADLaM tokens in visible text
  corpusMatchRatio: number;  // fraction of ADLaM tokens found in known vocab
  sectionCount: number;      // header/nav/section/main/footer tags
  hasDoctype: boolean;
  hasTailwind: boolean;
  hasAdlamFont: boolean;
  mockItemSignal: number;    // rough count of repeated card-like structures
  flags: string[];           // human-readable problems
}

export function runChecks(
  code: string,
  expect: 'adlam' | 'french' | 'english',
  vocab: Set<string>
): CheckResult {
  const text = visibleText(code);
  const cps = [...text].map((c) => c.codePointAt(0)!);
  const adlamLetters = cps.filter(isAdlam).length;
  const latinLetters = cps.filter(isLatinLetter).length;
  const adlamRatio = adlamLetters + latinLetters === 0 ? 0 : adlamLetters / (adlamLetters + latinLetters);

  const adlamTokens = new Set<string>();
  for (const tok of text.split(/\s+/)) {
    const clean = [...tok].filter((c) => isAdlam(c.codePointAt(0)!)).join('');
    if (clean.length >= 2) adlamTokens.add(clean);
  }
  const matched = [...adlamTokens].filter((t) => vocab.has(t)).length;
  const corpusMatchRatio = adlamTokens.size === 0 ? 0 : matched / adlamTokens.size;

  const sectionCount = (code.match(/<(header|nav|section|main|footer)\b/gi) ?? []).length;
  const hasDoctype = /<!doctype html>/i.test(code);
  const hasTailwind = /cdn\.tailwindcss\.com/i.test(code);
  const hasAdlamFont = /Noto\+Sans\+Adlam/i.test(code);
  const mockItemSignal = (code.match(/<(article|li)\b|class="[^"]*\bcard\b/gi) ?? []).length;

  const flags: string[] = [];
  if (expect === 'adlam') {
    if (adlamRatio < 0.5) flags.push(`LOW ADLaM ratio ${(adlamRatio * 100).toFixed(0)}% (expected mostly ADLaM)`);
    if (latinLetters > adlamLetters) flags.push('More Latin than ADLaM letters — likely wrong/mixed script');
    if (!hasAdlamFont) flags.push('Missing Noto Sans Adlam font link');
    if (corpusMatchRatio < 0.15 && adlamTokens.size > 5) flags.push(`Only ${(corpusMatchRatio * 100).toFixed(0)}% of ADLaM words match corpus — possible hallucination`);
  }
  if (sectionCount < 3) flags.push(`Only ${sectionCount} structural sections (want >= 3)`);
  if (!hasDoctype) flags.push('Missing <!DOCTYPE html>');
  if (!hasTailwind) flags.push('Missing Tailwind CDN');
  if (mockItemSignal < 4) flags.push(`Sparse content (mock-item signal ${mockItemSignal})`);

  return {
    adlamRatio, adlamWordCount: adlamTokens.size, corpusMatchRatio,
    sectionCount, hasDoctype, hasTailwind, hasAdlamFont, mockItemSignal, flags,
  };
}
