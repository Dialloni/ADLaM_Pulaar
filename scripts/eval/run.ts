// Eval runner. Runs each prompt through Gemini + Claude with the SAME system prompt,
// runs automated ADLaM/structure checks, writes per-output HTML + a review.html for grading.
//
// Usage:
//   tsx scripts/eval/run.ts                 # full set, both models
//   tsx scripts/eval/run.ts --limit 4       # first 4 prompts (cheap smoke test)
//   tsx scripts/eval/run.ts --models gemini # one provider only
//   tsx scripts/eval/run.ts --only adlam-shop-01
//
// Requires GEMINI_API_KEY and/or ANTHROPIC_API_KEY in .env (gitignored).

import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROMPTS, type EvalPrompt } from './prompts.js';
import { buildAdlamVocab, runChecks } from './checks.js';
import { runGemini, runClaude, type ProviderRun } from './providers.js';
import { generateReviewHtml, type ReviewRow } from './review.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../..');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function selectPrompts(): EvalPrompt[] {
  const only = arg('--only');
  if (only) return PROMPTS.filter((p) => p.id === only);
  const limit = arg('--limit');
  return limit ? PROMPTS.slice(0, Number(limit)) : PROMPTS;
}

function esc(html: string): string {
  // Wrap raw generated HTML so it's a standalone file the iframe can load.
  return html;
}

async function main() {
  const modelsArg = (arg('--models') || 'gemini,claude').split(',').map((s) => s.trim());
  const useGemini = modelsArg.includes('gemini');
  const useClaude = modelsArg.includes('claude');

  if (useGemini && !process.env.GEMINI_API_KEY) console.warn('⚠ GEMINI_API_KEY missing — Gemini runs will error.');
  if (useClaude && !process.env.ANTHROPIC_API_KEY) console.warn('⚠ ANTHROPIC_API_KEY missing — Claude runs will error.');

  const prompts = selectPrompts();
  const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = resolve(HERE, 'results', runId);
  mkdirSync(outDir, { recursive: true });

  console.log(`Vocab: building from corpus + dict...`);
  const vocab = buildAdlamVocab(REPO_ROOT);
  console.log(`Vocab size: ${vocab.size} ADLaM tokens`);
  console.log(`Running ${prompts.length} prompts × [${modelsArg.join(', ')}] → ${outDir}\n`);

  const concurrency = Number(arg('--concurrency')) || 4;
  const rowsById = new Map<string, ReviewRow>();

  async function processPrompt(p: EvalPrompt): Promise<void> {
    const row: ReviewRow = { id: p.id, category: p.category, expect: p.expect, prompt: p.prompt, preferredLanguage: p.preferredLanguage, models: [] };
    const jobs: { label: string; run: () => Promise<ProviderRun> }[] = [];
    if (useGemini) jobs.push({ label: 'gemini', run: () => runGemini(p, GEMINI_MODEL) });
    if (useClaude) jobs.push({ label: 'claude', run: () => runClaude(p, CLAUDE_MODEL) });

    // Providers run in parallel per prompt.
    const results = await Promise.all(jobs.map((j) => j.run()));
    results.forEach((res, i) => {
      const label = jobs[i].label;
      if (!res.ok || !res.code) {
        console.log(`  [${p.id}] ${label}: ERROR ${res.error ?? 'no code'} (${res.ms}ms)`);
        row.models.push({ model: label, ok: false, error: res.error ?? 'no code returned', ms: res.ms });
        return;
      }
      const checks = runChecks(res.code, p.expect, vocab);
      const file = `${p.id}__${label}.html`;
      writeFileSync(resolve(outDir, file), esc(res.code), 'utf8');
      const flagStr = checks.flags.length ? ` ⚠ ${checks.flags.length} flag(s)` : '';
      console.log(`  [${p.id}] ${label}: ok ADLaM ${Math.round(checks.adlamRatio * 100)}% corpus ${Math.round(checks.corpusMatchRatio * 100)}% sec ${checks.sectionCount}${flagStr} (${res.ms}ms)`);
      row.models.push({ model: label, ok: true, ms: res.ms, name: res.name, explanation: res.explanation, file, checks });
    });
    rowsById.set(p.id, row);
  }

  // Worker pool: up to `concurrency` prompts in flight at once.
  let next = 0;
  async function worker(): Promise<void> {
    while (next < prompts.length) {
      const p = prompts[next++];
      await processPrompt(p);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, prompts.length) }, worker));

  // Preserve original prompt order in output.
  const rows: ReviewRow[] = prompts.map((p) => rowsById.get(p.id)!).filter(Boolean);

  writeFileSync(resolve(outDir, 'data.json'), JSON.stringify({ runId, models: { GEMINI_MODEL, CLAUDE_MODEL }, rows }, null, 2), 'utf8');
  writeFileSync(resolve(outDir, 'review.html'), generateReviewHtml(runId, rows), 'utf8');

  // Aggregate quick stats
  for (const label of ['gemini', 'claude']) {
    const cells = rows.flatMap((r) => r.models.filter((m) => m.model === label && m.ok));
    if (!cells.length) continue;
    const adlamCells = cells.filter((m) => rows.find((r) => r.id && r.models.includes(m))?.expect === 'adlam');
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    console.log(`\n${label.toUpperCase()} — ok ${cells.length}, avg sections ${avg(cells.map((m) => m.checks!.sectionCount)).toFixed(1)}, avg ADLaM% ${(avg(adlamCells.map((m) => m.checks!.adlamRatio)) * 100).toFixed(0)}, avg corpus% ${(avg(adlamCells.map((m) => m.checks!.corpusMatchRatio)) * 100).toFixed(0)}`);
  }

  console.log(`\n✅ Done. Open for by-ear grading:\n   open "${resolve(outDir, 'review.html')}"`);
}

main().catch((e) => { console.error(e); process.exit(1); });
