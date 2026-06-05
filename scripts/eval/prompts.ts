// Eval prompt set for comparing models on Gando's task.
// Weighted toward Fulani/Pulaar (ADLaM) output — that's the differentiator we must measure.
//
// `preferredLanguage` forces the output language (mirrors api/generate's preferredLanguage param),
// so we can test ADLaM *output* quality using clean EN/FR *input* — instead of risking
// malformed ADLaM input prompts. A few native ADLaM-input prompts test language detection too.

export interface EvalPrompt {
  id: string;
  category: string;
  /** Expected output language bucket — used by grading + checks. */
  expect: 'adlam' | 'french' | 'english';
  prompt: string;
  preferredLanguage?: string;
}

const ADLAM = 'Fulani / Pulaar written ONLY in ADLaM script (Unicode U+1E900–U+1E95F)';

export const PROMPTS: EvalPrompt[] = [
  // ---- ADLaM output (forced via preferredLanguage) — the core of the eval ----
  { id: 'adlam-shop-01', category: 'ecommerce', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Build an online shop that sells traditional Fulani clothes and fabrics. Show a product grid with at least 8 items, a cart counter, and a hero banner.' },
  { id: 'adlam-restaurant-02', category: 'restaurant', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Create a restaurant website for a West African restaurant. Include a menu with categories (rice dishes, grilled meat, drinks), prices, and a reservation form.' },
  { id: 'adlam-portfolio-03', category: 'portfolio', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Make a personal portfolio for a photographer: hero with name and role, about section, a gallery of 6 photos, and a contact form.' },
  { id: 'adlam-school-04', category: 'education', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Build a website for a Quranic school: about, list of classes with times, teachers section, and an enrollment form.' },
  { id: 'adlam-clinic-05', category: 'health', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Create a website for a small health clinic: services offered, doctors, opening hours, and an appointment booking form.' },
  { id: 'adlam-news-06', category: 'news', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Build a local news homepage: a featured article, a grid of 6 news cards with titles and summaries, and category tabs.' },
  { id: 'adlam-market-07', category: 'marketplace', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Make a farmers market app where people sell vegetables and livestock. List 8 products with prices in CFA, seller names, and a search bar.' },
  { id: 'adlam-recipes-08', category: 'recipes', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Create a recipe website for traditional Fulani dishes. Show 6 recipe cards with images, cooking time, and a featured recipe of the day.' },
  { id: 'adlam-events-09', category: 'events', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Build an events page for community celebrations and weddings: upcoming events list with dates and locations, and an RSVP form.' },
  { id: 'adlam-music-10', category: 'music', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Make a music streaming landing page for African artists: hero, trending songs list of 8 tracks with play buttons, and top artists.' },
  { id: 'adlam-prayer-11', category: 'utility', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Build a prayer times app: show the 5 daily prayer times, the current date, the next prayer highlighted, and a weekly schedule table.' },
  { id: 'adlam-weather-12', category: 'utility', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Create a weather app showing current weather, a 5-day forecast in cards, and temperature in Celsius.' },
  { id: 'adlam-todo-13', category: 'app', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Build a to-do list app where you can add tasks, mark them done, and delete them. Keep working interactivity with vanilla JS.' },
  { id: 'adlam-quiz-14', category: 'app', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Make a 5-question multiple-choice quiz about Fulani culture. Show a score at the end and a restart button.' },
  { id: 'adlam-blog-15', category: 'blog', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Create a personal blog: masthead, one featured post, a grid of 6 post previews, and a sidebar with categories.' },
  { id: 'adlam-landing-16', category: 'landing', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Build a SaaS landing page for a mobile money app: nav, hero with call to action, features grid, a 3-tier pricing table, and an FAQ.' },
  { id: 'adlam-taxi-17', category: 'app', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Make a ride-hailing landing page: hero with a "book a ride" form (pickup, destination), how-it-works steps, and driver signup section.' },
  { id: 'adlam-gallery-18', category: 'gallery', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Build an art gallery website showcasing paintings: a responsive image grid of 9 artworks with titles and artist names, and an about section.' },
  { id: 'adlam-dashboard-19', category: 'dashboard', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Create an admin dashboard: a sidebar nav, 4 KPI cards (sales, users, orders, revenue), and a recent activity table.' },
  { id: 'adlam-charity-20', category: 'landing', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Build a charity website for building wells: hero with a donation call to action, impact stats, 3 ongoing projects, and a donate form.' },
  { id: 'adlam-store-21', category: 'ecommerce', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Make an electronics store: category nav, a grid of 8 phones and laptops with prices and ratings, and a shopping cart icon with a badge.' },
  { id: 'adlam-hotel-22', category: 'hospitality', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Create a hotel booking website: hero with a search form (check-in, check-out, guests), room types with prices, amenities, and reviews.' },
  { id: 'adlam-gym-23', category: 'landing', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Build a fitness gym website: hero, class schedule table, trainers section, membership pricing, and a join form.' },
  { id: 'adlam-library-24', category: 'education', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Make a digital library for Fulani books: a searchable grid of 8 books with titles, authors, and a read button, plus categories.' },
  { id: 'adlam-job-25', category: 'app', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Build a job board: search bar with filters, a list of 6 job postings with company, location, and salary, and an apply button.' },
  { id: 'adlam-translate-26', category: 'app', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Create a simple translator UI: two text boxes (input and output), a language dropdown, and a translate button. Mock the translation.' },
  { id: 'adlam-banking-27', category: 'app', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Build a mobile banking dashboard: account balance card, recent transactions list, quick actions (send, receive, pay bills), and a spending chart placeholder.' },
  { id: 'adlam-radio-28', category: 'media', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Make a community radio website: live now banner, schedule of programs by hour, hosts section, and a contact form.' },
  { id: 'adlam-wedding-29', category: 'landing', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Create a wedding invitation website: couple names, date and venue, our story timeline, photo gallery, and an RSVP form.' },
  { id: 'adlam-agri-30', category: 'dashboard', expect: 'adlam', preferredLanguage: ADLAM, prompt: 'Build a farming assistant dashboard: weather card, crop calendar, market prices for 5 crops, and tips of the day.' },

  // ---- Native ADLaM-input prompts (test language DETECTION, not forced) ----
  { id: 'adlam-input-31', category: 'ecommerce', expect: 'adlam', prompt: '𞤥𞤢𞤸𞤢𞤴 𞤥𞤭 𞤦𞤵𞥅𞤼𞤭𞤳𞤭 𞤲𞤺𞤢𞤮𞤪𞤭 𞤥𞤦𞤢𞥄𞤴𞤣𞤭' /* "build me an online shop" (Pulaar) */ },
  { id: 'adlam-input-32', category: 'app', expect: 'adlam', prompt: '𞤥𞤢𞤸𞤢𞤴 𞤥𞤭 𞤦𞤢𞤴𞤤𞤭𞥅𞤤 𞤲𞤺𞤢𞤥𞤭' /* "build me a calculator" (Pulaar) */ },

  // ---- French output (breadth) ----
  { id: 'fr-shop-33', category: 'ecommerce', expect: 'french', prompt: 'Crée une boutique en ligne de vêtements africains avec une grille de 8 produits, un panier, et une bannière.' },
  { id: 'fr-restaurant-34', category: 'restaurant', expect: 'french', prompt: 'Fais un site web pour un restaurant sénégalais avec un menu, des prix, et un formulaire de réservation.' },
  { id: 'fr-portfolio-35', category: 'portfolio', expect: 'french', prompt: 'Crée un portfolio pour un développeur web: présentation, compétences, 6 projets, et un formulaire de contact.' },
  { id: 'fr-blog-36', category: 'blog', expect: 'french', prompt: 'Fais un blog personnel avec un article en vedette, une grille de 6 articles, et une barre latérale de catégories.' },
  { id: 'fr-landing-37', category: 'landing', expect: 'french', prompt: 'Crée une page de présentation pour une application de transfert d’argent: hero, fonctionnalités, tarifs, FAQ.' },
  { id: 'fr-dashboard-38', category: 'dashboard', expect: 'french', prompt: 'Construis un tableau de bord admin avec 4 cartes de statistiques et un tableau d’activité récente.' },
  { id: 'fr-clinic-39', category: 'health', expect: 'french', prompt: 'Fais un site pour une clinique: services, médecins, horaires, et un formulaire de rendez-vous.' },
  { id: 'fr-school-40', category: 'education', expect: 'french', prompt: 'Crée un site pour une école primaire: présentation, classes, enseignants, et formulaire d’inscription.' },
  { id: 'fr-events-41', category: 'events', expect: 'french', prompt: 'Fais une page d’événements communautaires avec une liste d’événements à venir et un formulaire RSVP.' },
  { id: 'fr-hotel-42', category: 'hospitality', expect: 'french', prompt: 'Crée un site de réservation d’hôtel: formulaire de recherche, types de chambres avec prix, et avis clients.' },

  // ---- English output (breadth) ----
  { id: 'en-shop-43', category: 'ecommerce', expect: 'english', prompt: 'Build an online shop for handmade jewelry with a product grid of 8 items, a cart, and a hero banner.' },
  { id: 'en-restaurant-44', category: 'restaurant', expect: 'english', prompt: 'Create a restaurant website with a menu by category, prices, and a reservation form.' },
  { id: 'en-portfolio-45', category: 'portfolio', expect: 'english', prompt: 'Make a portfolio for a UX designer: hero, about, skills, 6 projects, and a contact form.' },
  { id: 'en-saas-46', category: 'landing', expect: 'english', prompt: 'Build a SaaS landing page: nav, hero with CTA, features grid, 3-tier pricing, FAQ accordion, footer.' },
  { id: 'en-blog-47', category: 'blog', expect: 'english', prompt: 'Create a tech blog: masthead, featured article, 6-article grid, and a categories sidebar.' },
  { id: 'en-dashboard-48', category: 'dashboard', expect: 'english', prompt: 'Build an analytics dashboard: sidebar nav, 4 KPI cards, chart placeholders, and a recent activity table.' },
  { id: 'en-todo-49', category: 'app', expect: 'english', prompt: 'Build a to-do app where you can add, complete, and delete tasks, with working vanilla JS.' },
  { id: 'en-events-50', category: 'events', expect: 'english', prompt: 'Make an events landing page with an upcoming events list, dates, locations, and an RSVP form.' },
];
