// Runnable check for lib/translit.ts. Run: npx tsx scripts/check-translit.ts
import { adlamToLatin, latinToAdlam, normalizeAdlam } from '../lib/translit';
import { strict as assert } from 'assert';

// Real words, both directions.
assert.equal(adlamToLatin('𞤆𞤵𞤤𞤢𞥄𞤪'), 'Pulaar');
assert.equal(latinToAdlam('Pulaar'), '𞤆𞤵𞤤𞤢𞥄𞤪');
assert.equal(adlamToLatin('𞤊𞤵𞥅𞤼𞤢'), 'Fuuta');
assert.equal(latinToAdlam('Fuuta'), '𞤊𞤵𞥅𞤼𞤢');
assert.equal(adlamToLatin('𞤘𞤢𞤲𞤣𞤮'), 'Gando');
assert.equal(latinToAdlam('Gando'), '𞤘𞤢𞤲𞤣𞤮');

// Gemination mark ↔ doubled consonant.
assert.equal(adlamToLatin('𞤧𞤫𞤤𞥆𞤢'), 'sella');
assert.equal(latinToAdlam('sella'), '𞤧𞤫𞤤𞥆𞤢');

// Special consonants: ɓ ɗ ƴ ŋ ñ + loanword letters.
assert.equal(latinToAdlam('ɓamtaare'), '𞤩𞤢𞤥𞤼𞤢𞥄𞤪𞤫');
assert.equal(adlamToLatin('𞤩𞤢𞤥𞤼𞤢𞥄𞤪𞤫'), 'ɓamtaare');
assert.equal(adlamToLatin(latinToAdlam('jaŋde')), 'jaŋde');
assert.equal(adlamToLatin(latinToAdlam('ɗemŋgal ñaamde ƴeewde')), 'ɗemŋgal ñaamde ƴeewde');
assert.equal(adlamToLatin(latinToAdlam('sharia gbagba kpelle zakat vitaal khaalis')), 'sharia gbagba kpelle zakat vitaal khaalis');
assert.equal(latinToAdlam('xaalis'), latinToAdlam('khaalis')); // x = input alias for kh

// Geminated digraphs per the book: 𞥆 doubles the first Latin char (kkh, Kkh, ssh…).
assert.equal(adlamToLatin('𞤿\u{1E946}'), 'kkh');
assert.equal(adlamToLatin('𞤝\u{1E946}'), 'Kkh');
assert.equal(latinToAdlam('kkh'), '𞤿\u{1E946}');
assert.equal(adlamToLatin(latinToAdlam('ssha ggbe kkpo')), 'ssha ggbe kkpo');

// Punctuation per the book: 𞥟 opens a question, Arabic ؟ closes it.
assert.equal(adlamToLatin('𞥟𞤳𞤢؟'), '?ka?');

// Nasalization mark → homorganic nasal (ᵐb, ⁿd).
assert.equal(adlamToLatin('𞤦\u{1E94B}𞤢'), 'mba');
assert.equal(adlamToLatin('𞤣\u{1E94B}𞤢'), 'nda');

// Digits + punctuation passthrough.
assert.equal(adlamToLatin('𞥑𞥒𞥓'), '123');
assert.equal(latinToAdlam('123'), '𞥑𞥒𞥓');
assert.equal(adlamToLatin('𞤳𞤢, 𞤳𞤢.'), 'ka, ka.');

// Mixed text: non-ADLaM passes through untouched.
assert.equal(adlamToLatin('API 𞤳𞤢'), 'API ka');

// Round-trip on every small + capital letter.
const all = 'a d l m b s p ɓ r e f i o ɗ ƴ w n k y u j c h q g ñ t ŋ v kh gb z kp sh';
assert.equal(adlamToLatin(latinToAdlam(all)), all);
assert.equal(
  adlamToLatin(latinToAdlam(all.toUpperCase().replace('KH', 'Kh').replace('GB', 'Gb').replace('KP', 'Kp').replace('SH', 'Sh'))).toLowerCase(),
  all,
);

// normalizeAdlam: LLM output repair — wrong mark on a letter → the only legal mark.
assert.equal(normalizeAdlam('𞤥\u{1E944}'), '𞤥\u{1E946}');   // aa-mark on consonant m → gemination
assert.equal(normalizeAdlam('𞤲\u{1E945}'), '𞤲\u{1E946}');   // ee-mark on consonant n → gemination
assert.equal(normalizeAdlam('𞤫\u{1E944}'), '𞤫\u{1E945}');   // aa-mark on e → vowel lengthener
assert.equal(normalizeAdlam('𞤢\u{1E945}'), '𞤢\u{1E944}');   // ee-mark on a → alif lengthener
assert.equal(normalizeAdlam('𞤢\u{1E946}'), '𞤢\u{1E944}');   // gemination on a → alif lengthener
assert.equal(normalizeAdlam('\u{1E944}x 𞤤\u{1E946}\u{1E946}'), 'x 𞤤\u{1E946}'); // orphan + doubled dropped
assert.equal(normalizeAdlam('𞤆𞤵𞤤𞤢\u{1E944}𞤪 𞤧𞤫𞤤\u{1E946}𞤢'), '𞤆𞤵𞤤𞤢\u{1E944}𞤪 𞤧𞤫𞤤\u{1E946}𞤢'); // valid text untouched
assert.equal(adlamToLatin('𞤥\u{1E944}𞤢'), 'mma'); // TTS path self-heals bad marks

console.log('check-translit: all assertions passed');
