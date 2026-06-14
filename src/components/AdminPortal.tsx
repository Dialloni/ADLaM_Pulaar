import { useState, useEffect, useRef } from 'react';
import {
  collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc, setDoc,
  db, serverTimestamp, addDoc, storage, ref, uploadBytes, uploadBytesResumable, getDownloadURL,
  auth,
} from '../firebase';
import adlamDictData from '../../adlam_dict.json';
import { CheckCircle2, XCircle, Download, RefreshCw, Upload, FileText, X, BookMarked } from 'lucide-react';
import { cn } from '../lib/utils';
import type { User } from '../firebase';
import type { Project } from '../types';
import { AudioRecorder } from './AudioRecorder';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;

type SubmissionStatus = 'pending' | 'verified' | 'rejected' | 'needs_adlam';
type SubmissionDomain = 'tech' | 'religion' | 'news' | 'casual' | 'literature' | 'ui_vocab';
type Tab = 'queue' | 'upload' | 'paste' | 'dictionary' | 'community';
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
const DOMAINS: SubmissionDomain[] = ['tech', 'religion', 'news', 'casual', 'literature', 'ui_vocab'];

const DOMAIN_COLORS: Record<SubmissionDomain, string> = {
  tech:       '#bca2ff',
  religion:   '#fd8b00',
  news:       '#3b82f6',
  casual:     '#4ade80',
  literature: '#60a5fa',
  ui_vocab:   '#f59e0b',
};

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
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map((item: any) => item.str).join(' '));
  }
  return { text: parts.join('\n'), pages: pdf.numPages };
}

// Render one PDF page to a JPEG base64 string (browser canvas).
async function renderPageToJpeg(page: any, scale = 2): Promise<string> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  // JPEG q0.9 keeps payload small (well under Vercel 4.5MB inbound limit)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  return dataUrl.split(',')[1];
}

async function ocrOneImage(base64: string, token: string): Promise<string> {
  for (let attempt = 0; attempt <= 3; attempt++) {
    const res = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
    });
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 4000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || `OCR failed (${res.status} ${res.statusText})`);
    }
    const { text } = await res.json() as { text: string };
    return text;
  }
  throw new Error('OCR rate limited — try again later.');
}

// Render PDF pages client-side → OCR each page image individually.
// Per-page image OCR is fast (seconds) and stays under Vercel's 60s limit,
// unlike sending a whole PDF to Gemini.
async function ocrPdfWithGemini(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<{ text: string; pages: number }> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages = pdf.numPages;

  const texts: string[] = [];
  for (let i = 1; i <= pages; i++) {
    onProgress?.(`Gemini OCR page ${i}/${pages}…`);
    const page = await pdf.getPage(i);
    const base64 = await renderPageToJpeg(page, 2);
    const text = await ocrOneImage(base64, token);
    if (text) texts.push(text);
  }
  return { text: texts.join('\n\n'), pages };
}

export function AdminPortal({ user }: { user: User }) {
  const [tab, setTab] = useState<Tab>('queue');

  /* ── QUEUE STATE ── */
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [corpusError, setCorpusError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionStatus>('pending');
  const [sourceFilter, setSourceFilter] = useState<'all' | string>('all');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<SubmissionDomain>('casual');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [editAudio, setEditAudio] = useState<Blob | null>(null);

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
    const qPending = query(collection(db, 'corpus_submissions'), where('status', '==', 'pending'));
    const qNeeds = query(collection(db, 'corpus_submissions'), where('status', '==', 'needs_adlam'));
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

  const filtered = submissions.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && s.source !== sourceFilter) return false;
    return true;
  });

  const stats = {
    needs_adlam: submissions.filter(s => s.status === 'needs_adlam').length,
    pending:  submissions.filter(s => s.status === 'pending').length,
    verified: submissions.filter(s => s.status === 'verified').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
  };

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

  /* ── PDF UPLOAD ACTIONS ── */
  async function processPdfs(files: File[]) {
    const pdfs = files.filter(f => f.type === 'application/pdf');
    if (!pdfs.length) return;
    setProcessing(true);

    for (const file of pdfs) {
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

        // 2. Extract text (digital) then OCR fallback (scanned/custom-font)
        let extracted = await extractPdfText(file);
        let ratio = adlamRatio(extracted.text);
        let word_count = extracted.text.trim().split(/\s+/).filter(Boolean).length;
        let usedOcr = false;

        if (ratio === 0 || word_count < 10) {
          // fallback: render pages client-side → Gemini vision OCR per page
          const setMsg = (msg: string) => setResults(prev => prev.map(r =>
            r.fileName === file.name ? { ...r, status: 'ready', error: msg } : r
          ));
          setMsg('Running Gemini OCR…');
          extracted = await ocrPdfWithGemini(file, setMsg);
          ratio = adlamRatio(extracted.text);
          word_count = extracted.text.trim().split(/\s+/).filter(Boolean).length;
          usedOcr = true;
        }

        const { text, pages } = extracted;

        setResults(prev => prev.map(r =>
          r.fileName === file.name
            ? { ...r, text, adlam_ratio: ratio, word_count, pages, file_url, error: undefined }
            : r
        ));

        // 3. Save any extracted text to the pending queue for review.
        //    Don't discard low-ADLaM-ratio results — Gemini may transliterate
        //    to Latin or emit pre-Unicode codepoints; admin inspects/edits/rejects.
        if (word_count >= 3) {
          await addDoc(collection(db, 'corpus_submissions'), {
            source: 'pdf',
            raw_text: text,
            adlam_ratio: ratio,
            word_count,
            status: 'pending',
            domain: null,
            submitted_at: serverTimestamp(),
            verified_by: null,
            verified_at: null,
            source_meta: { file_name: file.name, pages, ocr: usedOcr, low_adlam: ratio < 0.1 },
            file_url,
          });
          setResults(prev => prev.map(r =>
            r.fileName === file.name
              ? { ...r, status: 'done', error: ratio < 0.1 ? 'Saved, but low ADLaM ratio — review in queue (may be Latin/pre-Unicode).' : undefined }
              : r
          ));
        } else {
          setResults(prev => prev.map(r =>
            r.fileName === file.name
              ? { ...r, status: 'error', error: 'Gemini returned almost no text. PDF may be blank or unreadable.' }
              : r
          ));
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
  }

  const sources = ['all', ...Array.from(new Set(submissions.map(s => s.source)))];

  return (
    <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 md:p-8 space-y-6" style={{ fontFamily: MANROPE }}>

      {/* header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Corpus Admin</h1>
          <p className="text-zinc-500 text-sm mt-1">Review and verify ADLaM text submissions</p>
        </div>
        <button onClick={exportJSONL}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80 flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Download className="w-4 h-4" />
          Export JSONL ({stats.verified})
        </button>
      </div>

      {/* corpus error */}
      {corpusError && (
        <div className="rounded-xl px-4 py-3 text-xs font-bold"
          style={{ background: '#f8717120', border: '1px solid #f8717140', color: '#f87171' }}>
          Firestore error: {corpusError}
        </div>
      )}

      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {([
          { label: 'Needs ADLaM', value: stats.needs_adlam, color: '#bca2ff' },
          { label: 'Pending',  value: stats.pending,  color: '#fd8b00' },
          { label: 'Verified', value: stats.verified, color: '#4ade80' },
          { label: 'Rejected', value: stats.rejected, color: '#f87171' },
        ] as const).map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-5 border border-white/8" style={{ background: '#131313' }}>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{label}</p>
            <p className="text-3xl font-black mt-1" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-full sm:w-fit overflow-x-auto"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {([
          { id: 'queue', label: 'Review Queue' },
          { id: 'community', label: `Community${communityProjects.length ? ` (${communityProjects.length})` : ''}` },
          { id: 'upload', label: 'Upload PDFs' },
          { id: 'paste', label: 'Paste Text' },
          { id: 'dictionary', label: 'Dictionary' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex-shrink-0"
            style={{
              background: tab === t.id ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: tab === t.id ? '#fff' : '#71717a',
              border: 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── COMMUNITY TAB ── */}
      {tab === 'community' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">Projects users shared to the gallery. Approve to publish as a community template; reject to hide.</p>
          {communityLoading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm"><RefreshCw className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : communityProjects.length === 0 ? (
            <div className="py-16 text-center text-zinc-600 text-sm">No projects awaiting review.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {communityProjects.map(cp => (
                <div key={cp.id} className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: '#131313' }}>
                  <div className="relative overflow-hidden" style={{ height: 200, background: '#0e0e0e' }}>
                    <iframe srcDoc={cp.code} title={cp.name} className="border-none pointer-events-none"
                      style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }} />
                  </div>
                  <div className="p-4">
                    <h3 className="font-black text-white text-sm mb-1 truncate">{cp.name}</h3>
                    <p className="text-zinc-500 text-xs line-clamp-2 mb-1">{cp.description}</p>
                    <p className="text-[10px] text-zinc-600 mb-3">{cp.language} · owner {cp.userId.slice(0, 8)}…</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => approveShare(cp.id)} disabled={communityActionId === cp.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition-all"
                        style={{ background: '#22c55e1a', color: '#4ade80', border: '1px solid #22c55e33' }}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => rejectShare(cp.id)} disabled={communityActionId === cp.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition-all"
                        style={{ background: '#ef44441a', color: '#f87171', border: '1px solid #ef444433' }}>
                        <XCircle className="w-3.5 h-3.5" /> Reject
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
              borderColor: dragOver ? P : 'rgba(255,255,255,0.12)',
              background: dragOver ? `${P}08` : '#131313',
            }}>
            <Upload className="w-8 h-8" style={{ color: dragOver ? P : '#52525b' }} />
            <p className="text-sm font-bold text-zinc-400">Drop PDFs here or click to browse</p>
            <p className="text-xs text-zinc-600">Digital PDFs + scanned images — Gemini OCR auto-runs if no text found</p>
            <input ref={fileInputRef} type="file" accept=".pdf" multiple className="hidden"
              onChange={e => processPdfs(Array.from(e.target.files ?? []))} />
          </div>

          {/* results */}
          {results.length > 0 && (
            <div className="space-y-3">
              {results.map((r, i) => (
                <div key={i} className="rounded-2xl border border-white/8 overflow-hidden"
                  style={{ background: '#131313' }}>
                  <div className="flex items-center gap-3 px-5 py-3">
                    <FileText className="w-4 h-4 flex-shrink-0" style={{ color: '#fd8b00' }} />
                    <span className="text-sm font-bold text-white truncate flex-1">{r.fileName}</span>
                    {r.status === 'ready' && (
                      <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />
                    )}
                    {r.status === 'done' && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Submitted
                      </span>
                    )}
                    {r.status === 'error' && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                        <XCircle className="w-3.5 h-3.5" /> Failed
                      </span>
                    )}
                    <button onClick={() => setResults(prev => prev.filter((_, j) => j !== i))}>
                      <X className="w-4 h-4 text-zinc-600 hover:text-white transition-colors" />
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
                          <span className="text-xs text-zinc-500">{r.word_count} words</span>
                          <span className="text-xs text-zinc-500">{r.pages} pages</span>
                        </div>
                      )}
                      {r.text && r.adlam_ratio > 0 && (
                        <p className="text-sm text-zinc-400 line-clamp-3 font-adlam" dir="rtl">
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
          <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: '#131313' }}>
            <div className="px-5 pt-4 pb-2 border-b border-white/6 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">ADLaM Text</span>
              <div className="flex items-center gap-3 flex-wrap">
                {pasteText.length > 0 && (
                  <>
                    <span className="text-xs font-mono px-2 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.06)', color: pasteRatio > 0.05 ? '#4ade80' : '#fd8b00' }}>
                      {codeRangeLabel(pasteText)}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${ratioColor(pasteRatio)}20`, color: ratioColor(pasteRatio) }}>
                      𞤀𞤁𞤂 {Math.round(pasteRatio * 100)}%
                    </span>
                    <span className="text-xs text-zinc-500">{pasteWords} words</span>
                  </>
                )}
              </div>
            </div>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste ADLaM text here — from PDFs, WhatsApp, Telegram, books…"
              className="w-full bg-transparent outline-none resize-none text-white placeholder-zinc-600 px-5 py-4"
              style={{
                minHeight: 220, fontSize: 15, lineHeight: 1.7,
                direction: 'rtl',
                fontFamily: '"Noto Sans Adlam", "ADLaM Display", serif',
              }}
            />
          </div>

          {/* metadata row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/8 p-4 space-y-2" style={{ background: '#131313' }}>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Domain</p>
              <div className="flex flex-wrap gap-1.5">
                {DOMAINS.map(d => (
                  <button key={d} onClick={() => setPasteDomain(d)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: pasteDomain === d ? `${DOMAIN_COLORS[d]}25` : 'rgba(255,255,255,0.04)',
                      color: pasteDomain === d ? DOMAIN_COLORS[d] : '#52525b',
                      border: `1px solid ${pasteDomain === d ? DOMAIN_COLORS[d] + '50' : 'transparent'}`,
                    }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/8 p-4 space-y-2" style={{ background: '#131313' }}>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Source</p>
              <div className="flex flex-wrap gap-1.5">
                {(['text_upload', 'telegram', 'pdf', 'collector'] as const).map(s => (
                  <button key={s} onClick={() => setPasteSource(s)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: pasteSource === s ? `${SOURCE_COLORS[s] ?? '#fff'}25` : 'rgba(255,255,255,0.04)',
                      color: pasteSource === s ? (SOURCE_COLORS[s] ?? '#fff') : '#52525b',
                      border: `1px solid ${pasteSource === s ? (SOURCE_COLORS[s] ?? '#fff') + '50' : 'transparent'}`,
                    }}>
                    {s}
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
                  Arabic codepoints detected (U+0600 range) — pre-Unicode font encoding.
                  <span className="block font-normal opacity-70 mt-0.5">
                    Note: Google Docs also shows correct ADLaM Unicode as Arabic because it lacks the font.
                    Check the codepoint label above — if it says <code>U+1E9xx</code> the text IS correct, just rendering wrong.
                  </span>
                </span>
              </div>
              <button
                onClick={decodeWithAI}
                disabled={pasteDecoding}
                className="self-start flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all disabled:opacity-50"
                style={{ background: '#fd8b0025', color: '#fd8b00', border: '1px solid #fd8b0050' }}>
                {pasteDecoding
                  ? <><RefreshCw className="w-3 h-3 animate-spin" /> Decoding…</>
                  : <>✦ Decode with AI → Unicode ADLaM</>}
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
              <><RefreshCw className="w-4 h-4 animate-spin" /> Submitting…</>
            ) : pasteSuccess ? (
              <><CheckCircle2 className="w-4 h-4" /> Submitted to queue!</>
            ) : (
              <><Upload className="w-4 h-4" /> Submit to corpus queue</>
            )}
          </button>
          {pasteWords > 0 && pasteWords < 3 && (
            <p className="text-xs text-zinc-600">Need at least 3 words</p>
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
                Draft: {dictTerms.filter(t => t.status === 'draft').length}
              </span>
              <span className="text-xs font-bold" style={{ color: '#4ade80' }}>
                Verified: {dictTerms.filter(t => t.status === 'verified').length}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {dictTerms.length === 0 && (
                <button onClick={seedDictFromJson} disabled={dictSeeding}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ background: '#bca2ff20', color: '#bca2ff', border: '1px solid #bca2ff40' }}>
                  {dictSeeding
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Seeding…</>
                    : <><BookMarked className="w-3.5 h-3.5" /> Seed from JSON</>}
                </button>
              )}
              <button onClick={exportDictJSON}
                disabled={dictTerms.filter(t => t.status === 'verified').length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80 disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Download className="w-4 h-4" />
                Export JSON ({dictTerms.filter(t => t.status === 'verified').length})
              </button>
            </div>
          </div>

          {/* error */}
          {dictError && (
            <div className="rounded-xl px-4 py-3 text-xs font-bold"
              style={{ background: '#f8717120', border: '1px solid #f8717140', color: '#f87171' }}>
              Firestore error: {dictError} — deploy firestore.rules then reload.
            </div>
          )}

          {/* add term form */}
          <div className="rounded-2xl border border-white/8 p-5 space-y-3" style={{ background: '#131313' }}>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Add New Term</p>
            <div className="space-y-1.5">
              <input
                value={addAdlam}
                onChange={e => setAddAdlam(e.target.value)}
                dir="rtl"
                placeholder="𞤢𞤣𞤤𞤢𞤥 — type ADLaM script here"
                className="w-full rounded-xl px-4 py-3 text-white text-xl bg-black/40 outline-none transition-all"
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
                    ✓ ADLaM script detected
                  </p>
                ) : (
                  <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#f87171' }}>
                    ✗ Type in ADLaM script — characters not recognized as ADLaM
                  </p>
                )
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input
                value={addLatin}
                onChange={e => setAddLatin(e.target.value)}
                placeholder="English / latin"
                className="rounded-xl px-4 py-2.5 text-white text-sm bg-black/40 outline-none"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <input
                value={addFr}
                onChange={e => setAddFr(e.target.value)}
                placeholder="Français"
                className="rounded-xl px-4 py-2.5 text-white text-sm bg-black/40 outline-none"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <select
                value={addDomain}
                onChange={e => setAddDomain(e.target.value)}
                className="rounded-xl px-4 py-2.5 text-white text-sm outline-none"
                style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)' }}>
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
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Adding…</>
                : addSuccess
                  ? <><CheckCircle2 className="w-4 h-4" /> Added!</>
                  : '+ Add to dictionary'}
            </button>
          </div>

          {/* filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {(['all', 'draft', 'verified'] as const).map(f => (
              <button key={f} onClick={() => setDictFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all"
                style={{
                  background: dictFilter === f ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: dictFilter === f ? '#fff' : '#71717a',
                  border: 'none',
                }}>
                {f}
              </button>
            ))}
          </div>

          {/* list */}
          {dictLoading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 text-zinc-600 animate-spin" />
            </div>
          ) : dictTerms.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <p className="text-zinc-600 text-sm">No terms yet.</p>
              <button onClick={seedDictFromJson} disabled={dictSeeding}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-80 disabled:opacity-40 mx-auto"
                style={{ background: '#bca2ff20', color: '#bca2ff', border: '1px solid #bca2ff40' }}>
                {dictSeeding
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Seeding…</>
                  : <><BookMarked className="w-3.5 h-3.5" /> Seed 50 terms from JSON</>}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {dictTerms
                .filter(t => dictFilter === 'all' || t.status === dictFilter)
                .map(t => (
                  <div key={t.id} className="rounded-2xl border border-white/8 overflow-hidden"
                    style={{ background: '#131313' }}>
                    <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
                      {dictEditingId === t.id ? (
                        <div className="flex-1 space-y-2">
                          <input
                            value={dictEditAdlam}
                            onChange={e => setDictEditAdlam(e.target.value)}
                            dir="rtl"
                            placeholder="ADLaM script…"
                            className="w-full rounded-lg px-3 py-2 text-white text-xl bg-black/40 outline-none"
                            style={{ fontFamily: '"Noto Sans Adlam", serif', border: '1px solid rgba(59,130,246,0.3)' }}
                          />
                          <div className="flex gap-2">
                            <input
                              value={dictEditFr}
                              onChange={e => setDictEditFr(e.target.value)}
                              placeholder="French translation"
                              className="flex-1 rounded-lg px-3 py-2 text-white text-sm bg-black/40 outline-none"
                              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                            <input
                              value={dictEditDomain}
                              onChange={e => setDictEditDomain(e.target.value)}
                              placeholder="domain"
                              className="w-28 rounded-lg px-3 py-2 text-white text-sm bg-black/40 outline-none"
                              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => saveEditDict(t.id)} disabled={dictActionLoading === t.id}
                              className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                              style={{ background: '#bca2ff20', color: '#bca2ff', border: '1px solid #bca2ff40' }}>
                              Save
                            </button>
                            <button onClick={() => setDictEditingId(null)}
                              className="text-xs text-zinc-600 hover:text-white transition-colors px-2">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="text-xl min-w-0" dir="rtl"
                            style={{ fontFamily: '"Noto Sans Adlam", serif', color: '#fff' }}>
                            {t.adlam}
                          </span>
                          <span className="text-sm text-zinc-500">·</span>
                          <span className="text-sm font-bold text-zinc-300">{t.latin}</span>
                          <span className="text-xs text-zinc-600">→</span>
                          <span className="text-sm text-zinc-400">{t.fr}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full ml-1"
                            style={{ background: 'rgba(255,255,255,0.06)', color: '#71717a' }}>
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
                              style={{ background: 'rgba(255,255,255,0.06)', color: '#71717a' }}>
                              ✏️ Edit
                            </button>
                            {t.status === 'draft' ? (
                              <button onClick={() => verifyTerm(t.id)} disabled={dictActionLoading === t.id}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                                style={{ background: '#4ade8020', color: '#4ade80', border: '1px solid #4ade8040' }}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Verify
                              </button>
                            ) : (
                              <button onClick={() => unverifyTerm(t.id)} disabled={dictActionLoading === t.id}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                                style={{ background: '#f8717120', color: '#f87171', border: '1px solid #f8717140' }}>
                                <XCircle className="w-3.5 h-3.5" /> Unverify
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
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {(['all', 'needs_adlam', 'pending', 'verified', 'rejected'] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all"
                    style={{
                      background: statusFilter === s ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: statusFilter === s ? '#fff' : '#71717a',
                      border: 'none',
                    }}>
                    {s}
                  </button>
                ))}
              </div>
              <span className="text-zinc-600 text-xs ml-auto">{filtered.length} results</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sources.map(s => {
                const label = s === 'all' ? 'ALL' : s.replace('telegram:', '').slice(0, 18);
                return (
                  <button key={s} onClick={() => setSourceFilter(s)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide transition-all"
                    style={{
                      background: sourceFilter === s ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                      color: sourceFilter === s ? '#fff' : '#71717a',
                      border: `1px solid ${sourceFilter === s ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
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
              <RefreshCw className="w-6 h-6 text-zinc-600 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-zinc-600 text-sm">No submissions</div>
          ) : (
            <div className="space-y-3">
              {filtered.map(s => (
                <div key={s.id} className="rounded-2xl border border-white/8 overflow-hidden"
                  style={{ background: '#131313' }}>
                  <div className="flex items-center gap-2 flex-wrap px-4 md:px-5 py-3 border-b border-white/6">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${SOURCE_COLORS[s.source] ?? '#71717a'}20`, color: SOURCE_COLORS[s.source] ?? '#71717a' }}>
                      {s.source}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${ratioColor(s.adlam_ratio)}20`, color: ratioColor(s.adlam_ratio) }}>
                      𞤀𞤁𞤂 {Math.round(s.adlam_ratio * 100)}%
                    </span>
                    <span className="text-xs text-zinc-600">{s.word_count ?? s.raw_text?.trim().split(/\s+/).filter(Boolean).length ?? 0} words</span>
                    {s.domain && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${DOMAIN_COLORS[s.domain]}20`, color: DOMAIN_COLORS[s.domain] }}>
                        {s.domain}
                      </span>
                    )}
                    <span className={cn('text-xs font-bold ml-auto px-2 py-0.5 rounded-full')}
                      style={{
                        background: s.status === 'verified' ? '#4ade8020' : s.status === 'rejected' ? '#f8717120' : s.status === 'needs_adlam' ? '#bca2ff20' : '#fd8b0020',
                        color: s.status === 'verified' ? '#4ade80' : s.status === 'rejected' ? '#f87171' : s.status === 'needs_adlam' ? '#bca2ff' : '#fd8b00',
                      }}>
                      {s.status === 'needs_adlam' ? 'needs ADLaM' : s.status}
                    </span>
                  </div>

                  <div className="px-5 py-4 space-y-3">
                    {s.file_url && s.source_meta?.has_image && (
                      <a href={s.file_url} target="_blank" rel="noopener noreferrer" className="block">
                        <img
                          src={s.file_url}
                          alt="contributor submission"
                          loading="lazy"
                          className="max-h-72 rounded-xl border border-white/10 object-contain hover:opacity-90 transition-opacity"
                        />
                      </a>
                    )}

                    {/* contributor glosses — what they knew the word as */}
                    {(s.gloss_en || s.gloss_fr || s.pulaar_latin) && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {s.gloss_en && (
                          <span className="px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
                            🇬🇧 {s.gloss_en}
                          </span>
                        )}
                        {s.gloss_fr && (
                          <span className="px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
                            🇫🇷 {s.gloss_fr}
                          </span>
                        )}
                        {s.pulaar_latin && (
                          <span className="px-2.5 py-1 rounded-lg font-bold" style={{ background: '#4ade8015', color: '#4ade80' }}>
                            Pulaar (Latin): {s.pulaar_latin}
                          </span>
                        )}
                      </div>
                    )}

                    {/* audio: contributor + verified Pulaar */}
                    {s.audio_url && (
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-600 uppercase tracking-widest font-bold">Contributor audio</p>
                        <audio src={s.audio_url} controls className="w-full" />
                      </div>
                    )}
                    {s.pulaar_audio_url && (
                      <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4ade80' }}>✓ Verified Pulaar audio</p>
                        <audio src={s.pulaar_audio_url} controls className="w-full" />
                      </div>
                    )}

                    {editingId === s.id ? (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#bca2ff' }}>
                            ADLaM equivalent
                          </p>
                          <textarea
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            rows={3}
                            placeholder="𞤢𞤣𞤤𞤢𞤥… write the ADLaM here"
                            className="w-full rounded-xl px-3 py-2 text-sm text-zinc-200 leading-relaxed resize-y"
                            dir="rtl"
                            style={{
                              fontFamily: '"Noto Sans Adlam", "ADLaM Display", serif',
                              fontSize: 18,
                              background: 'rgba(0,0,0,0.4)',
                              border: '1px solid rgba(59,130,246,0.3)',
                              outline: 'none',
                            }}
                          />
                        </div>
                        {/* admin records the proper Pulaar pronunciation */}
                        <AudioRecorder
                          value={editAudio}
                          onChange={setEditAudio}
                          label="Record Pulaar pronunciation (optional)"
                          accent="#4ade80"
                          disabled={actionLoading === s.id}
                        />
                      </div>
                    ) : (
                      s.raw_text && (
                        <p className="text-sm text-zinc-300 leading-relaxed line-clamp-4" dir="rtl"
                          style={{ fontSize: 15, fontFamily: '"Noto Sans Adlam", "ADLaM Display", serif' }}>
                          {s.raw_text}
                        </p>
                      )
                    )}
                  </div>

                  {(s.status === 'pending' || s.status === 'needs_adlam') && (
                    <div className="px-5 pb-4 flex items-center gap-3 flex-wrap">
                      {editingId === s.id ? (
                        <>
                          <button onClick={() => saveEdit(s.id, s.status)} disabled={actionLoading === s.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                            style={{ background: '#bca2ff20', color: '#bca2ff', border: '1px solid #bca2ff40' }}>
                            {actionLoading === s.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                            {s.status === 'needs_adlam' ? 'Save ADLaM → queue' : 'Save Edit'}
                          </button>
                          <button onClick={() => { setEditingId(null); setEditText(''); setEditAudio(null); }}
                            className="text-xs text-zinc-600 hover:text-white transition-colors">
                            Cancel
                          </button>
                        </>
                      ) : approvingId === s.id ? (
                        <>
                          <select value={selectedDomain} onChange={e => setSelectedDomain(e.target.value as SubmissionDomain)}
                            className="text-xs rounded-lg px-3 py-2 font-bold"
                            style={{ background: '#1e1e1e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <button onClick={() => approve(s.id)} disabled={actionLoading === s.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                            style={{ background: '#4ade8020', color: '#4ade80', border: '1px solid #4ade8040' }}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                          </button>
                          <button onClick={() => setApprovingId(null)}
                            className="text-xs text-zinc-600 hover:text-white transition-colors">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {s.status === 'needs_adlam' ? (
                            <button onClick={() => { setEditingId(s.id); setEditText(s.adlam_text ?? ''); setEditAudio(null); }}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                              style={{ background: '#bca2ff20', color: '#bca2ff', border: '1px solid #bca2ff40' }}>
                              ✏️ Complete ADLaM
                            </button>
                          ) : (
                            <>
                              <button onClick={() => setApprovingId(s.id)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                                style={{ background: '#4ade8020', color: '#4ade80', border: '1px solid #4ade8040' }}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button onClick={() => { setEditingId(s.id); setEditText(s.adlam_text ?? s.raw_text); setEditAudio(null); }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                                style={{ background: '#bca2ff20', color: '#bca2ff', border: '1px solid #bca2ff40' }}>
                                ✏️ Edit
                              </button>
                            </>
                          )}
                          <button onClick={() => reject(s.id)} disabled={actionLoading === s.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                            style={{ background: '#f8717120', color: '#f87171', border: '1px solid #f8717140' }}>
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
