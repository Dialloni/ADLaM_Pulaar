import type { LanguageCode } from '../translations';

export const LANGS: { code: LanguageCode; name: string; short: string }[] = [
  { code: 'ff-adlm', name: '𞤆𞤓𞤂𞤀𞥄𞤈 (𞤀𞤁𞤂𞤀𞤃)', short: '𞤀𞤁𞤂𞤀𞤃' },
  { code: 'en',      name: 'ENGLISH',          short: 'EN' },
  { code: 'fr',      name: 'FRANÇAIS',         short: 'FR' },
];

// `name` above is for humans (the picker shows ADLaM in ADLaM). Models get this
// instead: an unambiguous English description. "𞤆𞤓𞤂𞤀𞥄𞤈 (𞤀𞤁𞤂𞤀𞤃)" as a language
// instruction is a much weaker signal than spelling out the script.
const MODEL_LANG: Record<string, string> = {
  'ff-adlm': 'Fulani/Pulaar written in ADLaM script (Unicode U+1E900–U+1E95F)',
  en: 'English',
  fr: 'French',
};

export function modelLang(code: string | undefined): string {
  return MODEL_LANG[code || ''] || MODEL_LANG['ff-adlm'];
}
