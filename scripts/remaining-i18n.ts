// Emits ONLY the keys still missing real ADLaM (not covered by the desktop files),
// so the next translation batch has no duplicates. Output: docs/i18n/remaining.json
import { readFileSync, writeFileSync } from 'fs';
import { TRANSLATIONS } from '../src/translations';

const home = process.env.HOME;
const covered = new Set<string>();
for (const f of ['updated.json', 'new_update.json', 'remain_updated.json']) {
  try {
    const arr = JSON.parse(readFileSync(`${home}/Desktop/${f}`, 'utf8')) as { key: string; adlam?: string }[];
    arr.forEach(r => { if (r.adlam && r.adlam.trim()) covered.add(r.key); });
  } catch { /* file optional */ }
}

const en = TRANSLATIONS.en as Record<string, unknown>;
const fr = TRANSLATIONS.fr as Record<string, unknown>;

const remaining = Object.keys(en)
  .filter(k => typeof en[k] === 'string' && !covered.has(k))
  .map(k => ({ key: k, english: en[k] as string, french: (fr[k] as string) ?? '', adlam: '' }));

writeFileSync('docs/i18n/remaining.json', JSON.stringify(remaining, null, 2));
console.log(`Wrote ${remaining.length} remaining keys to docs/i18n/remaining.json`);
