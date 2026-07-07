import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, query, where, orderBy, limit, onSnapshot, updateDoc, deleteDoc, doc, getDoc, setDoc, getDocs, getCountFromServer,
  db, serverTimestamp, addDoc, storage, ref, uploadBytes, uploadBytesResumable, getDownloadURL,
  auth,
} from '../firebase';
import adlamDictData from '../../adlam_dict.json';
import { CheckCircle2, XCircle, Download, RefreshCw, Upload, FileText, X, BookMarked, Trash2, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import type { User } from '../firebase';
import type { Project } from '../types';
import { AudioRecorder } from './AudioRecorder';
import { ProjectThumb } from './ProjectThumb';
import { adlamToLatin, latinToAdlam } from '../../lib/translit';
import { DEFAULT_CATEGORIES, mergeCategories, categoryLabel, categoryColor, type Category } from '../lib/categories';
// pdfjs (~400 KB) loads on first PDF use, not with the page
async function getPdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;
  return pdfjsLib;
}

type SubmissionStatus = 'pending' | 'verified' | 'rejected' | 'needs_adlam';
type SubmissionDomain = string;   // category slug — now dynamic (see lib/categories.ts)
type Tab = 'queue' | 'upload' | 'paste' | 'dictionary' | 'community' | 'translit' | 'voice' | 'controls' | 'usage';
type DictStatus = 'draft' | 'verified';

interface DictTerm {
  id: string;
  adlam: string;
  latin: string;
  fr: string;
  domain: string;
  status: DictStatus;
  verified_by?: string | null;
  verified_at?: any;
}

interface Submission {
  id: string;
  source: string;
  raw_text: string;
  adlam_text?: string;
  gloss_en?: string;
  gloss_fr?: string;
  pulaar_latin?: string;
  adlam_ratio: number;
  word_count: number;
  status: SubmissionStatus;
  domain: SubmissionDomain | null;
  submitted_at: any;
  verified_by: string | null;
  source_meta: Record<string, any>;
  file_url: string | null;
  audio_url?: string | null;
  pulaar_audio_url?: string | null;
}

interface PdfResult {
  fileName: string;
  text: string;
  adlam_ratio: number;
  word_count: number;
  pages: number;
  file_url: string;
  status: 'ready' | 'submitting' | 'done' | 'error';
  error?: string;
}

const P = '#3b82f6';
const MANROPE = 'Manrope, sans-serif';
// Hand-picked colors for the original core categories; everything else gets a
// stable hashed color from lib/categories.
const DOMAIN_COLORS: Record<string, string> = {
  tech:       '#bca2ff',
  religion:   '#fd8b00',
  news:       '#3b82f6',
  casual:     '#4ade80',
  literature: '#60a5fa',
  ui_vocab:   '#f59e0b',
};
const domColor = (slug?: string | null): string =>
  (slug && DOMAIN_COLORS[slug]) || (slug ? categoryColor(slug) : '#52525b');

const SOURCE_COLORS: Record<string, string> = {
  telegram:    '#229ed9',
  pdf:         '#fd8b00',
  text_upload: '#bca2ff',
  collector:   '#4ade80',
  test:        '#71717a',
};

function adlamRatio(text: string): number {
  const letters = [...text].filter(c => /\p{L}/u.test(c));
  if (!letters.length) return 0;
  const adlam = letters.filter(c => c >= '\u{1E900}' && c <= '\u{1E95F}');
  return adlam.length / letters.length;
}

function ratioColor(r: number) {
  if (r >= 0.9) return '#4ade80';
  if (r >= 0.7) return '#fd8b00';
  return '#f87171';
}

async function extractPdfText(file: File): Promise<{ text: string; pages: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map((item: any) => item.str).join(' '));
  }
  return { text: parts.join('\n'), pages: pdf.numPages };
}

// Render one PDF page to a lossless PNG base64 string (browser canvas).
// PNG + higher scale keeps ADLaM's thin curved glyphs sharp — JPEG compression
// smeared them and hurt OCR accuracy. Payload rides the 25MB /api/ocr limit.
async function renderPageToPng(page: any, scale = 3): Promise<string> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1];
}

// Read an uploaded image file straight to base64 (for direct JPG/PNG uploads).
async function fileToBase64(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  return dataUrl.split(',')[1];
}

async function ocrOneImage(base64: string, token: string, mimeType = 'image/png'): Promise<string> {
  for (let attempt = 0; attempt <= 4; attempt++) {
    const res = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ imageBase64: base64, mimeType }),
    });
    // 429 rate limit and transient 5xx (Gemini INTERNAL/UNAVAILABLE) are both retryable.
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || `OCR failed (${res.status} ${res.statusText})`);
    }
    const { text } = await res.json() as { text: string };
    return text;
  }
  throw new Error('OCR failed after retries — Gemini kept returning errors. Try again later.');
}

// Render PDF pages client-side → OCR each page image individually, saving in
// page-range chunks as we go. Incremental save matters: a whole book in ONE
// Firestore doc would blow the 1MB doc cap and lose everything; chunking also
// means a crash at page 250 keeps the first 240. onBatch persists each chunk.
async function ocrPdfWithGemini(
  file: File,
  onProgress: (msg: string) => void,
  onBatch: (text: string, fromPage: number, toPage: number) => Promise<void>,
): Promise<{ pages: number; words: number; failed: number; sample: string }> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const buf = await file.arrayBuffer();
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages = pdf.numPages;

  const CONCURRENCY = 5;   // overlap network-bound page OCR — ~5× faster than serial
  const BATCH = 10;        // save every 10 pages — stays well under Firestore's 1MB doc cap
  let done = 0;
  let failed = 0;
  let words = 0;
  let sample = '';

  for (let start = 1; start <= pages; start += BATCH) {
    const end = Math.min(start + BATCH - 1, pages);
    const pageNums = Array.from({ length: end - start + 1 }, (_, k) => start + k);
    const texts: string[] = new Array(pageNums.length).fill('');
    let cursor = 0;

    const worker = async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= pageNums.length) return;
        const pageNum = pageNums[idx];
        try {
          const page = await pdf.getPage(pageNum);
          const base64 = await renderPageToPng(page, 3);
          texts[idx] = await ocrOneImage(base64, token, 'image/png');
        } catch (err) {
          // One flaky page shouldn't kill a whole book — skip it, keep the rest.
          failed++;
          console.error(`OCR page ${pageNum} failed:`, err);
        } finally {
          done++;
          const tail = failed ? ` (${failed} skipped)` : '';
          onProgress(`Gemini OCR ${done}/${pages}…${tail}`);
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, pageNums.length) }, () => worker()),
    );

    const batchText = texts.filter(t => t.trim().length > 0).join('\n\n').trim();
    if (batchText) {
      onProgress(`Saving pages ${start}–${end}…`);
      await onBatch(batchText, start, end);
      words += batchText.split(/\s+/).filter(Boolean).length;
      if (!sample) sample = batchText.slice(0, 300);
    }
  }

  if (!words && failed) {
    throw new Error(`All ${failed} pages failed OCR — Gemini kept erroring. Try again later.`);
  }
  return { pages, words, failed, sample };
}


/* ── Admin UI i18n — en/fr (ADLaM slot ready, falls back to en until verified) ── */
const ADMIN_I18N = {
  en: {
    title: 'Corpus Admin',
    subtitle: 'Review and verify ADLaM text submissions',
    exportJsonl: 'Export JSONL',
    firestoreError: 'Firestore error:',
    statNeedsAdlam: 'Needs ADLaM', statPending: 'Pending', statVerified: 'Verified', statRejected: 'Rejected',
    tabQueue: 'Review Queue', tabCommunity: 'Community', tabUpload: 'Upload PDFs', tabPaste: 'Paste Text', tabDictionary: 'Dictionary', tabTranslit: 'Transliterator',
    translitHint: 'Type in either box — the other converts live. Rules follow the official Adlam book (Adlam_book/).',
    translitLatin: 'Latin (Pulaar)', translitAdlam: 'ADLaM',
    tabVoice: 'Voice Data',
    tabControls: 'Controls',
    controlsHint: 'Live switches — changes take effect within ~20 seconds, no redeploy. Use with care: they affect every user right now.',
    controlsLimitsTitle: 'Daily usage limits',
    controlsLimitsDesc: 'ON: each user gets the normal free daily caps. OFF: limits lifted for everyone — good for a demo or open trial (watch the bill).',
    controlsKeyTitle: 'Shared API key (our credits)',
    controlsKeyDesc: 'ON: our key powers the free tier. OFF: our key is paused — users must add their own key (BYOK) to keep building. Instant wallet stop.',
    controlsOn: 'ON', controlsOff: 'OFF',
    controlsActive: 'active', controlsPaused: 'paused',
    controlsKeyNote: 'Note: for now this stops ALL our keys (Claude, Gemini, Groq). Goal later: pause only the paid ones (Claude + Gemini) and leave the free tiers running.',
    tabUsage: 'Usage',
    usageHint: 'Token spend on our keys (BYOK excluded). Live from the backend — no need to check Anthropic or Google dashboards.',
    usageToday: 'Today', usageTotal: 'Total tokens', usageIn: 'in', usageOut: 'out', usageCalls: 'calls',
    usageByModel: 'By model (today)', usageByKind: 'By route (today)', usageTrend: 'Last 7 days', usageTopUsers: 'Top users today',
    usageNone: 'No usage recorded yet today.', usageLoading: 'Loading usage…',
    voiceHint: 'Every verified text read aloud = one training pair. Goal: 1,000 training-ready clips for the first Pulaar voice fine-tune.',
    voiceReadyLabel: 'training-ready (verified + audio)', voiceAwaitingLabel: 'recorded, awaiting verification',
    voiceListTitle: 'Training-ready clips', voiceExport: 'Export dataset (JSONL)',
    voiceNone: 'No clips yet — record while verifying in the Review Queue.',
    communityHint: 'Projects shared by users. Approve to publish as a community template; reject to hide.',
    loading: 'Loading…', noProjects: 'No projects awaiting review.', owner: 'owner',
    approve: 'Approve', reject: 'Reject', confirm: 'Confirm', cancel: 'Cancel', save: 'Save', edit: '✏️ Edit',
    dropPdfs: 'Drop PDFs or images here — or click to browse',
    dropHint: 'PDF, JPG or PNG — Gemini OCR runs automatically (pages saved in 10-page chunks)',
    submitted: 'Submitted', failed: 'Failed', words: 'words', pages: 'pages',
    adlamText: 'ADLaM Text',
    pastePlaceholder: 'Paste ADLaM text here — from PDFs, WhatsApp, Telegram, books…',
    domain: 'Domain', source: 'Source',
    encodingWarning: 'Arabic characters detected (U+0600 range) — pre-Unicode font encoding.',
    encodingNote: 'Note: Google Docs also displays correct Unicode ADLaM as Arabic when the font is missing.',
    encodingNote2: 'Check the codepoint label above — if it says',
    encodingNote3: 'the text IS correct, just rendering wrong.',
    decoding: 'Decoding…', decodeBtn: '✦ Decode with AI → Unicode ADLaM',
    submitting: 'Submitting…', submittedQueue: 'Submitted to queue!', submitQueue: 'Submit to corpus queue',
    need3Words: 'At least 3 words required',
    draftCount: 'Draft', verifiedCount: 'Verified',
    seeding: 'Seeding…', seedFromJson: 'Seed from JSON', seed50: 'Seed 50 terms from JSON', exportJson: 'Export JSON',
    dictErrorHint: '— deploy firestore.rules then reload.',
    addNewTerm: 'Add New Term',
    typeAdlamPlaceholder: '𞤢𞤣𞤤𞤢𞤥 — type ADLaM script here',
    adlamDetected: '✓ ADLaM script detected',
    adlamNotDetected: '✗ Write in ADLaM — characters not recognized as ADLaM',
    englishLatin: 'English / latin',
    adding: 'Adding…', added: 'Added!', addToDict: '+ Add to dictionary',
    noTerms: 'No terms yet.',
    adlamScriptPlaceholder: 'ADLaM script…', frTranslation: 'French translation', domainPlaceholder: 'domain',
    verify: 'Verify', unverify: 'Unverify',
    del: 'Delete', deleteConfirm: 'Delete permanently? This cannot be undone.', deleteYes: 'Yes, delete', restore: 'Restore to queue',
    results: 'results', noSubmissions: 'No submissions',
    contributorAudio: 'Contributor audio', verifiedAudio: '✓ Verified Pulaar audio',
    adlamEquivalent: 'ADLaM equivalent',
    writeAdlamPlaceholder: '𞤢𞤣𞤤𞤢𞤥… write the ADLaM here',
    recordPulaar: 'Record Pulaar pronunciation (optional)',
    saveAdlamQueue: 'Save ADLaM → queue', saveEdit: 'Save Edit', completeAdlam: '✏️ Complete the ADLaM',
    loadMore: 'Load more', remaining: 'remaining',
    pulaarLatin: 'Pulaar (Latin):',
    statusLabels: { all: 'all', needs_adlam: 'needs ADLaM', pending: 'pending', verified: 'verified', rejected: 'rejected' } as Record<string, string>,
    dictFilterLabels: { all: 'all', draft: 'draft', verified: 'verified' } as Record<string, string>,
  },
  fr: {
    title: 'Administration du corpus',
    subtitle: 'Vérifiez et validez les soumissions de texte ADLaM',
    exportJsonl: 'Exporter JSONL',
    firestoreError: 'Erreur Firestore :',
    statNeedsAdlam: 'ADLaM requis', statPending: 'En attente', statVerified: 'Vérifiés', statRejected: 'Rejetés',
    tabQueue: 'File de révision', tabCommunity: 'Communauté', tabUpload: 'Importer des PDF', tabPaste: 'Coller du texte', tabDictionary: 'Dictionnaire', tabTranslit: 'Translittérateur',
    translitHint: "Écrivez dans l'une des zones — l'autre se convertit en direct. Règles selon le livre officiel ADLaM (Adlam_book/).",
    translitLatin: 'Latin (pulaar)', translitAdlam: 'ADLaM',
    tabVoice: 'Données vocales',
    tabControls: 'Contrôles',
    controlsHint: 'Interrupteurs en direct — effet en ~20 secondes, sans redéploiement. À utiliser avec prudence : ils affectent tous les utilisateurs immédiatement.',
    controlsLimitsTitle: 'Limites journalières',
    controlsLimitsDesc: "ON : chaque utilisateur garde les quotas gratuits habituels. OFF : limites levées pour tous — pratique pour une démo ou un essai ouvert (surveillez la facture).",
    controlsKeyTitle: 'Clé API partagée (nos crédits)',
    controlsKeyDesc: "ON : notre clé alimente la version gratuite. OFF : notre clé est suspendue — les utilisateurs doivent ajouter leur propre clé (BYOK). Arrêt immédiat des dépenses.",
    controlsOn: 'ON', controlsOff: 'OFF',
    controlsActive: 'actif', controlsPaused: 'suspendu',
    controlsKeyNote: 'Note : pour l’instant, cela coupe TOUTES nos clés (Claude, Gemini, Groq). Objectif futur : ne suspendre que les payantes (Claude + Gemini) et laisser les gratuites actives.',
    tabUsage: 'Utilisation',
    usageHint: "Consommation de jetons sur nos clés (BYOK exclu). En direct depuis le backend — pas besoin de consulter les tableaux de bord Anthropic ou Google.",
    usageToday: "Aujourd'hui", usageTotal: 'Jetons totaux', usageIn: 'entrée', usageOut: 'sortie', usageCalls: 'appels',
    usageByModel: 'Par modèle (auj.)', usageByKind: 'Par route (auj.)', usageTrend: '7 derniers jours', usageTopUsers: "Top utilisateurs auj.",
    usageNone: "Aucune utilisation enregistrée aujourd'hui.", usageLoading: 'Chargement…',
    voiceHint: "Chaque texte vérifié lu à voix haute = une paire d'entraînement. Objectif : 1 000 clips prêts pour le premier fine-tune vocal pulaar.",
    voiceReadyLabel: 'prêts (vérifiés + audio)', voiceAwaitingLabel: 'enregistrés, en attente de vérification',
    voiceListTitle: "Clips prêts pour l'entraînement", voiceExport: 'Exporter le dataset (JSONL)',
    voiceNone: "Aucun clip pour l'instant — enregistrez en vérifiant dans la file de révision.",
    communityHint: 'Projets partagés par les utilisateurs. Approuvez pour publier comme modèle communautaire ; rejetez pour masquer.',
    loading: 'Chargement…', noProjects: 'Aucun projet en attente de révision.', owner: 'propriétaire',
    approve: 'Approuver', reject: 'Rejeter', confirm: 'Confirmer', cancel: 'Annuler', save: 'Enregistrer', edit: '✏️ Modifier',
    dropPdfs: 'Déposez des PDF ou images ici — ou cliquez pour parcourir',
    dropHint: "PDF, JPG ou PNG — l'OCR Gemini se lance automatiquement (pages enregistrées par lots de 10)",
    submitted: 'Envoyé', failed: 'Échec', words: 'mots', pages: 'pages',
    adlamText: 'Texte ADLaM',
    pastePlaceholder: 'Collez du texte ADLaM ici — depuis PDF, WhatsApp, Telegram, livres…',
    domain: 'Domaine', source: 'Source',
    encodingWarning: 'Caractères arabes détectés (plage U+0600) — encodage de police pré-Unicode.',
    encodingNote: "Remarque : Google Docs affiche aussi l'ADLaM Unicode correct comme de l'arabe, faute de police.",
    encodingNote2: "Vérifiez l'étiquette ci-dessus — si elle indique",
    encodingNote3: "le texte est correct, seul l'affichage est erroné.",
    decoding: 'Décodage…', decodeBtn: "✦ Décoder avec l'IA → ADLaM Unicode",
    submitting: 'Envoi…', submittedQueue: 'Envoyé dans la file !', submitQueue: 'Envoyer dans la file du corpus',
    need3Words: 'Au moins 3 mots requis',
    draftCount: 'Brouillons', verifiedCount: 'Vérifiés',
    seeding: 'Insertion…', seedFromJson: 'Insérer depuis JSON', seed50: 'Insérer 50 termes depuis JSON', exportJson: 'Exporter JSON',
    dictErrorHint: '— déployez firestore.rules puis rechargez.',
    addNewTerm: 'Ajouter un terme',
    typeAdlamPlaceholder: '𞤢𞤣𞤤𞤢𞤥 — écrivez en ADLaM ici',
    adlamDetected: '✓ Écriture ADLaM détectée',
    adlamNotDetected: '✗ Écrivez en ADLaM — caractères non reconnus comme ADLaM',
    englishLatin: 'Anglais / latin',
    adding: 'Ajout…', added: 'Ajouté !', addToDict: '+ Ajouter au dictionnaire',
    noTerms: 'Aucun terme pour l’instant.',
    adlamScriptPlaceholder: 'Écriture ADLaM…', frTranslation: 'Traduction française', domainPlaceholder: 'domaine',
    verify: 'Vérifier', unverify: 'Invalider',
    del: 'Supprimer', deleteConfirm: 'Supprimer définitivement ? Action irréversible.', deleteYes: 'Oui, supprimer', restore: 'Remettre en file',
    results: 'résultats', noSubmissions: 'Aucune soumission',
    contributorAudio: 'Audio du contributeur', verifiedAudio: '✓ Audio pulaar vérifié',
    adlamEquivalent: 'Équivalent ADLaM',
    writeAdlamPlaceholder: '𞤢𞤣𞤤𞤢𞤥… écrivez l’ADLaM ici',
    recordPulaar: 'Enregistrer la prononciation pulaar (optionnel)',
    saveAdlamQueue: "Enregistrer l'ADLaM → file", saveEdit: 'Enregistrer', completeAdlam: "✏️ Compléter l'ADLaM",
    loadMore: 'Charger plus', remaining: 'restants',
    pulaarLatin: 'Pulaar (latin) :',
    statusLabels: { all: 'tous', needs_adlam: 'ADLaM requis', pending: 'en attente', verified: 'vérifié', rejected: 'rejeté' } as Record<string, string>,
    dictFilterLabels: { all: 'tous', draft: 'brouillon', verified: 'vérifié' } as Record<string, string>,
  },
};

export function AdminPortal({ user, langCode = 'en' }: { user: User; langCode?: 'ff-adlm' | 'en' | 'fr' }) {
  // ADLaM admin strings pending native review — falls back to English for now.
  const L = langCode === 'fr' ? ADMIN_I18N.fr : ADMIN_I18N.en;
  const [tab, setTab] = useState<Tab>('queue');

  /* ── TRANSLITERATOR STATE ── */
  const [trLatin, setTrLatin] = useState('');
  const [trAdlam, setTrAdlam] = useState('');

  /* ── RUNTIME CONTROLS STATE ── live config/runtime kill switches */
  const [runtimeCfg, setRuntimeCfg] = useState({ limitsEnabled: true, sharedKeyEnabled: true });
  const [cfgSaving, setCfgSaving] = useState<string | null>(null);
  useEffect(() => onSnapshot(doc(db, 'config', 'runtime'), snap => {
    const d = snap.data() ?? {};
    setRuntimeCfg({ limitsEnabled: d.limitsEnabled !== false, sharedKeyEnabled: d.sharedKeyEnabled !== false });
  }, err => console.error('runtime config subscribe error:', err)), []);
  const setRuntimeFlag = async (key: 'limitsEnabled' | 'sharedKeyEnabled', value: boolean) => {
    setCfgSaving(key);
    try {
      await setDoc(doc(db, 'config', 'runtime'), { [key]: value, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.error('runtime config write error:', e);
    } finally {
      setCfgSaving(null);
    }
  };

  /* ── TOKEN USAGE STATE ── reads usage_tokens (server-written) */
  type UsageDoc = { day?: string; uid?: string; inTok?: number; outTok?: number; total?: number; calls?: number; byModel?: Record<string, number>; byKind?: Record<string, number> };
  const [usageTrend, setUsageTrend] = useState<UsageDoc[]>([]);
  const [usageUsers, setUsageUsers] = useState<UsageDoc[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  useEffect(() => {
    if (tab !== 'usage') return;
    setUsageLoading(true);
    (async () => {
      try {
        const days = [...Array(7)].map((_, i) => {
          const d = new Date(); d.setUTCDate(d.getUTCDate() - i);
          return d.toISOString().slice(0, 10);
        });
        // 7-day global totals — one doc per day, id = the date (no uid suffix).
        const trendSnaps = await Promise.all(days.map(dy => getDoc(doc(db, 'usage_tokens', dy))));
        setUsageTrend(trendSnaps.map((s, i) => ({ day: days[i], ...(s.exists() ? s.data() as UsageDoc : {}) })));
        // Today's per-user docs (id = `${day}_${uid}`), ranked by spend.
        const usnap = await getDocs(query(collection(db, 'usage_tokens'), where('day', '==', days[0])));
        setUsageUsers(usnap.docs.map(d => d.data() as UsageDoc)
          .filter(x => x.uid).sort((a, b) => (b.total ?? 0) - (a.total ?? 0)).slice(0, 8));
      } catch (e) {
        console.error('usage load error:', e);
      } finally {
        setUsageLoading(false);
      }
    })();
  }, [tab]);

  /* ── VOICE DATA STATE ── */
  const VOICE_GOAL = 1000;
  const [voiceCount, setVoiceCount] = useState<number | null>(null);
  const [voiceClips, setVoiceClips] = useState<Submission[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  useEffect(() => {
    if (tab !== 'voice') return;
    setVoiceLoading(true);
    (async () => {
      try {
        // Count every recorded clip (instructor readings), then list the latest verified pairs.
        const cnt = await getCountFromServer(query(collection(db, 'corpus_submissions'), where('pulaar_audio_url', '>', '')));
        const snap = await getDocs(query(collection(db, 'corpus_submissions'), where('status', '==', 'verified'), limit(300)));
        const clips = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Submission))
          .filter(s => s.pulaar_audio_url || s.audio_url);
        setVoiceCount(cnt.data().count);
        setVoiceClips(clips);
      } catch (e) {
        console.error('voice data load error:', e);
        setVoiceCount(0);
      } finally {
        setVoiceLoading(false);
      }
    })();
  }, [tab]);
  const exportVoiceDataset = () => {
    // JSONL: one training pair per line; the fine-tune script downloads audio_url later.
    const jsonl = voiceClips.map(s => JSON.stringify({
      id: s.id,
      audio_url: s.pulaar_audio_url || s.audio_url,
      text_adlam: s.adlam_text || s.raw_text,
      text_latin: adlamToLatin(s.adlam_text || s.raw_text),
      domain: s.domain,
      verified_by: s.verified_by,
    })).join('\n');
    const url = URL.createObjectURL(new Blob([jsonl], { type: 'application/jsonl' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `gando-voice-dataset-${new Date().toISOString().slice(0, 10)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── QUEUE STATE ── */
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [corpusError, setCorpusError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionStatus>('pending');
  const [sourceFilter, setSourceFilter] = useState<'all' | string>('all');
  // verified/rejected docs aren't in the live review listeners — fetch on demand.
  const [filterDocs, setFilterDocs] = useState<Submission[] | null>(null);
  useEffect(() => {
    if (statusFilter !== 'verified' && statusFilter !== 'rejected') {
      setFilterDocs(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'corpus_submissions'),
          where('status', '==', statusFilter),
          limit(300),
        ));
        if (!cancelled) setFilterDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
      } catch (e) {
        console.error('filter load error:', e);
        if (!cancelled) setFilterDocs([]);
      }
    })();
    return () => { cancelled = true; };
  }, [statusFilter]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<SubmissionDomain>('casual');
  // Shared category list (seed + instructor-added), same source as the Collector.
  const [adminCategories, setAdminCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  useEffect(() => onSnapshot(collection(db, 'corpus_categories'), snap => {
    setAdminCategories(mergeCategories(snap.docs.map(d => d.data() as Category)));
  }, () => {/* keep defaults on error */}), []);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);   // rejected-item delete confirm
  const [editText, setEditText] = useState<string>('');
  const [editAudio, setEditAudio] = useState<Blob | null>(null);
  // Cap how many review cards render at once — prevents thousands of DOM nodes
  // (4k+ pending) from freezing the page, especially on mobile.
  const [visibleCount, setVisibleCount] = useState(40);
  useEffect(() => { setVisibleCount(40); }, [statusFilter, sourceFilter]);

  /* ── UPLOAD STATE ── */
  const [results, setResults] = useState<PdfResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── DICTIONARY STATE ── */
  const [dictTerms, setDictTerms] = useState<DictTerm[]>([]);
  const [dictLoading, setDictLoading] = useState(true);
  const [dictFilter, setDictFilter] = useState<'all' | DictStatus>('all');
  const [dictEditingId, setDictEditingId] = useState<string | null>(null);
  const [dictEditAdlam, setDictEditAdlam] = useState('');
  const [dictEditFr, setDictEditFr] = useState('');
  const [dictEditDomain, setDictEditDomain] = useState('');
  const [dictActionLoading, setDictActionLoading] = useState<string | null>(null);
  const [dictSeeding, setDictSeeding] = useState(false);
  const [dictError, setDictError] = useState<string | null>(null);
  const [addAdlam, setAddAdlam] = useState('');
  const [addLatin, setAddLatin] = useState('');
  const [addFr, setAddFr] = useState('');
  const [addDomain, setAddDomain] = useState('general');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  /* ── PASTE STATE ── */
  const [pasteText, setPasteText] = useState('');
  const [pasteDomain, setPasteDomain] = useState<SubmissionDomain>('casual');
  const [pasteSource, setPasteSource] = useState('text_upload');
  const [pasteSubmitting, setPasteSubmitting] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [pasteDecoding, setPasteDecoding] = useState(false);
  const pasteRatio = adlamRatio(pasteText);
  const pasteWords = pasteText.trim().split(/\s+/).filter(Boolean).length;

  /* ── COMMUNITY STATE ── */
  const [communityProjects, setCommunityProjects] = useState<Project[]>([]);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [communityActionId, setCommunityActionId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'projects'), where('shareStatus', '==', 'pending'));
    return onSnapshot(q,
      snap => { setCommunityProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project))); setCommunityLoading(false); },
      () => setCommunityLoading(false));
  }, []);

  const approveShare = async (id: string) => {
    setCommunityActionId(id);
    try { await updateDoc(doc(db, 'projects', id), { featured: true, shareStatus: 'approved' }); }
    finally { setCommunityActionId(null); }
  };
  const rejectShare = async (id: string) => {
    setCommunityActionId(id);
    try { await updateDoc(doc(db, 'projects', id), { featured: false, shareStatus: 'rejected' }); }
    finally { setCommunityActionId(null); }
  };

  function codeRangeLabel(text: string): string {
    const sample = [...text.replace(/\s/g, '')].slice(0, 5);
    if (!sample.length) return '';
    const points = sample.map(c => c.codePointAt(0) ?? 0);
    const inAdlam  = points.filter(p => p >= 0x1E900 && p <= 0x1E95F).length;
    const inArabic = points.filter(p => p >= 0x0600 && p <= 0x06FF).length;
    const inArabPF = points.filter(p => p >= 0xFB50 && p <= 0xFEFF).length;
    const hex = `U+${points[0].toString(16).toUpperCase().padStart(4,'0')}`;
    if (inAdlam  > 0) return `✓ Unicode ADLaM (${hex})`;
    if (inArabic > 0) return `Arabic block (${hex}) — pre-Unicode font`;
    if (inArabPF > 0) return `Arabic Pres. Forms (${hex}) — pre-Unicode font`;
    return `Unknown range (${hex})`;
  }

  useEffect(() => {
    // Two listeners merged client-side so ALL pending submissions are always
    // visible (review queue), plus the 100 most-recent of any status for context.
    // Neither query uses where+orderBy together, so no composite index is needed.
    let pendingDocs: Submission[] = [];
    let needsAdlamDocs: Submission[] = [];
    let recentDocs: Submission[] = [];
    const millis = (s: Submission) => (s.submitted_at as any)?.toMillis?.() ?? 0;
    const recompute = () => {
      const m = new Map<string, Submission>();
      recentDocs.forEach(s => m.set(s.id, s));
      needsAdlamDocs.forEach(s => m.set(s.id, s));
      pendingDocs.forEach(s => m.set(s.id, s));
      setSubmissions([...m.values()].sort((a, b) => millis(b) - millis(a)));
    };
    const toSub = (d: any) => ({ id: d.id, ...d.data() } as Submission);
    const onErr = (err: any) => { setCorpusError(err.message); setLoading(false); };

    // Three single-field listeners merged client-side — none uses where+orderBy
    // together, so no composite index is needed. needs_adlam = contributor gave
    // a gloss/audio but no ADLaM yet; instructors complete those.
    // Cap the pending listener: loading ALL pending docs (thousands) live froze
    // the tab and made the counter flicker. 500 is plenty to review at a time;
    // the true totals come from getCountFromServer (refreshCounts), not this list.
    const qPending = query(collection(db, 'corpus_submissions'), where('status', '==', 'pending'), limit(500));
    const qNeeds = query(collection(db, 'corpus_submissions'), where('status', '==', 'needs_adlam'), limit(500));
    const qRecent = query(collection(db, 'corpus_submissions'), orderBy('submitted_at', 'desc'), limit(100));
    const unsubP = onSnapshot(qPending, snap => { pendingDocs = snap.docs.map(toSub); recompute(); setLoading(false); }, onErr);
    const unsubN = onSnapshot(qNeeds, snap => { needsAdlamDocs = snap.docs.map(toSub); recompute(); setLoading(false); }, onErr);
    const unsubR = onSnapshot(qRecent, snap => { recentDocs = snap.docs.map(toSub); recompute(); setLoading(false); }, onErr);
    return () => { unsubP(); unsubN(); unsubR(); };
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'adlam_dict'), orderBy('latin', 'asc'));
    const unsub = onSnapshot(q,
      snap => {
        setDictTerms(snap.docs.map(d => ({ id: d.id, ...d.data() } as DictTerm)));
        setDictLoading(false);
      },
      err => {
        setDictError(err.message);
        setDictLoading(false);
      }
    );
    return unsub;
  }, []);

  const filtered = (filterDocs ?? submissions).filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && s.source !== sourceFilter) return false;
    return true;
  });

  // Accurate totals from the server (aggregation query — one cheap read each,
  // no docs downloaded). The capped listener above can't be trusted for counts.
  const [stats, setStats] = useState({ needs_adlam: 0, pending: 0, verified: 0, rejected: 0 });
  const refreshCounts = useCallback(async () => {
    try {
      const c = collection(db, 'corpus_submissions');
      const [n, p, v, r] = await Promise.all([
        getCountFromServer(query(c, where('status', '==', 'needs_adlam'))),
        getCountFromServer(query(c, where('status', '==', 'pending'))),
        getCountFromServer(query(c, where('status', '==', 'verified'))),
        getCountFromServer(query(c, where('status', '==', 'rejected'))),
      ]);
      setStats({
        needs_adlam: n.data().count, pending: p.data().count,
        verified: v.data().count, rejected: r.data().count,
      });
    } catch (e) {
      console.error('count refresh error:', e);
    }
  }, []);
  useEffect(() => { refreshCounts(); }, [refreshCounts]);

  /* ── QUEUE ACTIONS ── */
  async function approve(id: string) {
    setActionLoading(id);
    await updateDoc(doc(db, 'corpus_submissions', id), {
      status: 'verified',
      domain: selectedDomain,
      verified_by: user.uid,
      verified_at: serverTimestamp(),
    });
    setApprovingId(null);
    setActionLoading(null);
    refreshCounts();
  }

  async function saveEdit(id: string, prevStatus: SubmissionStatus) {
    const adlam = editText.trim();
    // Need either an ADLaM transcription or a recorded Pulaar pronunciation.
    if (!adlam && !editAudio) return;
    setActionLoading(id);
    try {
      let pulaar_audio_url: string | null = null;
      if (editAudio) {
        const ext = editAudio.type.includes('mp4') ? 'mp4' : editAudio.type.includes('ogg') ? 'ogg' : 'webm';
        const name = `pulaar_${id}_${Date.now()}.${ext}`;
        const audioRef = ref(storage, `collector/${user.uid}/${name}`);
        await uploadBytes(audioRef, editAudio, { contentType: editAudio.type || 'audio/webm' });
        pulaar_audio_url = await getDownloadURL(audioRef);
      }

      const patch: Record<string, any> = {
        edited_by: user.uid,
        edited_at: serverTimestamp(),
      };
      if (adlam) {
        patch.adlam_text = adlam;
        patch.raw_text = adlam;          // keep legacy field in sync
        patch.adlam_ratio = adlamRatio(adlam);
        // Completing a needs_adlam entry moves it into the normal review queue.
        if (prevStatus === 'needs_adlam') patch.status = 'pending';
      }
      if (pulaar_audio_url) patch.pulaar_audio_url = pulaar_audio_url;

      await updateDoc(doc(db, 'corpus_submissions', id), patch);
    } catch (err) {
      setCorpusError(String(err instanceof Error ? err.message : err));
    } finally {
      setEditingId(null);
      setEditText('');
      setEditAudio(null);
      setActionLoading(null);
      refreshCounts();
    }
  }

  async function reject(id: string) {
    setActionLoading(id);
    await updateDoc(doc(db, 'corpus_submissions', id), {
      status: 'rejected',
      verified_by: user.uid,
      verified_at: serverTimestamp(),
    });
    setActionLoading(null);
    refreshCounts();
  }

  // Move a verified/rejected item back to the pending queue.
  async function moveToPending(id: string) {
    setActionLoading(id);
    await updateDoc(doc(db, 'corpus_submissions', id), { status: 'pending' });
    setActionLoading(null);
    refreshCounts();
  }

  // Permanently delete a rejected item (two-step: click Delete → Confirm).
  async function deleteSubmission(id: string) {
    setActionLoading(id);
    try {
      await deleteDoc(doc(db, 'corpus_submissions', id));
    } catch (err) {
      setCorpusError('Delete failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeletingId(null);
      setActionLoading(null);
      refreshCounts();
    }
  }

  function exportJSONL() {
    const verified = submissions.filter(s => s.status === 'verified');
    const lines = verified.map(s => JSON.stringify({
      text: s.raw_text,
      source: s.source,
      domain: s.domain,
      adlam_ratio: s.adlam_ratio,
      word_count: s.word_count,
    })).join('\n');
    const blob = new Blob([lines], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adlam_corpus_${new Date().toISOString().slice(0, 10)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── DICTIONARY ACTIONS ── */
  async function seedDictFromJson() {
    setDictSeeding(true);
    const terms = (adlamDictData as any).terms as Array<{ adlam: string; latin: string; fr: string; domain: string }>;
    for (const term of terms) {
      await setDoc(doc(db, 'adlam_dict', term.latin), {
        adlam: term.adlam,
        latin: term.latin,
        fr: term.fr,
        domain: term.domain,
        status: 'draft',
        verified_by: null,
        verified_at: null,
      }, { merge: true });
    }
    setDictSeeding(false);
  }

  async function verifyTerm(id: string) {
    setDictActionLoading(id);
    await updateDoc(doc(db, 'adlam_dict', id), {
      status: 'verified',
      verified_by: user.uid,
      verified_at: serverTimestamp(),
    });
    setDictActionLoading(null);
  }

  async function unverifyTerm(id: string) {
    setDictActionLoading(id);
    await updateDoc(doc(db, 'adlam_dict', id), {
      status: 'draft',
      verified_by: null,
      verified_at: null,
    });
    setDictActionLoading(null);
  }

  async function saveEditDict(id: string) {
    if (!dictEditAdlam.trim()) return;
    setDictActionLoading(id);
    await updateDoc(doc(db, 'adlam_dict', id), {
      adlam: dictEditAdlam.trim(),
      fr: dictEditFr.trim(),
      domain: dictEditDomain,
      status: 'draft',
      verified_by: null,
      verified_at: null,
    });
    setDictEditingId(null);
    setDictActionLoading(null);
  }

  function exportDictJSON() {
    const verified = dictTerms.filter(t => t.status === 'verified');
    const data = {
      _meta: { description: 'Verified ADLaM technical dictionary', updated: new Date().toISOString().slice(0, 10) },
      terms: verified.map(({ adlam, latin, fr, domain }) => ({ adlam, latin, fr, domain, status: 'verified' })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adlam_dict_verified_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function addTerm() {
    if (!addAdlam.trim() || !addLatin.trim()) return;
    setAddSubmitting(true);
    await setDoc(doc(db, 'adlam_dict', addLatin.trim().toLowerCase()), {
      adlam: addAdlam.trim(),
      latin: addLatin.trim().toLowerCase(),
      fr: addFr.trim(),
      domain: addDomain,
      status: 'draft',
      verified_by: null,
      verified_at: null,
    }, { merge: false });
    setAddAdlam('');
    setAddLatin('');
    setAddFr('');
    setAddDomain('general');
    setAddSubmitting(false);
    setAddSuccess(true);
    setTimeout(() => setAddSuccess(false), 2500);
  }

  /* ── PASTE SUBMIT ── */
  async function submitPaste() {
    if (!pasteText.trim() || pasteWords < 3) return;
    setPasteSubmitting(true);
    // adlam_ratio=0 means pre-Unicode font encoding — still save, tag for later decoding
    const needsDecoding = pasteRatio < 0.05 && pasteWords >= 3;
    await addDoc(collection(db, 'corpus_submissions'), {
      source: pasteSource,
      raw_text: pasteText.trim(),
      adlam_ratio: pasteRatio,
      word_count: pasteWords,
      status: 'pending',
      domain: pasteDomain,
      submitted_at: serverTimestamp(),
      verified_by: null,
      verified_at: null,
      source_meta: { submitted_by: user.email, needs_decoding: needsDecoding },
      file_url: null,
    });
    setPasteText('');
    setPasteSubmitting(false);
    setPasteSuccess(true);
    setTimeout(() => setPasteSuccess(false), 3000);
    refreshCounts();
  }

  async function decodeWithAI() {
    if (!pasteText.trim()) return;
    setPasteDecoding(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: pasteText }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { decoded } = await res.json() as { decoded: string };
      if (decoded) setPasteText(decoded);
    } catch (err) {
      alert('Decode failed: ' + String(err));
    } finally {
      setPasteDecoding(false);
    }
  }

  /* ── PDF / IMAGE UPLOAD ACTIONS ── */
  async function processPdfs(files: File[]) {
    const uploads = files.filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'));
    if (!uploads.length) return;
    setProcessing(true);

    for (const file of uploads) {
      const id = crypto.randomUUID();
      setResults(prev => [...prev, {
        fileName: file.name, text: '', adlam_ratio: 0,
        word_count: 0, pages: 0, file_url: '', status: 'ready',
      }]);

      try {
        // 1. Upload to Storage
        const storageRef = ref(storage, `corpus/${Date.now()}_${file.name}`);
        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, file);
          task.on('state_changed', null, reject, resolve);
        });
        const file_url = await getDownloadURL(storageRef);

        const patchRow = (patch: Partial<PdfResult>) => setResults(prev => prev.map(r =>
          r.fileName === file.name ? { ...r, ...patch } : r
        ));

        // Direct image upload (JPG/PNG): one image = one page, OCR straight away.
        if (file.type.startsWith('image/')) {
          patchRow({ status: 'ready', error: 'Running Gemini OCR…' });
          const token = await auth.currentUser?.getIdToken();
          if (!token) throw new Error('Not authenticated');
          const base64 = await fileToBase64(file);
          const text = await ocrOneImage(base64, token, file.type);
          const cWords = text.trim().split(/\s+/).filter(Boolean).length;
          const cRatio = adlamRatio(text);
          if (cWords >= 3) {
            await addDoc(collection(db, 'corpus_submissions'), {
              source: 'pdf', raw_text: text, adlam_ratio: cRatio, word_count: cWords,
              status: 'pending', domain: null, submitted_at: serverTimestamp(),
              verified_by: null, verified_at: null,
              source_meta: { file_name: file.name, ocr: true, low_adlam: cRatio < 0.1, image: true },
              file_url,
            });
            patchRow({ status: 'done', text: text.slice(0, 300), adlam_ratio: cRatio, word_count: cWords, pages: 1, file_url, error: `Saved ${cWords} words.` });
            refreshCounts();
          } else {
            patchRow({ status: 'error', error: 'Gemini returned almost no text. Image may be blank or unreadable.' });
          }
          continue;   // next file
        }

        // 2. Extract digital text; decide whether OCR is needed.
        // Text-layer ADLaM almost always comes from broken pre-Unicode fonts →
        // garbage (boxes + jumbled glyphs) even at a high ADLaM ratio. Trust the
        // text layer only for clean Latin/French digital PDFs; for anything with
        // meaningful ADLaM, render + OCR each page (reliable, page-by-page).
        const extracted = await extractPdfText(file);
        const digitalRatio = adlamRatio(extracted.text);
        const digitalWords = extracted.text.trim().split(/\s+/).filter(Boolean).length;
        const needsOcr = digitalRatio === 0 || digitalWords < 10 || digitalRatio >= 0.3;

        if (needsOcr) {
          // OCR path: save each 10-page chunk to the queue as it finishes, so a
          // whole book never lives in one (over-1MB) doc and partial work survives.
          const setMsg = (msg: string) => patchRow({ status: 'ready', error: msg });
          setMsg('Running Gemini OCR…');
          let savedWords = 0;
          const summary = await ocrPdfWithGemini(file, setMsg, async (chunkText, fromPage, toPage) => {
            const cRatio = adlamRatio(chunkText);
            const cWords = chunkText.trim().split(/\s+/).filter(Boolean).length;
            await addDoc(collection(db, 'corpus_submissions'), {
              source: 'pdf',
              raw_text: chunkText,
              adlam_ratio: cRatio,
              word_count: cWords,
              status: 'pending',
              domain: null,
              submitted_at: serverTimestamp(),
              verified_by: null,
              verified_at: null,
              source_meta: { file_name: file.name, ocr: true, low_adlam: cRatio < 0.1, page_from: fromPage, page_to: toPage },
              file_url,
            });
            savedWords += cWords;
            patchRow({ word_count: savedWords, adlam_ratio: cRatio, text: chunkText.slice(0, 300) });
            refreshCounts();
          });

          if (summary.words === 0) {
            patchRow({ status: 'error', error: 'Gemini returned almost no text. PDF may be blank or unreadable.' });
          } else {
            const skipped = summary.failed ? ` (${summary.failed} pages skipped)` : '';
            patchRow({ status: 'done', pages: summary.pages, word_count: savedWords, file_url, error: `Saved ${savedWords} words${skipped}.` });
          }
        } else {
          // Digital text path: clean Latin/French — one save (these are small).
          const { text, pages } = extracted;
          patchRow({ text, adlam_ratio: digitalRatio, word_count: digitalWords, pages, file_url, error: undefined });
          if (digitalWords >= 3) {
            await addDoc(collection(db, 'corpus_submissions'), {
              source: 'pdf',
              raw_text: text,
              adlam_ratio: digitalRatio,
              word_count: digitalWords,
              status: 'pending',
              domain: null,
              submitted_at: serverTimestamp(),
              verified_by: null,
              verified_at: null,
              source_meta: { file_name: file.name, pages, ocr: false, low_adlam: digitalRatio < 0.1 },
              file_url,
            });
            patchRow({ status: 'done', error: digitalRatio < 0.1 ? 'Saved, but low ADLaM ratio — review in queue (may be Latin/pre-Unicode).' : undefined });
          } else {
            patchRow({ status: 'error', error: 'No readable text found. PDF may be blank or unreadable.' });
          }
        }
      } catch (err) {
        setResults(prev => prev.map(r =>
          r.fileName === file.name
            ? { ...r, status: 'error', error: String(err) }
            : r
        ));
      }
    }
    setProcessing(false);
    refreshCounts();
  }

  const sources = ['all', ...Array.from(new Set(submissions.map(s => s.source)))];

  return (
    //: the admin portal is an internal tool styled dark-only —
    // re-scoping the CSS vars here keeps it consistent when the app is in light mode.
    <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 md:p-8 space-y-6" style={{ fontFamily: MANROPE, background: 'var(--app-bg)', color: 'var(--text-primary)' }}>

      {/* header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] tracking-tighter">{L.title}</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">{L.subtitle}</p>
        </div>
        <button onClick={exportJSONL}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80 flex-shrink-0"
          style={{ background: 'var(--btn-bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
          <Download className="w-4 h-4" />
          {L.exportJsonl} ({stats.verified})
        </button>
      </div>

      {/* corpus error */}
      {corpusError && (
        <div className="rounded-xl px-4 py-3 text-xs font-bold"
          style={{ background: '#f8717120', border: '1px solid #f8717140', color: '#f87171' }}>
          {L.firestoreError} {corpusError}
        </div>
      )}

      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {([
          { label: L.statNeedsAdlam, value: stats.needs_adlam, color: '#bca2ff' },
          { label: L.statPending,  value: stats.pending,  color: '#fd8b00' },
          { label: L.statVerified, value: stats.verified, color: '#4ade80' },
          { label: L.statRejected, value: stats.rejected, color: '#f87171' },
        ] as const).map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-5 border border-[var(--border)]" style={{ background: 'var(--card-bg)' }}>
            <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest">{label}</p>
            <p className="text-3xl font-black mt-1" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-full sm:w-fit overflow-x-auto"
        style={{ background: 'var(--btn-bg)', border: '1px solid var(--border-subtle)' }}>
        {([
          { id: 'queue', label: L.tabQueue },
          { id: 'community', label: `${L.tabCommunity}${communityProjects.length ? ` (${communityProjects.length})` : ''}` },
          { id: 'upload', label: L.tabUpload },
          { id: 'paste', label: L.tabPaste },
          { id: 'dictionary', label: L.tabDictionary },
          { id: 'translit', label: L.tabTranslit },
          { id: 'voice', label: L.tabVoice },
          { id: 'usage', label: L.tabUsage },
          { id: 'controls', label: L.tabControls },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex-shrink-0"
            style={{
              background: tab === t.id ? 'var(--hover-bg)' : 'transparent',
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
              border: 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TRANSLITERATOR TAB ── */}
      {tab === 'translit' && (
        <div className="space-y-4 max-w-3xl">
          <p className="text-sm text-[var(--text-muted)]">{L.translitHint}</p>
          <div className="rounded-2xl border border-[var(--border)] p-4 space-y-4" style={{ background: 'var(--card-bg)' }}>
            <div>
              <label className="block text-xs font-black uppercase tracking-wide text-[var(--text-muted)] mb-1.5">{L.translitAdlam}</label>
              <textarea
                value={trAdlam}
                onChange={e => { setTrAdlam(e.target.value); setTrLatin(adlamToLatin(e.target.value)); }}
                rows={4}
                dir="rtl"
                spellCheck={false}
                placeholder="𞤆𞤵𞤤𞤢𞥄𞤪…"
                className="w-full rounded-xl px-4 py-3 text-xl outline-none resize-y"
                style={{ background: 'var(--app-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontFamily: 'var(--font-adlam)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wide text-[var(--text-muted)] mb-1.5">{L.translitLatin}</label>
              <textarea
                value={trLatin}
                onChange={e => { setTrLatin(e.target.value); setTrAdlam(latinToAdlam(e.target.value)); }}
                rows={4}
                spellCheck={false}
                placeholder="Pulaar e ɓamtaare…"
                className="w-full rounded-xl px-4 py-3 text-base outline-none resize-y"
                style={{ background: 'var(--app-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── CONTROLS TAB ── runtime kill switches */}
      {tab === 'controls' && (
        <div className="space-y-4 max-w-3xl">
          <p className="text-sm text-[var(--text-muted)]">{L.controlsHint}</p>
          {([
            { key: 'limitsEnabled' as const, on: runtimeCfg.limitsEnabled, title: L.controlsLimitsTitle, desc: L.controlsLimitsDesc },
            { key: 'sharedKeyEnabled' as const, on: runtimeCfg.sharedKeyEnabled, title: L.controlsKeyTitle, desc: L.controlsKeyDesc },
          ]).map(c => (
            <div key={c.key} className="rounded-2xl border border-[var(--border)] p-5 flex items-start justify-between gap-4"
              style={{ background: 'var(--card-bg)' }}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-[var(--text-primary)]">{c.title}</h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: c.on ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      color: c.on ? '#16a34a' : '#dc2626',
                    }}>
                    {c.on ? L.controlsActive : L.controlsPaused}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-muted)] mt-1.5">{c.desc}</p>
                {c.key === 'sharedKeyEnabled' && (
                  <p className="text-xs mt-2 px-2.5 py-1.5 rounded-lg"
                    style={{ background: 'rgba(253,139,0,0.1)', color: 'var(--text-muted)', border: '1px solid rgba(253,139,0,0.25)' }}>
                    {L.controlsKeyNote}
                  </p>
                )}
              </div>
              <button
                onClick={() => setRuntimeFlag(c.key, !c.on)}
                disabled={cfgSaving === c.key}
                aria-pressed={c.on}
                className="relative flex-shrink-0 rounded-full transition-all disabled:opacity-50"
                style={{
                  width: 56, height: 30,
                  background: c.on ? 'var(--brand, #3b82f6)' : 'var(--border)',
                }}>
                <span className="absolute top-1 rounded-full bg-white transition-all"
                  style={{ width: 22, height: 22, left: c.on ? 30 : 4 }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── USAGE TAB ── token spend from the backend */}
      {tab === 'usage' && (() => {
        const today = usageTrend[0] ?? {};
        const maxDay = Math.max(1, ...usageTrend.map(d => d.total ?? 0));
        const fmt = (n?: number) => (n ?? 0).toLocaleString();
        const entries = (m?: Record<string, number>) => Object.entries(m ?? {}).sort((a, b) => b[1] - a[1]);
        return (
          <div className="space-y-5 max-w-3xl">
            <p className="text-sm text-[var(--text-muted)]">{L.usageHint}</p>
            {usageLoading ? (
              <p className="text-sm text-[var(--text-muted)]">{L.usageLoading}</p>
            ) : (today.total ?? 0) === 0 && usageTrend.every(d => (d.total ?? 0) === 0) ? (
              <p className="text-sm text-[var(--text-muted)]">{L.usageNone}</p>
            ) : (
              <>
                {/* Today headline */}
                <div className="rounded-2xl border border-[var(--border)] p-5" style={{ background: 'var(--card-bg)' }}>
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)] mb-1">{L.usageToday}</div>
                  <div className="flex items-end gap-3 flex-wrap">
                    <span className="text-4xl font-black text-[var(--text-primary)]">{fmt(today.total)}</span>
                    <span className="text-sm text-[var(--text-muted)] mb-1">{L.usageTotal}</span>
                  </div>
                  <div className="text-sm text-[var(--text-muted)] mt-1">
                    {fmt(today.inTok)} {L.usageIn} · {fmt(today.outTok)} {L.usageOut} · {fmt(today.calls)} {L.usageCalls}
                  </div>
                </div>

                {/* By model + by route */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {([[L.usageByModel, today.byModel], [L.usageByKind, today.byKind]] as const).map(([title, m], i) => (
                    <div key={i} className="rounded-2xl border border-[var(--border)] p-4" style={{ background: 'var(--card-bg)' }}>
                      <div className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)] mb-2">{title}</div>
                      {entries(m).length === 0 ? (
                        <div className="text-sm text-[var(--text-muted)]">—</div>
                      ) : entries(m).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between text-sm py-0.5">
                          <span className="text-[var(--text-primary)] truncate mr-2">{k}</span>
                          <span className="text-[var(--text-muted)] flex-shrink-0">{fmt(v)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* 7-day trend */}
                <div className="rounded-2xl border border-[var(--border)] p-4" style={{ background: 'var(--card-bg)' }}>
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)] mb-3">{L.usageTrend}</div>
                  <div className="space-y-1.5">
                    {usageTrend.map(d => (
                      <div key={d.day} className="flex items-center gap-3 text-xs">
                        <span className="text-[var(--text-muted)] w-20 flex-shrink-0">{d.day?.slice(5)}</span>
                        <div className="flex-1 h-4 rounded" style={{ background: 'var(--app-bg)' }}>
                          <div className="h-4 rounded" style={{ width: `${((d.total ?? 0) / maxDay) * 100}%`, background: 'var(--brand, #3b82f6)', minWidth: (d.total ?? 0) > 0 ? 4 : 0 }} />
                        </div>
                        <span className="text-[var(--text-muted)] w-20 text-right flex-shrink-0">{fmt(d.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top users today */}
                {usageUsers.length > 0 && (
                  <div className="rounded-2xl border border-[var(--border)] p-4" style={{ background: 'var(--card-bg)' }}>
                    <div className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)] mb-2">{L.usageTopUsers}</div>
                    {usageUsers.map(u => (
                      <div key={u.uid} className="flex items-center justify-between text-sm py-0.5">
                        <span className="text-[var(--text-primary)] font-mono text-xs truncate mr-2">{u.uid?.slice(0, 14)}…</span>
                        <span className="text-[var(--text-muted)] flex-shrink-0">{fmt(u.total)} · {fmt(u.calls)} {L.usageCalls}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* ── VOICE DATA TAB ── */}
      {tab === 'voice' && (
        <div className="space-y-5 max-w-3xl">
          <p className="text-sm text-[var(--text-muted)]">{L.voiceHint}</p>
          {voiceLoading && voiceCount === null ? (
            <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm"><RefreshCw className="w-4 h-4 animate-spin" /> {L.loading}</div>
          ) : (() => {
            const ready = voiceClips.length;
            const awaiting = Math.max(0, (voiceCount ?? 0) - voiceClips.filter(s => s.pulaar_audio_url).length);
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: '#22c55e44' }}>
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-4xl font-black tabular-nums" style={{ color: '#4ade80' }}>{ready}</span>
                    <span className="text-sm font-bold text-[var(--text-muted)] pb-1.5">/ {VOICE_GOAL}</span>
                  </div>
                  <p className="text-xs font-bold text-[var(--text-muted)] mb-3">{L.voiceReadyLabel}</p>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--btn-bg)', border: '1px solid var(--border-subtle)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (ready / VOICE_GOAL) * 100)}%`, background: 'linear-gradient(90deg, #3b82f6, #fd8b00)', minWidth: ready ? 6 : 0 }} />
                  </div>
                </div>
                <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: '#fd8b0044' }}>
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-4xl font-black tabular-nums" style={{ color: '#fd8b00' }}>{awaiting}</span>
                  </div>
                  <p className="text-xs font-bold text-[var(--text-muted)]">{L.voiceAwaitingLabel}</p>
                </div>
              </div>
            );
          })()}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{L.voiceListTitle}</h3>
              {voiceClips.length > 0 && (
                <button onClick={exportVoiceDataset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all"
                  style={{ background: '#3b82f61a', color: '#3b82f6', border: '1px solid #3b82f633' }}>
                  <Download className="w-3.5 h-3.5" /> {L.voiceExport}
                </button>
              )}
            </div>
            {voiceClips.length === 0 && !voiceLoading ? (
              <div className="py-10 text-center text-[var(--text-faint)] text-sm">{L.voiceNone}</div>
            ) : (
              <div className="space-y-2">
                {voiceClips.map(s => (
                  <div key={s.id} className="rounded-xl border border-[var(--border-subtle)] p-3 flex flex-col sm:flex-row sm:items-center gap-3" style={{ background: 'var(--card-bg)' }}>
                    <audio controls preload="none" src={s.pulaar_audio_url || s.audio_url || undefined} className="h-9 w-full sm:w-64 flex-shrink-0" />
                    <p dir="rtl" className="flex-1 text-base text-[var(--text-primary)] leading-relaxed break-words" style={{ fontFamily: 'var(--font-adlam)' }}>
                      {s.adlam_text || s.raw_text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── COMMUNITY TAB ── */}
      {tab === 'community' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">{L.communityHint}</p>
          {communityLoading ? (
            <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm"><RefreshCw className="w-4 h-4 animate-spin" /> {L.loading}</div>
          ) : communityProjects.length === 0 ? (
            <div className="py-16 text-center text-[var(--text-faint)] text-sm">{L.noProjects}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {communityProjects.map(cp => (
                <div key={cp.id} className="rounded-2xl border border-[var(--border)] overflow-hidden" style={{ background: 'var(--card-bg)' }}>
                  <ProjectThumb code={cp.code} height={200} />
                  <div className="p-4">
                    <h3 className="font-black text-[var(--text-primary)] text-sm mb-1 truncate">{cp.name}</h3>
                    <p className="text-[var(--text-muted)] text-xs line-clamp-2 mb-1">{cp.description}</p>
                    <p className="text-[10px] text-[var(--text-faint)] mb-3">{cp.language} · {L.owner} {cp.userId.slice(0, 8)}…</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => approveShare(cp.id)} disabled={communityActionId === cp.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition-all"
                        style={{ background: '#22c55e1a', color: '#4ade80', border: '1px solid #22c55e33' }}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> {L.approve}
                      </button>
                      <button onClick={() => rejectShare(cp.id)} disabled={communityActionId === cp.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition-all"
                        style={{ background: '#ef44441a', color: '#f87171', border: '1px solid #ef444433' }}>
                        <XCircle className="w-3.5 h-3.5" /> {L.reject}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── UPLOAD TAB ── */}
      {tab === 'upload' && (
        <div className="space-y-4">
          {/* drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); processPdfs(Array.from(e.dataTransfer.files)); }}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
            style={{
              minHeight: 180,
              borderColor: dragOver ? P : 'var(--border)',
              background: dragOver ? `${P}08` : 'var(--card-bg)',
            }}>
            <Upload className="w-8 h-8" style={{ color: dragOver ? P : '#52525b' }} />
            <p className="text-sm font-bold text-[var(--text-muted)]">{L.dropPdfs}</p>
            <p className="text-xs text-[var(--text-faint)]">{L.dropHint}</p>
            <input ref={fileInputRef} type="file" accept=".pdf,image/*" multiple className="hidden"
              onChange={e => processPdfs(Array.from(e.target.files ?? []))} />
          </div>

          {/* results */}
          {results.length > 0 && (
            <div className="space-y-3">
              {results.map((r, i) => (
                <div key={i} className="rounded-2xl border border-[var(--border)] overflow-hidden"
                  style={{ background: 'var(--card-bg)' }}>
                  <div className="flex items-center gap-3 px-5 py-3">
                    <FileText className="w-4 h-4 flex-shrink-0" style={{ color: '#fd8b00' }} />
                    <span className="text-sm font-bold text-[var(--text-primary)] truncate flex-1">{r.fileName}</span>
                    {r.status === 'ready' && (
                      <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
                        {r.error && <span className="truncate max-w-[220px]">{r.error}</span>}
                        <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
                      </span>
                    )}
                    {r.status === 'done' && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {L.submitted}
                      </span>
                    )}
                    {r.status === 'error' && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                        <XCircle className="w-3.5 h-3.5" /> {L.failed}
                      </span>
                    )}
                    <button onClick={() => setResults(prev => prev.filter((_, j) => j !== i))}>
                      <X className="w-4 h-4 text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors" />
                    </button>
                  </div>

                  {r.status !== 'ready' && (
                    <div className="px-5 pb-4 space-y-2">
                      {r.status === 'error' ? (
                        <p className="text-xs text-red-400">{r.error}</p>
                      ) : (
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${ratioColor(r.adlam_ratio)}20`, color: ratioColor(r.adlam_ratio) }}>
                            𞤀𞤁𞤂 {Math.round(r.adlam_ratio * 100)}%
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">{r.word_count} {L.words}</span>
                          <span className="text-xs text-[var(--text-muted)]">{r.pages} {L.pages}</span>
                        </div>
                      )}
                      {r.text && r.adlam_ratio > 0 && (
                        <p className="text-sm text-[var(--text-muted)] line-clamp-3 font-adlam" dir="rtl">
                          {r.text.slice(0, 300)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PASTE TAB ── */}
      {tab === 'paste' && (
        <div className="space-y-4 max-w-2xl">
          {/* textarea */}
          <div className="rounded-2xl border border-[var(--border)] overflow-hidden" style={{ background: 'var(--card-bg)' }}>
            <div className="px-5 pt-4 pb-2 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{L.adlamText}</span>
              <div className="flex items-center gap-3 flex-wrap">
                {pasteText.length > 0 && (
                  <>
                    <span className="text-xs font-mono px-2 py-0.5 rounded"
                      style={{ background: 'var(--btn-bg)', color: pasteRatio > 0.05 ? '#4ade80' : '#fd8b00' }}>
                      {codeRangeLabel(pasteText)}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${ratioColor(pasteRatio)}20`, color: ratioColor(pasteRatio) }}>
                      𞤀𞤁𞤂 {Math.round(pasteRatio * 100)}%
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{pasteWords} {L.words}</span>
                  </>
                )}
              </div>
            </div>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={L.pastePlaceholder}
              className="w-full bg-transparent outline-none resize-none text-[var(--text-primary)] placeholder-[var(--text-faint)] px-5 py-4"
              style={{
                minHeight: 220, fontSize: 15, lineHeight: 1.7,
                direction: 'rtl',
                fontFamily: '"Noto Sans Adlam", "ADLaM Display", serif',
              }}
            />
          </div>

          {/* metadata row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--border)] p-4 space-y-2" style={{ background: 'var(--card-bg)' }}>
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{L.domain}</p>
              <div className="flex flex-wrap gap-1.5">
                {adminCategories.map(c => (
                  <button key={c.slug} onClick={() => setPasteDomain(c.slug)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: pasteDomain === c.slug ? `${domColor(c.slug)}25` : 'rgba(255,255,255,0.04)',
                      color: pasteDomain === c.slug ? domColor(c.slug) : '#52525b',
                      border: `1px solid ${pasteDomain === c.slug ? domColor(c.slug) + '50' : 'transparent'}`,
                    }}>
                    {categoryLabel(c, langCode)}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] p-4 space-y-2" style={{ background: 'var(--card-bg)' }}>
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{L.source}</p>
              <div className="flex flex-wrap gap-1.5">
                {(['text_upload', 'telegram', 'pdf', 'collector'] as const).map(s => (
                  <button key={s} onClick={() => setPasteSource(s)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: pasteSource === s ? `${SOURCE_COLORS[s] ?? '#fff'}25` : 'rgba(255,255,255,0.04)',
                      color: pasteSource === s ? (SOURCE_COLORS[s] ?? '#fff') : '#52525b',
                      border: `1px solid ${pasteSource === s ? (SOURCE_COLORS[s] ?? '#fff') + '50' : 'transparent'}`,
                    }}>
                    {L.statusLabels[s] ?? s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* encoding warning + decode */}
          {pasteWords >= 3 && pasteRatio < 0.05 && (
            <div className="rounded-xl px-4 py-3 text-xs flex flex-col gap-3"
              style={{ background: '#fd8b0015', border: '1px solid #fd8b0030', color: '#fd8b00' }}>
              <div className="flex items-start gap-2 font-bold">
                <span className="mt-0.5">⚠</span>
                <span>
                  {L.encodingWarning}
                  <span className="block font-normal opacity-70 mt-0.5">
                    {L.encodingNote}
                    {L.encodingNote2} <code>U+1E9xx</code> {L.encodingNote3}
                  </span>
                </span>
              </div>
              <button
                onClick={decodeWithAI}
                disabled={pasteDecoding}
                className="self-start flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all disabled:opacity-50"
                style={{ background: '#fd8b0025', color: '#fd8b00', border: '1px solid #fd8b0050' }}>
                {pasteDecoding
                  ? <><RefreshCw className="w-3 h-3 animate-spin" /> {L.decoding}</>
                  : <>{L.decodeBtn}</>}
              </button>
            </div>
          )}

          {/* submit */}
          <button
            onClick={submitPaste}
            disabled={pasteSubmitting || pasteWords < 3}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all disabled:opacity-40"
            style={{ background: pasteSuccess ? '#4ade8030' : 'var(--gradient-brand)', color: pasteSuccess ? '#4ade80' : '#000' }}>
            {pasteSubmitting ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> {L.submitting}</>
            ) : pasteSuccess ? (
              <><CheckCircle2 className="w-4 h-4" /> {L.submittedQueue}</>
            ) : (
              <><Upload className="w-4 h-4" /> {L.submitQueue}</>
            )}
          </button>
          {pasteWords > 0 && pasteWords < 3 && (
            <p className="text-xs text-[var(--text-faint)]">{L.need3Words}</p>
          )}
        </div>
      )}

      {/* ── DICTIONARY TAB ── */}
      {tab === 'dictionary' && (
        <div className="space-y-4">
          {/* header */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold" style={{ color: '#fd8b00' }}>
                {L.draftCount}: {dictTerms.filter(t => t.status === 'draft').length}
              </span>
              <span className="text-xs font-bold" style={{ color: '#4ade80' }}>
                {L.verifiedCount}: {dictTerms.filter(t => t.status === 'verified').length}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {dictTerms.length === 0 && (
                <button onClick={seedDictFromJson} disabled={dictSeeding}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ background: '#bca2ff20', color: '#bca2ff', border: '1px solid #bca2ff40' }}>
                  {dictSeeding
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> {L.seeding}</>
                    : <><BookMarked className="w-3.5 h-3.5" /> {L.seedFromJson}</>}
                </button>
              )}
              <button onClick={exportDictJSON}
                disabled={dictTerms.filter(t => t.status === 'verified').length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80 disabled:opacity-40"
                style={{ background: 'var(--btn-bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                <Download className="w-4 h-4" />
                {L.exportJson} ({dictTerms.filter(t => t.status === 'verified').length})
              </button>
            </div>
          </div>

          {/* error */}
          {dictError && (
            <div className="rounded-xl px-4 py-3 text-xs font-bold"
              style={{ background: '#f8717120', border: '1px solid #f8717140', color: '#f87171' }}>
              {L.firestoreError} {dictError} {L.dictErrorHint}
            </div>
          )}

          {/* add term form */}
          <div className="rounded-2xl border border-[var(--border)] p-5 space-y-3" style={{ background: 'var(--card-bg)' }}>
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{L.addNewTerm}</p>
            <div className="space-y-1.5">
              <input
                value={addAdlam}
                onChange={e => setAddAdlam(e.target.value)}
                dir="rtl"
                placeholder={L.typeAdlamPlaceholder}
                className="w-full rounded-xl px-4 py-3 text-[var(--text-primary)] text-xl bg-[var(--input-bg)] outline-none transition-all"
                style={{
                  fontFamily: '"Noto Sans Adlam", serif',
                  border: addAdlam.trim() === ''
                    ? '1px solid rgba(59,130,246,0.25)'
                    : adlamRatio(addAdlam) >= 0.8
                      ? '1px solid #4ade80'
                      : '1px solid #f87171',
                }}
              />
              {addAdlam.trim() !== '' && (
                adlamRatio(addAdlam) >= 0.8 ? (
                  <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#4ade80' }}>
                    {L.adlamDetected}
                  </p>
                ) : (
                  <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#f87171' }}>
                    {L.adlamNotDetected}
                  </p>
                )
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input
                value={addLatin}
                onChange={e => setAddLatin(e.target.value)}
                placeholder={L.englishLatin}
                className="rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm bg-[var(--input-bg)] outline-none"
                style={{ border: '1px solid var(--border)' }}
              />
              <input
                value={addFr}
                onChange={e => setAddFr(e.target.value)}
                placeholder="Français"
                className="rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm bg-[var(--input-bg)] outline-none"
                style={{ border: '1px solid var(--border)' }}
              />
              <select
                value={addDomain}
                onChange={e => setAddDomain(e.target.value)}
                className="rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm outline-none"
                style={{ background: 'var(--card-elevated)', border: '1px solid var(--border)' }}>
                {['general','ui','ux','auth','data','infrastructure','design','layout','media','ecommerce','ai'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <button
              onClick={addTerm}
              disabled={addSubmitting || !addAdlam.trim() || !addLatin.trim() || adlamRatio(addAdlam) < 0.8}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all disabled:opacity-40"
              style={{ background: addSuccess ? '#4ade8030' : 'var(--gradient-brand)', color: addSuccess ? '#4ade80' : '#000' }}>
              {addSubmitting
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> {L.adding}</>
                : addSuccess
                  ? <><CheckCircle2 className="w-4 h-4" /> {L.added}</>
                  : L.addToDict}
            </button>
          </div>

          {/* filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
            style={{ background: 'var(--btn-bg)', border: '1px solid var(--border-subtle)' }}>
            {(['all', 'draft', 'verified'] as const).map(f => (
              <button key={f} onClick={() => setDictFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all"
                style={{
                  background: dictFilter === f ? 'var(--hover-bg)' : 'transparent',
                  color: dictFilter === f ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: 'none',
                }}>
                {L.dictFilterLabels[f] ?? f}
              </button>
            ))}
          </div>

          {/* list */}
          {dictLoading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 text-[var(--text-faint)] animate-spin" />
            </div>
          ) : dictTerms.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <p className="text-[var(--text-faint)] text-sm">{L.noTerms}</p>
              <button onClick={seedDictFromJson} disabled={dictSeeding}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-80 disabled:opacity-40 mx-auto"
                style={{ background: '#bca2ff20', color: '#bca2ff', border: '1px solid #bca2ff40' }}>
                {dictSeeding
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> {L.seeding}</>
                  : <><BookMarked className="w-3.5 h-3.5" /> {L.seed50}</>}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {dictTerms
                .filter(t => dictFilter === 'all' || t.status === dictFilter)
                .map(t => (
                  <div key={t.id} className="rounded-2xl border border-[var(--border)] overflow-hidden"
                    style={{ background: 'var(--card-bg)' }}>
                    <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
                      {dictEditingId === t.id ? (
                        <div className="flex-1 space-y-2">
                          <input
                            value={dictEditAdlam}
                            onChange={e => setDictEditAdlam(e.target.value)}
                            dir="rtl"
                            placeholder={L.adlamScriptPlaceholder}
                            className="w-full rounded-lg px-3 py-2 text-[var(--text-primary)] text-xl bg-[var(--input-bg)] outline-none"
                            style={{ fontFamily: '"Noto Sans Adlam", serif', border: '1px solid rgba(59,130,246,0.3)' }}
                          />
                          <div className="flex gap-2">
                            <input
                              value={dictEditFr}
                              onChange={e => setDictEditFr(e.target.value)}
                              placeholder={L.frTranslation}
                              className="flex-1 rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm bg-[var(--input-bg)] outline-none"
                              style={{ border: '1px solid var(--border)' }}
                            />
                            <input
                              value={dictEditDomain}
                              onChange={e => setDictEditDomain(e.target.value)}
                              placeholder={L.domainPlaceholder}
                              className="w-28 rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm bg-[var(--input-bg)] outline-none"
                              style={{ border: '1px solid var(--border)' }}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => saveEditDict(t.id)} disabled={dictActionLoading === t.id}
                              className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                              style={{ background: '#bca2ff20', color: '#bca2ff', border: '1px solid #bca2ff40' }}>
                              {L.save}
                            </button>
                            <button onClick={() => setDictEditingId(null)}
                              className="text-xs text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors px-2">
                              {L.cancel}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="text-xl min-w-0" dir="rtl"
                            style={{ fontFamily: '"Noto Sans Adlam", serif', color: 'var(--text-primary)' }}>
                            {t.adlam}
                          </span>
                          <span className="text-sm text-[var(--text-muted)]">·</span>
                          <span className="text-sm font-bold text-[var(--text-secondary)]">{t.latin}</span>
                          <span className="text-xs text-[var(--text-faint)]">→</span>
                          <span className="text-sm text-[var(--text-muted)]">{t.fr}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full ml-1"
                            style={{ background: 'var(--btn-bg)', color: '#71717a' }}>
                            {t.domain}
                          </span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: t.status === 'verified' ? '#4ade8020' : '#fd8b0020',
                              color: t.status === 'verified' ? '#4ade80' : '#fd8b00',
                            }}>
                            {t.status}
                          </span>
                          <div className="flex items-center gap-1.5 ml-auto">
                            <button
                              onClick={() => { setDictEditingId(t.id); setDictEditAdlam(t.adlam); setDictEditFr(t.fr); setDictEditDomain(t.domain); }}
                              className="px-2.5 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
                              style={{ background: 'var(--btn-bg)', color: '#71717a' }}>
                              {L.edit}
                            </button>
                            {t.status === 'draft' ? (
                              <button onClick={() => verifyTerm(t.id)} disabled={dictActionLoading === t.id}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                                style={{ background: '#4ade8020', color: '#4ade80', border: '1px solid #4ade8040' }}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> {L.verify}
                              </button>
                            ) : (
                              <button onClick={() => unverifyTerm(t.id)} disabled={dictActionLoading === t.id}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                                style={{ background: '#f8717120', color: '#f87171', border: '1px solid #f8717140' }}>
                                <XCircle className="w-3.5 h-3.5" /> {L.unverify}
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── QUEUE TAB ── */}
      {tab === 'queue' && (
        <>
          {/* filters */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 p-1 rounded-xl"
                style={{ background: 'var(--btn-bg)', border: '1px solid var(--border-subtle)' }}>
                {(['all', 'needs_adlam', 'pending', 'verified', 'rejected'] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all"
                    style={{
                      background: statusFilter === s ? 'var(--hover-bg)' : 'transparent',
                      color: statusFilter === s ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: 'none',
                    }}>
                    {L.statusLabels[s] ?? s}
                  </button>
                ))}
              </div>
              <span className="text-[var(--text-faint)] text-xs ml-auto">{filtered.length} {L.results}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sources.map(s => {
                const label = s === 'all' ? 'ALL' : s.replace('telegram:', '').slice(0, 18);
                return (
                  <button key={s} onClick={() => setSourceFilter(s)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide transition-all"
                    style={{
                      background: sourceFilter === s ? 'var(--hover-bg)' : 'var(--btn-bg)',
                      color: sourceFilter === s ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: `1px solid ${sourceFilter === s ? 'var(--border)' : 'var(--border-subtle)'}`,
                    }}
                    title={s}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* list */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 text-[var(--text-faint)] animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-[var(--text-faint)] text-sm">{L.noSubmissions}</div>
          ) : (
            <div className="space-y-3">
              {filtered.slice(0, visibleCount).map(s => (
                <div key={s.id} className="rounded-2xl border border-[var(--border)] overflow-hidden"
                  style={{ background: 'var(--card-bg)' }}>
                  <div className="flex items-center gap-2 flex-wrap px-4 md:px-5 py-3 border-b border-[var(--border-subtle)]">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${SOURCE_COLORS[s.source] ?? '#71717a'}20`, color: SOURCE_COLORS[s.source] ?? '#71717a' }}>
                      {s.source}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${ratioColor(s.adlam_ratio)}20`, color: ratioColor(s.adlam_ratio) }}>
                      𞤀𞤁𞤂 {Math.round(s.adlam_ratio * 100)}%
                    </span>
                    <span className="text-xs text-[var(--text-faint)]">{s.word_count ?? s.raw_text?.trim().split(/\s+/).filter(Boolean).length ?? 0} {L.words}</span>
                    {s.domain && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${domColor(s.domain)}20`, color: domColor(s.domain) }}>
                        {s.domain}
                      </span>
                    )}
                    <span className={cn('text-xs font-bold ml-auto px-2 py-0.5 rounded-full')}
                      style={{
                        background: s.status === 'verified' ? '#4ade8020' : s.status === 'rejected' ? '#f8717120' : s.status === 'needs_adlam' ? '#bca2ff20' : '#fd8b0020',
                        color: s.status === 'verified' ? '#4ade80' : s.status === 'rejected' ? '#f87171' : s.status === 'needs_adlam' ? '#bca2ff' : '#fd8b00',
                      }}>
                      {L.statusLabels[s.status] ?? s.status}
                    </span>
                  </div>

                  <div className="px-5 py-4 space-y-3">
                    {s.file_url && s.source_meta?.has_image && (
                      <a href={s.file_url} target="_blank" rel="noopener noreferrer" className="block">
                        <img
                          src={s.file_url}
                          alt="contributor submission"
                          loading="lazy"
                          className="max-h-72 rounded-xl border border-[var(--border)] object-contain hover:opacity-90 transition-opacity"
                        />
                      </a>
                    )}

                    {/* contributor glosses — what they knew the word as */}
                    {(s.gloss_en || s.gloss_fr || s.pulaar_latin) && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {s.gloss_en && (
                          <span className="px-2.5 py-1 rounded-lg" style={{ background: 'var(--btn-bg)', color: '#a1a1aa' }}>
                            🇬🇧 {s.gloss_en}
                          </span>
                        )}
                        {s.gloss_fr && (
                          <span className="px-2.5 py-1 rounded-lg" style={{ background: 'var(--btn-bg)', color: '#a1a1aa' }}>
                            🇫🇷 {s.gloss_fr}
                          </span>
                        )}
                        {s.pulaar_latin && (
                          <span className="px-2.5 py-1 rounded-lg font-bold" style={{ background: '#4ade8015', color: '#4ade80' }}>
                            {L.pulaarLatin} {s.pulaar_latin}
                          </span>
                        )}
                      </div>
                    )}

                    {/* audio: contributor + verified Pulaar */}
                    {s.audio_url && (
                      <div className="space-y-1">
                        <p className="text-xs text-[var(--text-faint)] uppercase tracking-widest font-bold">{L.contributorAudio}</p>
                        <audio src={s.audio_url} controls className="w-full" />
                      </div>
                    )}
                    {s.pulaar_audio_url && (
                      <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4ade80' }}>{L.verifiedAudio}</p>
                        <audio src={s.pulaar_audio_url} controls className="w-full" />
                      </div>
                    )}

                    {editingId === s.id ? (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#bca2ff' }}>
                            {L.adlamEquivalent}
                          </p>
                          <textarea
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            ref={el => {
                              // auto-grow with content, capped to 60vh (Claude-style)
                              if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.6) + 'px'; }
                            }}
                            onInput={e => {
                              const el = e.currentTarget;
                              el.style.height = 'auto';
                              el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.6) + 'px';
                            }}
                            placeholder={L.writeAdlamPlaceholder}
                            className="w-full rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] leading-relaxed resize-y"
                            dir="rtl"
                            style={{
                              fontFamily: '"Noto Sans Adlam", "ADLaM Display", serif',
                              fontSize: 18,
                              background: 'rgba(0,0,0,0.4)',
                              border: '1px solid rgba(59,130,246,0.3)',
                              outline: 'none',
                              minHeight: '40vh',
                              maxHeight: '60vh',
                              overflowY: 'auto',
                            }}
                          />
                        </div>
                        {/* admin records the proper Pulaar pronunciation */}
                        <AudioRecorder
                          value={editAudio}
                          onChange={setEditAudio}
                          label={L.recordPulaar}
                          accent="#4ade80"
                          disabled={actionLoading === s.id}
                        />
                      </div>
                    ) : (
                      s.raw_text && (
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-4" dir="rtl"
                          style={{ fontSize: 15, fontFamily: '"Noto Sans Adlam", "ADLaM Display", serif' }}>
                          {s.raw_text}
                        </p>
                      )
                    )}
                  </div>

                  <div className="px-5 pb-4 flex items-center gap-3 flex-wrap">
                    {editingId === s.id ? (
                      <>
                        <button onClick={() => saveEdit(s.id, s.status)} disabled={actionLoading === s.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: '#bca2ff20', color: '#bca2ff', border: '1px solid #bca2ff40' }}>
                          {actionLoading === s.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                          {s.status === 'needs_adlam' ? L.saveAdlamQueue : L.saveEdit}
                        </button>
                        <button onClick={() => { setEditingId(null); setEditText(''); setEditAudio(null); }}
                          className="text-xs text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors">
                          {L.cancel}
                        </button>
                      </>
                    ) : approvingId === s.id ? (
                      <>
                        <select value={selectedDomain} onChange={e => setSelectedDomain(e.target.value)}
                          className="text-xs rounded-lg px-3 py-2 font-bold"
                          style={{ background: 'var(--card-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                          {adminCategories.map(c => <option key={c.slug} value={c.slug}>{categoryLabel(c, langCode)}</option>)}
                        </select>
                        <button onClick={() => approve(s.id)} disabled={actionLoading === s.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: '#4ade8020', color: '#4ade80', border: '1px solid #4ade8040' }}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> {L.confirm}
                        </button>
                        <button onClick={() => setApprovingId(null)}
                          className="text-xs text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors">
                          {L.cancel}
                        </button>
                      </>
                    ) : deletingId === s.id ? (
                      <>
                        <span className="text-xs font-bold" style={{ color: '#f87171' }}>{L.deleteConfirm}</span>
                        <button onClick={() => deleteSubmission(s.id)} disabled={actionLoading === s.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: '#f87171', color: '#fff', border: '1px solid #f87171' }}>
                          {actionLoading === s.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} {L.deleteYes}
                        </button>
                        <button onClick={() => setDeletingId(null)}
                          className="text-xs text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors">
                          {L.cancel}
                        </button>
                      </>
                    ) : (
                      <>
                        {(s.status === 'pending' || s.status === 'needs_adlam') && (
                          <>
                            {s.status === 'needs_adlam' ? (
                              <button onClick={() => { setEditingId(s.id); setEditText(s.adlam_text ?? ''); setEditAudio(null); }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                                style={{ background: '#bca2ff20', color: '#bca2ff', border: '1px solid #bca2ff40' }}>
                                {L.completeAdlam}
                              </button>
                            ) : (
                              <>
                                <button onClick={() => setApprovingId(s.id)}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                                  style={{ background: '#4ade8020', color: '#4ade80', border: '1px solid #4ade8040' }}>
                                  <CheckCircle2 className="w-3.5 h-3.5" /> {L.approve}
                                </button>
                                <button onClick={() => { setEditingId(s.id); setEditText(s.adlam_text ?? s.raw_text); setEditAudio(null); }}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                                  style={{ background: '#bca2ff20', color: '#bca2ff', border: '1px solid #bca2ff40' }}>
                                  {L.edit}
                                </button>
                              </>
                            )}
                            <button onClick={() => reject(s.id)} disabled={actionLoading === s.id}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                              style={{ background: '#f8717120', color: '#f87171', border: '1px solid #f8717140' }}>
                              <XCircle className="w-3.5 h-3.5" /> {L.reject}
                            </button>
                          </>
                        )}

                        {s.status === 'verified' && (
                          <>
                            <button onClick={() => { setEditingId(s.id); setEditText(s.adlam_text ?? s.raw_text); setEditAudio(null); }}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                              style={{ background: '#bca2ff20', color: '#bca2ff', border: '1px solid #bca2ff40' }}>
                              {L.edit}
                            </button>
                            <button onClick={() => moveToPending(s.id)} disabled={actionLoading === s.id}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                              style={{ background: 'var(--btn-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                              <RotateCcw className="w-3.5 h-3.5" /> {L.unverify}
                            </button>
                          </>
                        )}

                        {s.status === 'rejected' && (
                          <>
                            <button onClick={() => moveToPending(s.id)} disabled={actionLoading === s.id}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                              style={{ background: 'var(--btn-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                              <RotateCcw className="w-3.5 h-3.5" /> {L.restore}
                            </button>
                            <button onClick={() => setDeletingId(s.id)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                              style={{ background: '#f8717120', color: '#f87171', border: '1px solid #f8717140' }}>
                              <Trash2 className="w-3.5 h-3.5" /> {L.del}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount(c => c + 40)}
                  className="w-full py-3 rounded-2xl border border-[var(--border)] text-sm font-bold transition-colors"
                  style={{ background: 'var(--btn-bg)', color: 'var(--text-secondary)' }}>
                  {L.loadMore} ({filtered.length - visibleCount} {L.remaining})
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
