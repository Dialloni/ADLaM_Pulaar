/* Starter-template catalog + its 3-language copy. Pure data — no imports. */
export const TEMPLATE_I18N: Record<string, { pageTitle: string; pageSubtitle: string; viewAll: string; preview: string; useTemplate: string; credit: string; templates: Record<string, { name: string; description: string; starterPrompt: string }> }> = {
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

export const TEMPLATES_META = [
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
