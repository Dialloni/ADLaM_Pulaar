// Dumps all UI strings to docs/i18n/ so they can be translated (esp. ADLaM) and
// brought back. Run: npx tsx scripts/dump-i18n.ts
import { writeFileSync, mkdirSync } from 'fs';
import { TRANSLATIONS } from '../src/translations';

mkdirSync('docs/i18n', { recursive: true });

const flat = (o: Record<string, unknown>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') out[k] = v;
    else if (Array.isArray(v)) v.forEach((s, i) => { if (typeof s === 'string') out[`${k}[${i}]`] = s; });
  }
  return out;
};
const en = flat(TRANSLATIONS.en as Record<string, unknown>);
const fr = flat(TRANSLATIONS.fr as Record<string, unknown>);
const adlm = flat(TRANSLATIONS['ff-adlm'] as Record<string, unknown>);

// 1) English source keyed for easy re-import (translate values → ADLaM, keep keys).
writeFileSync('docs/i18n/english-source.json', JSON.stringify(en, null, 2));

// 2) Worklist with current ADLaM/French alongside each English string for review.
const rows = Object.keys(en).map(k => ({
  key: k,
  english: en[k],
  french: fr[k] ?? '',
  current_adlam: adlm[k] ?? '',
}));
writeFileSync('docs/i18n/translation-worklist.json', JSON.stringify(rows, null, 2));

// 3) Human-friendly CSV for handing to a translator.
const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
const csv = ['key,english,french,current_adlam',
  ...rows.map(r => [r.key, r.english, r.french, r.current_adlam].map(esc).join(','))].join('\n');
writeFileSync('docs/i18n/translation-worklist.csv', csv);

console.log(`Wrote ${rows.length} keys to docs/i18n/ (english-source.json, translation-worklist.json, .csv)`);
