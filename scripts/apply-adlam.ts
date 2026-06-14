// Applies ADLaM translations from a worklist JSON into TRANSLATIONS['ff-adlm'].
// Usage: npx tsx scripts/apply-adlam.ts ~/Desktop/updated.json
import { readFileSync, writeFileSync } from 'fs';
import { TRANSLATIONS } from '../src/translations';

const srcPath = process.argv[2] || `${process.env.HOME}/Desktop/updated.json`;
const updates = JSON.parse(readFileSync(srcPath, 'utf8')) as { key: string; adlam: string }[];
const map = new Map(updates.filter(u => u.adlam && u.adlam.trim()).map(u => [u.key, u.adlam.trim()]));

const cur = TRANSLATIONS['ff-adlm'] as Record<string, unknown>;

// Merge: override string keys when provided; keep arrays (twPhrases) + untouched keys.
const merged: Record<string, unknown> = {};
for (const k of Object.keys(cur)) {
  merged[k] = Array.isArray(cur[k]) ? cur[k] : (map.has(k) ? map.get(k) : cur[k]);
}

// Serialize the ff-adlm object literal.
const body = Object.entries(merged).map(([k, v]) => {
  const key = /^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
  if (Array.isArray(v)) {
    const items = (v as string[]).map(s => `      ${JSON.stringify(s)}`).join(',\n');
    return `    ${key}: [\n${items},\n    ],`;
  }
  return `    ${key}: ${JSON.stringify(v)},`;
}).join('\n');
const block = `  'ff-adlm': {\n${body}\n  },`;

const text = readFileSync('src/translations.ts', 'utf8');
const startIdx = text.search(/ {2}'ff-adlm': \{/);
const frIdx = text.indexOf('\n  fr: {');
if (startIdx === -1 || frIdx === -1) throw new Error('Could not find ff-adlm / fr markers');
const out = text.slice(0, startIdx) + block + '\n' + text.slice(frIdx + 1);
writeFileSync('src/translations.ts', out);

// Report
const updatedKeys = Object.keys(cur).filter(k => map.has(k));
const notUpdated = Object.keys(cur).filter(k => !Array.isArray(cur[k]) && !map.has(k));
const unknown = [...map.keys()].filter(k => !(k in cur));
console.log(`Applied ${updatedKeys.length} ADLaM overrides.`);
console.log(`Still untranslated (${notUpdated.length}): ${notUpdated.join(', ') || 'none'}`);
if (unknown.length) console.log(`Unknown keys in file (ignored): ${unknown.join(', ')}`);
