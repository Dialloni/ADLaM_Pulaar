import { useState, useEffect, useRef, useCallback } from 'react';
import { GandoLogo } from './components/GandoLogo';
import {
  Loader2, Trash2, Eye, Code as CodeIcon, Download, AlertTriangle,
  Search, Bell, LayoutDashboard, FolderKanban, Globe2, Settings,
  Users, BookOpen, Activity, Sparkles, LogOut, ChevronRight,
  RotateCcw, CheckCircle2, XCircle, AlertCircle, X, PanelLeft,
  HelpCircle, Gift, Globe, Layers, Github, Figma, Camera,
  Share2, Heart, ChevronDown, Check, Plus, Paperclip, Mic, MicOff,
  MessageSquare, ArrowLeft, ArrowUp, Sun, Moon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './contexts/AuthContext';
import {
  collection, addDoc, updateDoc, doc, setDoc, getDoc, query, where, orderBy,
  onSnapshot, deleteDoc, db, serverTimestamp,
  handleFirestoreError, OperationType, auth,
  storage, ref, uploadBytes, getDownloadURL,
} from './firebase';
import { Project, Message, ChatThread } from './types';
import { generateProject, editProject, chatStream, resolveByok, type Provider, type ByokProvider } from './services/geminiService';
import { Chat } from './components/Chat';
import { Preview } from './components/Preview';
import { CodeEditor } from './components/CodeEditor';
import { LanguageSelector } from './components/LanguageSelector';
import { useVoiceInput } from './lib/useVoiceInput';
import { ModeSwitch } from './components/ModeSwitch';
import { useTheme } from './lib/useTheme';
import { AdminPortal } from './components/AdminPortal';
import { GandoCollector } from './components/GandoCollector';
import { ScrollVelocity } from './components/ScrollVelocity';
import { SettingsModal, type UserPrefs } from './components/SettingsModal';
import { cn } from './lib/utils';
import { TRANSLATIONS, LanguageCode } from './translations';

/* ── constants ──────────────────────────────────── */
const LANGS: { code: LanguageCode; name: string; short: string }[] = [
  { code: 'ff-adlm', name: '𞤆𞤓𞤂𞤀𞥄𞤈 (𞤀𞤁𞤂𞤀𞤃)', short: '𞤀𞤁𞤂𞤀𞤃' },
  { code: 'en',      name: 'ENGLISH',          short: 'EN' },
  { code: 'fr',      name: 'FRANÇAIS',         short: 'FR' },
];
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
function latinToAdlam(input: string): string {
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

const P = '#3b82f6';
const S = '#fd8b00';
const T = '#bca2ff';
const MANROPE = 'Manrope, sans-serif';

type NavPage = 'dashboard' | 'projects' | 'chats' | 'assets' | 'templates' | 'docs' | 'status' | 'collector' | 'admin';

const TEMPLATE_I18N: Record<string, { pageTitle: string; pageSubtitle: string; viewAll: string; preview: string; useTemplate: string; credit: string; templates: Record<string, { name: string; description: string; starterPrompt: string }> }> = {
  en: {
    pageTitle: 'Discover templates', pageSubtitle: 'Start your next project with a template',
    viewAll: 'View all', preview: 'Preview →', useTemplate: 'Use template',
    credit: 'Custom templates by Gando AI · HTML5 UP templates CC Attribution 3.0',
    templates: {
      alpha: {
        name: 'Conakry Market',
        description: 'West African artisan e-commerce marketplace',
        starterPrompt: `Build a West African e-commerce marketplace called "Conakry Market" for selling handmade and artisan goods in Guinea.\n\nColor palette: warm terracotta (#c4623a), gold (#d4a843), cream (#f5f0e8), deep charcoal (#1a1a1a).\n\nPages:\n1. Home — hero banner with featured vendor spotlight, trending products (3-column grid), category chips (Textiles, Jewelry, Ceramics, Leather), New Arrivals section\n2. Shop — filter sidebar (category, price range, region), product grid with hover zoom, quick-add to cart\n3. Product Detail — gallery, vendor info card, size/variant selector, star reviews, Buy Now + Add to Cart\n4. Vendor Profile — bio, rating, product portfolio, location pin\n5. Cart & Checkout — item list, promo code, price breakdown, mobile money payment (Orange Money, MTN MoMo)\n\nFeatures: multilingual toggle (French + Pular/ADLaM), responsive mobile-first, currency in GNF (Guinean Franc), lazy-load images, wishlist, recently viewed.\n\nData model: products (id, name, price, vendor, category, images[], stock), vendors (id, name, bio, rating, location), cart (items[], total), orders.`,
      },
      spectral: {
        name: 'Dakar Learning Hub',
        description: 'Online learning platform for African students',
        starterPrompt: `Build an online learning platform called "Dakar Learning Hub" for students across Senegal and West Africa.\n\nColor palette: deep navy (#0a1a2e), electric orange (#ff6b35), white (#ffffff), slate grey (#64748b).\n\nPages:\n1. Home — hero with enrollment CTA, featured courses carousel, topic categories (Tech, Business, Health, Arts), instructor spotlight, student testimonials\n2. Course Catalog — filter by level (Beginner/Intermediate/Advanced), subject, duration, language; grid/list toggle\n3. Course Detail — video player with chapter list, instructor bio, enrolled count, Enroll Now button, free preview lesson\n4. Lesson Page — embedded video, auto-progress tracker, end-of-module quiz, note-taking sidebar\n5. Student Dashboard — enrolled courses with progress bars, certificates earned, upcoming live sessions, activity streak calendar\n\nFeatures: multilingual UI (French + Wolof + English), offline lesson download badge, PDF certificates, discussion threads per lesson, mobile-first, progress persistence.\n\nData model: courses (id, title, instructor, level, language, chapters[], price), students (id, name, progress{}, certificates[]), quizzes (questions[], passing_score).`,
      },
      bigpicture: {
        name: 'Nairobi Events',
        description: 'Event discovery and ticketing for East Africa',
        starterPrompt: `Build an event discovery and ticketing platform called "Nairobi Events" for East Africa.\n\nColor palette: forest green (#1a4d2e), warm gold (#e8c84a), charcoal (#1c1c1c), cream white (#f5f5f0).\n\nPages:\n1. Home — full-bleed hero with "Discover Events in Nairobi" headline, featured events carousel, category filter (Music, Tech, Sports, Food, Culture), this-week countdown strip\n2. Events Listing — map view toggle, filter by date/category/price/location, event cards with thumbnail + date badge\n3. Event Detail — hero image, date/time/venue, ticket tiers (Regular, VIP, Early Bird) with seat availability counter, organizer profile, similar events row\n4. Booking Flow — ticket quantity selector, attendee form, promo code, M-Pesa/card payment UI, booking confirmation screen\n5. My Tickets — QR code ticket viewer, event calendar sync, past events history\n\nFeatures: multilingual (English + Swahili), real-time seat availability, countdown timers, WhatsApp share, mobile-first, .ics calendar export, email confirmation template.\n\nData model: events (id, title, date, venue, categories[], tickets{regular,vip,earlybird}, organizer), bookings (id, userId, eventId, quantity, total, qrCode), venues (id, name, address, coordinates).`,
      },
      telephasic: {
        name: 'Lagos Forum',
        description: 'Creator community forum for Nigerian builders',
        starterPrompt: `Build a creator community forum called "Lagos Forum" for Nigerian creators, artists, and entrepreneurs.\n\nColor palette: deep charcoal (#0f0f0f), vibrant orange (#ff6b35), electric yellow (#ffd700), off-white (#e8e8e8). Dark theme throughout.\n\nPages:\n1. Home / Feed — trending discussions, sticky announcements, category tabs (Design, Tech, Music, Business, Film), new post button\n2. Thread View — title, original post with rich text, nested comments (3 levels deep), upvote/downvote, report button, inline reply editor\n3. User Profile — bio, social links, post history, badges earned, followers/following count, portfolio links\n4. Write Post — rich text editor (bold/italic/link/image/code block), tag picker, preview mode, publish + save draft\n5. Notifications — mentions, replies, upvote milestones, system alerts, mark-all-read\n\nFeatures: dark theme with orange accents, multilingual (English + Yoruba + Igbo), real-time notification badge, full-text post search, pagination, code syntax highlighting, image uploads, moderator tools (pin/lock/remove), mobile responsive.\n\nData model: posts (id, title, body, authorId, tags[], votes, category), comments (id, postId, parentId, body, votes), users (id, username, bio, badges[], karma), notifications (type, actorId, postId, read).`,
      },
      food: {
        name: 'Accra Bites',
        description: 'Food delivery from local kitchens in Accra',
        starterPrompt: `Build a food delivery platform called "Accra Bites" for local restaurants and home kitchens in Accra, Ghana.\n\nColor palette: deep red (#8b1a1a), warm gold (#d4a843), dark charcoal (#1a1a1a), cream (#f5f0e8).\n\nPages:\n1. Home — location picker, cuisine category scrollbar (Ghanaian, Continental, Grills, Chop Bar, Vegan), featured restaurants, Fast Delivery + Top Rated filter chips, promotional banner\n2. Restaurant Detail — cover image, rating, delivery time/fee, menu grouped by category (Starters, Mains, Sides, Drinks, Desserts), item cards with add button\n3. Item Detail Modal — photo, description, extras/add-ons checkboxes, quantity selector, Add to Cart button\n4. Cart — item list with quantity adjusters, delivery address form, delivery time estimate, promo code, price breakdown, Place Order button\n5. Order Tracking — real-time status steps (Order Placed → Preparing → On the Way → Delivered), driver info card, ETA countdown, map placeholder\n\nFeatures: multilingual (English + Twi), mobile-first, currency in GHS, mobile money checkout (MTN MoMo, AirtelTigo), post-delivery ratings, restaurant open/closed status, dietary tags (Spicy, Vegetarian, Halal).\n\nData model: restaurants (id, name, cuisine, rating, deliveryFee, openHours), menuItems (id, restaurantId, name, price, category, extras[]), orders (id, userId, items[], status, total, driver), users (addresses[], savedPayments[]).`,
      },
      fashion: {
        name: 'Abidjan Mode',
        description: 'Luxury African fashion boutique from Côte d\'Ivoire',
        starterPrompt: `Build a luxury fashion e-commerce boutique called "Abidjan Mode" celebrating contemporary African fashion from Côte d'Ivoire.\n\nColor palette: near-black (#0a0a0a), antique gold (#d4af37), cream white (#f5f0e8), warm charcoal (#1a1a1a). Typography: Georgia serif for headings, clean sans for body. Minimal editorial luxury aesthetic.\n\nPages:\n1. Home — full-split hero (editorial text left, product visual right), spring collection announcement, Shop Now + Discover CTAs, featured fabric origins story section\n2. Collections — Femme / Homme / Couture category navigation, grid of collection tiles with hover overlay showing piece count, season badge\n3. Product Listing — 4-column grid, hover zoom, filter sidebar (fabric type, size, price range, color), breadcrumb trail\n4. Product Detail — fullscreen image gallery with zoom, size guide modal, fabric origin story ("Hand-woven kente from Kumasi"), Add to Wishlist, Add to Bag, delivery estimate\n5. Cart & Checkout — bag summary, gift wrapping option, delivery address, payment (card + mobile money XOF), order confirmation with tracking number\n\nFeatures: multilingual (French + English + Dioula), currency toggle (XOF/EUR), size guide overlay, editorial lookbook mode, WhatsApp customer service button, wishlist persistence.\n\nData model: products (id, name, collection, fabric, origin, sizes[], price_xof, price_eur, images[]), collections (id, name, season, coverImage), cart (items[], subtotal, currency), wishlist.`,
      },
      music: {
        name: 'Bamako Sound',
        description: 'West African music discovery and streaming',
        starterPrompt: `Build a music discovery and streaming platform called "Bamako Sound" celebrating West African music from Mali and the Sahel region.\n\nColor palette: deep space dark (#0d0d14), warm orange (#ff6b35), amber gold (#f7c59f), electric purple (#7c3aed). Vibrant energetic aesthetic.\n\nPages:\n1. Home — search hero, trending tracks list (play buttons, duration, artist), genre chips (Mandé, Afrobeat, Wassoulou, Griot, Kora Jazz, Highlife), featured artist spotlight card\n2. Artist Profile — bio, discography albums grid, popular tracks table, upcoming shows, follow button, social links, listener count\n3. Album / Playlist — cover art hero, full tracklist with per-row play/pause, shuffle + repeat controls, download badge, Share to WhatsApp\n4. Player (fixed bottom bar) — now-playing artwork + title + artist, prev/play-pause/next, scrubber bar with timestamp, volume, queue sidebar toggle\n5. Discover — curated playlists by mood (Work, Party, Chill, Sacred), new releases this week, "Made for you" AI-generated playlist, live radio stations\n\nFeatures: multilingual (French + Bambara + English + ADLaM/Pulaar), offline download badge, lyrics viewer panel, collaborative playlists, listening history, artist verification badge, geo-trending "Now popular in Bamako" feed.\n\nData model: tracks (id, title, artist, album, duration, genre, audioUrl, plays), artists (id, name, bio, followers, verified), playlists (id, name, tracks[], owner, collaborative), userLibrary (savedTracks[], followedArtists[], history[]).`,
      },
      news: {
        name: 'Kampala Tribune',
        description: 'East African digital newspaper and news portal',
        starterPrompt: `Build a digital news platform called "Kampala Tribune" — East Africa's premier online newspaper covering Uganda, the Great Lakes region, and the continent.\n\nColor palette: near-black (#1a1a1a), gold yellow (#e8c84a), off-white (#f5f4f0), medium grey (#555). Clean, authoritative editorial design with typographic hierarchy.\n\nPages:\n1. Home — top navbar with section links, breaking news banner (yellow bg), two-column hero (main story left + sidebar stories right), Latest Stories 3-column grid, opinion section\n2. Section Page (e.g. Politics) — chronological article list with thumbnails, Editor's Pick sidebar, pagination controls\n3. Article — headline, byline + date + read time, hero image with caption, long-form body text, pull quotes, related articles row, share buttons (WhatsApp/Twitter/Facebook), comments section\n4. Author Profile — headshot, bio, full article archive, social links\n5. Search — full-text search results, filter by section/date/author, highlighted keywords\n\nFeatures: multilingual (English + Luganda + Swahili), dark mode toggle, newsletter signup modal, breaking news notification prompt, reading progress bar, video embeds, paywall badge for subscriber content, comment moderation, social share.\n\nData model: articles (id, title, body, author, section, tags[], publishedAt, readTime, isPremium, heroImage), authors (id, name, bio, photo, articles[]), sections (id, name, slug), subscribers (id, email, tier).`,
      },
      legal: {
        name: 'Benali & Associés',
        description: 'Professional law firm website for Maghreb & Africa',
        starterPrompt: `Build a professional law firm website for "Benali & Associés" — a leading corporate law firm based in Casablanca, Morocco, serving clients across the Maghreb and Sub-Saharan Africa.\n\nColor palette: near-black (#1c1c1c), antique gold (#c8a96e), warm cream (#faf9f7), charcoal (#2a2a2a). Serif typography (Georgia), luxury editorial layout.\n\nPages:\n1. Home — navbar with consultation CTA, split hero (firm intro text left, gold seal right), practice areas grid (6 areas), team section (3 senior partners), client testimonial strip, contact CTA banner\n2. Practice Areas — individual pages per area (Corporate Law, International Arbitration, Real Estate, Tax Law, Energy & Mining, IP), each with service description, representative matters, relevant team members\n3. Team — full attorney directory with bio cards, filter by practice area, individual attorney pages with bar admissions, education, publications\n4. Insights — legal news articles, jurisdiction updates, client alerts, downloadable PDF reports with gated email signup\n5. Contact / Consultation — intake form (name, company, matter type, description), office addresses (Casablanca + Rabat), map embed, phone, "We respond within 24 hours" promise\n\nFeatures: multilingual (French + Arabic RTL + English), client portal login placeholder, document download center, GDPR-compliant contact form, WhatsApp business chat widget, newsletter for case law updates.\n\nData model: attorneys (id, name, title, practiceAreas[], education[], barAdmissions[], photo, bio), articles (id, title, category, publishedAt, pdfUrl), offices (city, address, phone, coordinates), inquiries (name, company, matterType, message, submittedAt).`,
      },
    },
  },
  fr: {
    pageTitle: 'Découvrir les modèles', pageSubtitle: 'Commencez votre prochain projet avec un modèle',
    viewAll: 'Voir tout', preview: 'Aperçu →', useTemplate: 'Utiliser ce modèle',
    credit: 'Modèles Gando AI · Templates HTML5 UP Licence CC Attribution 3.0',
    templates: {
      alpha: {
        name: 'Marché Conakry',
        description: 'Marketplace e-commerce pour artisans d\'Afrique de l\'Ouest',
        starterPrompt: `Crée une marketplace e-commerce appelée "Marché Conakry" pour vendre des produits artisanaux en Guinée.\n\nCouleurs : terre cuite (#c4623a), or (#d4a843), crème (#f5f0e8), charbon (#1a1a1a).\n\nPages :\n1. Accueil — bannière héro avec vendeur vedette, grille produits (3 colonnes), chips catégories (Textiles, Bijoux, Céramiques, Cuir), section Nouveautés\n2. Boutique — sidebar filtres (catégorie, prix, région), grille avec zoom au survol, ajout rapide au panier\n3. Fiche Produit — galerie photos, carte vendeur, sélecteur taille/variante, avis étoilés, Acheter + Ajouter au panier\n4. Profil Vendeur — bio, note, portfolio produits, localisation\n5. Panier & Paiement — liste articles, code promo, récapitulatif, paiement mobile money (Orange Money, MTN MoMo)\n\nFonctionnalités : multilingue (français + pular/ADLaM), responsive mobile-first, devise GNF (Franc guinéen), chargement lazy, liste de souhaits.\n\nModèle de données : produits (id, nom, prix, vendeur, catégorie, images[], stock), vendeurs (id, nom, bio, note, localisation), panier (articles[], total), commandes.`,
      },
      spectral: {
        name: 'Hub Dakar',
        description: 'Plateforme d\'apprentissage en ligne pour étudiants africains',
        starterPrompt: `Crée une plateforme d'apprentissage appelée "Hub Dakar" pour les étudiants du Sénégal et d'Afrique de l'Ouest.\n\nCouleurs : bleu marine profond (#0a1a2e), orange électrique (#ff6b35), blanc (#ffffff), gris ardoise (#64748b).\n\nPages :\n1. Accueil — héro avec CTA inscription, carrousel cours vedettes, catégories thématiques (Tech, Business, Santé, Arts), spotlight formateurs, témoignages\n2. Catalogue Cours — filtre niveau (Débutant/Intermédiaire/Avancé), sujet, durée, langue ; toggle grille/liste\n3. Fiche Cours — lecteur vidéo avec liste chapitres, bio formateur, nombre inscrits, bouton S'inscrire, leçon gratuite\n4. Page Leçon — vidéo intégrée, suivi progression auto, quiz de fin de module, sidebar prise de notes\n5. Tableau de bord Étudiant — cours en cours avec barres de progression, certificats, sessions live, calendrier de régularité\n\nFonctionnalités : multilingue (français + wolof + anglais), badge téléchargement hors-ligne, certificats PDF, fils de discussion par leçon, mobile-first.\n\nModèle de données : cours (id, titre, formateur, niveau, langue, chapitres[], prix), étudiants (id, nom, progression{}, certificats[]), quiz (questions[], note_passage).`,
      },
      bigpicture: {
        name: 'Événements Nairobi',
        description: 'Découverte et billetterie d\'événements en Afrique de l\'Est',
        starterPrompt: `Crée une plateforme de découverte d'événements appelée "Événements Nairobi" pour l'Afrique de l'Est.\n\nCouleurs : vert forêt (#1a4d2e), or chaud (#e8c84a), charbon (#1c1c1c), blanc crème (#f5f5f0).\n\nPages :\n1. Accueil — héro plein écran avec titre "Découvrez les Événements à Nairobi", carrousel événements vedettes, filtre catégories (Musique, Tech, Sport, Gastronomie, Culture), bande compte à rebours\n2. Liste Événements — bascule vue carte, filtre date/catégorie/prix/lieu, cartes événement avec badge date\n3. Détail Événement — image héro, date/heure/lieu, tiers billetterie (Standard, VIP, Early Bird) avec compteur places, profil organisateur, événements similaires\n4. Réservation — sélecteur quantité, formulaire participant, code promo, UI paiement M-Pesa/carte, confirmation de commande\n5. Mes Billets — visualiseur QR code, sync calendrier, historique événements passés\n\nFonctionnalités : multilingue (anglais + swahili), disponibilité temps réel, compte à rebours, partage WhatsApp, mobile-first, export .ics.\n\nModèle de données : événements (id, titre, date, lieu, catégories[], billets{standard,vip,early}, organisateur), réservations (id, userId, eventId, quantité, total, qrCode).`,
      },
      telephasic: {
        name: 'Forum Lagos',
        description: 'Forum communautaire pour créateurs nigérians',
        starterPrompt: `Crée un forum communautaire appelé "Forum Lagos" pour les créateurs, artistes et entrepreneurs nigérians.\n\nCouleurs : charbon profond (#0f0f0f), orange vif (#ff6b35), jaune électrique (#ffd700), blanc cassé (#e8e8e8). Thème sombre intégral.\n\nPages :\n1. Accueil / Fil — discussions tendances, annonces épinglées, onglets catégories (Design, Tech, Musique, Business, Cinéma), bouton Nouveau Post\n2. Vue Fil — titre, post original avec texte enrichi, commentaires imbriqués (3 niveaux), vote haut/bas, bouton Signaler, éditeur réponse inline\n3. Profil Utilisateur — bio, liens sociaux, historique posts, badges obtenus, compteur abonnés/abonnements, liens portfolio\n4. Rédiger Post — éditeur texte enrichi (gras/italique/lien/image/code), sélecteur tags, mode aperçu, publier + sauvegarder brouillon\n5. Notifications — mentions, réponses, jalons de votes, alertes système, tout marquer comme lu\n\nFonctionnalités : thème sombre avec accents orange, multilingue (anglais + yoruba + igbo), badge notification temps réel, recherche plein texte, pagination, coloration syntaxique, uploads images, outils modérateur.\n\nModèle de données : posts (id, titre, corps, auteurId, tags[], votes, catégorie), commentaires (id, postId, parentId, corps, votes), utilisateurs (id, pseudo, bio, badges[], karma).`,
      },
      food: {
        name: 'Accra Bites',
        description: 'Livraison de repas depuis cuisines locales à Accra',
        starterPrompt: `Crée une plateforme de livraison de repas appelée "Accra Bites" pour les restaurants et cuisines locales d'Accra, Ghana.\n\nCouleurs : rouge profond (#8b1a1a), or chaud (#d4a843), charbon (#1a1a1a), crème (#f5f0e8).\n\nPages :\n1. Accueil — sélecteur de localisation, carrousel catégories (Ghanéen, Continental, Grillades, Chop Bar, Vegan), restaurants en vedette, chips "Livraison rapide" et "Mieux notés"\n2. Détail Restaurant — image couverture, note, délai/frais livraison, menu par catégorie (Entrées, Plats, Accompagnements, Boissons, Desserts), cartes articles\n3. Modal Article — photo, description, suppléments/options (cases à cocher), quantité, bouton Ajouter au panier\n4. Panier — liste articles avec ajusteurs quantité, formulaire adresse livraison, estimation délai, code promo, récapitulatif, bouton Commander\n5. Suivi Commande — étapes statut temps réel (Commandé → Préparation → En chemin → Livré), carte livreur, compte à rebours ETA\n\nFonctionnalités : multilingue (anglais + twi), mobile-first, devise GHS, paiement mobile money (MTN MoMo, AirtelTigo), avis post-livraison, statut ouvert/fermé restaurant, tags régimes (Épicé, Végétarien, Halal).\n\nModèle de données : restaurants (id, nom, cuisine, note, fraisLivraison, horaires), menuItems (id, restaurantId, nom, prix, catégorie, suppléments[]), commandes (id, userId, articles[], statut, total, livreur).`,
      },
      fashion: {
        name: 'Abidjan Mode',
        description: 'Boutique de mode africaine de luxe de Côte d\'Ivoire',
        starterPrompt: `Crée une boutique e-commerce de mode de luxe appelée "Abidjan Mode" célébrant la mode africaine contemporaine de Côte d'Ivoire.\n\nCouleurs : quasi-noir (#0a0a0a), or antique (#d4af37), blanc crème (#f5f0e8), charbon chaud (#1a1a1a). Typographie Georgia serif pour titres, sans-serif épuré pour corps. Esthétique éditoriale luxe minimale.\n\nPages :\n1. Accueil — héro bipartite (texte éditorial gauche, visuel produit droite), annonce collection printemps, CTAs "Acheter" + "Découvrir", section histoire tissu\n2. Collections — navigation Femme / Homme / Couture, grille de tuiles collection avec overlay hover montrant le nombre de pièces, badge saison\n3. Catalogue Produits — grille 4 colonnes, zoom survol, sidebar filtres (type tissu, taille, prix, couleur), fil d'Ariane\n4. Fiche Produit — galerie plein écran avec zoom, modal guide des tailles, histoire du tissu d'origine, Ajouter à la liste de souhaits, Ajouter au sac, estimation livraison\n5. Panier & Paiement — récapitulatif sac, option emballage cadeau, adresse livraison, paiement (carte + mobile money XOF), confirmation avec numéro de suivi\n\nFonctionnalités : multilingue (français + anglais + dioula), toggle devise (XOF/EUR), guide des tailles overlay, mode lookbook éditorial, bouton WhatsApp service client.\n\nModèle de données : produits (id, nom, collection, tissu, origine, tailles[], prix_xof, prix_eur, images[]), collections (id, nom, saison, imageCouverture), panier (articles[], sous-total, devise).`,
      },
      music: {
        name: 'Bamako Sound',
        description: 'Découverte et streaming de musique d\'Afrique de l\'Ouest',
        starterPrompt: `Crée une plateforme de découverte musicale appelée "Bamako Sound" célébrant la musique d'Afrique de l'Ouest, du Mali et de la région du Sahel.\n\nCouleurs : dark profond (#0d0d14), orange chaud (#ff6b35), or ambré (#f7c59f), violet électrique (#7c3aed). Esthétique vibrante et énergique.\n\nPages :\n1. Accueil — héro de recherche, liste pistes tendances (boutons lecture, durée, artiste), chips genres (Mandé, Afrobeat, Wassoulou, Griot, Kora Jazz, Highlife), carte artiste en vedette\n2. Profil Artiste — bio, grille albums discographie, tableau pistes populaires, concerts à venir, bouton Suivre, liens réseaux sociaux\n3. Album / Playlist — visuel pochette héro, tracklist complète avec lecture par ligne, contrôles aléatoire + répétition, badge téléchargement, Partager sur WhatsApp\n4. Lecteur (barre fixe bas) — visuel + titre + artiste, commandes préc/lecture-pause/suiv, barre de progression avec horodatage, volume, sidebar file d'attente\n5. Découvrir — playlists par humeur (Travail, Fête, Détente, Sacré), sorties de la semaine, playlist "Faite pour vous" IA, stations radio\n\nFonctionnalités : multilingue (français + bambara + anglais + ADLaM/Pular), badge téléchargement hors-ligne, panneau paroles, playlists collaboratives, historique d'écoute, badge artiste vérifié, fil tendances géo "En vogue à Bamako".\n\nModèle de données : pistes (id, titre, artiste, album, durée, genre, audioUrl, écoutes), artistes (id, nom, bio, abonnés, vérifié), playlists (id, nom, pistes[], propriétaire), bibliothèqueUtilisateur.`,
      },
      news: {
        name: 'Tribune Kampala',
        description: 'Journal numérique d\'Afrique de l\'Est',
        starterPrompt: `Crée un journal numérique appelé "Tribune Kampala" — le premier quotidien en ligne d'Afrique de l'Est couvrant l'Ouganda, la région des Grands Lacs et le continent africain.\n\nCouleurs : quasi-noir (#1a1a1a), jaune or (#e8c84a), blanc cassé (#f5f4f0), gris moyen (#555). Design éditorial propre et autoritaire avec hiérarchie typographique.\n\nPages :\n1. Accueil — navbar avec rubriques, bandeau "Breaking" (fond jaune), héro deux colonnes (article principal + stories sidebar), grille "Dernières nouvelles" 3 colonnes, section opinion\n2. Page Rubrique (ex. Politique) — liste articles chronologique avec vignettes, sidebar "Choix de la rédaction", pagination\n3. Article — titre, auteur + date + temps de lecture, image héro avec légende, corps long format, citations en exergue, articles liés, boutons partage (WhatsApp/Twitter/Facebook), section commentaires\n4. Profil Auteur — photo, bio, archive articles, liens réseaux sociaux\n5. Recherche — résultats plein texte, filtre par rubrique/date/auteur, mots-clés surlignés\n\nFonctionnalités : multilingue (anglais + luganda + swahili), mode sombre, inscription newsletter, barre progression lecture, embeds vidéo, badge contenu abonné, modération commentaires.\n\nModèle de données : articles (id, titre, corps, auteur, rubrique, tags[], publiéLe, tempsDeLecture, estPremium, imageHéro), auteurs (id, nom, bio, photo, articles[]), rubriques (id, nom, slug), abonnés (id, email, niveau).`,
      },
      legal: {
        name: 'Benali & Associés',
        description: 'Site de cabinet d\'avocats pour le Maghreb et l\'Afrique',
        starterPrompt: `Crée un site web pour un cabinet d'avocats appelé "Benali & Associés" — un cabinet de droit des affaires de premier plan basé à Casablanca, au Maroc, servant des clients au Maghreb et en Afrique subsaharienne.\n\nCouleurs : quasi-noir (#1c1c1c), or antique (#c8a96e), crème chaude (#faf9f7), charbon (#2a2a2a). Typographie Georgia serif, mise en page éditoriale de luxe.\n\nPages :\n1. Accueil — navbar avec CTA consultation, héro bipartite (présentation cabinet gauche, sceau or droite), grille 6 domaines d'expertise, section équipe (3 associés seniors), bande témoignages clients, bannière contact\n2. Domaines d'Expertise — pages individuelles (Droit des Sociétés, Arbitrage International, Immobilier, Fiscal, Énergie & Mines, PI) avec description, dossiers représentatifs, équipe concernée\n3. Équipe — répertoire complet des avocats avec fiches bio, filtre par domaine, pages individuelles avec barreaux, formation, publications\n4. Actualités Juridiques — articles, mises à jour juridictionnelles, alertes clients, rapports PDF téléchargeables\n5. Contact / Consultation — formulaire (nom, société, type d'affaire, description), adresses (Casablanca + Rabat), carte, téléphone, promesse réponse 24h\n\nFonctionnalités : multilingue (français + arabe RTL + anglais), portail client futur, centre de téléchargement documents, formulaire conforme RGPD, widget WhatsApp Business, newsletter jurisprudence.\n\nModèle de données : avocats (id, nom, titre, domaines[], formation[], barreaux[], photo, bio), articles (id, titre, catégorie, publiéLe, pdfUrl), bureaux (ville, adresse, téléphone, coordonnées), demandes (nom, société, typeAffaire, message, soumisLe).`,
      },
    },
  },
  'ff-adlm': {
    pageTitle: '𞤁𞤫𞤬𞤪𞤭𞤲𞤣𞤫 𞤃𞤮𞤣𞤫𞤤𞤭', pageSubtitle: '𞤄𞤫𞤴𞤲𞤭 𞤥𞤮𞤣𞤫𞤤 𞤸𞤢𞤲𞤯𞤫 𞤶𞤮𞤤𞤤𞤭𞤪𞤣𞤫',
    viewAll: '𞤄𞤭𞤲𞥋𞤣𞤫 𞤸𞤫𞤬𞤯𞤫', preview: '𞤌𞤺𞤭𞤲𞤭𞤪𞤫 →', useTemplate: '𞤁𞤫𞤬𞤪𞤭𞤲𞤣𞤫 𞤃𞤮𞤣𞤫𞤤',
    credit: '𞤃𞤮𞤣𞤫𞤤𞤭 𞤱𞤮𞤲𞤭 Gando AI · HTML5 UP CC Attribution 3.0',
    templates: {
      alpha: {
        name: '𞤐𞤢𞥄𞤺𞤢 𞤑𞤮𞤲𞤢𞤳𞤪𞤭',
        description: '𞤚𞤮𞤲𞤺𞤭𞤲𞤢𞤤 𞤑𞤮𞤲𞤢𞤳𞤪𞤭 — 𞤸𞤭𞤪𞤫𞥊𞤯𞤫 𞤑𞤮𞤲𞤢𞤳𞤪𞤭',
        starterPrompt: '𞤄𞤫𞤴𞤲𞤭 𞤚𞤮𞤲𞤺𞤭𞤲𞤢𞤤 𞤑𞤮𞤲𞤢𞤳𞤪𞤭, 𞤔𞤭𞤲𞤫. 𞤑𞤮𞤤𞤮𞤤𞤭 𞤸𞤭𞤪𞤫𞥊𞤯𞤫: #c4623a, #d4a843, #f5f0e8. 𞤆𞤵𞤤𞤢𞤪 𞤱𞤮𞤲𞤭 𞤊𞤪𞤢𞤲𞤧𞤫. 𞤆𞤢𞤲𞤲𞤣𞤫 𞤳𞤵𞥅𞤯𞤫: 𞤀𞤤𞤲𞤣𞤫-𞤺𞤵𞤥𞤲𞤣𞤫, 𞤐𞤢𞥄𞤺𞤢, 𞤆𞤭𞤤𞤤𞤭𞤼𞤢𞤤, 𞤆𞤪𞤮𞤬𞤭𞤤 𞤕𞤭𞤤𞥆𞤮𞤱𞤮𞤤, 𞤆𞤢𞤲𞤩𞤫𞤤.',
      },
      spectral: {
        name: '𞤖𞤵𞤦 𞤁𞤢𞤳𞤢𞤪',
        description: '𞤋𞤤𞤥𞤭𞤲𞥋𞤣𞤫 𞤁𞤢𞤳𞤢𞤪 — 𞤶𞤢𞤲𞤺𞤭𞤲𞤢𞤤 𞤝𞤫𞥅𞤤𞤢𞤲𞤭 𞤀𞤬𞤪𞤭𞤳𞤢',
        starterPrompt: '𞤄𞤫𞤴𞤲𞤭 𞤖𞤵𞤦 𞤁𞤢𞤳𞤢𞤪, 𞤅𞤫𞤲𞤫𞤺𞤢𞤤. 𞤑𞤮𞤤𞤮𞤤𞤭: #0a1a2e, #ff6b35. 𞤆𞤵𞤤𞤢𞤪 𞤱𞤮𞤲𞤭 𞤓𞤵𞤤𞤮𞤬. 𞤆𞤢𞤲𞤲𞤣𞤫: 𞤀𞤤𞤲𞤣𞤫-𞤺𞤵𞤥𞤲𞤣𞤫, 𞤑𞤮𞤪𞤧𞤭, 𞤂𞤫𞤧𞤮𞤲𞤭 𞤳𞤵𥅅𞤯𞤫, 𞤁𞤢𞤱𞤪𞤫𞤤 𞤝𞤫𞥅𞤤𞤢𞤲𞤭.',
      },
      bigpicture: {
        name: '𞤖𞤢𞤱𞤤𞤭𞤲𞤣𞤫 𞤐𞤢𞤭𞤪𞤮𞤦𞤭',
        description: '𞤖𞤢𞤱𞤤𞤭𞤲𞤣𞤫 𞤒𞤵𞤦𞤲𞤣𞤫 — 𞤐𞤢𞤭𞤪𞤮𞤦𞤭, 𞤑𞤫𞤲𞤭𞤴𞤢',
        starterPrompt: '𞤄𞤫𞤴𞤲𞤭 𞤖𞤢𞤱𞤤𞤭𞤲𞤣𞤫 𞤐𞤢𞤭𞤪𞤮𞤦𞤭, 𞤑𞤫𞤲𞤭𞤴𞤢. 𞤑𞤮𞤤𞤮𞤤𞤭: #1a4d2e, #e8c84a. 𞤒𞤵𞤦𞤲𞤣𞤫 𞤱𞤮𞤲𞤭 𞤄𞤭𞤤𞤭𞤴𞤫𞤼𞤭. 𞤆𞤢𞤲𞤲𞤣𞤫: 𞤀𞤤𞤲𞤣𞤫-𞤺𞤵𞤥𞤲𞤣𞤫, 𞤂𞤭𞤧𞤼𞤮 𞤖𞤢𞤱𞤤𞤭𞤲𞤣𞤫, 𞤄𞤭𞤤𞤭𞤴𞤫𞤼𞤭, 𞤕𞤭𞤤𞥆𞤮𞥅 𞤕𞤭𞤤𞥆𞤮𞤤.',
      },
      telephasic: {
        name: '𞤊𞤮𞤪𞤵𞤥 𞤂𞤢𞤺𞤮𞤧',
        description: '𞤊𞤮𞤪𞤵𞤥 𞤕𞤭𞤤𞥆𞤮𞤱𞤮𞤤 — 𞤂𞤢𞤺𞤮𞤧, 𞤐𞤭𞤶𞤫𞤪𞤭𞤴𞤢',
        starterPrompt: '𞤄𞤫𞤴𞤲𞤭 𞤊𞤮𞤪𞤵𞤥 𞤂𞤢𞤺𞤮𞤧, 𞤐𞤭𞤶𞤫𞤪𞤭𞤴𞤢. 𞤑𞤮𞤤𞤮𞤤𞤭: #0f0f0f, #ff6b35. 𞤒𞤮𞤪𞤵𞤦𞤢 𞤱𞤮𞤲𞤭 𞤋𞤺𞤦𞤮. 𞤆𞤢𞤲𞤲𞤣𞤫: 𞤕𞤭𞤤𞥆𞤮𞤱𞤮𞤤-𞤱𞤢𞤴𞤲𞤣𞤫, 𞤅𞤫𞤼𞤢𞤪𞤫, 𞤆𞤪𞤮𞤬𞤭𞤤, 𞤊𞤮𞤬𞤯𞤮𞤤.',
      },
      food: {
        name: '𞤁𞤫𞤱𞤲𞤣𞤭 𞤀𞤳𞤳𞤪𞤢',
        description: '𞤁𞤫𞤱𞤲𞤣𞤭 𞤋𞤯𞤢𞤥 — 𞤀𞤳𞤳𞤪𞤢, 𞤘𞤢𞤲𞤢',
        starterPrompt: '𞤄𞤫𞤴𞤲𞤭 𞤁𞤫𞤱𞤲𞤣𞤭 𞤋𞤯𞤢𞤥 𞤀𞤳𞤳𞤪𞤢 𞤄𞤭𞤼𞤧, 𞤘𞤢𞤲𞤢. 𞤑𞤮𞤤𞤮𞤤𞤭: #8b1a1a, #d4a843. 𞤚𞤱𞤭 𞤱𞤮𞤲𞤭 𞤒𞤲𞤺𞤤𞤭𞤧𞤭. 𞤆𞤢𞤲𞤲𞤣𞤫: 𞤀𞤤𞤲𞤣𞤫-𞤺𞤵𞤥𞤲𞤣𞤫, 𞤈𞤫𞤧𞤼𞤮𞤪𞤢𞤲𞤭, 𞤃𞤮𞤣𞤢𞤤, 𞤆𞤢𞤲𞤩𞤫𞤤, 𞤅𞤵𞤴𞤭𞤲𞤣𞤫.',
      },
      fashion: {
        name: '𞤊𞤢𞥄𞤳𞤮 𞤀𞤦𞤭𞤶𞤢𞥄𞤲',
        description: '𞤊𞤢𞤼𞤮 𞤂𞤵𞤶𞤵𞤱𞤵𞤤𞤫 — 𞤀𞤦𞤭𞤶𞤢𞥄𞤲, 𞤑𞤮𞤼𞤫-𞤁𞤭𞤱𞤮𞥅𞤪',
        starterPrompt: '𞤄𞤫𞤴𞤲𞤭 𞤊𞤢𞥄𞤳𞤮 𞤀𞤦𞤭𞤶𞤢𞥄𞤲, 𞤑𞤮𞤼𞤫-𞤁𞤭𞤱𞤮𞥅𞤪. 𞤑𞤮𞤤𞤮𞤤𞤭: #0a0a0a, #d4af37. 𞤊𞤪𞤢𞤲𞤧𞤫 𞤱𞤮𞤲𞤭 𞤒𞤲𞤺𞤤𞤭𞤧𞤭 𞤱𞤮𞤲𞤭 𞤁𞤭𞤱𞤵𞤤𞤢. 𞤆𞤢𞤲𞤲𞤣𞤫: 𞤀𞤤𞤲𞤣𞤫-𞤺𞤵𞤥𞤲𞤣𞤫, 𞤑𞤮𞤤𞤮𞤤𞤭-𞤕𞤭𞤤𞥆𞤮𞤤, 𞤆𞤭𞤤𞤤𞤭𞤼𞤢𞤤, 𞤆𞤢𞤲𞤩𞤫𞤤, 𞤑𞤭𞤪𞤳𞤭𞤼𞤢𞤤.',
      },
      music: {
        name: '𞤑𞤵𞤤𞤢𞤤 𞤄𞤢𞤥𞤢𞤳𞤮',
        description: '𞤑𞤵𞤤𞤢𞤤 𞤀𞤬𞤪𞤭𞤳𞤢 𞤖𞤢𞤰𞤭𞤤𞤢𞤲𞤶𞤫 — 𞤄𞤢𞤥𞤢𞤳𞤮, 𞤃𞤢𞤤𞤭',
        starterPrompt: '𞤄𞤫𞤴𞤲𞤭 𞤑𞤵𞤤𞤢𞤤 𞤄𞤢𞤥𞤢𞤳𞤮, 𞤃𞤢𞤤𞤭. 𞤑𞤮𞤤𞤮𞤤𞤭: #0d0d14, #ff6b35. 𞤊𞤪𞤢𞤲𞤧𞤫 𞤱𞤮𞤲𞤭 𞤄𞤢𞤥𞤢𞤲𞤢𞤲𞤭 𞤱𞤮𞤲𞤭 𞤆𞤵𞤤𞤢𞤪/𞤀𞤁𞤂𞤀𞤃. 𞤆𞤢𞤲𞤲𞤣𞤫: 𞤀𞤤𞤲𞤣𞤫-𞤺𞤵𞤥𞤲𞤣𞤫, 𞤆𞤪𞤮𞤬𞤭𞤤 𞤕𞤭𞤤𞥆𞤮𞤱𞤮𞤤, 𞤀𞤤𞤦𞤵𞤥𞤭, 𞤂𞤫𞤤𞥆𞤢𞤲𞤳𞤭𞥅𞤤, 𞤁𞤭𞤧𞤳𞤮𞤱𞤭𞤪𞤫.',
      },
      news: {
        name: '𞤚𞤪𞤭𞤦𞤵𞤲𞤫 𞤑𞤢𞤥𞤦𞤢𞤤𞤢',
        description: '𞤕𞤵𞤪𞤲𞤢𞤤𞤭 𞤒𞤲𞤼𞤫𞤪𞤲𞤫𞤼𞤭 — 𞤑𞤢𞤥𞤦𞤢𞤤𞤢, 𞤓𞤺𞤢𞤲𞤣𞤢',
        starterPrompt: '𞤄𞤫𞤴𞤲𞤭 𞤚𞤪𞤭𞤦𞤵𞤲𞤫 𞤑𞤢𞤥𞤦𞤢𞤤𞤢, 𞤓𞤺𞤢𞤲𞤣𞤢. 𞤑𞤮𞤤𞤮𞤤𞤭: #1a1a1a, #e8c84a. 𞤒𞤲𞤺𞤤𞤭𞤧𞤭 𞤱𞤮𞤲𞤭 𞤂𞤵𞤺𞤢𞤲𞤣𞤢 𞤱𞤮𞤲𞤭 𞤅𞤱𞤢𞤸𞤭𞤤𞤭. 𞤆𞤢𞤲𞤲𞤣𞤫: 𞤀𞤤𞤲𞤣𞤫-𞤺𞤵𞤥𞤲𞤣𞤫, 𞤆𞤢𞤺𞤭𞤲𞤢𞤤, 𞤕𞤵𞤪𞤲𞤢𞤤, 𞤆𞤪𞤮𞤬𞤭𞤤 𞤕𞤭𞤤𞥆𞤮𞤱𞤮𞤤, 𞤅𞤫𞤳𞤭𞤼𞤮𞤤.',
      },
      legal: {
        name: '𞤄𞤫𞤲𞤢𞤤𞤭 & 𞤀𞤧𞤮𞤧𞤭𞤴𞤫',
        description: '𞤒𞤤𞤥𞤭 𞤔𞤵𞤪𞤭𞤣𞤭𞤳𞤭 — 𞤑𞤢𞤧𞤢𞤦𞤤𞤢𞤲𞤳𞤢, 𞤃𞤢𞤪𞤮𞤳𞤮',
        starterPrompt: '𞤄𞤫𞤴𞤲𞤭 𞤋𞤤𞤥𞤭 𞤔𞤵𞤪𞤭𞤣𞤭𞤳𞤭 𞤄𞤫𞤲𞤢𞤤𞤭 & 𞤀𞤧𞤮𞤧𞤭𞤴𞤫, 𞤑𞤢𞤧𞤢𞤦𞤤𞤢𞤲𞤳𞤢. 𞤑𞤮𞤤𞤮𞤤𞤭: #1c1c1c, #c8a96e. 𞤊𞤪𞤢𞤲𞤧𞤫 𞤱𞤮𞤲𞤭 𞤀𞤪𞤢𞤦𞤭𞤴𞤫 𞤱𞤮𞤲𞤭 𞤒𞤲𞤺𞤤𞤭𞤧𞤭. 𞤆𞤢𞤲𞤲𞤣𞤫: 𞤀𞤤𞤲𞤣𞤫-𞤺𞤵𞤥𞤲𞤣𞤫, 𞤒𞤤𞤥𞤭-𞤕𞤭𞤤𞥆𞤮𞤤, 𞤚𞤭𞤥𞤭, 𞤀𞤳𞤼𞤵𞤢𞤤𞤭𞤼𞤫𞤤, 𞤕𞤭𞤲𞤳𞤭𞤤-𞤚𞤭𞤥𞤭.',
      },
    },
  },
};

const TEMPLATES_META = [
  { id: 'alpha',      category: 'E-commerce', city: 'Conakry',    color: '#1a0f2e', previewUrl: '/templates/alpha/index.html' },
  { id: 'spectral',   category: 'Education',  city: 'Dakar',      color: '#0a1a2e', previewUrl: '/templates/spectral/index.html' },
  { id: 'bigpicture', category: 'Events',     city: 'Nairobi',    color: '#0a2e1a', previewUrl: '/templates/big-picture/index.html' },
  { id: 'telephasic', category: 'Community',  city: 'Lagos',      color: '#2e1a0a', previewUrl: '/templates/telephasic/index.html' },
  { id: 'food',       category: 'Food',       city: 'Accra',      color: '#2e0a0a', previewUrl: null },
  { id: 'fashion',    category: 'Fashion',    city: 'Abidjan',    color: '#0d0a07', previewUrl: '/templates/fashion-abidjan/index.html' },
  { id: 'music',      category: 'Music',      city: 'Bamako',     color: '#0d0d14', previewUrl: '/templates/music-bamako/index.html' },
  { id: 'news',       category: 'News',       city: 'Kampala',    color: '#1a1a18', previewUrl: '/templates/news-kampala/index.html' },
  { id: 'legal',      category: 'Legal',      city: 'Casablanca', color: '#1c1a16', previewUrl: '/templates/legal-casablanca/index.html' },
];

/* ── UI translation maps for iframe injection ── */
const ADLAM_UI: Record<string, string> = {
  'Home':         '𞤖𞤮𞤪𞤮𞤲𞤣𞤫',
  'Accueil':      '𞤖𞤮𞤪𞤮𞤲𞤣𞤫',
  'About':        '𞤃𞤢𞤲𞤫',
  'À propos':     '𞤃𞤢𞤲𞤫',
  'Shop':         '𞤐𞤢𞥄𞤺𞤫',
  'Boutique':     '𞤐𞤢𞥄𞤺𞤫',
  'Contact':      '𞤐𞤭𞤲𞤣𞤫',
  'Contact Us':   '𞤐𞤭𞤲𞤣𞤫',
  'Search':       '𞤅𞤫𞤳𞤭𞤼𞤮𞤤',
  'Rechercher':   '𞤅𞤫𞤳𞤭𞤼𞤮𞤤',
  'Discover':     '𞤁𞤫𞤬𞤪𞤭𞤲𞤣𞤫',
  'Découvrir':    '𞤁𞤫𞤬𞤪𞤭𞤲𞤣𞤫',
  'Sign Up':      '𞤁𞤢𞤤𞤢𞤤',
  'Sign In':      '𞤁𞤵𞤺𞤭𞤲𞤣𞤫',
  'Login':        '𞤁𞤵𞤺𞤭𞤲𞤣𞤫',
  'Connexion':    '𞤁𞤵𞤺𞤭𞤲𞤣𞤫',
  'Get Started':  '𞤄𞤫𞤫𞤼𞤭𞤪',
  'Learn More':   '𞤐𞤢𞤤𞤫 𞤸𞤮𞤪𞤭',
  'Services':     '𞤑𞤮𞤤𞤮𞤤𞤭',
  'Women':        '𞤔𞤭𞤤𞥆𞤭',
  'Femme':        '𞤔𞤭𞤤𞥆𞤭',
  'Men':          '𞤘𞤢𞤤𞥆𞤭',
  'Homme':        '𞤘𞤢𞤤𞥆𞤭',
  'Music':        '𞤑𞤵𞤤𞤢𞤤',
  'Musique':      '𞤑𞤵𞤤𞤢𞤤',
  'News':         '𞤖𞤮𞤤𞤤𞤭𞤲𞤣𞤫',
  'Actualités':   '𞤖𞤮𞤤𞤤𞤭𞤲𞤣𞤫',
  'Events':       '𞤖𞤭𞤼𞤼𞤢𞤲𞤣𞤫',
  'Artists':      '𞤕𞤭𞤤𞥆𞤮𞤱𞤮𞤤',
  'Artistes':     '𞤕𞤭𞤤𞥆𞤮𞤱𞤮𞤤',
  'Charts':       '𞤂𞤭𞤧𞤼𞤮 𞤑𞤵𞤤𞤢𞤤',
  'Radio':        '𞤈𞤢𞤣𞤭𞤴𞤮',
  'Fashion':      '𞤊𞤢𞤼𞤮',
  'Politics':     '𞤆𞤮𞤤𞤭𞤼𞤭𞤳𞤭',
  'Business':     '𞤄𞤭𞤱𞤼𞤮𞤤𞤭',
  'Technology':   '𞤚𞤫𞤳𞤲𞤮𞤤𞤮𞤶𞤭',
  'Culture':      '𞤑𞤮𞤤𞤼𞤵𞤪𞤫',
  'Sports':       '𞤅𞤮𞤪𞤼𞤭',
  'Breaking':     '𞤆𞤮𞤤𞤭𞤼𞤭𞤳𞤭',
  'Trending':     '𞤖𞤮𞤤𞤤𞤭𞤲𞤣𞤫',
  'Tendances':    '𞤖𞤮𞤤𞤤𞤭𞤲𞤣𞤫',
  'Genres':       '𞤓𞤮𞤤𞤵𞤯𞤫',
  'Couture':      '𞤊𞤢𞤼𞤮',
  'Équipe':       '𞤔𞤭𞤤𞥆𞤭 𞤌𞤲',
  'Expertise':    '𞤑𞤮𞤤𞤮𞤤𞤭',
  'Consultation': '𞤒𞤤𞤥𞤭',
};

/* English → French (for French lang on English templates) */
const FRENCH_UI: Record<string, string> = {
  'Home':          'Accueil',
  'About':         'À propos',
  'About Us':      'À propos',
  'Services':      'Services',
  'Products':      'Produits',
  'Contact':       'Contact',
  'Contact Us':    'Contactez-nous',
  'Sign In':       'Connexion',
  'Sign Up':       "S'inscrire",
  'Get Started':   'Commencer',
  'Learn More':    'En savoir plus',
  'Shop Now':      'Acheter',
  'Work':          'Portfolio',
  'Politics':      'Politique',
  'Business':      'Affaires',
  'Technology':    'Technologie',
  'Sports':        'Sports',
  'Culture':       'Culture',
  'Breaking':      'Alerte',
  'Latest Stories':'Dernières nouvelles',
  'Events':        'Événements',
  'Community':     'Communauté',
  'Education':     'Éducation',
  'Music':         'Musique',
  'Fashion':       'Mode',
  'News':          'Actualités',
  'Legal':         'Juridique',
  'Artists':       'Artistes',
  'Charts':        'Classements',
  'Trending':      'Tendances',
  'Discover':      'Découvrir',
  'Search':        'Rechercher',
  'Login':         'Connexion',
  'Women':         'Femme',
  'Men':           'Homme',
  'Radio':         'Radio',
};

/* French → English (for English lang on French templates) */
const ENGLISH_UI: Record<string, string> = {
  'Accueil':              'Home',
  'À propos':             'About',
  'Boutique':             'Shop',
  'Découvrir':            'Discover',
  'Femme':                'Women',
  'Homme':                'Men',
  'Couture':              'Couture',
  'Connexion':            'Login',
  'Artistes':             'Artists',
  'Tendances':            'Trending',
  'Genres':               'Genres',
  'Rechercher':           'Search',
  'Musique':              'Music',
  'Équipe':               'Team',
  'Actualités':           'News',
  'Expertise':            'Expertise',
  'Prendre Rendez-vous':  'Book Appointment',
  'Nos Domaines':         'Our Practice Areas',
  'Consultation':         'Consultation',
  'Nouveautés':           'New Arrivals',
  'Mode Africaine':       'African Fashion',
  'Politique':            'Politics',
  'Affaires':             'Business',
  'Sports':               'Sports',
  'Culture':              'Culture',
  'Breaking':             'Breaking',
  'Radio':                'Radio',
  'Charts':               'Charts',
};

/* ── tiny helpers ───────────────────────────────── */
function DonutChart({ pct, label }: { pct: number; label: string }) {
  const r = 52; const circ = 2 * Math.PI * r;
  return (
    <div className="relative w-36 h-36 flex-shrink-0 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="transparent" stroke="#262626" strokeWidth="8" />
        <circle cx="64" cy="64" r={r} fill="transparent"
          stroke="url(#gd)" strokeWidth="12"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.max(pct, 2) / 100)}
          strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${P}88)`, transition: 'stroke-dashoffset 1s ease' }} />
        <defs>
          <linearGradient id="gd" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={P} /><stop offset="100%" stopColor={S} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-black text-white" style={{ fontFamily: MANROPE }}>{Math.round(pct)}%</span>
        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">{label}</span>
      </div>
    </div>
  );
}

function Gauge({ pct, from, to, shadow }: { pct: number; from: string; to: string; shadow: string }) {
  return (
    <div className="relative h-3 rounded-full overflow-hidden" style={{ background: '#262626' }}>
      <div className="absolute h-full rounded-full transition-all duration-1000"
        style={{ width: `${pct}%`, background: `linear-gradient(to right,${from},${to})`, boxShadow: shadow }} />
    </div>
  );
}

function StatusDot({ status }: { status: 'ok' | 'degraded' | 'down' | 'checking' }) {
  if (status === 'checking') return <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />;
  if (status === 'ok')       return <CheckCircle2 className="w-4 h-4" style={{ color: '#4ade80' }} />;
  if (status === 'degraded') return <AlertCircle  className="w-4 h-4" style={{ color: S }} />;
  return                            <XCircle      className="w-4 h-4" style={{ color: '#f87171' }} />;
}

/* ════════════════════════════════════════════════════
   useIsMobile — true when viewport ≤ 767px (phones)
════════════════════════════════════════════════════ */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

const PROVIDER_LABEL: Record<Provider, string> = {
  'claude': 'Claude',
  'gemini': 'Gemini',
  'groq-llama': 'Llama 3.3',
  'groq-scout': 'Llama 4 Scout',
  'byok-openai': 'OpenAI',
  'byok-anthropic': 'Claude',
  'byok-gemini': 'Gemini',
  'byok-deepseek': 'DeepSeek',
  'byok-groq': 'Groq',
};

const PROVIDER_COLOR: Record<Provider, string> = {
  'claude': '#3b82f6',
  'gemini': '#5b9bff',
  'groq-llama': '#22c55e',
  'groq-scout': '#f59e0b',
  'byok-openai': '#10a37f',
  'byok-anthropic': '#d97757',
  'byok-gemini': '#5b9bff',
  'byok-deepseek': '#4d6bfe',
  'byok-groq': '#f55036',
};

const MODEL_OPTIONS: { id: Provider; label: string; sub: string }[] = [
  { id: 'claude', label: 'Claude Sonnet 4.6', sub: 'Best ADLaM quality' },
  { id: 'gemini', label: 'Gemini 2.5 Flash', sub: 'Free tier · Google' },
  { id: 'groq-llama', label: 'Llama 3.3 70B', sub: 'Free · Groq · Fast' },
  { id: 'groq-scout', label: 'Llama 4 Scout', sub: 'Free · Groq · Multimodal' },
];

// BYOK provider registry — used by the "Bring your own key" settings modal and to
// build dynamic model-picker entries for any provider the user has saved a key for.
const BYOK_PROVIDERS: { id: ByokProvider; label: string; model: string; placeholder: string; keysUrl: string }[] = [
  { id: 'openai',    label: 'OpenAI (ChatGPT)',   model: 'gpt-4o',                  placeholder: 'sk-...',     keysUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', label: 'Claude (Anthropic)', model: 'claude-sonnet-4-6',       placeholder: 'sk-ant-...', keysUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'gemini',    label: 'Gemini (Google)',    model: 'gemini-2.5-flash',        placeholder: 'AIza...',    keysUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 'deepseek',  label: 'DeepSeek',           model: 'deepseek-chat',           placeholder: 'sk-...',     keysUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'groq',      label: 'Groq (Llama)',       model: 'llama-3.3-70b-versatile', placeholder: 'gsk_...',    keysUrl: 'https://console.groq.com/keys' },
];

const BYOK_STORAGE_KEY = 'gando_byok';

function loadByokKeys(): Partial<Record<ByokProvider, string>> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(BYOK_STORAGE_KEY) || '{}'); } catch { return {}; }
}

// Settings modal for pasting your own provider API keys. Keys live in this browser
// (localStorage) only — never sent to our database, only forwarded per-request to
// the chosen provider. Each user's key has its own quota.
const ByokModal: React.FC<{
  open: boolean;
  keys: Partial<Record<ByokProvider, string>>;
  onSave: (next: Partial<Record<ByokProvider, string>>) => void;
  onClose: () => void;
  fr?: boolean;
}> = ({ open, keys, onSave, onClose, fr = false }) => {
  const [draft, setDraft] = useState<Partial<Record<ByokProvider, string>>>(keys);
  useEffect(() => { if (open) setDraft(keys); }, [open, keys]);
  if (!open) return null;
  const save = () => {
    const cleaned = Object.fromEntries(
      Object.entries(draft).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, (v as string).trim()])
    );
    onSave(cleaned);
    onClose();
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', padding: 24, fontFamily: 'Inter, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{fr ? 'Utilisez votre propre clé API' : 'Bring your own API key'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.5 }}>
          {fr
            ? 'Collez une clé pour utiliser ce fournisseur avec votre propre quota. Les clés sont stockées uniquement dans ce navigateur — jamais sur nos serveurs. Laissez vide pour retirer.'
            : 'Paste a key to use that provider with your own quota. Keys are stored in this browser only — never on our servers. Leave blank to remove.'}
        </p>
        {BYOK_PROVIDERS.map(p => (
          <div key={p.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</label>
              <a href={p.keysUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none' }}>{fr ? 'Obtenir une clé →' : 'Get key →'}</a>
            </div>
            <input
              type="password" autoComplete="off" spellCheck={false}
              value={draft[p.id] || ''} placeholder={p.placeholder}
              onChange={e => setDraft(d => ({ ...d, [p.id]: e.target.value }))}
              style={{ width: '100%', boxSizing: 'border-box', height: 38, borderRadius: 10, background: 'var(--btn-bg)', border: '1px solid var(--border)', padding: '0 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'monospace' }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, height: 40, borderRadius: 10, background: 'var(--btn-bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{fr ? 'Annuler' : 'Cancel'}</button>
          <button onClick={save} style={{ flex: 1, height: 40, borderRadius: 10, background: 'var(--gradient-brand)', border: 'none', color: '#0a0a0a', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{fr ? 'Enregistrer' : 'Save keys'}</button>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   ROOT APP
════════════════════════════════════════════════════ */
export default function App() {
  const isMobile = useIsMobile();
  const { toggle: toggleTheme, resolved: resolvedTheme } = useTheme();
  const { user, isAdmin, loading, error: authContextError, signIn, signInWithEmail, signUpWithEmail, updateDisplayName, updateAvatar, deleteAccount, logout } = useAuth();

  /* auth */
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'google'>('google');
  const [authError, setAuthError] = useState<string | null>(null);

  /* app state */
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]     = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [inputShake, setInputShake] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationSteps, setGenerationSteps] = useState<string[]>([]); // Claude-style build steps
  const appendStep = (text: string) => setGenerationSteps((s) => (s.includes(text) ? s : [...s, text]));
  const [streamingCode, setStreamingCode] = useState<string | null>(null);  // live text (code editor)
  const [previewCode, setPreviewCode] = useState<string | null>(null);      // throttled (iframe preview)
  const lastPreviewAt = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  // Code editor updates on every chunk (smooth text); preview re-renders at most ~1.5s
  // to avoid hammering the iframe. Double-buffering in <Preview> removes the flash.
  const handleStreamCode = (c: string) => {
    setStreamingCode(c);
    const now = Date.now();
    if (now - lastPreviewAt.current > 1500) { lastPreviewAt.current = now; setPreviewCode(c); }
  };
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [selectedLang, setSelectedLang] = useState<{ code: LanguageCode; name: string; short?: string }>(LANGS[0]);
  // AI model picker — Claude (eval winner) default; remembered per browser.
  const [provider, setProviderState] = useState<Provider>(
    () => (typeof window !== 'undefined' && (localStorage.getItem('gando_provider') as Provider)) || 'claude'
  );
  const setProvider = (p: Provider) => {
    setProviderState(p);
    try { localStorage.setItem('gando_provider', p); } catch { /* ignore */ }
  };
  // BYOK — user's own API keys, stored in this browser only (never sent to our DB).
  const [byokKeys, setByokKeys] = useState<Partial<Record<ByokProvider, string>>>(loadByokKeys);
  const [byokModalOpen, setByokModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false); // account settings (tabbed)
  const [userPrefs, setUserPrefs] = useState<UserPrefs>({});
  const saveUserPrefs = (partial: UserPrefs) => {
    setUserPrefs(prev => ({ ...prev, ...partial }));
    if (user) {
      try { void setDoc(doc(db, 'users', user.uid), { ...partial, updatedAt: serverTimestamp() }, { merge: true }); }
      catch (err) { console.error('prefs save failed:', err); }
    }
  };
  const saveByokKeys = (next: Partial<Record<ByokProvider, string>>) => {
    setByokKeys(next);
    try { localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  // Free models + one entry per provider the user has saved a key for.
  const byokModelOptions: { id: Provider; label: string; sub: string }[] = BYOK_PROVIDERS
    .filter(p => byokKeys[p.id])
    .map(p => ({ id: `byok-${p.id}` as Provider, label: `${p.label.split(' (')[0]} · your key`, sub: 'Your key · your own quota' }));
  const modelOptions = [...MODEL_OPTIONS, ...byokModelOptions];
  const [dashModelOpen, setDashModelOpen] = useState(false);
  const dashModelRef = useRef<HTMLDivElement>(null);
  const [dashPlusOpen, setDashPlusOpen] = useState(false);
  const dashPlusRef = useRef<HTMLDivElement>(null);
  type DashAttachment = { id: string; name: string; kind: 'image' | 'text'; content: string; previewUrl?: string };
  const [dashAttachments, setDashAttachments] = useState<DashAttachment[]>([]);
  const dashFileInputRef = useRef<HTMLInputElement>(null);
  const handleDashFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(file => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        const reader = new FileReader();
        reader.onload = () => setDashAttachments(prev => [...prev, { id, name: file.name, kind: 'image', content: reader.result as string, previewUrl: url }]);
        reader.readAsDataURL(file);
      } else {
        file.text().then(text => setDashAttachments(prev => [...prev, { id, name: file.name, kind: 'text', content: text }]));
      }
    });
    e.target.value = '';
  };
  const buildDashContext = () => dashAttachments.map(a =>
    a.kind === 'image' ? `[Image: ${a.name}]` : `[File: ${a.name}]\n${a.content.slice(0, 4000)}`
  ).join('\n\n');
  const dashVoice = useVoiceInput(input, setInput, selectedLang.name);
  // Build vs Chat mode. Build = generate/edit an app. Chat = just talk to the AI.
  const [mode, setModeState] = useState<'build' | 'chat'>(
    () => (typeof window !== 'undefined' && (localStorage.getItem('gando_mode') as 'build' | 'chat')) || 'build'
  );
  const setMode = (m: 'build' | 'chat') => {
    setModeState(m);
    try { localStorage.setItem('gando_mode', m); } catch { /* ignore */ }
  };
  const [chatMessages, setChatMessages] = useState<Message[]>([]); // active chat-mode thread (in-memory)
  const [chatActive, setChatActive] = useState(false);             // dashboard chat view open
  const [chats, setChats] = useState<ChatThread[]>([]);            // saved chat threads (per user)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const t = TRANSLATIONS[selectedLang.code] || TRANSLATIONS.en;
  const isAdlam = selectedLang.code === 'ff-adlm';

  /* nav / UI */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [page, setPage] = useState<NavPage>('dashboard');
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES_META[0] | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [chatHidden, setChatHidden] = useState(typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  const [communityTemplates, setCommunityTemplates] = useState<Project[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Project | null>(null);
  const [promptTr, setPromptTr] = useState<{ text: string; loading: boolean }>({ text: '', loading: false });
  const trCacheRef = useRef<Map<string, string>>(new Map());
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<'all' | 'live' | 'building' | 'draft'>('all');
  const [headerSearch, setHeaderSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false); // command-palette search (projects + chats)
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [importMode, setImportMode] = useState<'describe' | 'github' | 'figma'>('describe');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [landingInput, setLandingInput] = useState('');
  const [landingModelOpen, setLandingModelOpen] = useState(false);
  const landingModelRef = useRef<HTMLDivElement>(null);
  const [twText, setTwText] = useState('');
  const [twIdx, setTwIdx] = useState(0);
  const [twDel, setTwDel] = useState(false);
  const [twCursor, setTwCursor] = useState(true);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const heroTextareaRef = useRef<HTMLTextAreaElement>(null);
  const landingTextareaRef = useRef<HTMLTextAreaElement>(null);
  const handleHeroInput = () => {
    const el = heroTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = next + 'px';
    el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
  };

  const injectTemplateI18n = useCallback((iframe: HTMLIFrameElement) => {
    try {
      const doc = iframe.contentDocument;
      if (!doc || !doc.body) return;
      const lang = selectedLang.code;
      const uiMap = lang === 'ff-adlm' ? ADLAM_UI : lang === 'fr' ? FRENCH_UI : ENGLISH_UI;
      if (lang === 'ff-adlm') {
        const style = doc.createElement('style');
        style.textContent = `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Adlam:wght@400;700&display=swap');body,nav,h1,h2,h3,p,button,a,li,span,div{font-family:'Noto Sans Adlam',sans-serif!important}`;
        doc.head.appendChild(style);
      }
      const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const orig = node.textContent || '';
        let text = orig;
        for (const [src, target] of Object.entries(uiMap)) {
          text = text.replace(new RegExp(esc(src), 'gi'), target);
        }
        if (text !== orig) node.textContent = text;
      }
    } catch {
      // cross-origin or doc not ready — silently skip
    }
  }, [selectedLang.code]);

  /* system status */
  const [sysStatus, setSysStatus] = useState<{
    server: 'ok'|'degraded'|'down'|'checking';
    ai: 'ok'|'degraded'|'down'|'checking';
    db: 'ok'|'degraded'|'down'|'checking';
    model: string; aiMs: number; uptime: number; checked: string;
  }>({ server: 'checking', ai: 'checking', db: 'checking', model: '—', aiMs: 0, uptime: 0, checked: '' });

  /* close dropdowns on outside click */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (!(e.target as Element).closest('.user-menu-container')) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => { if (authContextError) { setAuthError(authContextError); setGlobalError(authContextError); } }, [authContextError]);

  /* projects listener */
  useEffect(() => {
    if (!user) { setProjects([]); return; }
    const q = query(collection(db, 'projects'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      setProjects(list);
      if (currentProject) {
        const up = list.find(p => p.id === currentProject.id);
        if (up && up.updatedAt !== currentProject.updatedAt) setCurrentProject(up);
      }
    }, err => setGlobalError(`Permission Error: ${err.message}`));
  }, [user, currentProject?.id]);

  /* user prefs listener (preferredName, occupation, training/location toggles) */
  useEffect(() => {
    if (!user) { setUserPrefs({}); return; }
    return onSnapshot(doc(db, 'users', user.uid),
      snap => {
        const d = snap.data() || {};
        setUserPrefs({
          preferredName: d.preferredName,
          occupation: d.occupation,
          allowTraining: d.allowTraining,
          allowPreciseLocation: d.allowPreciseLocation,
        });
      },
      () => {});
  }, [user]);

  /* chats listener (per user) */
  useEffect(() => {
    if (!user) { setChats([]); return; }
    const q = query(collection(db, 'chats'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
    return onSnapshot(q,
      snap => setChats(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatThread))),
      () => {});
  }, [user]);

  /* community templates listener (admin-approved, public) */
  useEffect(() => {
    if (!user) { setCommunityTemplates([]); return; }
    const q = query(collection(db, 'projects'), where('featured', '==', true));
    return onSnapshot(q,
      snap => setCommunityTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project))),
      () => {});
  }, [user]);

  /* translate a community template's prompt into the selected language (lazy + cached) */
  useEffect(() => {
    const cc = selectedCommunity;
    const clean = cleanPrompt(cc?.description || '');
    if (!cc || !clean || selectedLang.code === 'en') { setPromptTr({ text: '', loading: false }); return; }
    const key = `${cc.id}:${selectedLang.code}`;
    const cached = trCacheRef.current.get(key);
    if (cached !== undefined) { setPromptTr({ text: cached, loading: false }); return; }
    let cancelled = false;
    setPromptTr({ text: '', loading: true });
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ text: clean.slice(0, 2000), targetLanguage: selectedLang.name }),
        });
        const data = await res.json();
        const tr = res.ok ? cleanPrompt(data.translation || '') : '';
        trCacheRef.current.set(key, tr);
        if (!cancelled) setPromptTr({ text: tr, loading: false });
      } catch {
        if (!cancelled) setPromptTr({ text: '', loading: false });
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCommunity?.id, selectedLang.code]);

  /* messages listener */
  useEffect(() => {
    if (!currentProject) { setMessages([]); return; }
    const q = query(collection(db, 'projects', currentProject.id, 'messages'), orderBy('timestamp', 'asc'));
    return onSnapshot(q, snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message))),
      err => setGlobalError(`Messages Error: ${err.message}`));
  }, [currentProject?.id]);

  /* fetch system status */
  const fetchStatus = useCallback(async () => {
    setSysStatus(s => ({ ...s, server: 'checking', ai: 'checking', db: 'checking' }));
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setSysStatus({
        server: data.server === 'ok' ? 'ok' : 'degraded',
        ai: data.ai as 'ok'|'degraded'|'down',
        db: user ? 'ok' : 'degraded',
        model: data.model, aiMs: data.aiLatencyMs, uptime: data.uptime,
        checked: new Date().toLocaleTimeString(),
      });
    } catch {
      setSysStatus(s => ({ ...s, server: 'down', ai: 'down', checked: new Date().toLocaleTimeString() }));
    }
  }, [user]);

  useEffect(() => { if (page === 'status') fetchStatus(); }, [page]);

  useEffect(() => {
    if (!dashModelOpen) return;
    const handler = (e: MouseEvent) => {
      if (dashModelRef.current && !dashModelRef.current.contains(e.target as Node)) setDashModelOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dashModelOpen]);

  useEffect(() => {
    if (!landingModelOpen) return;
    const handler = (e: MouseEvent) => {
      if (landingModelRef.current && !landingModelRef.current.contains(e.target as Node)) setLandingModelOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [landingModelOpen]);

  useEffect(() => {
    if (!dashPlusOpen) return;
    const handler = (e: MouseEvent) => {
      if (dashPlusRef.current && !dashPlusRef.current.contains(e.target as Node)) setDashPlusOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dashPlusOpen]);

  /* typewriter */
  useEffect(() => {
    const active = user ? input : landingInput;
    if (active) return;
    const phrase = t.twPhrases[twIdx % t.twPhrases.length];
    const timer = !twDel
      ? twText.length < phrase.length
        ? setTimeout(() => setTwText(phrase.slice(0, twText.length + 1)), 52)
        : setTimeout(() => setTwDel(true), 2200)
      : twText.length > 0
        ? setTimeout(() => setTwText(phrase.slice(0, twText.length - 1)), 28)
        : (() => { setTwDel(false); setTwIdx(i => (i + 1) % t.twPhrases.length); return undefined; })();
    return () => { if (timer) clearTimeout(timer); };
  }, [twText, twDel, twIdx, input, landingInput, user]);
  useEffect(() => {
    const t = setInterval(() => setTwCursor(c => !c), 530);
    return () => clearInterval(t);
  }, []);

  /* ── handlers ─────────────────────────────────── */
  const handleLogin = async () => {
    setAuthError(null);
    try {
      if (authMode === 'google') await signIn();
      else if (authMode === 'login') await signInWithEmail(email, password);
      else await signUpWithEmail(email, password);
    } catch (err: any) { setAuthError(err.message || t.errorAuth); }
  };

  const handleStop = () => { abortRef.current?.abort(); };

  const createNewProject = async (prompt: string, signal: AbortSignal) => {
    const result = await generateProject(prompt, selectedLang.name, appendStep, handleStreamCode, provider, resolveByok(provider, byokKeys), signal);
    // If aborted before any code arrived, nothing to save.
    if (!result.code) return;
    const data = {
      userId: user!.uid, name: result.name || 'Untitled App', description: prompt,
      language: selectedLang.name, languageCode: selectedLang.code,
      code: result.code, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    try {
      const ref = await addDoc(collection(db, 'projects'), data);
      const np = { id: ref.id, ...data } as unknown as Project;
      setCurrentProject(np);
      await addDoc(collection(db, 'projects', ref.id, 'messages'), { projectId: ref.id, role: 'user', content: prompt, timestamp: serverTimestamp() });
      if (!result.wasAborted) {
        await addDoc(collection(db, 'projects', ref.id, 'messages'), { projectId: ref.id, role: 'assistant', content: result.explanation, codeSnapshot: result.code, timestamp: serverTimestamp() });
      }
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'projects'); }
  };

  const updateExistingProject = async (prompt: string, signal: AbortSignal) => {
    if (!currentProject) return;
    try {
      await addDoc(collection(db, 'projects', currentProject.id, 'messages'), { projectId: currentProject.id, role: 'user', content: prompt, timestamp: serverTimestamp() });
      const result = await editProject(prompt, currentProject.code, messages, currentProject.language, appendStep, handleStreamCode, provider, resolveByok(provider, byokKeys), signal);
      // Always save what was built — partial or complete.
      const savedCode = result.code || currentProject.code;
      await updateDoc(doc(db, 'projects', currentProject.id), { code: savedCode, updatedAt: serverTimestamp() });
      setCurrentProject(p => p ? { ...p, code: savedCode } : null);
      if (!result.wasAborted) {
        await addDoc(collection(db, 'projects', currentProject.id, 'messages'), { projectId: currentProject.id, role: 'assistant', content: result.explanation, codeSnapshot: savedCode, timestamp: serverTimestamp() });
      }
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, `projects/${currentProject.id}`); }
  };

  // Open a saved chat thread into the live view.
  const openChat = (c: ChatThread) => {
    setCurrentChatId(c.id);
    setChatMessages(c.messages.map((m, i) => ({ id: `${c.id}-${i}`, projectId: '', role: m.role, content: m.content, timestamp: Date.now() })));
    setCurrentProject(null);
    setChatActive(true);
    setMode('chat');
    setMobileNavOpen(false);
  };

  // Start a fresh chat thread.
  const startNewChat = () => {
    setCurrentChatId(null);
    setChatMessages([]);
    setCurrentProject(null);
    setChatActive(true);
    setMode('chat');
    setInput('');
    setMobileNavOpen(false);
  };

  // Persist a completed chat exchange to Firestore (per user). New thread on first
  // message, append after that. Best-effort — a save failure never breaks the chat.
  const persistChat = async (userText: string, aiText: string) => {
    if (!user) return;
    const pair = [{ role: 'user' as const, content: userText }, { role: 'assistant' as const, content: aiText }];
    try {
      if (currentChatId) {
        const existing = chats.find(c => c.id === currentChatId);
        await updateDoc(doc(db, 'chats', currentChatId), {
          messages: [...(existing?.messages ?? []), ...pair],
          updatedAt: serverTimestamp(),
        });
      } else {
        const ref = await addDoc(collection(db, 'chats'), {
          userId: user.uid,
          title: userText.slice(0, 60),
          messages: pair,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setCurrentChatId(ref.id);
      }
    } catch (err) { console.error('chat save failed:', err); }
  };

  // Upload a new avatar image to Storage (reuses the collector/{uid} path which
  // already allows owner image writes), then set it as the profile photo.
  const changeAvatar = async (file: File) => {
    if (!user) return;
    const r = ref(storage, `collector/${user.uid}/avatar-${Date.now()}-${file.name}`);
    await uploadBytes(r, file);
    const url = await getDownloadURL(r);
    await updateAvatar(url);
  };

  // Export the user's data (projects + chats) as a downloadable JSON file.
  const exportUserData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      account: { uid: user?.uid, email: user?.email, displayName: user?.displayName },
      projects: projects.map(p => ({ id: p.id, name: p.name, description: p.description, language: p.language, code: p.code, createdAt: p.createdAt, updatedAt: p.updatedAt })),
      chats: chats.map(c => ({ id: c.id, title: c.title, messages: c.messages, createdAt: c.createdAt, updatedAt: c.updatedAt })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gando-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Real account deletion: purge the user's Firestore docs (projects + chats +
  // profile), then delete the auth account. onAuthStateChanged then signs them out.
  const runDeleteAccount = async () => {
    if (!user) return;
    const uid = user.uid;
    // best-effort purge of owned data
    try {
      await Promise.all(projects.map(p => deleteDoc(doc(db, 'projects', p.id)).catch(() => {})));
      await Promise.all(chats.map(c => deleteDoc(doc(db, 'chats', c.id)).catch(() => {})));
      await deleteDoc(doc(db, 'users', uid)).catch(() => {});
    } catch { /* non-blocking */ }
    await deleteAccount(); // may throw auth/requires-recent-login → surfaced in modal
  };

  // Chat mode — converse with the AI, no app generation. Thread saved per user (chats).
  const runChat = async (typedPrompt: string, extraContext?: string) => {
    if (!currentProject) setChatActive(true); // dashboard chat opens the full-screen session
    const fullPrompt = extraContext ? `${extraContext}\n\n${typedPrompt}` : typedPrompt;
    const userMsg: Message = { id: `u-${Date.now()}`, projectId: '', role: 'user', content: typedPrompt, timestamp: Date.now() };
    const aiMsg: Message = { id: `a-${Date.now()}`, projectId: '', role: 'assistant', content: '', timestamp: Date.now() };
    const history = chatMessages;
    setChatMessages(prev => [...prev, userMsg, aiMsg]);
    setInput('');
    setIsGenerating(true);
    let finalAnswer = '';
    try {
      finalAnswer = await chatStream(
        fullPrompt,
        history,
        currentProject?.code,
        selectedLang.name,
        (full) => setChatMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...aiMsg, content: full };
          return copy;
        }),
        provider,
        resolveByok(provider, byokKeys)
      );
    } catch (err: any) {
      const m = err.message || 'Chat failed.';
      finalAnswer = `⚠️ ${m}`;
      setChatMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...aiMsg, content: finalAnswer };
        return copy;
      });
    } finally { setIsGenerating(false); }
    // Save the exchange (dashboard chat threads only — project chats live with the project).
    if (!currentProject) await persistChat(typedPrompt, finalAnswer);
  };

  const handleSend = async (extraContext?: string) => {
    if (!input.trim()) {
      setInputShake(true);
      setTimeout(() => setInputShake(false), 500);
      return;
    }
    if (!user) return;
    if (mode === 'chat') { await runChat(input.trim(), extraContext); return; }
    setIsGenerating(true);
    setStreamingCode(null);
    setPreviewCode(null);
    setGenerationSteps([]);
    lastPreviewAt.current = 0;
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const basePrompt = importMode === 'github'
      ? `Clone and recreate a web app inspired by this GitHub repository: ${input}`
      : importMode === 'figma'
      ? `Build a pixel-perfect web UI matching this Figma design: ${input}`
      : input;
    const prompt = extraContext ? `${extraContext}\n\n${basePrompt}` : basePrompt;
    setInput('');
    try {
      if (!currentProject) await createNewProject(prompt, signal);
      else await updateExistingProject(prompt, signal);
    } catch (err: any) {
      const m = err.message || '';
      setGlobalError(/429|quota|rate|RESOURCE_EXHAUSTED/i.test(m)
        ? "You've reached the AI limit. Please wait a minute." : m || 'Unexpected error.');
    } finally { setIsGenerating(false); setStreamingCode(null); setPreviewCode(null); setGenerationSteps([]); abortRef.current = null; }
  };

  const handleRevert = async (snapshot: string) => {
    if (!currentProject || snapshot === currentProject.code) return;
    setCurrentProject(p => p ? { ...p, code: snapshot } : null);
    try { await updateDoc(doc(db, 'projects', currentProject.id), { code: snapshot, updatedAt: serverTimestamp() }); }
    catch { setGlobalError('Could not revert.'); }
  };

  const handleCodeChange = async (code: string) => {
    if (!currentProject) return;
    setCurrentProject(p => p ? { ...p, code } : null);
    try { await updateDoc(doc(db, 'projects', currentProject.id), { code, updatedAt: new Date().toISOString() }); }
    catch (err) { console.error('Code update failed:', err); }
  };

  const handleDownload = () => {
    if (!currentProject) return;
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([currentProject.code], { type: 'text/html' })),
      download: `${currentProject.name.replace(/\s+/g, '_')}.html`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
  };

  const handleRename = async () => {
    if (!currentProject || !newName.trim()) return;
    try {
      await updateDoc(doc(db, 'projects', currentProject.id), { name: newName.trim(), updatedAt: new Date().toISOString() });
      setCurrentProject(p => p ? { ...p, name: newName.trim() } : null);
      setIsRenaming(false);
    } catch (err) { console.error('Rename failed:', err); }
  };

  const deleteProject = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    try { await deleteDoc(doc(db, 'projects', id)); if (currentProject?.id === id) setCurrentProject(null); }
    catch (err) { console.error('Delete failed:', err); }
  };

  const openProject = (p: Project) => { setCurrentProject(p); };

  const shareProject = async (p: Project) => {
    if (p.shareStatus === 'pending' || p.featured) return;
    if (!confirm(t.shareConfirm)) return;
    setSharingId(p.id);
    try {
      await updateDoc(doc(db, 'projects', p.id), { shareStatus: 'pending', sharedAt: serverTimestamp() });
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, `projects/${p.id}`); }
    finally { setSharingId(null); }
  };

  const remixCommunity = async (tmpl: Project) => {
    if (!user) return;
    const data = {
      userId: user.uid, name: `${tmpl.name} (remix)`, description: tmpl.description || '',
      language: tmpl.language, languageCode: tmpl.languageCode,
      code: tmpl.code, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    try {
      const refDoc = await addDoc(collection(db, 'projects'), data);
      setCurrentProject({ id: refDoc.id, ...data } as unknown as Project);
      setSelectedTemplate(null);
      setSelectedCommunity(null);
      setPage('projects');
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'projects'); }
  };

  const openFullPreview = (code: string) => {
    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  // Keep only the natural-language prompt — drop any code/HTML that leaked into the
  // stored description (or a model translation). Cut at the first code fence/markup.
  const cleanPrompt = (s: string): string => {
    if (!s) return '';
    let t = s;
    let cut = -1;
    for (const m of ['```', '<!DOCTYPE', '<!doctype', '<html', '<HTML', '<head', '<body', '<style']) {
      const i = t.indexOf(m);
      if (i !== -1 && (cut === -1 || i < cut)) cut = i;
    }
    if (cut !== -1) t = t.slice(0, cut);
    t = t.replace(/<[^>]+>/g, ' ');
    return t.replace(/\s+/g, ' ').trim();
  };

  /* ── derived metrics ──────────────────────────── */
  const completionPct = Math.min(projects.length * 12, 96);
  const tokenPct = Math.min(messages.length * 2.5, 90);
  const userMessages = messages.filter(m => m.role === 'user').length;
  const filteredProjects = projects
    .filter(p => projectFilter === 'all' || p.status === projectFilter)
    .filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(projectSearch.toLowerCase())
  );

  /* ═════════════════════════════════════════════════
     LOADING
  ═════════════════════════════════════════════════ */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: P }} />
          <div className="absolute inset-0 rounded-full blur-xl animate-pulse" style={{ background: `${P}25` }} />
        </div>
        <p className="text-white text-sm font-medium" style={{ fontFamily: MANROPE }}>Loading Gando AI…</p>
      </div>
    </div>
  );

  /* ═════════════════════════════════════════════════
     LANDING PAGE
  ═════════════════════════════════════════════════ */
  if (!user) return (
    <div className={cn('min-h-screen relative overflow-x-hidden', isAdlam && 'font-adlam')}
      style={{ background: 'var(--app-bg)', color: 'var(--text-primary)' }}>

      <ByokModal open={byokModalOpen} keys={byokKeys} onSave={saveByokKeys} onClose={() => setByokModalOpen(false)} fr={selectedLang.code === "fr"} />

      {/* ambient blobs + grid */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute w-[65%] h-[65%] rounded-full top-[-20%] left-[-10%]"
          style={{ background: P, filter: 'blur(120px)', opacity: 0.07 }} />
        <div className="absolute w-[65%] h-[65%] rounded-full bottom-[-20%] right-[-10%]"
          style={{ background: S, filter: 'blur(120px)', opacity: 0.07 }} />
        <div className="absolute inset-0"
          style={{ backgroundImage: 'linear-gradient(to right,#80808006 1px,transparent 1px),linear-gradient(to bottom,#80808006 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-10 h-16 border-b border-white/5"
        style={{ background: 'var(--navbar-bg)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-2 md:gap-2.5 min-w-0 flex-shrink-0">
          <GandoLogo size={22} />
          <span style={{ fontFamily: MANROPE, fontSize: 18, fontWeight: 900, background: `linear-gradient(135deg,${P},${S})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Gando</span>
          <span className="hidden sm:inline" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', color: '#52525b', textTransform: 'uppercase', marginLeft: 2 }}>BETA</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
          <button onClick={toggleTheme} title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-xl transition-colors"
            style={{ color: 'var(--text-muted)', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'}>
            {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <LanguageSelector currentLanguage={selectedLang} languages={LANGS} onSelect={setSelectedLang} />
          <button onClick={() => { setAuthMode('login'); setAuthError(null); setAuthModalOpen(true); }}
            className="text-sm font-bold text-zinc-400 hover:text-white transition-colors px-2.5 md:px-4 py-2 rounded-xl hover:bg-white/5"
            style={{ fontFamily: MANROPE }}>
            {t.signIn}
          </button>
          <button onClick={() => { setAuthMode('google'); setAuthError(null); setAuthModalOpen(true); }}
            className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl font-black text-black text-sm transition-all hover:scale-[1.03] active:scale-95"
            style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--glow-primary-sm)', fontFamily: MANROPE, whiteSpace: 'nowrap' }}>
            <span>{t.getStarted} →</span>
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative z-10 pt-32 pb-20 px-5 flex flex-col items-center text-center">
        <div style={{ maxWidth: 820, width: '100%' }}>
          <p className={cn(isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE, fontSize: 11, fontWeight: 900, letterSpacing: '0.16em', color: P, textTransform: 'uppercase', marginBottom: 20 }}>
            {t.loginEyebrow}
          </p>
          <h2 className={cn(isAdlam && 'font-adlam-display')} style={{ fontFamily: isAdlam ? undefined : MANROPE, fontWeight: 900, fontSize: 'clamp(26px,4vw,48px)', lineHeight: 1.1, letterSpacing: isAdlam ? 0 : '-0.03em', color: 'var(--text-primary)', marginBottom: 14 }}>
            {t.loginLine1} {t.loginLine2}{' '}
            <span style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t.loginLine3}</span>
          </h2>

          {/* ── SCROLL VELOCITY STRIP — replaces subtitle, landing only ── */}
          <div style={{ position: 'relative', left: '50%', transform: 'translateX(-50%)', width: '100vw', overflow: 'hidden', margin: '0 0 32px' }}>
            {/* ADLaM row — RTL script, orange, moves rightward */}
            <ScrollVelocity
              texts={['𞤃𞤢𞤸𞤭𞤪 𞤫 𞤳𞤢𞤤𞤢 𞤯𞤫𞤥𞤽𞤢𞤤. 𞤖𞤢𞤳𞥆𞤭𞤤𞤮 𞤳𞤵𞥄𞤩𞤢𞤤 𞤬𞤭𞥄 𞤀𞤬𞤪𞤭𞤳. 𞤳𞤮𞥄𞤣𞤭 𞤸𞤢𞥄𞤶𞤢𞤼𞤢𞥄. 𞤆𞤭𞤲𞤢𞤤 𞤥𞤢𞥄⹁ 𞤀𞤨𞥆 𞤥𞤢𞥄!']}
              velocity={-80}
              className="gando-scroll-adlam"
              parallaxClassName="gando-scroll-parallax"
              scrollerClassName="gando-scroll-scroller"
              numCopies={8}
              damping={50}
              stiffness={400}
            />
            {/* Latin row — white, changes with language, moves leftward */}
            <ScrollVelocity
              texts={[
                selectedLang.code === 'fr'
                  ? "Créez dans votre langue. IA pour l'Afrique. Sans code. Votre culture, votre app!"
                  : 'Build in any language. AI for Africa. No code needed. Your culture, your app!',
              ]}
              velocity={80}
              className="gando-scroll-latin"
              parallaxClassName="gando-scroll-parallax"
              scrollerClassName="gando-scroll-scroller"
              numCopies={8}
              damping={50}
              stiffness={400}
            />
          </div>

          {/* textarea card */}
          <div style={{ borderRadius: 20, background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: '0 32px 80px -12px rgba(0,0,0,0.7)', padding: '18px 18px 14px', textAlign: 'left' }}>
            <textarea
              ref={landingTextareaRef}
              value={landingInput}
              onChange={e => setLandingInput(e.target.value)}
              onInput={() => {
                const el = landingTextareaRef.current;
                if (!el) return;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 200) + 'px';
              }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setAuthMode('google'); setAuthModalOpen(true); } }}
              placeholder={!landingInput ? (twText + (twCursor ? '|' : ' ')) : ''}
              className="gando-input"
              style={{ width: '100%', minHeight: 100, background: 'transparent', border: 'none', outline: 'none', resize: 'none', color: 'var(--text-primary)', fontSize: 16, lineHeight: 1.6, fontFamily: 'var(--font-sans)', display: 'block', boxSizing: 'border-box', overflowY: 'hidden' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', gap: 8 }}>
              {/* Left cluster: Plus · Model · Mode */}
              <div className="flex items-center gap-2 min-w-0">
                {/* Plus — opens auth */}
                <button
                  onClick={() => { setAuthMode('google'); setAuthError(null); setAuthModalOpen(true); }}
                  title="Sign in to attach files"
                  style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--btn-bg)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                  <Plus className="w-4 h-4" />
                </button>
                {/* Model picker — functional (just UI state) */}
                <div ref={landingModelRef} style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    onClick={() => setLandingModelOpen(o => !o)}
                    title="Choose AI model"
                    style={{ height: 38, borderRadius: 12, background: 'var(--btn-bg)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 700 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: PROVIDER_COLOR[provider] }} />
                    {PROVIDER_LABEL[provider]}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                  {landingModelOpen && (
                    <div style={{ position: 'absolute', top: 44, left: 0, background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'hidden', overflowY: 'auto', minWidth: 240, maxHeight: 132, zIndex: 50 }}>
                      {modelOptions.map(m => (
                        <div key={m.id} onClick={() => { setProvider(m.id); setLandingModelOpen(false); }}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--hover-bg)'}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: PROVIDER_COLOR[m.id] }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{m.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{m.sub}</div>
                          </div>
                          {provider === m.id && <Check className="w-3.5 h-3.5" style={{ color: '#3b82f6', flexShrink: 0 }} />}
                        </div>
                      ))}
                      <div onClick={() => { setByokModalOpen(true); setLandingModelOpen(false); }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--hover-bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent', borderTop: '1px solid var(--border)' }}>
                        <Plus className="w-3.5 h-3.5" style={{ color: '#3b82f6', flexShrink: 0 }} />
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{selectedLang.code === "fr" ? "Utilisez votre clé" : "Bring your own key"}</div>
                      </div>
                    </div>
                  )}
                </div>
                {/* Build/Chat toggle */}
                <ModeSwitch mode={mode} onChange={setMode} />
              </div>
              {/* Right cluster: Voice · Send */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => { setAuthMode('google'); setAuthError(null); setAuthModalOpen(true); }}
                  title="Sign in to use voice input"
                  style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--btn-bg)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setAuthMode('google'); setAuthError(null); setAuthModalOpen(true); }}
                  title={mode === 'chat' ? 'Sign in to chat' : 'Sign in to build'}
                  style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: landingInput.trim() ? 'var(--gradient-brand)' : 'rgba(255,255,255,0.06)', color: landingInput.trim() ? '#0a0a0a' : '#52525b', boxShadow: landingInput.trim() ? 'var(--glow-primary-sm)' : 'none' }}>
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* trust row */}
          <div className="flex items-center justify-center gap-4 flex-wrap mt-5" style={{ fontSize: 12, color: '#52525b' }}>
            <span>🔒 SOC 2 Type II</span><span style={{ color: '#3f3f46' }}>·</span>
            <span>Data stays in-region</span><span style={{ color: '#3f3f46' }}>·</span>
            <span>Free during Beta</span>
          </div>
        </div>
      </section>

      {/* ── TEMPLATES ── */}
      {(() => {
        const tl = TEMPLATE_I18N[selectedLang.code] || TEMPLATE_I18N.en;
        return (
          <section className="relative z-10 px-5 md:px-10 pb-24" style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 style={{ fontFamily: MANROPE, fontWeight: 900, fontSize: 24, color: 'var(--text-primary)', margin: 0 }}>{tl.pageTitle}</h2>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{tl.pageSubtitle}</p>
              </div>
              <button onClick={() => { setAuthMode('google'); setAuthError(null); setAuthModalOpen(true); }}
                style={{ fontSize: 11, fontWeight: 900, color: P, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: MANROPE }}>
                {tl.viewAll} →
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {TEMPLATES_META.slice(0, 6).map(tmpl => {
                const tr = tl.templates[tmpl.id] || TEMPLATE_I18N.en.templates[tmpl.id];
                return (
                  <motion.div key={tmpl.id} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    onClick={() => { setAuthMode('google'); setAuthError(null); setAuthModalOpen(true); }}
                    className="group relative rounded-2xl overflow-hidden cursor-pointer border border-white/8 hover:border-white/20 transition-all"
                    style={{ background: 'var(--card-bg)' }}>
                    <div className="relative overflow-hidden" style={{ height: 160, background: tmpl.color }}>
                      {tmpl.previewUrl ? (
                        <iframe src={tmpl.previewUrl} title={tr.name} className="border-none pointer-events-none"
                          style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Layers className="w-10 h-10 opacity-20 text-white" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '7px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Use template →</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ padding: '2px 8px', borderRadius: 9999, background: `${P}18`, color: P, fontSize: 9, fontWeight: 700, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tmpl.category}</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{tmpl.city}</span>
                      </div>
                      <h3 style={{ fontFamily: MANROPE, fontWeight: 900, fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>{tr.name}</h3>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#71717a', lineHeight: 1.5 }}>{tr.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-white/5" style={{ padding: '48px 40px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <GandoLogo size={20} />
                <span style={{ fontFamily: MANROPE, fontSize: 16, fontWeight: 900, background: `linear-gradient(135deg,${P},${S})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Gando</span>
              </div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#52525b', lineHeight: 1.6 }}>
                AI app builder for West Africa. Build in ADLaM, French, English, and more.
              </p>
            </div>
            {[
              { title: 'Resources', links: ['Documentation', 'API Reference', 'Templates', 'Changelog'] },
              { title: 'Company',   links: ['About', 'Blog', 'Careers', 'Press'] },
              { title: 'Community', links: ['Discord', 'Twitter / X', 'GitHub', 'Support'] },
            ].map(col => (
              <div key={col.title}>
                <p style={{ fontFamily: MANROPE, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', color: '#52525b', textTransform: 'uppercase', marginBottom: 14 }}>{col.title}</p>
                <div className="space-y-2.5">
                  {col.links.map(lnk => (
                    <p key={lnk}
                      style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text-muted)', cursor: 'default', transition: 'color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLParagraphElement).style.color = '#fff'}
                      onMouseLeave={e => (e.currentTarget as HTMLParagraphElement).style.color = '#767575'}>
                      {lnk}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-6 border-t border-white/5">
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#3f3f46' }}>© 2025 Gando AI. All rights reserved.</p>
            <p style={{ fontFamily: MANROPE, fontSize: 11, fontWeight: 700, color: '#52525b', letterSpacing: '0.08em' }}>BUILT FOR WEST AFRICA 🌍</p>
          </div>
        </div>
      </footer>

      {/* ── AUTH MODAL ── */}
      <AnimatePresence>
        {authModalOpen && (
          <motion.div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(20px)' }}
              onClick={() => { setAuthModalOpen(false); setAuthError(null); }} />
            <motion.div className="relative z-10 w-full rounded-3xl border border-white/10 p-8"
              style={{ maxWidth: 420, background: '#0f0f0f', boxShadow: '0 40px 100px rgba(0,0,0,0.85)' }}
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}>

              <button onClick={() => { setAuthModalOpen(false); setAuthError(null); }}
                className="absolute top-4 right-4 p-2 rounded-lg text-zinc-600 hover:text-white hover:bg-white/5 transition-all">
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-6">
                <GandoLogo size={22} />
                <span style={{ fontFamily: MANROPE, fontSize: 17, fontWeight: 900, background: `linear-gradient(135deg,${P},${S})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Gando</span>
              </div>

              <h2 style={{ fontFamily: MANROPE, fontWeight: 900, fontSize: 26, color: 'var(--text-primary)', marginBottom: 6 }}>
                {authMode === 'login' ? 'Welcome back' : authMode === 'signup' ? 'Create account' : 'Get started free'}
              </h2>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
                {authMode === 'login' ? 'Sign in to continue building.' : authMode === 'signup' ? 'Build your first app in minutes.' : 'One click to start building.'}
              </p>

              {authMode === 'google' ? (
                <div className="space-y-3">
                  <button onClick={handleLogin}
                    className="w-full flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
                    style={{ padding: '15px 24px', borderRadius: 14, background: '#ffffff', color: '#000', fontFamily: MANROPE, fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer' }}>
                    <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                    Continue with Google
                  </button>
                  {authError && <p className="text-red-400 text-xs text-center">{authError}</p>}
                  <button onClick={() => { setAuthMode('login'); setAuthError(null); }}
                    className="w-full text-sm font-medium transition-colors hover:text-white text-center"
                    style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginTop: 4 }}>
                    Or use email & password
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
                    className="gando-input w-full rounded-xl px-4 py-3 text-white border border-white/10 outline-none transition-all" />
                  <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                    className="gando-input w-full rounded-xl px-4 py-3 text-white border border-white/10 outline-none transition-all"
                    onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }} />
                  {authError && <p className="text-red-400 text-xs">{authError}</p>}
                  <button onClick={handleLogin}
                    className="w-full py-3.5 rounded-xl font-black text-black transition-all hover:scale-[1.01]"
                    style={{ fontFamily: MANROPE, background: 'var(--gradient-brand)', boxShadow: 'var(--glow-primary-sm)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--glow-primary-lg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--glow-primary-sm)'}>
                    {authMode === 'login' ? 'Sign In' : 'Sign Up'}
                  </button>
                  <div className="flex flex-col gap-2 pt-1">
                    <button onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(null); }}
                      className="text-xs font-bold transition-colors" style={{ color: P, fontFamily: MANROPE }}>
                      {authMode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
                    </button>
                    <button onClick={() => { setAuthMode('google'); setAuthError(null); }}
                      className="text-xs font-medium transition-colors hover:text-white text-center" style={{ color: '#52525b' }}>
                      ← Back to Google login
                    </button>
                  </div>
                </div>
              )}

              {/* data/training disclosure (GDPR — opt-out lives in Settings → Privacy) */}
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-faint)', marginTop: 18, lineHeight: 1.5, textAlign: 'center' }}>
                By continuing, your chats may be used to improve our AI models. You can turn this off anytime in Settings → Privacy.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  /* ═════════════════════════════════════════════════
     MAIN APP
  ═════════════════════════════════════════════════ */
  return (
    <div className={cn('w-screen flex flex-col overflow-hidden', isAdlam && 'font-adlam')} style={{ background: 'var(--app-bg)', color: 'var(--text-primary)', height: '100dvh' }}>

      <ByokModal open={byokModalOpen} keys={byokKeys} onSave={saveByokKeys} onClose={() => setByokModalOpen(false)} fr={selectedLang.code === "fr"} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        displayName={user.displayName || ''}
        email={user.email || ''}
        photoURL={user.photoURL}
        prefs={userPrefs}
        theme={resolvedTheme}
        t={t}
        fr={selectedLang.code === 'fr'}
        onToggleTheme={toggleTheme}
        onSaveName={updateDisplayName}
        onChangeAvatar={changeAvatar}
        onSavePrefs={saveUserPrefs}
        onExport={exportUserData}
        onLogout={() => { setSettingsOpen(false); logout(); }}
        onDelete={runDeleteAccount}
      />

      {/* ════ SEARCH (command palette) ════ */}
      {searchModalOpen && (() => {
        const q = searchQuery.toLowerCase().trim();
        const projHits = projects.filter(p =>
          !q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q) || (p.language || '').toLowerCase().includes(q)
        ).slice(0, 6);
        const chatHits = chats.filter(c =>
          !q || (c.title || '').toLowerCase().includes(q) || c.messages?.some(m => m.content.toLowerCase().includes(q))
        ).slice(0, 6);
        return (
          <div onClick={() => setSearchModalOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 400, padding: '12vh 16px 16px' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 100px rgba(0,0,0,0.6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <Search className="w-4 h-4 flex-shrink-0" style={{ color: '#71717a' }} />
                <input autoFocus value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setSearchModalOpen(false); }}
                  placeholder={selectedLang.code === 'fr' ? 'Rechercher projets et discussions…' : 'Search projects and chats…'}
                  className="gando-input"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 15, fontFamily: 'Inter, sans-serif' }} />
                <button onClick={() => setSearchModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
              </div>
              <div style={{ overflowY: 'auto', padding: 8 }}>
                {projHits.length === 0 && chatHits.length === 0 && (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {selectedLang.code === 'fr' ? 'Aucun résultat' : 'No results'}{q ? ` for "${searchQuery}"` : ''}
                  </div>
                )}
                {projHits.length > 0 && (
                  <>
                    <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#71717a', padding: '8px 12px 4px', fontFamily: MANROPE }}>{t.myProjectsLabel}</p>
                    {projHits.map(p => (
                      <button key={p.id} onClick={() => { openProject(p); setCurrentProject(p); setSearchModalOpen(false); }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: 'none', background: 'transparent', textAlign: 'left' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${P}18` }}>
                          <Sparkles className="w-4 h-4" style={{ color: P }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                          <p style={{ fontSize: 11, color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.language} · {p.description?.slice(0, 50) || '—'}</p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {chatHits.length > 0 && (
                  <>
                    <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#71717a', padding: '8px 12px 4px', fontFamily: MANROPE }}>{t.chatsLabel}</p>
                    {chatHits.map(c => (
                      <button key={c.id} onClick={() => { openChat(c); setSearchModalOpen(false); }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: 'none', background: 'transparent', textAlign: 'left' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${P}18` }}>
                          <MessageSquare className="w-4 h-4" style={{ color: P }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title || 'Untitled chat'}</p>
                          <p style={{ fontSize: 11, color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.messages?.[c.messages.length - 1]?.content?.slice(0, 50) || '—'}</p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* global error toast */}
      <AnimatePresence>
        {globalError && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] max-w-md w-full px-4">
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/20 shadow-2xl backdrop-blur-xl" style={{ background: 'rgba(255,50,50,0.08)' }}>
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-300 flex-1">{globalError}</p>
              <button onClick={() => setGlobalError(null)}><X className="w-4 h-4 text-zinc-500 hover:text-white" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════ HEADER ════════ */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 md:px-8 flex-shrink-0"
        style={{ background: 'var(--navbar-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        {/* brand + nav */}
        <div className="flex items-center gap-2 md:gap-8 min-w-0 flex-shrink-0">
          <button onClick={() => setMobileNavOpen(o => !o)}
            className="md:hidden p-2 -ml-1 rounded-lg text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Menu">
            <PanelLeft className="w-5 h-5" />
          </button>
          <span className={cn('text-lg md:text-2xl font-black tracking-tight cursor-pointer select-none', isAdlam && 'font-adlam')}
            style={{ fontFamily: isAdlam ? undefined : MANROPE, background: `linear-gradient(135deg,${P},${S})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            onClick={() => { setCurrentProject(null); setPage('dashboard'); }}>
            {t.appName.toUpperCase()}
          </span>
        </div>


        {/* icons + language */}
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          <button onClick={toggleTheme} title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-xl transition-colors"
            style={{ color: 'var(--text-muted)', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'}>
            {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {/* language selector — global, lives in the top bar */}
          <LanguageSelector currentLanguage={selectedLang} languages={LANGS} onSelect={setSelectedLang} />
        </div>
      </header>

      {/* ════════ BODY ════════ */}
      <div className="flex flex-1 overflow-hidden pt-14">


        {/* mobile drawer backdrop */}
        {mobileNavOpen && (
          <div onClick={() => setMobileNavOpen(false)}
            className="md:hidden fixed inset-0 z-[90]" style={{ background: 'rgba(0,0,0,0.6)' }} />
        )}

        {/* ════ SIDEBAR ════ */}
        <aside className={cn(
            'flex-shrink-0 flex flex-col border-r border-white/5',
            'fixed md:static top-14 md:top-0 bottom-0 left-0 z-[100] md:z-auto',
            'transition-transform duration-200 md:transition-none',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          )}
          style={{ background: 'var(--sidebar-bg)', width: sidebarCollapsed ? 60 : 256, overflowX: 'hidden', overflowY: 'auto' }}>

          {sidebarCollapsed ? (
            /* Collapsed: Gando logo that morphs into the "Open sidebar" toggle on hover (Gemini-style) */
            <div className="flex justify-center pt-4 pb-2">
              <button onClick={() => setSidebarCollapsed(false)}
                className="group relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 transition-all"
                title="Open sidebar">
                <span className="block group-hover:hidden"><GandoLogo size={28} /></span>
                <PanelLeft className="w-5 h-5 hidden group-hover:block" style={{ color: 'var(--text-primary)' }} />
              </button>
            </div>
          ) : (
            /* Expanded: search (left) + collapse slider (right edge) */
            <div className="flex items-center px-3 pt-4 pb-2 justify-between">
              <button onClick={() => { setSearchQuery(''); setSearchModalOpen(true); }}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-all"
                title="Search projects & chats">
                <Search className="w-4 h-4" />
              </button>
              <button onClick={() => setSidebarCollapsed(true)}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-all"
                title="Collapse sidebar">
                <PanelLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* new project (Claude-style, top) */}
          <div className="px-3 mb-3">
            <button onClick={() => { setCurrentProject(null); setInput(''); setPage('dashboard'); setImportMode('describe'); setMobileNavOpen(false); }}
              className={cn('w-full flex items-center rounded-xl font-black text-black transition-all hover:scale-[1.02] active:scale-95', sidebarCollapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-2.5', isAdlam && 'font-adlam')}
              style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--glow-primary-sm)', fontFamily: isAdlam ? undefined : MANROPE, fontSize: 13 }}
              title={t.newProject}>
              <Plus className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && <span>{t.newProject}</span>}
            </button>
          </div>

          {/* nav */}
          <nav className="px-3 space-y-0.5 flex-shrink-0">
            {([
              { icon: LayoutDashboard, label: t.dashboardNav,       pg: 'dashboard' as NavPage },
              { icon: FolderKanban,   label: t.myProjectsLabel,     pg: 'projects'  as NavPage },
              { icon: MessageSquare,  label: t.chatsLabel, pg: 'chats' as NavPage },
              { icon: Layers,         label: t.templatesNav,         pg: 'templates' as NavPage },
              { icon: Globe2,         label: t.languageAssetsLabel,  pg: 'assets'    as NavPage },
              { icon: Camera,         label: t.collectorLabel, pg: 'collector' as NavPage },
              ...(isAdmin ? [{ icon: Users, label: 'Corpus Admin', pg: 'admin' as NavPage }] : []),
            ]).map(({ icon: Icon, label, pg }) => {
              const active = page === pg && !currentProject;
              return (
                <button key={pg} onClick={() => { setPage(pg); setCurrentProject(null); setChatActive(false); setMobileNavOpen(false); }}
                  className={cn('w-full flex items-center rounded-xl transition-all', sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2', isAdlam && 'font-adlam')}
                  style={{ background: active ? 'rgba(255,255,255,0.07)' : 'transparent', color: active ? '#fff' : '#71717a', border: 'none', fontFamily: isAdlam ? undefined : MANROPE, fontWeight: 600, fontSize: 13 }}>
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? P : undefined }} />
                  {!sidebarCollapsed && <span>{label}</span>}
                </button>
              );
            })}
          </nav>

          {/* recents */}
          {!sidebarCollapsed && projects.length > 0 && (
            <div className="mt-5 px-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-3 mb-1.5" style={{ fontFamily: MANROPE }}>{t.recentsHeader}</p>
              <div className="space-y-0.5">
                {projects.slice(0, 5).map(p => (
                  <button key={p.id} onClick={() => { openProject(p); setMobileNavOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all hover:bg-white/5"
                    style={{ color: 'var(--text-muted)' }}>
                    <Sparkles className="w-3 h-3 flex-shrink-0 opacity-60" style={{ color: P }} />
                    <span className="text-xs font-medium truncate" style={{ fontFamily: 'Inter, sans-serif' }}>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* spacer */}
          <div className="flex-1" />

          {/* user (Claude-style, bottom) */}
          <div className="p-3 user-menu-container" style={{ position: 'relative' }}>
            <div className={cn('flex items-center rounded-xl cursor-pointer hover:bg-white/5 transition-all', sidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2.5')}
              onClick={() => setUserMenuOpen(o => !o)}>
              {user.photoURL
                ? <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-black flex-shrink-0"
                    style={{ background: `linear-gradient(135deg,${P},${S})` }}>
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
              }
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-bold text-white truncate', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
                      {user.displayName || user.email?.split('@')[0] || 'Builder'}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate" style={{ fontFamily: 'Inter, sans-serif' }}>{user.email}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" style={{ transform: 'rotate(-90deg)' }} />
                </>
              )}
            </div>
            {userMenuOpen && (
              <div style={{ position: 'absolute', bottom: '100%', left: 12, right: 12, marginBottom: 6, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{user.email}</div>
                <button onClick={e => { e.stopPropagation(); setSettingsOpen(true); setUserMenuOpen(false); }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}>
                  <Settings size={14} /> {t.settingsNav}
                </button>
                <button onClick={e => { e.stopPropagation(); setPage('status'); setCurrentProject(null); setUserMenuOpen(false); setMobileNavOpen(false); }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}>
                  <Activity size={14} /> {t.systemStatusLabel}
                </button>
                <button onClick={e => { e.stopPropagation(); setPage('docs'); setCurrentProject(null); setUserMenuOpen(false); setMobileNavOpen(false); }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}>
                  <BookOpen size={14} /> {t.documentationLabel}
                </button>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                <button onClick={e => { e.stopPropagation(); logout(); setUserMenuOpen(false); }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', fontSize: 13, color: '#f87171', fontFamily: 'Inter, sans-serif', cursor: 'pointer', border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}>
                  <LogOut size={14} /> {t.signOut}
                </button>
              </div>
            )}
          </div>

        </aside>

        {/* ════ MAIN ════ */}
        <main className="flex-1 min-w-0 overflow-hidden relative flex flex-col">
          {/* ambient glows */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
            <div className="absolute w-96 h-96 rounded-full top-0 -left-20" style={{ background: P, filter: 'blur(80px)', opacity: 0.08 }} />
            <div className="absolute w-[500px] h-[500px] rounded-full bottom-0 -right-40" style={{ background: S, filter: 'blur(80px)', opacity: 0.08 }} />
          </div>

          {/* ── WORKSPACE (project open) ── */}
          {currentProject ? (
            <div className="flex flex-1 overflow-hidden relative z-10">
              {/* workspace top bar */}
              <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-3 md:px-6 border-b border-white/5 z-20 gap-2"
                style={{ background: 'var(--navbar-bg)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-shrink">
                  <button onClick={() => setCurrentProject(null)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white transition-colors" title={t.recentProjects}>
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button onClick={() => setChatHidden(h => !h)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: chatHidden ? P : '#71717a' }}
                    title={chatHidden ? 'Show chat' : 'Hide chat'}>
                    <PanelLeft className="w-4 h-4" />
                  </button>
                  {isRenaming ? (
                    <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                      onBlur={handleRename} onKeyDown={e => e.key === 'Enter' && handleRename()}
                      className="gando-input bg-transparent border-b text-white text-sm font-bold outline-none w-48 px-1"
                      style={{ borderColor: `${P}60` }} />
                  ) : (
                    <span className={cn('text-sm font-black text-white cursor-pointer hover:text-[#3b82f6] transition-colors truncate max-w-[120px] md:max-w-none', isAdlam && 'font-adlam')}
                      style={{ fontFamily: isAdlam ? undefined : MANROPE }}
                      onClick={() => { setIsRenaming(true); setNewName(currentProject.name); }}>
                      {currentProject.name}
                    </span>
                  )}
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest flex-shrink-0"
                    style={{ background: `${P}15`, color: P, border: `1px solid ${P}25` }}>
                    {currentProject.language}
                  </span>
                </div>
                <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--btn-bg)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={() => setActiveTab('preview')}
                      className="flex items-center gap-2 px-2.5 md:px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={activeTab === 'preview' ? { background: 'rgba(59,130,246,0.14)', color: '#fff' } : { color: 'var(--text-muted)' }}>
                      <Eye className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.preview}</span>
                    </button>
                    <button onClick={() => setActiveTab('code')}
                      className="flex items-center gap-2 px-2.5 md:px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={activeTab === 'code' ? { background: 'rgba(59,130,246,0.14)', color: '#fff' } : { color: 'var(--text-muted)' }}>
                      <CodeIcon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.code}</span>
                    </button>
                  </div>
                  {currentProject.featured ? (
                    <span className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold', isAdlam && 'font-adlam')} style={{ background: '#22c55e1a', color: '#4ade80' }}>
                      <Heart className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.shareLiveLabel}</span>
                    </span>
                  ) : currentProject.shareStatus === 'pending' ? (
                    <span className={cn('hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold', isAdlam && 'font-adlam')} style={{ background: '#eab3081a', color: '#fbbf24' }}>
                      {t.sharePendingLabel}
                    </span>
                  ) : (
                    <button onClick={() => shareProject(currentProject)} disabled={sharingId === currentProject.id}
                      className={cn('flex items-center gap-2 px-2.5 md:px-3 py-2 rounded-xl text-xs font-bold border transition-all', isAdlam && 'font-adlam')}
                      style={{ color: T, borderColor: `${T}33`, background: `${T}0c` }}>
                      <Share2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{sharingId === currentProject.id ? '…' : t.shareLabel}</span>
                    </button>
                  )}
                  <button onClick={handleDownload}
                    className="flex items-center gap-2 px-2.5 md:px-3 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
                    style={{ background: 'var(--btn-bg)' }}>
                    <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.download}</span>
                  </button>
                </div>
              </div>

              {/* chat + preview */}
              <div className="flex flex-1 pt-14 overflow-hidden relative">
                {isMobile ? (
                  <>
                    {/* MOBILE: preview fills screen; chat is a bottom sheet toggled by chatHidden */}
                    <div className="flex-1 overflow-hidden w-full">
                      {activeTab === 'preview'
                        ? <Preview code={previewCode ?? currentProject.code} />
                        : <CodeEditor code={streamingCode ?? currentProject.code} onChange={handleCodeChange} t={t} languageCode={selectedLang.code} />}
                    </div>
                    {/* dim backdrop when chat open */}
                    {!chatHidden && (
                      <div onClick={() => setChatHidden(true)}
                        className="fixed inset-0 z-[140]" style={{ background: 'rgba(0,0,0,0.5)' }} />
                    )}
                    <motion.div
                      className="fixed left-0 right-0 bottom-0 z-[150] flex flex-col"
                      initial={false}
                      animate={{ y: chatHidden ? '100%' : '0%' }}
                      transition={{ type: 'spring', damping: 32, stiffness: 240 }}
                      style={{ height: '78vh', background: 'var(--app-bg)', borderTop: '1px solid var(--border)', borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' }}>
                      <div className="flex items-center justify-center py-2 flex-shrink-0" onClick={() => setChatHidden(true)}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
                      </div>
                      <div className="flex flex-col flex-1 min-h-0">
                        <Chat messages={mode === 'chat' ? chatMessages : messages} input={input} setInput={setInput} onSend={handleSend}
                          isGenerating={isGenerating} generationStatus={generationStatus} generationSteps={mode === 'chat' ? [] : generationSteps}
                          selectedLanguage={selectedLang.name} currentLanguage={selectedLang}
                          languages={LANGS} onLanguageSelect={setSelectedLang}
                          languageCode={selectedLang.code} t={t}
                          provider={provider} onProviderChange={setProvider}
                          byokModels={byokModelOptions} onManageKeys={() => setByokModalOpen(true)}
                          userPhoto={user.photoURL} userName={user.displayName || user.email}
                          mode={mode} onModeChange={setMode}
                          currentCode={currentProject?.code} onRevert={handleRevert}
                          onStop={handleStop} />
                      </div>
                    </motion.div>
                  </>
                ) : (
                  <>
                    {/* DESKTOP: chat panel — collapsible side-by-side */}
                    <motion.div className="flex-shrink-0 flex flex-col"
                      animate={{ width: chatHidden ? 0 : 480, opacity: chatHidden ? 0 : 1, marginRight: chatHidden ? 0 : 12 }}
                      transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                      style={{ background: 'var(--app-bg)', border: chatHidden ? 'none' : '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
                      <div className="flex flex-col h-full" style={{ width: 480, minWidth: 480 }}>
                        <Chat messages={mode === 'chat' ? chatMessages : messages} input={input} setInput={setInput} onSend={handleSend}
                          isGenerating={isGenerating} generationStatus={generationStatus} generationSteps={mode === 'chat' ? [] : generationSteps}
                          selectedLanguage={selectedLang.name} currentLanguage={selectedLang}
                          languages={LANGS} onLanguageSelect={setSelectedLang}
                          languageCode={selectedLang.code} t={t}
                          provider={provider} onProviderChange={setProvider}
                          byokModels={byokModelOptions} onManageKeys={() => setByokModalOpen(true)}
                          userPhoto={user.photoURL} userName={user.displayName || user.email}
                          mode={mode} onModeChange={setMode}
                          currentCode={currentProject?.code} onRevert={handleRevert}
                          onStop={handleStop} />
                      </div>
                    </motion.div>
                    <AnimatePresence mode="wait">
                      <motion.div key="panel" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                        transition={{ type: 'spring', damping: 30, stiffness: 200 }} className="flex-1 overflow-hidden">
                        {activeTab === 'preview'
                          ? <Preview code={previewCode ?? currentProject.code} />
                          : <CodeEditor code={streamingCode ?? currentProject.code} onChange={handleCodeChange} t={t} languageCode={selectedLang.code} />}
                      </motion.div>
                    </AnimatePresence>
                  </>
                )}
              </div>
            </div>

          ) : chatActive ? (
            /* ══ CHAT SESSION (chat mode, no project) ══ */
            <div className="flex flex-1 flex-col overflow-hidden relative z-10">
              <div className="h-14 flex items-center gap-3 px-4 md:px-6 border-b border-white/5 flex-shrink-0">
                <button onClick={() => { setChatActive(false); setChatMessages([]); setCurrentChatId(null); setPage('chats'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
                  style={{ fontFamily: MANROPE }}>
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <span style={{ fontFamily: MANROPE, fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>Chat with Gando</span>
              </div>
              <div className="flex flex-col flex-1 min-h-0">
                <Chat messages={chatMessages} input={input} setInput={setInput} onSend={handleSend}
                  isGenerating={isGenerating} generationStatus={generationStatus} generationSteps={[]}
                  selectedLanguage={selectedLang.name} currentLanguage={selectedLang}
                  languages={LANGS} onLanguageSelect={setSelectedLang}
                  languageCode={selectedLang.code} t={t}
                  provider={provider} onProviderChange={setProvider}
                  byokModels={byokModelOptions} onManageKeys={() => setByokModalOpen(true)}
                          userPhoto={user.photoURL} userName={user.displayName || user.email}
                  mode={mode} onModeChange={setMode} onStop={handleStop} />
              </div>
            </div>

          ) : page === 'chats' ? (
            /* ══ CHATS PAGE ══ */
            <div className="flex-1 overflow-y-auto relative z-10 p-8 md:p-10 space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className={cn('text-4xl font-black text-white tracking-tighter', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
                    {t.chatsLabel}
                  </h1>
                  <p className={cn('text-zinc-500 mt-1', isAdlam && 'font-adlam')}>
                    {selectedLang.code === 'fr' ? 'Vos conversations avec Gando' : 'Your conversations with Gando'}
                  </p>
                </div>
                <button onClick={startNewChat}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-black transition-all hover:scale-[1.02] active:scale-95"
                  style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--glow-primary-sm)', fontFamily: MANROPE, fontSize: 13 }}>
                  <Plus className="w-4 h-4" /> {selectedLang.code === 'fr' ? 'Nouvelle discussion' : 'New chat'}
                </button>
              </div>

              {chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${P}15` }}>
                    <MessageSquare className="w-8 h-8" style={{ color: P }} />
                  </div>
                  <p className="text-zinc-500 text-center">
                    {selectedLang.code === 'fr' ? 'Aucune discussion pour le moment.' : 'No chats yet.'}<br />
                    {selectedLang.code === 'fr' ? 'Démarrez-en une pour la retrouver ici.' : 'Start one and it will show up here.'}
                  </p>
                  <button onClick={startNewChat}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-black transition-all hover:scale-[1.02]"
                    style={{ background: 'var(--gradient-brand)', fontFamily: MANROPE, fontSize: 13 }}>
                    <Plus className="w-4 h-4" /> {selectedLang.code === 'fr' ? 'Nouvelle discussion' : 'New chat'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {chats.map(c => (
                    <div key={c.id} onClick={() => openChat(c)}
                      className="group relative p-5 rounded-2xl border border-white/10 cursor-pointer transition-all hover:border-white/20 hover:scale-[1.01]"
                      style={{ background: 'var(--card-bg)' }}>
                      <button onClick={async e => { e.stopPropagation(); try { await deleteDoc(doc(db, 'chats', c.id)); if (currentChatId === c.id) { setCurrentChatId(null); setChatMessages([]); } } catch (err) { console.error(err); } }}
                        className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        title={selectedLang.code === 'fr' ? 'Supprimer' : 'Delete'}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${P}15` }}>
                        <MessageSquare className="w-4 h-4" style={{ color: P }} />
                      </div>
                      <p className="text-sm font-bold text-white truncate group-hover:text-[#3b82f6] transition-colors pr-6" style={{ fontFamily: MANROPE }}>{c.title || 'Untitled chat'}</p>
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{c.messages?.[c.messages.length - 1]?.content?.slice(0, 90) || '—'}</p>
                      <p className="text-[10px] text-zinc-600 mt-3 uppercase tracking-widest" style={{ fontFamily: MANROPE }}>{c.messages?.length || 0} {selectedLang.code === 'fr' ? 'messages' : 'messages'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          ) : page === 'projects' ? (
            /* ══ PROJECTS PAGE ══ */
            <div className="flex-1 overflow-y-auto relative z-10 p-8 md:p-10 space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 dir={isAdlam ? 'rtl' : undefined} className={cn('text-4xl font-black text-white tracking-tighter', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
                    {t.projectsPageTitle}
                  </h1>
                  <p dir={isAdlam ? 'rtl' : undefined} className={cn('text-zinc-500 mt-1', isAdlam && 'font-adlam')}>{t.projectsPageSubtitle}</p>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10" style={{ background: 'var(--card-bg)', minWidth: 260 }}>
                  <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <input value={projectSearch} onChange={e => setProjectSearch(e.target.value)}
                    placeholder={t.searchProjectsPlaceholder}
                    className={cn('gando-input bg-transparent border-none outline-none text-sm text-white placeholder-zinc-600 flex-1', isAdlam && 'font-adlam')} />
                  {projectSearch && <button onClick={() => setProjectSearch('')}><X className="w-3.5 h-3.5 text-zinc-500 hover:text-white" /></button>}
                </div>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--btn-bg)', border: '1px solid var(--border)', width: 'fit-content' }}>
                {(['all', 'live', 'building', 'draft'] as const).map(f => {
                  const active = projectFilter === f;
                  return (
                  <button
                    key={f}
                    onClick={() => setProjectFilter(f)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontFamily: MANROPE,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      transition: 'all 150ms',
                      background: active ? 'var(--card-bg)' : 'transparent',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.18)' : 'none',
                      fontWeight: active ? 700 : 600,
                    }}
                  >
                    {f}
                  </button>
                  );
                })}
              </div>

              {filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${P}15` }}>
                    <Sparkles className="w-8 h-8" style={{ color: P }} />
                  </div>
                  <p className={cn('text-white font-black text-lg', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
                    {projectSearch ? 'No projects match your search' : t.noProjectsTitle}
                  </p>
                  <p className="text-zinc-500 text-sm text-center max-w-xs">
                    {projectSearch ? 'Try a different search term.' : 'Describe an app in any language and Gando will build it for you.'}
                  </p>
                  {!projectSearch && (
                    <button onClick={() => { setPage('dashboard'); setCurrentProject(null); }}
                      className={cn('flex items-center gap-2 px-6 py-3 rounded-xl font-black text-black text-sm', isAdlam && 'font-adlam')}
                      style={{ background: 'var(--gradient-brand)', fontFamily: isAdlam ? undefined : MANROPE }}>
                      <Sparkles className="w-4 h-4" /> {t.noProjectsTitle} →
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredProjects.map(p => (
                    <motion.div key={p.id} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      className="group relative rounded-2xl border border-white/8 overflow-hidden transition-all hover:border-white/15"
                      style={{ background: 'var(--card-bg)' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${P}18`, color: P }}>
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div className="flex items-center gap-2">
                            {p.featured ? (
                              <span className={cn('flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest', isAdlam && 'font-adlam')} style={{ background: '#22c55e1a', color: '#4ade80' }}>
                                <Heart className="w-2.5 h-2.5" /> {t.shareLiveLabel}
                              </span>
                            ) : p.shareStatus === 'pending' ? (
                              <span className={cn('px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest', isAdlam && 'font-adlam')} style={{ background: '#eab3081a', color: '#fbbf24' }}>
                                {t.sharePendingLabel}
                              </span>
                            ) : null}
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!p.featured && p.shareStatus !== 'pending' && (
                                <button onClick={() => shareProject(p)} disabled={sharingId === p.id}
                                  className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all', isAdlam && 'font-adlam')}
                                  style={{ color: T, borderColor: `${T}33` }}>
                                  <Share2 className="w-3 h-3" /> {sharingId === p.id ? '…' : t.shareLabel}
                                </button>
                              )}
                              <button onClick={() => deleteProject(p.id)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all">
                                <Trash2 className="w-3 h-3" /> {t.deleteProjectLabel}
                              </button>
                            </div>
                          </div>
                        </div>
                        <h3 className={cn('font-black text-white text-base mb-1 truncate', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
                          {p.name}
                        </h3>
                        <p className={cn('text-zinc-500 text-xs mb-5 line-clamp-2', isAdlam && 'font-adlam')}>{p.description}</p>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full" style={{ background: `${T}15`, color: T }}>
                            {p.language}
                          </span>
                          <button onClick={() => openProject(p)}
                            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-black transition-all hover:scale-105', isAdlam && 'font-adlam')}
                            style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--glow-primary-sm)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--glow-primary-lg)'}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--glow-primary-sm)'}>
                            {t.openProjectLabel} <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

          ) : page === 'templates' ? (
            /* ══ TEMPLATES PAGE ══ */
            (() => {
              const tl = TEMPLATE_I18N[selectedLang.code] || TEMPLATE_I18N.en;

              /* ── COMMUNITY SPLIT VIEW ── */
              if (selectedCommunity) {
                const cc = selectedCommunity;
                return (
                  <div className={cn('flex-1 flex overflow-hidden', isMobile ? 'flex-col overflow-y-auto' : '')} style={{ height: '100%' }}>
                    {/* LEFT (mobile: TOP): live preview of the shared app */}
                    <div className={cn('flex flex-col overflow-hidden border-white/8', isMobile ? 'border-b' : 'flex-1 border-r')}
                      style={isMobile ? { height: '68vh', flexShrink: 0 } : undefined}>
                      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'var(--app-bg)' }}>
                        <button onClick={() => setSelectedCommunity(null)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'Inter, sans-serif', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
                          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#fff'}
                          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#adaaaa'}>
                          <ChevronRight className="w-3 h-3 rotate-180" /> {t.templatesNav}
                        </button>
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>/</span>
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{cc.name}</span>
                      </div>
                      <div className="flex-1 relative" style={{ background: 'var(--app-bg)' }}>
                        <iframe srcDoc={cc.code} title={cc.name} className="w-full h-full border-none" sandbox="allow-scripts allow-same-origin" />
                      </div>
                    </div>
                    {/* RIGHT (mobile: BELOW): info + actions */}
                    <div className={cn(!isMobile && 'overflow-y-auto')} style={isMobile ? { width: '100%', flexShrink: 0, background: 'var(--app-bg)', padding: 20 } : { width: 340, flexShrink: 0, background: 'var(--app-bg)', padding: 28 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ cursor: 'pointer' }} onClick={() => setSelectedCommunity(null)}>{t.templatesNav}</span>
                        <ChevronRight className="w-3 h-3" />
                        <span style={{ color: 'var(--text-muted)' }}>{cc.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ padding: '3px 10px', borderRadius: 9999, background: `${T}18`, color: T, fontSize: 10, fontWeight: 700, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cc.language}</span>
                        <span className={cn(isAdlam && 'font-adlam')} style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{t.communityTitle}</span>
                      </div>
                      <h2 className={cn('font-black text-white tracking-tighter mb-3', isAdlam && 'font-adlam')}
                        style={{ fontFamily: isAdlam ? undefined : MANROPE, fontSize: 26, lineHeight: 1.15 }}>{cc.name}</h2>
                      <p style={{ fontSize: 14, color: '#a1a1aa', fontFamily: 'Inter, sans-serif', lineHeight: 1.6, marginBottom: 24, overflowWrap: 'anywhere' }}>{cleanPrompt(cc.description) || cc.name}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                        <button onClick={() => remixCommunity(cc)}
                          className={cn(isAdlam && 'font-adlam')}
                          style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'var(--gradient-brand)', border: 'none', color: '#0a0a0a', fontSize: 13, fontWeight: 900, fontFamily: isAdlam ? undefined : MANROPE, cursor: 'pointer', letterSpacing: '0.02em' }}>
                          {tl.useTemplate}
                        </button>
                        <button onClick={() => openFullPreview(cc.code)}
                          style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                          Open full preview ↗
                        </button>
                      </div>
                      {cleanPrompt(cc.description) && (
                        <>
                          {/* original prompt (the language it was built in) */}
                          <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Original prompt</p>
                            <p style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'Inter, sans-serif', lineHeight: 1.6, overflowWrap: 'anywhere' }}>{cleanPrompt(cc.description)}</p>
                          </div>
                          {/* translation into the selected language */}
                          {selectedLang.code !== 'en' && (
                            <div style={{ padding: '14px 16px', borderRadius: 12, background: `${T}0c`, border: `1px solid ${T}33`, marginBottom: 24 }}>
                              <p className={cn(isAdlam && 'font-adlam')} style={{ fontSize: 10, fontWeight: 700, color: T, fontFamily: isAdlam ? undefined : 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{selectedLang.name}</p>
                              {promptTr.loading ? (
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontStyle: 'italic' }}>…</p>
                              ) : (
                                <p className={cn(isAdlam && 'font-adlam')} style={{ fontSize: 12, color: '#d4d4d8', fontFamily: isAdlam ? undefined : 'Inter, sans-serif', lineHeight: 1.7, overflowWrap: 'anywhere' }}>{promptTr.text || cleanPrompt(cc.description)}</p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              }

              /* ── SPLIT VIEW ── */
              if (selectedTemplate) {
                const tr = tl.templates[selectedTemplate.id] || TEMPLATE_I18N.en.templates[selectedTemplate.id];
                return (
                  <div className={cn('flex-1 flex overflow-hidden', isMobile ? 'flex-col overflow-y-auto' : '')} style={{ height: '100%' }}>
                    {/* LEFT (mobile: TOP): iframe preview */}
                    <div className={cn('flex flex-col overflow-hidden border-white/8', isMobile ? 'border-b' : 'flex-1 border-r')}
                      style={isMobile ? { height: '68vh', flexShrink: 0 } : undefined}>
                      {/* top bar */}
                      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'var(--app-bg)' }}>
                        <button
                          onClick={() => setSelectedTemplate(null)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'Inter, sans-serif', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
                          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#fff'}
                          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#adaaaa'}
                        >
                          <ChevronRight className="w-3 h-3 rotate-180" /> {t.templatesNav}
                        </button>
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>/</span>
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{tr.name}</span>
                      </div>
                      {/* iframe */}
                      <div className="flex-1 relative" style={{ background: selectedTemplate.color }}>
                        {selectedTemplate.previewUrl ? (
                          <iframe
                            src={selectedTemplate.previewUrl}
                            title={tr.name}
                            className="w-full h-full border-none"
                            sandbox="allow-scripts allow-same-origin"
                            onLoad={(e) => injectTemplateI18n(e.currentTarget)}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                            <Layers className="w-12 h-12 opacity-20" style={{ color: '#fff' }} />
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>Preview coming soon</span>
                          </div>
                        )}
                      </div>
                      {/* thumbnail strip */}
                      <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, background: 'var(--app-bg)', flexShrink: 0 }}>
                        {TEMPLATES_META.filter(t => t.id !== selectedTemplate.id).slice(0, 4).map(t => {
                          const tt = tl.templates[t.id] || TEMPLATE_I18N.en.templates[t.id];
                          return (
                            <button key={t.id} onClick={() => setSelectedTemplate(t)}
                              style={{ width: 72, height: 44, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer', background: t.color, flexShrink: 0, position: 'relative' }}
                              title={tt.name}>
                              {t.previewUrl && (
                                <iframe src={t.previewUrl} title={tt.name} className="border-none pointer-events-none"
                                  style={{ transform: 'scale(0.25)', transformOrigin: 'top left', width: '400%', height: '400%' }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* RIGHT (mobile: BELOW): info panel */}
                    <div className={cn(!isMobile && 'overflow-y-auto')} style={isMobile ? { width: '100%', flexShrink: 0, background: 'var(--app-bg)', padding: 20 } : { width: 340, flexShrink: 0, background: 'var(--app-bg)', padding: 28 }}>
                      {/* breadcrumb */}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ cursor: 'pointer' }} onClick={() => setSelectedTemplate(null)}>{t.templatesNav}</span>
                        <ChevronRight className="w-3 h-3" />
                        <span style={{ color: 'var(--text-muted)' }}>{tr.name}</span>
                      </div>

                      {/* category + city */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ padding: '3px 10px', borderRadius: 9999, background: `${P}18`, color: P, fontSize: 10, fontWeight: 700, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{selectedTemplate.category}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{selectedTemplate.city}</span>
                      </div>

                      {/* name */}
                      <h2 className={cn('font-black text-white tracking-tighter mb-3', isAdlam && 'font-adlam')}
                        style={{ fontFamily: isAdlam ? undefined : MANROPE, fontSize: 26, lineHeight: 1.15 }}>{tr.name}</h2>

                      {/* description */}
                      <p style={{ fontSize: 14, color: '#a1a1aa', fontFamily: 'Inter, sans-serif', lineHeight: 1.6, marginBottom: 24 }}>{tr.description}</p>

                      {/* CTA buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                        <button
                          onClick={() => { setInput(tr.starterPrompt); setPage('dashboard'); setCurrentProject(null); setSelectedTemplate(null); }}
                          style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'var(--gradient-brand)', border: 'none', color: '#0a0a0a', fontSize: 13, fontWeight: 900, fontFamily: MANROPE, cursor: 'pointer', letterSpacing: '0.02em' }}>
                          {tl.useTemplate}
                        </button>
                        {selectedTemplate.previewUrl && (
                          <button
                            onClick={() => window.open(selectedTemplate.previewUrl!, '_blank')}
                            style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                            Open full preview ↗
                          </button>
                        )}
                      </div>

                      {/* starter prompt preview */}
                      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 24 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Starter prompt</p>
                        <p style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>{tr.starterPrompt}</p>
                      </div>

                      {/* credit */}
                      <p style={{ fontSize: 10, color: '#52525b', fontFamily: 'Inter, sans-serif' }}>{tl.credit}</p>
                    </div>
                  </div>
                );
              }

              /* ── GRID VIEW ── */
              return (
                <div className="flex-1 overflow-y-auto relative z-10 p-8 md:p-10">
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <h1 className={cn('text-4xl font-black text-white tracking-tighter', isAdlam && 'font-adlam')}
                        style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{tl.pageTitle}</h1>
                      <p className="text-zinc-500 mt-1" style={{ fontFamily: 'Inter, sans-serif', fontSize: 14 }}>{tl.pageSubtitle}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                    {TEMPLATES_META.map(tmpl => {
                      const tr = tl.templates[tmpl.id] || TEMPLATE_I18N.en.templates[tmpl.id];
                      return (
                        <motion.div key={tmpl.id}
                          whileHover={{ y: -4 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                          onClick={() => setSelectedTemplate(tmpl)}
                          className="group relative rounded-2xl overflow-hidden cursor-pointer border border-white/8 hover:border-white/20 transition-all"
                          style={{ background: 'var(--card-bg)' }}>
                          {/* preview thumbnail */}
                          <div className="relative overflow-hidden" style={{ height: 180, background: tmpl.color }}>
                            {tmpl.previewUrl ? (
                              <iframe src={tmpl.previewUrl} title={tr.name} className="border-none pointer-events-none"
                                style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Layers className="w-10 h-10 opacity-20" style={{ color: '#fff' }} />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '7px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Preview →</span>
                            </div>
                          </div>
                          {/* info */}
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span style={{ padding: '2px 8px', borderRadius: 9999, background: `${P}18`, color: P, fontSize: 9, fontWeight: 700, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tmpl.category}</span>
                              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{tmpl.city}</span>
                            </div>
                            <h3 className={cn('font-black text-white text-sm mb-1', isAdlam && 'font-adlam')}
                              style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{tr.name}</h3>
                            <p className="text-zinc-500 text-xs line-clamp-2" style={{ fontFamily: 'Inter, sans-serif' }}>{tr.description}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {communityTemplates.length > 0 && (
                    <div className="mb-8">
                      <div className="flex items-center gap-2 mb-4">
                        <Heart className="w-4 h-4" style={{ color: P }} />
                        <h2 className={cn('text-lg font-black text-white tracking-tight', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
                          {t.communityTitle}
                        </h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                        {communityTemplates.map(ct => (
                          <motion.div key={ct.id}
                            whileHover={{ y: -4 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            onClick={() => setSelectedCommunity(ct)}
                            className="group relative rounded-2xl overflow-hidden cursor-pointer border border-white/8 hover:border-white/20 transition-all"
                            style={{ background: 'var(--card-bg)' }}>
                            <div className="relative overflow-hidden" style={{ height: 180, background: 'var(--app-bg)' }}>
                              <iframe srcDoc={ct.code} title={ct.name} className="border-none pointer-events-none"
                                style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }} />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '7px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{tl.preview}</span>
                              </div>
                            </div>
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span style={{ padding: '2px 8px', borderRadius: 9999, background: `${T}18`, color: T, fontSize: 9, fontWeight: 700, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{ct.language}</span>
                                <span className={cn(isAdlam && 'font-adlam')} style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{t.communityTitle}</span>
                              </div>
                              <h3 className={cn('font-black text-white text-sm mb-1 truncate', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{ct.name}</h3>
                              <p className="text-zinc-500 text-xs line-clamp-2" style={{ fontFamily: 'Inter, sans-serif' }}>{ct.description}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginTop: 32 }}>{tl.credit}</p>
                </div>
              );
            })()

          ) : page === 'assets' ? (
            /* ══ LANGUAGES PAGE ══ */
            <div className="flex-1 overflow-y-auto relative z-10 p-8 md:p-10 space-y-10">

              {/* header */}
              <div>
                <h1 className={cn('text-4xl font-black text-white tracking-tighter mb-2', isAdlam && 'font-adlam')}
                  style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{t.languageAssetsLabel}</h1>
                <p className={cn('text-zinc-500', isAdlam && 'font-adlam')} style={{ fontSize: 14, fontFamily: 'Inter, sans-serif' }}>
                  Supported languages in Gando AI — switch your active language below.
                </p>
              </div>

              {/* ── ACTIVE LANGUAGES ── */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-4" style={{ fontFamily: MANROPE }}>AVAILABLE NOW</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {LANGS.map(lang => {
                    const active = selectedLang.code === lang.code;
                    const meta: Record<string, { script: string; region: string; speakers: string; sample: string; sampleLabel: string }> = {
                      'ff-adlm': { script: 'ADLaM Script', region: 'West Africa (Guinea, Senegal, Mali, Nigeria)', speakers: '40M+', sample: '𞤃𞤢𞤸𞤵 𞤢𞤨𞥆 𞤥𞤢𞥄𞤯𞤢', sampleLabel: '"Build your app"' },
                      'fr':      { script: 'Latin Script',  region: 'Francophone Africa + Europe',                speakers: '300M+', sample: 'Créez votre app', sampleLabel: '"Build your app"' },
                      'en':      { script: 'Latin Script',  region: 'Global',                                      speakers: '1.5B+', sample: 'Build your app',  sampleLabel: '"Build your app"' },
                    };
                    const m = meta[lang.code];
                    return (
                      <div key={lang.code}
                        className="relative rounded-2xl border transition-all overflow-hidden"
                        style={{ background: active ? `${P}0c` : 'var(--card-bg)', border: `1px solid ${active ? `${P}40` : 'var(--border)'}`, boxShadow: active ? `var(--glow-primary-sm)` : 'none' }}>
                        {active && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />}
                        <div className="p-5">
                          {/* language name + active badge */}
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className={cn('font-black text-sm mb-0.5', lang.code === 'ff-adlm' && 'font-adlam')}
                                style={{ color: 'var(--text-primary)', fontFamily: lang.code === 'ff-adlm' ? undefined : MANROPE }}>{lang.name}</p>
                              <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{m.script}</p>
                            </div>
                            {active && (
                              <span style={{ padding: '2px 10px', borderRadius: 9999, background: `${P}20`, color: P, fontSize: 10, fontWeight: 800, fontFamily: MANROPE, textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>Active</span>
                            )}
                          </div>

                          {/* sample text */}
                          <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)' }}>
                            <p className={cn('font-bold mb-0.5', lang.code === 'ff-adlm' && 'font-adlam')}
                              style={{ fontSize: lang.code === 'ff-adlm' ? 15 : 14, color: 'var(--text-primary)', fontFamily: lang.code === 'ff-adlm' ? undefined : MANROPE }}>{m.sample}</p>
                            <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{m.sampleLabel}</p>
                          </div>

                          {/* stats row */}
                          <div className="flex gap-4 mb-4">
                            <div>
                              <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Speakers</p>
                              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: MANROPE }}>{m.speakers}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Region</p>
                              <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}>{m.region}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedLang(lang)}
                            disabled={active}
                            className="w-full py-2.5 rounded-xl font-black text-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-default"
                            style={{ background: active ? 'var(--btn-bg)' : 'var(--gradient-brand)', color: active ? 'var(--text-primary)' : '#000', fontFamily: MANROPE, boxShadow: active ? 'none' : 'var(--glow-primary-sm)' }}>
                            {active ? 'Currently Active' : `Switch to ${lang.code === 'ff-adlm' ? 'ADLaM' : lang.name}`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── COMING SOON ── */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-4" style={{ fontFamily: MANROPE }}>COMING SOON</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { name: 'Wolof',    region: 'Senegal',    flag: '🇸🇳' },
                    { name: 'Yoruba',   region: 'Nigeria',    flag: '🇳🇬' },
                    { name: 'Hausa',    region: 'West Africa', flag: '🌍' },
                    { name: 'Bambara',  region: 'Mali',        flag: '🇲🇱' },
                    { name: 'Swahili',  region: 'East Africa', flag: '🌍' },
                    { name: 'Igbo',     region: 'Nigeria',     flag: '🇳🇬' },
                  ].map(({ name, region, flag }) => (
                    <div key={name} className="rounded-xl p-4 text-center border border-white/5 opacity-50"
                      style={{ background: 'var(--card-bg)' }}>
                      <p style={{ fontSize: 22, marginBottom: 6 }}>{flag}</p>
                      <p style={{ fontFamily: MANROPE, fontWeight: 900, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{name}</p>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#52525b' }}>{region}</p>
                      <span style={{ marginTop: 8, display: 'inline-block', padding: '2px 8px', borderRadius: 9999, background: 'var(--btn-bg)', border: '1px solid var(--border)', fontSize: 9, fontWeight: 700, color: '#52525b', fontFamily: MANROPE, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Soon</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── ADLAM SCRIPT REFERENCE ── */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-4" style={{ fontFamily: MANROPE }}>ADLAM SCRIPT REFERENCE</p>
                <div className="rounded-2xl border border-white/8 overflow-hidden relative" style={{ background: 'var(--card-bg)' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                  <div className="p-6 space-y-6">

                    {/* header */}
                    <div className="flex items-start gap-4">
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${P}18`, border: `1px solid ${P}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="font-adlam text-2xl" style={{ color: P }}>𞤀</span>
                      </div>
                      <div>
                        <h3 className="font-black text-white mb-1" style={{ fontFamily: MANROPE }}>ADLaM Alphabet — Complete Reference</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                          Unicode U+1E900–U+1E95F · RTL script by Ibrahima & Abdoulaye Barry · 28 core letters + 6 loan · 40M+ Fulani speakers
                        </p>
                      </div>
                    </div>

                    {/* column legend */}
                    <div className="grid grid-cols-5 gap-1 px-1" style={{ fontSize: 9, fontWeight: 700, color: '#3f3f46', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      <span>Capital</span><span>Small</span><span>Latin</span><span>Name</span><span>IPA</span>
                    </div>

                    {/* VOWELS */}
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#52525b', fontFamily: MANROPE, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                        VOWELS <span style={{ color: '#3f3f46', fontWeight: 500 }}>(5)</span>
                      </p>
                      <div className="space-y-1.5">
                        {[
                          { cap: '𞤀', sml: '𞤢', latin: 'a',  name: 'Alif',  ipa: '/a/'  },
                          { cap: '𞤉', sml: '𞤫', latin: 'e',  name: 'E',     ipa: '/e/'  },
                          { cap: '𞤋', sml: '𞤭', latin: 'i',  name: 'I',     ipa: '/i/'  },
                          { cap: '𞤌', sml: '𞤮', latin: 'o',  name: 'O',     ipa: '/ɔ/'  },
                          { cap: '𞤓', sml: '𞤵', latin: 'u',  name: 'U',     ipa: '/u/'  },
                        ].map(({ cap, sml, latin, name, ipa }) => (
                          <div key={name} className="grid grid-cols-5 gap-1 items-center px-3 py-2 rounded-xl hover:bg-white/4 transition-all" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--btn-bg)' }}>
                            <span className="font-adlam text-xl text-white" style={{ lineHeight: 1 }}>{cap}</span>
                            <span className="font-adlam text-lg" style={{ color: 'var(--text-muted)', lineHeight: 1 }}>{sml}</span>
                            <span style={{ fontFamily: MANROPE, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{latin}</span>
                            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>{name}</span>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: P }}>{ipa}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CONSONANTS */}
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#52525b', fontFamily: MANROPE, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                        CORE CONSONANTS <span style={{ color: '#3f3f46', fontWeight: 500 }}>(23)</span>
                      </p>
                      <div className="space-y-1.5">
                        {[
                          { cap: '𞤁', sml: '𞤣', latin: 'd',      name: 'Daali',      ipa: '/d/'   },
                          { cap: '𞤂', sml: '𞤤', latin: 'l',      name: 'Laam',       ipa: '/l/'   },
                          { cap: '𞤃', sml: '𞤥', latin: 'm',      name: 'Miim',       ipa: '/m/'   },
                          { cap: '𞤄', sml: '𞤦', latin: 'b',      name: 'Baa',        ipa: '/b/'   },
                          { cap: '𞤅', sml: '𞤧', latin: 's',      name: 'Sinnyiiyhe', ipa: '/s/'   },
                          { cap: '𞤆', sml: '𞤨', latin: 'p',      name: 'Puu',        ipa: '/p/'   },
                          { cap: '𞤇', sml: '𞤩', latin: 'ɓ / bh', name: 'Bhee',       ipa: '/ɓ/'   },
                          { cap: '𞤈', sml: '𞤪', latin: 'r',      name: 'Raa',        ipa: '/r/ɾ/' },
                          { cap: '𞤊', sml: '𞤬', latin: 'f',      name: 'Faa',        ipa: '/f/'   },
                          { cap: '𞤍', sml: '𞤯', latin: 'ɗ / dh', name: 'Dha',        ipa: '/ɗ/'   },
                          { cap: '𞤎', sml: '𞤰', latin: 'ƴ / yh', name: 'Yhe',        ipa: '/ʔʲ/'  },
                          { cap: '𞤏', sml: '𞤱', latin: 'w',      name: 'Waw',        ipa: '/w/'   },
                          { cap: '𞤐', sml: '𞤲', latin: 'n',      name: 'Nun',        ipa: '/n/'   },
                          { cap: '𞤑', sml: '𞤳', latin: 'k',      name: 'Kaf',        ipa: '/k/'   },
                          { cap: '𞤒', sml: '𞤴', latin: 'y',      name: 'Yaa',        ipa: '/j/'   },
                          { cap: '𞤔', sml: '𞤶', latin: 'j',      name: 'Jiim',       ipa: '/dʒ/'  },
                          { cap: '𞤕', sml: '𞤷', latin: 'c',      name: 'Chi',        ipa: '/tʃ/'  },
                          { cap: '𞤖', sml: '𞤸', latin: 'h',      name: 'Haa',        ipa: '/h/'   },
                          { cap: '𞤗', sml: '𞤹', latin: 'ɠ / q',  name: 'Qaaf',       ipa: '/q/'   },
                          { cap: '𞤘', sml: '𞤺', latin: 'g',      name: 'Gaa',        ipa: '/ɡ/'   },
                          { cap: '𞤙', sml: '𞤻', latin: 'ñ / ny', name: 'Nya',        ipa: '/ɲ/'   },
                          { cap: '𞤚', sml: '𞤼', latin: 't',      name: 'Tuu',        ipa: '/t/'   },
                          { cap: '𞤛', sml: '𞤽', latin: 'ŋ / nh', name: 'Nha',        ipa: '/ŋ/'   },
                        ].map(({ cap, sml, latin, name, ipa }) => (
                          <div key={name} className="grid grid-cols-5 gap-1 items-center px-3 py-2 rounded-xl hover:bg-white/4 transition-all" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--btn-bg)' }}>
                            <span className="font-adlam text-xl text-white" style={{ lineHeight: 1 }}>{cap}</span>
                            <span className="font-adlam text-lg" style={{ color: 'var(--text-muted)', lineHeight: 1 }}>{sml}</span>
                            <span style={{ fontFamily: MANROPE, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{latin}</span>
                            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>{name}</span>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: P }}>{ipa}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SUPPLEMENTAL / LOAN */}
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#52525b', fontFamily: MANROPE, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                        SUPPLEMENTAL — LOAN CONSONANTS <span style={{ color: '#3f3f46', fontWeight: 500 }}>(6 · for loanwords)</span>
                      </p>
                      <div className="space-y-1.5 opacity-60">
                        {[
                          { cap: '𞤜', sml: '𞤾', latin: 'v',  name: 'Vaa',  ipa: '/v/'   },
                          { cap: '𞤝', sml: '𞤿', latin: 'x',  name: 'Kha',  ipa: '/x/'   },
                          { cap: '𞤞', sml: '𞥀', latin: 'ɡb', name: 'Gbe',  ipa: '/ɡ͡b/' },
                          { cap: '𞤟', sml: '𞥁', latin: 'z',  name: 'Zal',  ipa: '/z/'   },
                          { cap: '𞤠', sml: '𞥂', latin: 'kp', name: 'Kpo',  ipa: '/k͡p/' },
                          { cap: '𞤡', sml: '𞥃', latin: 'sh', name: 'Sha',  ipa: '/ʃ/'   },
                        ].map(({ cap, sml, latin, name, ipa }) => (
                          <div key={name} className="grid grid-cols-5 gap-1 items-center px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--btn-bg)' }}>
                            <span className="font-adlam text-xl text-white" style={{ lineHeight: 1 }}>{cap}</span>
                            <span className="font-adlam text-lg" style={{ color: 'var(--text-muted)', lineHeight: 1 }}>{sml}</span>
                            <span style={{ fontFamily: MANROPE, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{latin}</span>
                            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>{name}</span>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: P }}>{ipa}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* sample words */}
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#52525b', fontFamily: MANROPE, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>SAMPLE WORDS</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { adlam: '𞤘𞤢𞤲𞤣𞤮',   latin: 'Gando',   meaning: 'Bridge / Connection' },
                          { adlam: '𞤆𞤵𞤤𞤢𞥄𞤪',   latin: 'Pulaar',  meaning: 'Fula language' },
                          { adlam: '𞤀𞤬𞤪𞤭𞤳𞤢',   latin: 'Afirika', meaning: 'Africa' },
                          { adlam: '𞤃𞤢𞤸𞤵',     latin: 'Mahu',    meaning: 'Build / Create' },
                        ].map(({ adlam, latin, meaning }) => (
                          <div key={latin} className="p-3 rounded-xl border border-white/6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <p className="font-adlam text-white font-bold mb-0.5" style={{ fontSize: 20 }}>{adlam}</p>
                            <p style={{ fontFamily: MANROPE, fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{latin}</p>
                            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#52525b' }}>{meaning}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

            </div>

          ) : page === 'docs' ? (
            /* ══ DOCUMENTATION PAGE ══ */
            <div className="flex-1 overflow-y-auto relative z-10">
              <div className="w-full p-8 md:p-10 space-y-8">

                {/* ── SEARCH HERO CARD ── */}
                <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(253,139,0,0.06) 60%, rgba(19,19,19,1))', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: 28, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                  <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.15em', color: P, textTransform: 'uppercase', marginBottom: 12, fontFamily: MANROPE }}>DOCUMENTATION</p>
                  <h1 className={cn('font-black text-white tracking-tighter mb-2', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE, fontSize: 32 }}>
                    {t.docsPageTitle}
                  </h1>
                  <p className={cn('text-zinc-500 mb-5', isAdlam && 'font-adlam')} style={{ fontSize: 14 }}>{t.docsPageSubtitle}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: 'var(--btn-bg)', border: '1px solid var(--border)', marginBottom: 14 }}>
                    <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 13, color: '#52525b', fontFamily: 'Inter, sans-serif' }}>Search docs — prompting, deploy, ADLaM...</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['Getting Started', 'Prompting Guide', 'Deploy', 'API Reference', 'ADLaM support'].map(chip => (
                      <span key={chip} style={{ padding: '4px 12px', borderRadius: 9999, background: 'var(--btn-bg)', border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', fontFamily: MANROPE }}>{chip}</span>
                    ))}
                  </div>
                </div>

                {/* ── TWO-COLUMN: sidebar + content ── */}
                <div className="flex gap-8 items-start">

                  {/* SIDEBAR */}
                  <div className="w-52 flex-shrink-0 space-y-6">
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.15em', color: '#52525b', textTransform: 'uppercase', marginBottom: 8, fontFamily: MANROPE }}>BROWSE</p>
                      <div className="space-y-1">
                        {[
                          { Icon: BookOpen, label: t.docsSection1Title, active: true },
                          { Icon: Sparkles, label: t.docsSection2Title, active: false },
                          { Icon: Globe2,   label: t.docsSection3Title, active: false },
                          { Icon: Settings, label: 'API & Integrations', active: false },
                          { Icon: Globe2,   label: 'Supported Languages', active: false },
                          { Icon: Activity, label: 'Billing & Tokens',    active: false },
                        ].map(({ Icon, label, active }) => (
                          <div key={label} className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-default"
                            style={active
                              ? { background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#fff', fontWeight: 700 }
                              : { background: 'transparent', border: '1px solid transparent', color: 'var(--text-muted)', fontWeight: 500 }}>
                            <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? '#3b82f6' : undefined }} />
                            <span className={cn(isAdlam && 'font-adlam')} style={{ fontSize: 13, fontFamily: isAdlam ? undefined : MANROPE }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.15em', color: '#52525b', textTransform: 'uppercase', marginBottom: 8, fontFamily: MANROPE }}>QUICK LINKS</p>
                      <div className="space-y-1">
                        {[
                          { Icon: Activity,      label: t.systemStatusLabel },
                          { Icon: BookOpen,      label: 'Release Notes' },
                          { Icon: Users,         label: 'Community Forum' },
                          { Icon: AlertTriangle, label: 'Contact Support' },
                        ].map(({ Icon, label }) => (
                          <div key={label} className="flex items-center justify-between px-3 py-2 rounded-xl transition-all hover:bg-white/5 cursor-default"
                            style={{ color: 'var(--text-muted)' }}>
                            <div className="flex items-center gap-3">
                              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className={cn(isAdlam && 'font-adlam')} style={{ fontSize: 12, fontFamily: isAdlam ? undefined : MANROPE, fontWeight: 500 }}>{label}</span>
                            </div>
                            <ChevronRight className="w-3 h-3 flex-shrink-0" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* CONTENT */}
                  <div className="flex-1 min-w-0 space-y-6">
                    {/* Section header */}
                    <div className="flex items-center gap-4 p-5 rounded-2xl relative overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BookOpen className="w-4 h-4" style={{ color: P }} />
                      </div>
                      <div>
                        <h2 className={cn('font-black text-white', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE, fontSize: 20, marginBottom: 2 }}>{t.docsSection1Title}</h2>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Your first app in under 5 minutes</p>
                      </div>
                    </div>

                    {/* TOPIC CARDS 2×2 */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { n: '01', label: 'Create your account' },
                        { n: '02', label: 'Sign in with Google' },
                        { n: '03', label: 'Your first prompt' },
                        { n: '04', label: 'Understanding previews' },
                      ].map(({ n, label }) => (
                        <div key={n} className="flex items-center gap-3 transition-all hover:bg-white/5 cursor-pointer"
                          style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ width: 22, height: 22, borderRadius: 7, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6', fontFamily: MANROPE, fontWeight: 900, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {n}
                          </div>
                          <span className={cn(isAdlam && 'font-adlam')} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: isAdlam ? undefined : MANROPE, flex: 1 }}>{label}</span>
                          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        </div>
                      ))}
                    </div>

                    {/* ARTICLE CARD */}
                    <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, fontFamily: MANROPE }}>ARTICLE · 3 MIN READ</p>
                      <h3 className={cn('font-black text-white', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE, fontSize: 20, marginBottom: 12 }}>{t.docsSection2Title}</h3>
                      <p className={cn('text-sm leading-relaxed', isAdlam && 'font-adlam')} style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{t.docsSection2Body}</p>
                      <div className="space-y-2 mb-4">
                        {[
                          { label: t.docsSection3Title, bold: true },
                          { label: 'Press Enter to send, Shift+Enter for a new line.', bold: false },
                          { label: 'After generation, ask follow-up questions to refine your app.', bold: false },
                        ].map(({ label, bold }, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span style={{ fontWeight: 700, color: P, flexShrink: 0 }}>·</span>
                            <p className={cn('text-xs', isAdlam && 'font-adlam')} style={{ color: bold ? '#e5e5e5' : '#767575', fontWeight: bold ? 700 : 400 }}>{label}</p>
                          </div>
                        ))}
                      </div>
                      {/* Author row */}
                      <div style={{ paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', fontFamily: MANROPE }}>G</span>
                        </div>
                        <div>
                          <p style={{ fontFamily: MANROPE, fontWeight: 700, fontSize: 11, color: '#fff', lineHeight: 1.3 }}>Gando Team</p>
                          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>Updated 2 weeks ago</p>
                        </div>
                      </div>
                    </div>

                    {/* QUICK TIPS */}
                    <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                      <h2 className={cn('font-black text-white mb-5', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE, fontSize: 16 }}>
                        💡 Quick Tips
                      </h2>
                      <div className="space-y-3">
                        {[
                          'Type in your native language — Gando understands Fulani, Swahili, Yoruba, Hausa, and more.',
                          'Press Enter to send, Shift+Enter for a new line.',
                          'After generation, ask follow-up questions to refine your app.',
                          'Use the Revert button on any chat message to go back to that version.',
                          'Download your app as a single HTML file — works offline.',
                          'Set GEMINI_MODEL=gemini-2.5-pro in .env for higher-quality generation.',
                        ].map((tip, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: P }} />
                            <p className={cn('text-zinc-400 text-sm', isAdlam && 'font-adlam')}>{tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          ) : page === 'status' ? (
            /* ══ SYSTEM STATUS PAGE ══ */
            <div className="flex-1 overflow-y-auto relative z-10 p-8 md:p-10 max-w-2xl mx-auto w-full space-y-8">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className={cn('text-4xl font-black text-white tracking-tighter mb-2', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
                    {t.statusPageTitle}
                  </h1>
                  <p className={cn('text-zinc-500', isAdlam && 'font-adlam')}>{t.statusPageSubtitle}</p>
                </div>
                <button onClick={fetchStatus}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-white/10 hover:border-white/20 text-zinc-400 hover:text-white transition-all"
                  style={{ background: 'var(--card-bg)' }}>
                  <RotateCcw className="w-4 h-4" /> Refresh
                </button>
              </div>

              {/* service rows */}
              {([
                { label: t.statusServer,   status: sysStatus.server,  detail: sysStatus.uptime ? `Uptime: ${Math.floor(sysStatus.uptime / 60)}m` : '' },
                { label: t.statusAI,       status: sysStatus.ai,      detail: sysStatus.aiMs ? `${sysStatus.aiMs}ms latency` : '' },
                { label: t.statusFirebase, status: sysStatus.db,      detail: user ? 'Authenticated' : 'Not connected' },
              ] as { label: string; status: 'ok'|'degraded'|'down'|'checking'; detail: string }[]).map(({ label, status, detail }) => (
                <div key={label} className="flex items-center justify-between p-6 rounded-2xl border border-white/8 relative overflow-hidden" style={{ background: 'var(--card-bg)' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                  <div className="flex items-center gap-4">
                    <StatusDot status={status} />
                    <div>
                      <p className={cn('font-black text-white', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{label}</p>
                      {detail && <p className="text-xs text-zinc-500 mt-0.5">{detail}</p>}
                    </div>
                  </div>
                  <span className={cn('text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full', isAdlam && 'font-adlam')}
                    style={status === 'ok' ? { background: 'rgba(74,222,128,0.1)', color: '#4ade80' }
                      : status === 'degraded' ? { background: `${S}15`, color: S }
                      : status === 'checking' ? { background: 'var(--hover-bg)', color: '#999' }
                      : { background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                    {status === 'ok' ? t.statusOperational : status === 'degraded' ? t.statusDegraded : status === 'checking' ? t.statusChecking : t.statusDown}
                  </span>
                </div>
              ))}

              {/* model info */}
              <div className="p-6 rounded-2xl border border-white/8 relative overflow-hidden" style={{ background: 'var(--card-bg)' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                <h3 className={cn('font-black text-white mb-4', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{t.statusModel}</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold text-sm">{sysStatus.model}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">Google Gemini via Gando Server</p>
                  </div>
                  <span className="text-xs font-black px-3 py-1 rounded-full" style={{ background: `${P}15`, color: P }}>Active</span>
                </div>
              </div>

              {sysStatus.checked && (
                <p className={cn('text-zinc-600 text-xs text-center', isAdlam && 'font-adlam')}>
                  {t.statusLastChecked}: {sysStatus.checked}
                </p>
              )}
            </div>

          ) : page === 'collector' ? (
            /* ══ GANDO COLLECTOR ══ */
            <GandoCollector user={user} langCode={selectedLang.code} />

          ) : page === 'admin' && isAdmin ? (
            /* ══ ADMIN PORTAL ══ */
            <AdminPortal user={user} />

          ) : (
            /* ══ DASHBOARD (Bolt-style) ══ */
            <div className="flex-1 overflow-y-auto relative z-10">

              {/* radial glow background */}
              <div className="pointer-events-none fixed inset-0 z-0" style={{ background: `radial-gradient(ellipse 80% 50% at 50% 25%, ${P}14 0%, transparent 70%)` }} />
              <div className="pointer-events-none fixed inset-0 z-0" style={{ background: `radial-gradient(ellipse 50% 40% at 70% 60%, ${S}09 0%, transparent 65%)` }} />

              {/* ── HERO SECTION ── */}
              <div className="flex flex-col items-center px-6 pt-16 pb-10 relative z-10">
                <div style={{ maxWidth: 760, width: '100%' }}>

                  {/* personalized greeting */}
                  {(() => {
                    const raw = userPrefs.preferredName?.trim() || user.displayName?.trim().split(/\s+/)[0] || user.email?.split('@')[0] || 'Builder';
                    // ADLaM: write the name in ADLaM letters + render RTL (greeting
                    // on the right, name on the left). Else Latin, capitalized.
                    const firstName = isAdlam ? latinToAdlam(raw) : raw.charAt(0).toUpperCase() + raw.slice(1);
                    const greet = selectedLang.code === 'fr' ? 'Bonjour'
                      : isAdlam ? '𞤔𞤢𞥄𞤪𞤢𞥄𞤥𞤢'
                      : 'Welcome';
                    return (
                      <h1 dir={isAdlam ? 'rtl' : undefined}
                        className={cn('text-center font-black text-white tracking-tighter mb-3', isAdlam && 'font-adlam')}
                        style={{ fontFamily: isAdlam ? undefined : MANROPE, fontSize: 'clamp(30px, 5vw, 58px)', lineHeight: 1.05 }}>
                        {greet},{' '}
                        <span style={{ background: `linear-gradient(135deg,${P},${S})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                          {firstName}
                        </span>
                      </h1>
                    );
                  })()}
                  <p className={cn('text-center text-zinc-500 mb-8', isAdlam && 'font-adlam')} style={{ fontSize: 15 }}>
                    {selectedLang.code === 'fr' ? 'Que construisons-nous aujourd’hui ?'
                      : selectedLang.code === 'ff-adlm' ? t.gandoViewSubtitle
                      : 'What will we build today?'}
                  </p>

                  {/* import mode tabs — build mode only */}
                  {mode === 'build' && (
                  <div className="flex items-center gap-1 mb-3">
                    {([
                      { im: 'describe' as const, Icon: Sparkles, label: 'Prompt' },
                      { im: 'github'   as const, Icon: Github,   label: 'GitHub' },
                      { im: 'figma'    as const, Icon: Figma,    label: 'Figma'  },
                    ]).map(({ im, Icon, label }) => (
                      <button key={im} onClick={() => { setImportMode(im); setInput(''); }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                          fontFamily: MANROPE,
                          color: importMode === im ? '#fff' : '#71717a',
                          background: importMode === im ? 'var(--border)' : 'transparent',
                          border: importMode === im ? '1px solid var(--border)' : '1px solid transparent',
                        }}>
                        <Icon className="w-3 h-3" />{label}
                      </button>
                    ))}
                  </div>
                  )}

                  {/* big textarea card */}
                  <div style={{ borderRadius: 20, background: 'var(--card-bg)', border: `1px solid ${inputShake ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.1)'}`, boxShadow: '0 24px 80px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)', padding: '18px 18px 14px', transition: 'border-color 0.2s' }}
                    className={inputShake ? 'animate-shake' : ''}>
                    <textarea
                      ref={heroTextareaRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onInput={handleHeroInput}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const ctx = buildDashContext(); setDashAttachments([]); handleSend(ctx || undefined); } }}
                      placeholder={
                        mode === 'chat' ? 'Ask Gando anything…' :
                        importMode === 'github' ? 'Paste a GitHub repository URL to clone…' :
                        importMode === 'figma'  ? 'Paste a Figma design link to build from…' :
                        !input ? (twText + (twCursor ? '|' : ' ')) : t.inputPlaceholder
                      }
                      className={cn('gando-input', isAdlam && 'font-adlam')}
                      style={{ width: '100%', minHeight: 110, maxHeight: 260, background: 'transparent', border: 'none', outline: 'none', resize: 'none', color: 'var(--text-primary)', fontSize: 16, lineHeight: 1.6, fontFamily: isAdlam ? undefined : 'var(--font-sans)', overflowY: 'hidden', display: 'block', boxSizing: 'border-box' }}
                    />
                    {dashAttachments.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {dashAttachments.map(att => (
                          <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 8px', fontSize: 12, color: 'var(--text-secondary)' }}>
                            {att.kind === 'image' && att.previewUrl
                              ? <img src={att.previewUrl} style={{ width: 18, height: 18, borderRadius: 3, objectFit: 'cover' }} alt="" />
                              : <Paperclip className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />}
                            <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                            <button onClick={() => setDashAttachments(prev => prev.filter(x => x.id !== att.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', gap: 8 }}>
                      <div className="flex items-center gap-2 min-w-0">
                      {importMode === 'describe'
                        ? <div className="flex items-center gap-2">
                            {/* Plus — attach files/photos/PDF */}
                            <div ref={dashPlusRef} style={{ position: 'relative' }}>
                              <button
                                onClick={() => setDashPlusOpen(o => !o)}
                                title="Attach files, photos or a URL"
                                style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--btn-bg)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              {dashPlusOpen && (
                                <div style={{ position: 'absolute', top: 44, left: 0, background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', minWidth: 220, zIndex: 50 }}>
                                  {([
                                    { icon: Paperclip, label: 'Add files or photos', action: () => { setDashPlusOpen(false); dashFileInputRef.current?.click(); } },
                                    { icon: Camera,    label: 'Take a screenshot',   action: () => setDashPlusOpen(false) },
                                    { icon: Globe,     label: 'Add from URL',         action: () => setDashPlusOpen(false) },
                                  ]).map(({ icon: Icon, label, action }) => (
                                    <div
                                      key={label}
                                      onClick={action}
                                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--hover-bg)'}
                                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', background: 'transparent' }}
                                    >
                                      <Icon className="w-4 h-4" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                      {label}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Model picker */}
                            <div ref={dashModelRef} style={{ position: 'relative' }}>
                              <button
                                onClick={() => setDashModelOpen(o => !o)}
                                title="Choose the AI model"
                                className="flex items-center gap-1.5 py-2 px-3 rounded-xl transition-colors"
                                style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', background: 'var(--btn-bg)', border: '1px solid var(--border)' }}
                              >
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: PROVIDER_COLOR[provider] }} />
                                {PROVIDER_LABEL[provider]}
                                <ChevronDown className="w-3 h-3 opacity-60" />
                              </button>
                              {dashModelOpen && (
                                <div style={{ position: 'absolute', top: 40, left: 0, background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'hidden', overflowY: 'auto', minWidth: 240, maxHeight: 132, zIndex: 50 }}>
                                  {modelOptions.map(m => (
                                    <div
                                      key={m.id}
                                      onClick={() => { setProvider(m.id); setDashModelOpen(false); }}
                                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--hover-bg)'}
                                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent' }}
                                    >
                                      <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: PROVIDER_COLOR[m.id] }} />
                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{m.label}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{m.sub}</div>
                                      </div>
                                      {provider === m.id && <Check className="w-3.5 h-3.5" style={{ color: '#3b82f6', flexShrink: 0 }} />}
                                    </div>
                                  ))}
                                  <div onClick={() => { setByokModalOpen(true); setDashModelOpen(false); }}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--hover-bg)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent', borderTop: '1px solid var(--border)' }}>
                                    <Plus className="w-3.5 h-3.5" style={{ color: '#3b82f6', flexShrink: 0 }} />
                                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{selectedLang.code === "fr" ? "Utilisez votre clé" : "Bring your own key"}</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        : <span style={{ fontSize: 11, color: '#52525b', fontFamily: 'Inter, sans-serif' }}>
                            {importMode === 'github' ? 'github.com/user/repo' : 'figma.com/design/…'}
                          </span>
                      }
                      <ModeSwitch mode={mode} onChange={setMode} />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {importMode === 'describe' && (
                          <button
                            onClick={dashVoice.toggleListening}
                            title={dashVoice.isListening ? 'Stop recording' : 'Speak your prompt'}
                            className={dashVoice.isListening ? 'animate-pulse' : ''}
                            style={{
                              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                              background: dashVoice.isListening ? 'rgba(239,68,68,0.18)' : 'var(--btn-bg)',
                              border: `1px solid ${dashVoice.isListening ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                              color: dashVoice.isListening ? '#f87171' : dashVoice.isTranscribing ? '#3b82f6' : '#adaaaa',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                            {dashVoice.isTranscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : dashVoice.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                          </button>
                        )}
                        <button onClick={() => { const ctx = buildDashContext(); setDashAttachments([]); handleSend(ctx || undefined); }} disabled={isGenerating || (!input.trim() && dashAttachments.length === 0)}
                          title={mode === 'chat' ? 'Ask Gando' : 'Generate'}
                          style={{
                            width: 38, height: 38, borderRadius: 12, flexShrink: 0, border: 'none',
                            background: ((!input.trim() && dashAttachments.length === 0) || isGenerating) ? 'rgba(255,255,255,0.06)' : 'var(--gradient-brand)',
                            color: ((!input.trim() && dashAttachments.length === 0) || isGenerating) ? '#52525b' : '#0a0a0a',
                            cursor: ((!input.trim() && dashAttachments.length === 0) || isGenerating) ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: (!input.trim() || isGenerating) ? 'none' : 'var(--glow-primary-sm)',
                          }}>
                          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <input ref={dashFileInputRef} type="file" accept="image/*,.txt,.md,.csv" multiple style={{ display: 'none' }} onChange={handleDashFileChange} />

                  {/* suggestion chips — prompt mode only */}
                  {importMode === 'describe' && (
                    <div className="flex flex-wrap gap-2.5 justify-center mt-6">
                      {['E-commerce store', 'Portfolio site', 'Restaurant menu', 'Event landing page'].map(ex => (
                        <button key={ex} onClick={() => { setInput(ex); heroTextareaRef.current?.focus(); }}
                          className="px-4 py-2 rounded-full text-sm font-bold text-zinc-400 hover:text-white transition-all hover:border-white/20"
                          style={{ background: 'var(--btn-bg)', border: '1px solid var(--border)' }}>
                          {ex}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── RECENT PROJECTS ── */}
              {projects.length > 0 && (
                <div className="relative z-10 px-6 pb-10" style={{ maxWidth: 960, width: '100%', margin: '0 auto' }}>
                  <div className="flex justify-between items-center mb-5">
                    <h2 className={cn('text-xl font-black text-white', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{t.activeSiteBuildsLabel}</h2>
                    <button onClick={() => setPage('projects')} className={cn('text-xs font-black uppercase tracking-widest hover:opacity-80 transition-opacity', isAdlam && 'font-adlam')} style={{ color: P }}>{t.viewAllLabel} →</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {projects.slice(0, 3).map(p => (
                      <motion.div key={p.id} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        onClick={() => openProject(p)}
                        className="group cursor-pointer rounded-2xl overflow-hidden border border-white/8 hover:border-white/15 transition-all"
                        style={{ background: 'var(--card-bg)' }}>
                        <div style={{ height: 2, background: 'var(--gradient-horizontal)' }} />
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${P}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Sparkles className="w-4 h-4" style={{ color: P }} />
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: `${T}15`, color: T, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{p.language}</span>
                          </div>
                          <p className={cn('font-black text-white text-sm mb-1 truncate', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{p.name}</p>
                          <p className={cn('text-zinc-500 text-xs line-clamp-2', isAdlam && 'font-adlam')}>{p.description}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── TEMPLATE GRID ── */}
              {(() => {
                const tl = TEMPLATE_I18N[selectedLang.code] || TEMPLATE_I18N.en;
                return (
                  <div className="relative z-10 px-6 pb-24" style={{ maxWidth: 960, width: '100%', margin: '0 auto' }}>
                    <div className="flex justify-between items-center mb-5">
                      <h2 className={cn('text-xl font-black text-white', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{tl.pageTitle}</h2>
                      <button onClick={() => { setPage('templates'); setCurrentProject(null); }} className={cn('text-xs font-black uppercase tracking-widest hover:opacity-80 transition-opacity', isAdlam && 'font-adlam')} style={{ color: P }}>{tl.viewAll} →</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {TEMPLATES_META.slice(0, 4).map(tmpl => {
                        const tr = tl.templates[tmpl.id] || TEMPLATE_I18N.en.templates[tmpl.id];
                        return (
                          <motion.div key={tmpl.id} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            onClick={() => { setPage('templates'); setSelectedTemplate(tmpl); }}
                            className="group relative rounded-2xl overflow-hidden cursor-pointer border border-white/8 hover:border-white/20 transition-all"
                            style={{ background: 'var(--card-bg)' }}>
                            <div style={{ height: 140, background: tmpl.color, position: 'relative', overflow: 'hidden' }}>
                              {tmpl.previewUrl ? (
                                <iframe src={tmpl.previewUrl} title={tr.name} className="border-none pointer-events-none"
                                  style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Layers className="w-8 h-8 opacity-20" style={{ color: '#fff' }} />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '6px 14px', borderRadius: 6, fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Preview →</span>
                              </div>
                            </div>
                            <div className="p-3">
                              <p className={cn('font-black text-white text-xs mb-0.5 truncate', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{tr.name}</p>
                              <p className="text-zinc-500 text-[10px] line-clamp-1" style={{ fontFamily: 'Inter, sans-serif' }}>{tr.description}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
