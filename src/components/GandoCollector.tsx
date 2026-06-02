import { useState, useRef } from 'react';
import {
  collection, addDoc, db, serverTimestamp,
  storage, ref, uploadBytes, getDownloadURL,
} from '../firebase';
import type { User } from '../firebase';
import { Camera, X, CheckCircle2, RefreshCw, ImagePlus } from 'lucide-react';
import { cn } from '../lib/utils';

const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)),
  ]);

const P = '#ff8b9b';
const MANROPE = 'Manrope, sans-serif';
const ADLAM_FONT = '"Noto Sans Adlam", "ADLaM Display", serif';

type LangCode = 'ff-adlm' | 'en' | 'fr';

const DOMAINS = ['casual', 'tech', 'religion', 'news', 'literature', 'ui_vocab'] as const;
type Domain = typeof DOMAINS[number];

const I18N: Partial<Record<LangCode, {
  title: string; subtitle: string; photoLabel: string; photoHint: string;
  textLabel: string; textPlaceholder: string; domainLabel: string;
  submit: string; submitting: string; success: string; needText: string;
  adlamOk: string; adlamBad: string; remove: string;
}>> = {
  // NOTE: ADLaM (ff-adlm) UI strings intentionally fall back to English for
  // now — to be replaced with verified ADLaM script by a native speaker.
  en: {
    title: 'GANDO Collector',
    subtitle: 'Contribute ADLaM text & photos to grow the corpus',
    photoLabel: 'Photo (optional)', photoHint: 'JPG / PNG · max 10MB',
    textLabel: 'ADLaM text', textPlaceholder: 'Type or transcribe ADLaM text here…',
    domainLabel: 'Category', submit: 'Submit contribution', submitting: 'Submitting…',
    success: 'Thank you! Sent for review.', needText: 'Enter at least a few words of ADLaM',
    adlamOk: '✓ ADLaM script detected', adlamBad: '✗ Type in ADLaM script',
    remove: 'Remove',
  },
  fr: {
    title: 'Collecteur GANDO',
    subtitle: 'Contribuez du texte et des photos ADLaM pour enrichir le corpus',
    photoLabel: 'Photo (optionnel)', photoHint: 'JPG / PNG · max 10 Mo',
    textLabel: 'Texte ADLaM', textPlaceholder: 'Tapez ou transcrivez du texte ADLaM ici…',
    domainLabel: 'Catégorie', submit: 'Envoyer la contribution', submitting: 'Envoi…',
    success: 'Merci ! Envoyé pour révision.', needText: 'Entrez au moins quelques mots en ADLaM',
    adlamOk: '✓ Écriture ADLaM détectée', adlamBad: '✗ Écrivez en ADLaM',
    remove: 'Retirer',
  },
};

function adlamRatio(text: string): number {
  const letters = [...text].filter(c => /\p{L}/u.test(c));
  if (!letters.length) return 0;
  const adlam = letters.filter(c => c >= '\u{1E900}' && c <= '\u{1E95F}');
  return adlam.length / letters.length;
}

export function GandoCollector({ user, langCode = 'en' }: { user: User; langCode?: LangCode }) {
  const t = I18N[langCode] ?? I18N.en;
  const isAdlam = langCode === 'ff-adlm';

  const [text, setText] = useState('');
  const [domain, setDomain] = useState<Domain>('casual');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ratio = adlamRatio(text);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const canSubmit = words >= 1 && ratio >= 0.5 && !submitting;

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

      if (imageFile) {
        const safe = imageFile.name.replace(/[^\w.\-]/g, '_');
        file_name = `${Date.now()}_${safe}`;
        await user.getIdToken(true);
        const storageRef = ref(storage, `collector/${user.uid}/${file_name}`);
        setProgress(50);
        await withTimeout(uploadBytes(storageRef, imageFile, { contentType: imageFile.type }), 60_000, 'Upload');
        file_url = await withTimeout(getDownloadURL(storageRef), 30_000, 'Get URL');
        setProgress(100);
      }

      await withTimeout(addDoc(collection(db, 'corpus_submissions'), {
        source: 'collector',
        raw_text: text.trim(),
        adlam_ratio: ratio,
        word_count: words,
        status: 'pending',
        domain,
        submitted_at: serverTimestamp(),
        verified_by: null,
        verified_at: null,
        source_meta: { submitted_by: user.email, file_name, has_image: !!imageFile },
        file_url,
      }), 30_000, 'Save');

      setText('');
      clearImage();
      setProgress(0);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-8" style={{ fontFamily: MANROPE }}>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* header */}
        <div>
          <h1 className={cn('text-3xl font-black text-white tracking-tighter', isAdlam && 'font-adlam')}>
            {t.title}
          </h1>
          <p className={cn('text-zinc-500 text-sm mt-1', isAdlam && 'font-adlam')}>{t.subtitle}</p>
        </div>

        {/* photo */}
        <div className="rounded-2xl border border-white/8 p-5 space-y-3" style={{ background: '#131313' }}>
          <p className={cn('text-xs font-bold text-zinc-500 uppercase tracking-widest', isAdlam && 'font-adlam')}>
            {t.photoLabel}
          </p>
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

        {/* ADLaM text */}
        <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: '#131313' }}>
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <span className={cn('text-xs font-bold text-zinc-500 uppercase tracking-widest', isAdlam && 'font-adlam')}>
              {t.textLabel}
            </span>
            {text.trim() !== '' && (
              <span className="text-xs font-bold" style={{ color: ratio >= 0.5 ? '#4ade80' : '#f87171' }}>
                {ratio >= 0.5 ? t.adlamOk : t.adlamBad}
              </span>
            )}
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t.textPlaceholder}
            dir="rtl"
            className="w-full bg-transparent outline-none resize-none text-white placeholder-zinc-600 px-5 py-4"
            style={{
              minHeight: 180, fontSize: 18, lineHeight: 1.8,
              fontFamily: ADLAM_FONT,
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          />
        </div>

        {/* domain */}
        <div className="rounded-2xl border border-white/8 p-5 space-y-2" style={{ background: '#131313' }}>
          <p className={cn('text-xs font-bold text-zinc-500 uppercase tracking-widest', isAdlam && 'font-adlam')}>
            {t.domainLabel}
          </p>
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
        {text.trim() !== '' && !canSubmit && !submitting && (
          <p className={cn('text-xs text-zinc-600 text-center', isAdlam && 'font-adlam')}>{t.needText}</p>
        )}
      </div>
    </div>
  );
}
