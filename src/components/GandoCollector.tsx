import { useState, useRef } from 'react';
import {
  collection, addDoc, db, serverTimestamp,
  storage, ref, uploadBytes, getDownloadURL,
} from '../firebase';
import type { User } from '../firebase';
import { Camera, X, CheckCircle2, RefreshCw, ImagePlus } from 'lucide-react';
import { cn } from '../lib/utils';
import { AudioRecorder } from './AudioRecorder';

const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)),
  ]);

const P = '#3b82f6';
const MANROPE = 'Manrope, sans-serif';
const ADLAM_FONT = '"Noto Sans Adlam", "ADLaM Display", serif';

type LangCode = 'ff-adlm' | 'en' | 'fr';

const DOMAINS = ['casual', 'tech', 'religion', 'news', 'literature', 'ui_vocab'] as const;
type Domain = typeof DOMAINS[number];

const I18N: Partial<Record<LangCode, {
  title: string; subtitle: string; photoLabel: string; photoHint: string;
  audioLabel: string; audioHint: string;
  enLabel: string; frLabel: string; latinLabel: string; adlamLabel: string;
  fieldsHint: string; domainLabel: string;
  submit: string; submitting: string; success: string; needAnything: string;
  adlamOk: string; adlamBad: string; remove: string;
}>> = {
  // NOTE: ADLaM (ff-adlm) UI strings fall back to English for now — to be
  // replaced with verified ADLaM script by a native speaker.
  en: {
    title: 'GANDO Collector',
    subtitle: 'Contribute a word — in any language you know. An instructor fills the ADLaM.',
    photoLabel: 'Photo (optional)', photoHint: 'JPG / PNG · max 10MB',
    audioLabel: 'Audio (optional) · record in Pulaar if you can', audioHint: 'mic',
    enLabel: 'English', frLabel: 'French', latinLabel: 'Pulaar (Latin letters)',
    adlamLabel: 'ADLaM script',
    fieldsHint: 'Fill whatever you know — at least one field or an audio recording.',
    domainLabel: 'Category', submit: 'Submit contribution', submitting: 'Submitting…',
    success: 'Thank you! Sent for review.',
    needAnything: 'Enter at least one word, or record audio',
    adlamOk: '✓ ADLaM script detected', adlamBad: '✗ Not ADLaM script (saved anyway)',
    remove: 'Remove',
  },
  fr: {
    title: 'Collecteur GANDO',
    subtitle: 'Contribuez un mot — dans la langue que vous connaissez. Un instructeur ajoute l’ADLaM.',
    photoLabel: 'Photo (optionnel)', photoHint: 'JPG / PNG · max 10 Mo',
    audioLabel: 'Audio (optionnel) · enregistrez en pulaar si possible', audioHint: 'micro',
    enLabel: 'Anglais', frLabel: 'Français', latinLabel: 'Pulaar (lettres latines)',
    adlamLabel: 'Écriture ADLaM',
    fieldsHint: 'Remplissez ce que vous savez — au moins un champ ou un enregistrement audio.',
    domainLabel: 'Catégorie', submit: 'Envoyer la contribution', submitting: 'Envoi…',
    success: 'Merci ! Envoyé pour révision.',
    needAnything: 'Entrez au moins un mot, ou enregistrez un audio',
    adlamOk: '✓ Écriture ADLaM détectée', adlamBad: '✗ Pas en ADLaM (enregistré quand même)',
    remove: 'Retirer',
  },
};

function adlamRatio(text: string): number {
  const letters = [...text].filter(c => /\p{L}/u.test(c));
  if (!letters.length) return 0;
  const adlam = letters.filter(c => c >= '\u{1E900}' && c <= '\u{1E95F}');
  return adlam.length / letters.length;
}

function audioExt(mime: string): string {
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

export function GandoCollector({ user, langCode = 'en' }: { user: User; langCode?: LangCode }) {
  const t = I18N[langCode] ?? I18N.en!;
  const isAdlam = langCode === 'ff-adlm';

  const [adlam, setAdlam] = useState('');
  const [en, setEn] = useState('');
  const [fr, setFr] = useState('');
  const [latin, setLatin] = useState('');
  const [domain, setDomain] = useState<Domain>('casual');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ratio = adlamRatio(adlam);
  const hasText = [adlam, en, fr, latin].some(v => v.trim() !== '');
  const hasAudio = !!audioBlob;
  const canSubmit = (hasText || hasAudio) && !submitting;

  function pickImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Image files only'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10MB'); return; }
    setError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      let file_url: string | null = null;
      let file_name: string | null = null;

      // ── Image upload (unchanged — one-shot uploadBytes + timeouts) ──
      if (imageFile) {
        const safe = imageFile.name.replace(/[^\w.\-]/g, '_');
        file_name = `${Date.now()}_${safe}`;
        await user.getIdToken(true);
        const storageRef = ref(storage, `collector/${user.uid}/${file_name}`);
        setProgress(40);
        await withTimeout(uploadBytes(storageRef, imageFile, { contentType: imageFile.type }), 60_000, 'Upload');
        file_url = await withTimeout(getDownloadURL(storageRef), 30_000, 'Get URL');
        setProgress(60);
      }

      // ── Audio upload (sibling of image, separate path/field) ──
      let audio_url: string | null = null;
      let audio_name: string | null = null;
      if (audioBlob) {
        const ext = audioExt(audioBlob.type);
        audio_name = `audio_${Date.now()}.${ext}`;
        await user.getIdToken(true);
        const audioRef = ref(storage, `collector/${user.uid}/${audio_name}`);
        setProgress(80);
        await withTimeout(uploadBytes(audioRef, audioBlob, { contentType: audioBlob.type || 'audio/webm' }), 60_000, 'Audio upload');
        audio_url = await withTimeout(getDownloadURL(audioRef), 30_000, 'Get audio URL');
        setProgress(95);
      }

      const adlam_text = adlam.trim();
      const wordSource = adlam_text || latin.trim() || en.trim() || fr.trim();
      const word_count = wordSource.split(/\s+/).filter(Boolean).length;

      await withTimeout(addDoc(collection(db, 'corpus_submissions'), {
        source: 'collector',
        // Keep raw_text populated (= ADLaM, or best available) so the existing
        // admin queue still renders something for every doc.
        raw_text: adlam_text || wordSource,
        adlam_text,
        gloss_en: en.trim(),
        gloss_fr: fr.trim(),
        pulaar_latin: latin.trim(),
        adlam_ratio: ratio,
        word_count,
        // No ADLaM yet → route to instructors to complete it.
        status: adlam_text ? 'pending' : 'needs_adlam',
        domain,
        submitted_at: serverTimestamp(),
        verified_by: null,
        verified_at: null,
        source_meta: {
          submitted_by: user.email,
          file_name,
          has_image: !!imageFile,
          has_audio: !!audioBlob,
        },
        file_url,
        audio_url,
        audio_name,
        pulaar_audio_url: null,
      }), 30_000, 'Save');

      setProgress(100);
      setAdlam(''); setEn(''); setFr(''); setLatin('');
      clearImage();
      setAudioBlob(null);
      setProgress(0);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSubmitting(false);
    }
  }

  const labelCls = cn('text-xs font-bold text-zinc-500 uppercase tracking-widest', isAdlam && 'font-adlam');
  const inputCls = 'w-full rounded-xl px-4 py-3 text-white bg-black/40 outline-none transition-all placeholder-zinc-600';

  return (
    // dark-only internal tool — see AdminPortal for the data-theme re-scoping trick
    <div data-theme="dark" className="flex-1 overflow-y-auto p-8" style={{ fontFamily: MANROPE, background: 'var(--app-bg)', color: 'var(--text-primary)' }}>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* header */}
        <div>
          <h1 className={cn('text-3xl font-black text-white tracking-tighter', isAdlam && 'font-adlam')}>
            {t.title}
          </h1>
          <p className={cn('text-zinc-500 text-sm mt-1', isAdlam && 'font-adlam')}>{t.subtitle}</p>
        </div>

        {/* photo */}
        <div className="rounded-2xl border border-white/8 p-5 space-y-3" style={{ background: 'var(--card-bg)' }}>
          <p className={labelCls}>{t.photoLabel}</p>
          {imagePreview ? (
            <div className="relative inline-block">
              <img src={imagePreview} alt="preview" className="max-h-64 rounded-xl border border-white/10" />
              <button onClick={clearImage}
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: '#f87171', color: '#fff' }} title={t.remove}>
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); pickImage(e.dataTransfer.files[0]); }}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
              style={{ minHeight: 140, borderColor: 'rgba(255,255,255,0.12)', background: '#0d0d0d' }}>
              <ImagePlus className="w-7 h-7" style={{ color: '#52525b' }} />
              <p className="text-sm font-bold text-zinc-400">{t.photoLabel}</p>
              <p className="text-xs text-zinc-600">{t.photoHint}</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => pickImage(e.target.files?.[0])} />
            </div>
          )}
        </div>

        {/* audio */}
        <AudioRecorder
          value={audioBlob}
          onChange={setAudioBlob}
          label={t.audioLabel}
          hint={t.audioHint}
          accent={P}
          disabled={submitting}
        />

        {/* word fields — fill any */}
        <div className="rounded-2xl border border-white/8 p-5 space-y-4" style={{ background: 'var(--card-bg)' }}>
          <p className={cn('text-xs text-zinc-600', isAdlam && 'font-adlam')}>{t.fieldsHint}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className={labelCls}>{t.enLabel}</p>
              <input value={en} onChange={e => setEn(e.target.value)}
                placeholder="e.g. blackboard"
                className={inputCls} style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>
            <div className="space-y-1.5">
              <p className={labelCls}>{t.frLabel}</p>
              <input value={fr} onChange={e => setFr(e.target.value)}
                placeholder="ex. tableau"
                className={inputCls} style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className={labelCls}>{t.latinLabel}</p>
            <input value={latin} onChange={e => setLatin(e.target.value)}
              placeholder="Pulaar in Latin letters…"
              className={inputCls} style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className={labelCls}>{t.adlamLabel}</p>
              {adlam.trim() !== '' && (
                <span className="text-xs font-bold" style={{ color: ratio >= 0.5 ? '#4ade80' : '#f87171' }}>
                  {ratio >= 0.5 ? t.adlamOk : t.adlamBad}
                </span>
              )}
            </div>
            <input value={adlam} onChange={e => setAdlam(e.target.value)}
              dir="rtl"
              placeholder="𞤢𞤣𞤤𞤢𞤥…"
              className={inputCls}
              style={{ border: '1px solid rgba(59,130,246,0.25)', fontFamily: ADLAM_FONT, fontSize: 18, lineHeight: 1.8 }} />
          </div>
        </div>

        {/* domain */}
        <div className="rounded-2xl border border-white/8 p-5 space-y-2" style={{ background: 'var(--card-bg)' }}>
          <p className={labelCls}>{t.domainLabel}</p>
          <div className="flex flex-wrap gap-1.5">
            {DOMAINS.map(d => (
              <button key={d} onClick={() => setDomain(d)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: domain === d ? `${P}25` : 'rgba(255,255,255,0.04)',
                  color: domain === d ? P : '#71717a',
                  border: `1px solid ${domain === d ? P + '50' : 'transparent'}`,
                }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* error */}
        {error && (
          <div className="rounded-xl px-4 py-3 text-xs font-bold"
            style={{ background: '#f8717120', border: '1px solid #f8717140', color: '#f87171' }}>
            {error}
          </div>
        )}

        {/* submit */}
        <button
          onClick={submit}
          disabled={!canSubmit}
          className={cn('w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-black text-sm transition-all disabled:opacity-40', isAdlam && 'font-adlam')}
          style={{ background: success ? '#4ade8030' : 'var(--gradient-brand)', color: success ? '#4ade80' : '#000' }}>
          {submitting ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> {t.submitting}{progress > 0 ? ` ${progress}%` : ''}</>
          ) : success ? (
            <><CheckCircle2 className="w-4 h-4" /> {t.success}</>
          ) : (
            <><Camera className="w-4 h-4" /> {t.submit}</>
          )}
        </button>
        {!canSubmit && !submitting && (hasText || hasAudio ? null : (
          <p className={cn('text-xs text-zinc-600 text-center', isAdlam && 'font-adlam')}>{t.needAnything}</p>
        ))}
      </div>
    </div>
  );
}
