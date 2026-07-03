import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, Plus, ChevronDown, Check, Mic, ArrowUp, X, Layers } from 'lucide-react';
import { GandoLogo } from './GandoLogo';
import { LanguageSelector } from './LanguageSelector';
import RotatingText from './RotatingText';
import { ModeSwitch } from './ModeSwitch';
import { ByokModal } from './ByokModal';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { P, S, MANROPE } from '../lib/brand';
import { PROVIDER_COLOR, PROVIDER_LABEL } from '../lib/providers';
import { LANGS } from '../lib/langs';
import { TEMPLATE_I18N, TEMPLATES_META } from '../data/templates';
import { TRANSLATIONS, type LanguageCode } from '../translations';
import type { Provider, ByokProvider } from '../services/geminiService';

type Translation = (typeof TRANSLATIONS)[LanguageCode];
type Lang = { code: LanguageCode; name: string; short?: string };

interface LandingPageProps {
  t: Translation;
  isAdlam: boolean;
  selectedLang: Lang;
  setSelectedLang: (l: Lang) => void;
  resolvedTheme: 'dark' | 'light';
  toggleTheme: () => void;
  landingInput: string;
  setLandingInput: (v: string) => void;
  twText: string;      // typewriter placeholder text (animated in App — shared with dashboard)
  twCursor: boolean;
  provider: Provider;
  setProvider: (p: Provider) => void;
  modelOptions: { id: Provider; label: string; sub: string }[];
  mode: 'build' | 'chat';
  setMode: (m: 'build' | 'chat') => void;
  byokKeys: Partial<Record<ByokProvider, string>>;
  saveByokKeys: (next: Partial<Record<ByokProvider, string>>) => void;
}

export function LandingPage({
  t, isAdlam, selectedLang, setSelectedLang, resolvedTheme, toggleTheme,
  landingInput, setLandingInput, twText, twCursor,
  provider, setProvider, modelOptions, mode, setMode, byokKeys, saveByokKeys,
}: LandingPageProps) {
  const { signIn, signInWithEmail, signUpWithEmail, error: authContextError } = useAuth();

  /* auth modal state — landing-only */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'google'>('google');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [byokModalOpen, setByokModalOpen] = useState(false);
  const [landingModelOpen, setLandingModelOpen] = useState(false);
  const landingModelRef = useRef<HTMLDivElement>(null);
  const landingTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (authContextError) setAuthError(authContextError); }, [authContextError]);

  /* Escape closes the auth modal and the model dropdown */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAuthModalOpen(false); setAuthError(null); setLandingModelOpen(false);
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      if (authMode === 'google') await signIn();
      else if (authMode === 'login') await signInWithEmail(email, password);
      else await signUpWithEmail(email, password);
    } catch (err: any) { setAuthError(err.message || t.errorAuth); }
  };

  useEffect(() => {
    if (!landingModelOpen) return;
    const handler = (e: MouseEvent) => {
      if (landingModelRef.current && !landingModelRef.current.contains(e.target as Node)) setLandingModelOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [landingModelOpen]);

  return (
    <div className={cn('min-h-screen relative overflow-x-hidden', isAdlam && 'font-adlam')}
      style={{ background: 'var(--app-bg)', color: 'var(--text-primary)' }}>

      <ByokModal open={byokModalOpen} keys={byokKeys} onSave={saveByokKeys} onClose={() => setByokModalOpen(false)} fr={selectedLang.code === "fr"} />

      {/* ambient wash — single soft glow behind hero, no grid mesh */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute w-[80%] h-[55%] rounded-full top-[-15%] left-1/2 -translate-x-1/2"
          style={{ background: P, filter: 'blur(140px)', opacity: 0.05 }} />
      </div>

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-2 px-3 md:px-10 h-16 border-b border-white/5"
        style={{ background: 'var(--navbar-bg)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-1.5 md:gap-2.5 min-w-0 flex-shrink-0">
          <GandoLogo size={22} />
          <span style={{ fontFamily: MANROPE, fontSize: 18, fontWeight: 900, background: `linear-gradient(135deg,${P},${S})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Gando</span>
          <span className="hidden sm:inline" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', color: '#52525b', textTransform: 'uppercase', marginLeft: 2 }}>BETA</span>
        </div>
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <button onClick={toggleTheme} title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-xl transition-colors"
            style={{ color: 'var(--text-muted)', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}>
            {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <LanguageSelector currentLanguage={selectedLang} languages={LANGS} onSelect={setSelectedLang} buttonClassName="!px-2.5 md:!px-4" />
          <button onClick={() => { setAuthMode('login'); setAuthError(null); setAuthModalOpen(true); }}
            className="hidden sm:inline-flex text-sm font-bold text-zinc-400 hover:text-white transition-colors px-2.5 md:px-4 py-2 rounded-xl hover:bg-white/5"
            style={{ fontFamily: MANROPE }}>
            {t.signIn}
          </button>
          <button onClick={() => { setAuthMode('google'); setAuthError(null); setAuthModalOpen(true); }}
            className="flex items-center gap-1.5 px-2.5 md:px-4 py-2 rounded-xl font-black text-black text-[13px] md:text-sm transition-all hover:scale-[1.03] active:scale-95"
            style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--glow-primary-sm)', fontFamily: MANROPE, whiteSpace: 'nowrap' }}>
            <span>{t.getStarted}</span>
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative z-10 pt-24 sm:pt-32 pb-20 px-5 flex flex-col items-center text-center">
        <div style={{ maxWidth: 820, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20, fontFamily: MANROPE, fontSize: 11, fontWeight: 900, letterSpacing: '0.16em', color: P, textTransform: 'uppercase' }}>
            <span>{selectedLang.code === 'fr' ? 'CONÇU POUR' : 'BUILT FOR'}</span>
            <RotatingText
              texts={['Pulaar', 'Hausa', 'Yoruba', 'Igbo', 'Swahili']}
              mainClassName="overflow-hidden rounded-md"
              style={{ background: '#3b82f6', color: '#ffffff', padding: '2px 10px', letterSpacing: '0.08em' }}
              staggerFrom="last"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '-120%' }}
              staggerDuration={0.025}
              splitLevelClassName="overflow-hidden"
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              rotationInterval={2000}
              splitBy="characters"
              auto
              loop
            />
          </div>
          <h2 dir={isAdlam ? 'rtl' : undefined} className={cn(isAdlam && 'font-adlam-display')} style={{ fontFamily: isAdlam ? undefined : MANROPE, fontWeight: 900, fontSize: 'clamp(26px,4vw,48px)', lineHeight: 1.1, letterSpacing: isAdlam ? 0 : '-0.03em', color: 'var(--text-primary)', marginBottom: 14 }}>
            {t.loginLine1} {t.loginLine2}{' '}
            <span style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t.loginLine3}</span>
          </h2>

          {/* ── MARQUEE — short verses, seamless loop, fades before the edge ── */}
          {(() => {
            const latin = selectedLang.code === 'fr'
              ? ['Créez dans votre langue', "L'IA pour l'Afrique", 'Sans code']
              : ['Build in any language', 'AI for Africa', 'No code needed'];
            const adlam = ['𞤃𞤢𞤸𞤭𞤪 𞤫 𞤳𞤢𞤤𞤢 𞤯𞤫𞤥𞤽𞤢𞤤', '𞤖𞤢𞤳𞥆𞤭𞤤𞤮 𞤳𞤵𞥄𞤩𞤢𞤤 𞤬𞤭𞥄 𞤀𞤬𞤪𞤭𞤳', '𞤳𞤮𞥄𞤣𞤭 𞤸𞤢𞥄𞤶𞤢𞤼𞤢𞥄'];
            // half = phrases repeated wide enough to fill any viewport; track holds two halves → translateX(-50%) loops seamlessly
            const half = (arr: string[], isAdlam: boolean) =>
              Array.from({ length: 4 }).flatMap((_, r) =>
                arr.map((p, i) => (
                  <span className="gando-marquee-item" key={`${r}-${i}`}>
                    <span className={isAdlam ? 'font-adlam' : undefined} dir={isAdlam ? 'rtl' : undefined}>{p}</span>
                    <span className="gando-marquee-sep" aria-hidden="true">✦</span>
                  </span>
                ))
              );
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '0 0 32px' }}>
                <div className="gando-marquee">
                  <div className="gando-marquee-track gando-marquee-adlam">{half(adlam, true)}{half(adlam, true)}</div>
                </div>
                <div className="gando-marquee">
                  <div className="gando-marquee-track is-reverse gando-marquee-latin">{half(latin, false)}{half(latin, false)}</div>
                </div>
              </div>
            );
          })()}

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
                    aria-haspopup="menu" aria-expanded={landingModelOpen}
                    style={{ height: 38, borderRadius: 12, background: 'var(--btn-bg)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 700 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: PROVIDER_COLOR[provider] }} />
                    {PROVIDER_LABEL[provider]}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                  {landingModelOpen && (
                    <div style={{ position: 'absolute', top: 44, left: 0, background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'hidden', overflowY: 'auto', minWidth: 240, maxHeight: 132, zIndex: 50 }}>
                      {modelOptions.map(m => (
                        <button type="button" key={m.id} onClick={() => { setProvider(m.id); setLandingModelOpen(false); }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent', width: '100%', textAlign: 'left', border: 'none' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: PROVIDER_COLOR[m.id] }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{m.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{m.sub}</div>
                          </div>
                          {provider === m.id && <Check className="w-3.5 h-3.5" style={{ color: '#3b82f6', flexShrink: 0 }} />}
                        </button>
                      ))}
                      <button type="button" onClick={() => { setByokModalOpen(true); setLandingModelOpen(false); }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent', borderTop: '1px solid var(--border)', width: '100%', textAlign: 'left', borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}>
                        <Plus className="w-3.5 h-3.5" style={{ color: '#3b82f6', flexShrink: 0 }} />
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{selectedLang.code === "fr" ? "Utilisez votre clé" : "Bring your own key"}</div>
                      </button>
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
            <span>🔒 Private by default</span><span style={{ color: '#3f3f46' }}>·</span>
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
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fff'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#767575'}>
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
            <motion.div role="dialog" aria-modal="true" aria-label="Sign in" className="relative z-10 w-full rounded-3xl border border-white/10 p-8"
              style={{ maxWidth: 420, background: '#0f0f0f', boxShadow: '0 40px 100px rgba(0,0,0,0.85)' }}
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}>

              <button aria-label="Close" onClick={() => { setAuthModalOpen(false); setAuthError(null); }}
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
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = 'var(--glow-primary-lg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'var(--glow-primary-sm)'}>
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
}
