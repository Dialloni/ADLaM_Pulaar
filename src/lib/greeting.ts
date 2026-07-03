/* Time-aware dashboard greeting (Claude-style). Templates contain {name};
   the caller splits on it to style the name separately.
   ADLaM phrases verified by Abubakar (2026-07-03) — do not edit without
   native-speaker review. Slash-variants from his sheet became pool entries.
   Punctuation rule: marks sit at the logical END (after {name}) — leftmost when
   rendered RTL. 𞥟 question · 𞥞 exclamation · '.' statement. */

export type GreetBucket = 'morning' | 'afternoon' | 'evening' | 'night';

export function greetBucket(d: Date = new Date()): GreetBucket {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}

const PHRASES: Record<'en' | 'fr' | 'ff-adlm', Record<GreetBucket | 'welcomeBack' | 'firstVisit', string[]>> = {
  en: {
    morning: ['Good morning, {name}', 'What shall we build this morning, {name}?'],
    afternoon: ['Good afternoon, {name}', 'Ready when you are, {name}.'],
    evening: ['Good evening, {name}', 'What are we building tonight, {name}?'],
    night: ['Working late, {name}?', 'Night builds hit different, {name}.'],
    welcomeBack: ['Welcome back, {name} — it’s been a while.'],
    firstVisit: ['Welcome to Gando, {name}'],
  },
  'ff-adlm': {
    morning: ['𞤔𞤢𞤥 𞤱𞤢𞥄𞤤𞤭, {name}', '𞤏𞤢𞥄𞤤𞤭 𞤫 𞤶𞤢𞤥, {name}', '𞤑𞤮 𞤸𞤮𞤲𞤯𞤵𞤲 𞤥𞤢𞤸𞤫𞤼𞤫𞤲 𞤳𞤢 𞤦𞤭𞤥𞤦𞤭 𞤯𞤮𞥅𞥟'],
    afternoon: ['𞤔𞤢𞤥 𞤻𞤢𞤤𞥆𞤭, {name}', '𞤙𞤢𞤤𞥆𞤭𞥅 𞤫 𞤶𞤢𞤥, {name}', '𞤃𞤭 𞤤𞤢𞤥 𞤸𞤫𞤦𞤭𞤤𞤭𞥅 𞤧𞤭𞤯𞤢 𞤸𞤫𞤦𞤭𞤤𞤭𞥅.'],
    evening: ['𞤔𞤢𞤥 𞤸𞤭𞥅𞤪𞤭, {name}', '𞤌𞤲 𞤖𞤭𞥅𞤪𞤭𞥅 𞤫 𞤶𞤢𞤥, {name}'],
    night: ['𞤘𞤮𞤤𞥆𞤵𞤣𞤫 𞤶𞤢𞤥𞥆𞤢, {name}𞥟', '𞤘𞤮𞤤𞥆𞤫 𞤶𞤢𞤥𞥆𞤢 𞤲𞤮 𞤧𞤫𞤪𞤼𞤭.'],
    welcomeBack: ['𞤐𞤫𞥅𞤦𞤭 𞤥𞤭 𞤴𞤭𞤢𞥄𞤤𞤭𞤥𞤢, {name}.'],
    firstVisit: ['𞤑𞤌 𞤼𞤮𞥅𞤤𞤭𞤥𞤮𞤲 𞤳𞤢 𞤺𞤢𞤲𞤣𞤮, {name}𞥞', '𞤔𞤢𞥄𞤪𞤢𞥄𞤥𞤢, {name}𞥞'],
  },
  fr: {
    morning: ['Bonjour, {name}', 'On construit quoi ce matin, {name} ?'],
    afternoon: ['Bon après-midi, {name}', 'Prêt quand vous l’êtes, {name}.'],
    evening: ['Bonsoir, {name}', 'On construit quoi ce soir, {name} ?'],
    night: ['On travaille tard, {name} ?', 'Les projets de nuit, c’est autre chose, {name}.'],
    welcomeBack: ['Content de vous revoir, {name} — ça faisait longtemps.'],
    firstVisit: ['Bienvenue sur Gando, {name}'],
  },
};

export function pickGreeting(
  lang: 'en' | 'fr' | 'ff-adlm',
  opts: { firstVisit?: boolean; welcomeBack?: boolean; seed?: number } = {},
): string {
  const set = PHRASES[lang];
  const pool = opts.firstVisit ? set.firstVisit
    : opts.welcomeBack ? set.welcomeBack
    : set[greetBucket()];
  const i = Math.floor((opts.seed ?? Math.random()) * pool.length) % pool.length;
  return pool[i];
}

/* Decorative emoji for the greeting — rendered separately so the UI can fade it
   out after a few seconds instead of baking it into the sentence. */
export function greetEmoji(opts: { firstVisit?: boolean; welcomeBack?: boolean } = {}): string | null {
  if (opts.firstVisit) return '🎉';
  if (opts.welcomeBack) return null;
  const b = greetBucket();
  return b === 'morning' ? '☀️' : b === 'night' ? '🌙' : null;
}
