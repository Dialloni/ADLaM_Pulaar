// Corpus categories — a shared seed list plus user-added ones persisted in the
// `corpus_categories` Firestore collection (option B: added categories show for
// everyone). English is the key/label; French filled; ADLaM left blank for an
// instructor (native speaker) to fill — never machine-generated (house rule).

export type CatLang = 'ff-adlm' | 'en' | 'fr';

export interface Category {
  slug: string;      // machine key, also stored as `domain` on submissions
  en: string;        // display label (required)
  fr?: string;
  adlam?: string;    // filled by an instructor, not generated
}

// Seed set. The first six keep their original slugs so existing data still maps.
export const DEFAULT_CATEGORIES: Category[] = [
  { slug: 'casual', en: 'Casual', fr: 'Quotidien' },
  { slug: 'tech', en: 'Tech', fr: 'Technologie' },
  { slug: 'religion', en: 'Religion', fr: 'Religion' },
  { slug: 'news', en: 'News', fr: 'Actualités' },
  { slug: 'literature', en: 'Literature', fr: 'Littérature' },
  { slug: 'ui_vocab', en: 'App UI', fr: 'Interface' },

  // Living things
  { slug: 'animals', en: 'Animals', fr: 'Animaux' },
  { slug: 'birds', en: 'Birds', fr: 'Oiseaux' },
  { slug: 'fish', en: 'Fish', fr: 'Poissons' },
  { slug: 'insects', en: 'Insects', fr: 'Insectes' },
  { slug: 'livestock', en: 'Livestock', fr: 'Bétail' },
  { slug: 'trees', en: 'Trees', fr: 'Arbres' },
  { slug: 'plants', en: 'Plants', fr: 'Plantes' },
  { slug: 'fruits', en: 'Fruits', fr: 'Fruits' },
  { slug: 'vegetables', en: 'Vegetables', fr: 'Légumes' },

  // Food & drink
  { slug: 'food', en: 'Food', fr: 'Nourriture' },
  { slug: 'dishes', en: 'Dishes', fr: 'Plats' },
  { slug: 'grains', en: 'Grains', fr: 'Céréales' },
  { slug: 'dairy', en: 'Dairy', fr: 'Produits laitiers' },
  { slug: 'spices', en: 'Spices', fr: 'Épices' },
  { slug: 'drinks', en: 'Drinks', fr: 'Boissons' },
  { slug: 'water', en: 'Water', fr: 'Eau' },

  // People & society
  { slug: 'family', en: 'Family', fr: 'Famille' },
  { slug: 'people', en: 'People', fr: 'Personnes' },
  { slug: 'greetings', en: 'Greetings', fr: 'Salutations' },
  { slug: 'proverbs', en: 'Proverbs', fr: 'Proverbes' },
  { slug: 'culture', en: 'Culture', fr: 'Culture' },
  { slug: 'music', en: 'Music', fr: 'Musique' },
  { slug: 'clothing', en: 'Clothing', fr: 'Vêtements' },
  { slug: 'adornment', en: 'Adornment', fr: 'Parures' },

  // Home & objects
  { slug: 'housing', en: 'Housing', fr: 'Habitat' },
  { slug: 'furniture', en: 'Furniture', fr: 'Mobilier' },
  { slug: 'household', en: 'Household', fr: 'Articles ménagers' },
  { slug: 'tools', en: 'Tools', fr: 'Outils' },
  { slug: 'crafts', en: 'Crafts', fr: 'Artisanat' },

  // Nature & environment
  { slug: 'nature', en: 'Nature', fr: 'Nature' },
  { slug: 'weather', en: 'Weather', fr: 'Météo' },
  { slug: 'land', en: 'Land', fr: 'Terrain' },
  { slug: 'sky', en: 'Sky', fr: 'Ciel' },
  { slug: 'seasons', en: 'Seasons', fr: 'Saisons' },
  { slug: 'time', en: 'Time', fr: 'Temps' },
  { slug: 'directions', en: 'Directions', fr: 'Directions' },

  // Transportation & travel
  { slug: 'transport_land', en: 'Transport (land)', fr: 'Transport terrestre' },
  { slug: 'transport_water', en: 'Transport (water)', fr: 'Transport maritime' },
  { slug: 'transport_air', en: 'Transport (air)', fr: 'Transport aérien' },
  { slug: 'roads', en: 'Roads & travel', fr: 'Routes' },

  // Descriptors
  { slug: 'colors', en: 'Colors', fr: 'Couleurs' },
  { slug: 'numbers', en: 'Numbers', fr: 'Nombres' },
  { slug: 'shapes', en: 'Shapes', fr: 'Formes' },
  { slug: 'sizes', en: 'Sizes', fr: 'Tailles' },

  // Work & economy
  { slug: 'work', en: 'Work', fr: 'Métiers' },
  { slug: 'market', en: 'Market', fr: 'Marché' },
  { slug: 'money', en: 'Money', fr: 'Argent' },
  { slug: 'farming', en: 'Farming', fr: 'Agriculture' },
  { slug: 'herding', en: 'Herding', fr: 'Élevage' },

  // Abstract & modern
  { slug: 'emotions', en: 'Emotions', fr: 'Émotions' },
  { slug: 'actions', en: 'Actions', fr: 'Actions' },
  { slug: 'body', en: 'Body', fr: 'Corps' },
  { slug: 'health', en: 'Health', fr: 'Santé' },
  { slug: 'education', en: 'Education', fr: 'Éducation' },
  { slug: 'sports', en: 'Sports', fr: 'Sports' },
  { slug: 'science', en: 'Science', fr: 'Science' },
];

// Machine key from an English label: "Transport (air)" → "transport_air".
export function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Label in the viewer's language, falling back English → slug.
export function categoryLabel(c: Category, lang: CatLang): string {
  if (lang === 'ff-adlm' && c.adlam) return c.adlam;
  if (lang === 'fr' && c.fr) return c.fr;
  return c.en || c.slug;
}

// Merge Firestore-added categories over the seed set (by slug), so a saved doc
// can add a brand-new category OR fill ADLaM on an existing one.
export function mergeCategories(extra: Category[]): Category[] {
  const map = new Map<string, Category>();
  for (const c of DEFAULT_CATEGORIES) map.set(c.slug, c);
  for (const c of extra) {
    if (!c.slug) continue;
    map.set(c.slug, { ...map.get(c.slug), ...c, slug: c.slug });
  }
  return [...map.values()];
}

// Stable accent color per category (hash → hue) so 60+ chips stay distinguishable.
export function categoryColor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 60%)`;
}
