// Transliterate a Latin-script name into ADLaM letters — phonetic, the same way
// a name is written in Arabic. The first letter uses the ADLaM capital form
// (the small-letter block sits 0x22 codepoints after the capitals). Approximate:
// good for common Fula/West-African names; unusual spellings may need tweaks.
const ADLAM_MAP: Record<string, number> = {
  a: 0x1e922, b: 0x1e926, c: 0x1e937, d: 0x1e923, e: 0x1e92b, f: 0x1e92c, g: 0x1e93a,
  h: 0x1e938, i: 0x1e92d, j: 0x1e936, k: 0x1e933, l: 0x1e924, m: 0x1e925, n: 0x1e932,
  o: 0x1e92e, p: 0x1e928, q: 0x1e939, r: 0x1e92a, s: 0x1e927, t: 0x1e93c, u: 0x1e935,
  v: 0x1e93e, w: 0x1e931, x: 0x1e93f, y: 0x1e934, z: 0x1e941,
};
export function latinToAdlam(input: string): string {
  let out = '';
  let first = true;
  for (const ch of input.toLowerCase()) {
    const cp = ADLAM_MAP[ch];
    if (cp == null) { out += ch; first = false; continue; }
    out += String.fromCodePoint(first ? cp - 0x22 : cp); // capital for first letter
    first = false;
  }
  return out;
}
