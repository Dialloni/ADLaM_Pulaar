import { useState, useEffect, useRef, useCallback } from 'react';
import { GandoLogo } from './components/GandoLogo';
import {
  Loader2, Trash2, Eye, Code as CodeIcon, Download, AlertTriangle,
  Search, Bell, LayoutDashboard, FolderKanban, Globe2, Settings,
  Users, BookOpen, Activity, Sparkles, LogOut, ChevronRight,
  RotateCcw, CheckCircle2, XCircle, AlertCircle, X, PanelLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './contexts/AuthContext';
import {
  collection, addDoc, updateDoc, doc, query, where,
  onSnapshot, deleteDoc, db, serverTimestamp,
  handleFirestoreError, OperationType,
} from './firebase';
import { Project, Message } from './types';
import { generateProject, editProject } from './services/geminiService';
import { Chat } from './components/Chat';
import { Preview } from './components/Preview';
import { CodeEditor } from './components/CodeEditor';
import { LanguageSelector } from './components/LanguageSelector';
import { cn } from './lib/utils';
import { TRANSLATIONS, LanguageCode } from './translations';

/* ── constants ──────────────────────────────────── */
const LANGS: { code: LanguageCode; name: string }[] = [
  { code: 'ff-adlm', name: '𞤆𞤓𞤂𞤀𞥄𞤈 (𞤀𞤁𞤂𞤀𞤃)' },
  { code: 'en',      name: 'ENGLISH' },
  { code: 'fr',      name: 'FRANÇAIS' },
];
const P = '#ff8b9b';
const S = '#fd8b00';
const T = '#bca2ff';
const MANROPE = 'Manrope, sans-serif';

type NavPage = 'dashboard' | 'projects' | 'assets' | 'docs' | 'status';

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
   ROOT APP
════════════════════════════════════════════════════ */
export default function App() {
  const { user, loading, error: authContextError, signIn, signInWithEmail, signUpWithEmail, logout } = useAuth();

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
  const [generationStatus, setGenerationStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [selectedLang, setSelectedLang] = useState(LANGS[0]);
  const t = TRANSLATIONS[selectedLang.code] || TRANSLATIONS.en;
  const isAdlam = selectedLang.code === 'ff-adlm';

  /* nav / UI */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [page, setPage] = useState<NavPage>('dashboard');
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [headerSearch, setHeaderSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

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
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => { if (authContextError) { setAuthError(authContextError); setGlobalError(authContextError); } }, [authContextError]);

  /* projects listener */
  useEffect(() => {
    if (!user) { setProjects([]); return; }
    const q = query(collection(db, 'projects'), where('userId', '==', user.uid));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      setProjects(list);
      if (currentProject) {
        const up = list.find(p => p.id === currentProject.id);
        if (up && up.updatedAt !== currentProject.updatedAt) setCurrentProject(up);
      }
    }, err => setGlobalError(`Permission Error: ${err.message}`));
  }, [user, currentProject?.id]);

  /* messages listener */
  useEffect(() => {
    if (!currentProject) { setMessages([]); return; }
    const q = query(collection(db, 'projects', currentProject.id, 'messages'));
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

  /* ── handlers ─────────────────────────────────── */
  const handleLogin = async () => {
    setAuthError(null);
    try {
      if (authMode === 'google') await signIn();
      else if (authMode === 'login') await signInWithEmail(email, password);
      else await signUpWithEmail(email, password);
    } catch (err: any) { setAuthError(err.message || t.errorAuth); }
  };

  const createNewProject = async (prompt: string) => {
    const result = await generateProject(prompt, selectedLang.name, setGenerationStatus);
    const data = {
      userId: user!.uid, name: result.name, description: prompt,
      language: selectedLang.name, languageCode: selectedLang.code,
      code: result.code, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    try {
      const ref = await addDoc(collection(db, 'projects'), data);
      const np = { id: ref.id, ...data } as unknown as Project;
      setCurrentProject(np);
      await addDoc(collection(db, 'projects', ref.id, 'messages'), { projectId: ref.id, role: 'user', content: prompt, timestamp: serverTimestamp() });
      await addDoc(collection(db, 'projects', ref.id, 'messages'), { projectId: ref.id, role: 'assistant', content: result.explanation, codeSnapshot: result.code, timestamp: serverTimestamp() });
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'projects'); }
  };

  const updateExistingProject = async (prompt: string) => {
    if (!currentProject) return;
    try {
      await addDoc(collection(db, 'projects', currentProject.id, 'messages'), { projectId: currentProject.id, role: 'user', content: prompt, timestamp: serverTimestamp() });
      const result = await editProject(prompt, currentProject.code, messages, currentProject.language, setGenerationStatus);
      await updateDoc(doc(db, 'projects', currentProject.id), { code: result.code, updatedAt: serverTimestamp() });
      await addDoc(collection(db, 'projects', currentProject.id, 'messages'), { projectId: currentProject.id, role: 'assistant', content: result.explanation, codeSnapshot: result.code, timestamp: serverTimestamp() });
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, `projects/${currentProject.id}`); }
  };

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    setIsGenerating(true);
    const prompt = input; setInput('');
    try {
      if (!currentProject) await createNewProject(prompt);
      else await updateExistingProject(prompt);
    } catch (err: any) {
      const m = err.message || '';
      setGlobalError(/429|quota|rate|RESOURCE_EXHAUSTED/i.test(m)
        ? "You've reached the AI limit. Please wait a minute." : m || 'Unexpected error.');
    } finally { setIsGenerating(false); }
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

  /* ── derived metrics ──────────────────────────── */
  const completionPct = Math.min(projects.length * 12, 96);
  const tokenPct = Math.min(messages.length * 2.5, 90);
  const perfPct = 94;
  const userMessages = messages.filter(m => m.role === 'user').length;
  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(projectSearch.toLowerCase())
  );

  /* ═════════════════════════════════════════════════
     LOADING
  ═════════════════════════════════════════════════ */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0e0e0e' }}>
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
     LOGIN
  ═════════════════════════════════════════════════ */
  if (!user) return (
    <div className={cn('min-h-screen flex items-center relative overflow-hidden', isAdlam && 'font-adlam')}
      style={{ background: '#0e0e0e', padding: '48px 64px' }}>
      {/* ambient blobs */}
      <div className="absolute w-[55%] h-[55%] rounded-full top-[-15%] left-[-10%] pointer-events-none"
        style={{ background: P, filter: 'blur(120px)', opacity: 0.1 }} />
      <div className="absolute w-[55%] h-[55%] rounded-full bottom-[-15%] right-[-10%] pointer-events-none"
        style={{ background: S, filter: 'blur(120px)', opacity: 0.1 }} />
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(to right,#80808006 1px,transparent 1px),linear-gradient(to bottom,#80808006 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="absolute top-8 right-8 z-50">
        <LanguageSelector currentLanguage={selectedLang} languages={LANGS} onSelect={setSelectedLang} />
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
        className="relative z-10 w-full flex items-center gap-16">

        {/* ── LEFT COLUMN ── */}
        <div className="flex-1 flex flex-col" style={{ gap: 28 }}>

          {/* logo + wordmark + beta chip */}
          <div className="flex items-center gap-3">
            <GandoLogo size={28} />
            <span style={{ fontFamily: MANROPE, fontSize: 22, fontWeight: 900, background: `linear-gradient(135deg,${P},${S})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Gando
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10"
              style={{ background: 'rgba(255,255,255,0.04)', fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', color: '#adaaaa', textTransform: 'uppercase' }}>
              <GandoLogo size={11} />
              PUBLIC BETA
            </span>
          </div>

          {/* eyebrow */}
          <p style={{ fontFamily: MANROPE, fontSize: 11, fontWeight: 900, letterSpacing: '0.15em', color: P, textTransform: 'uppercase', margin: 0 }}>
            {t.loginEyebrow}
          </p>

          {/* hero h1 */}
          <h1 className={cn(isAdlam && 'font-adlam')}
            style={{ fontFamily: isAdlam ? undefined : MANROPE, fontWeight: 900, fontSize: 'clamp(48px,5.5vw,72px)', lineHeight: 1.0, color: '#fff', margin: 0 }}>
            {t.loginLine1}<br />
            {t.loginLine2}<br />
            <span style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {t.loginLine3}
            </span>
          </h1>

          {/* subtext */}
          <p className={cn(isAdlam && 'font-adlam')}
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, color: '#767575', lineHeight: 1.6, maxWidth: 460, margin: 0 }}>
            {t.heroSubtitle}
          </p>

          {/* auth section */}
          <div className="flex flex-col" style={{ gap: 10, maxWidth: 380 }}>
            {authMode === 'google' ? (
              <button onClick={handleLogin}
                className="flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
                style={{ padding: '16px 32px', borderRadius: 9999, background: '#ffffff', color: '#000000', fontFamily: MANROPE, fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', width: '100%' }}>
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                <span className={cn(isAdlam && 'font-adlam')}>{t.loginWithGoogle}</span>
              </button>
            ) : (
              <div className="space-y-3 rounded-2xl p-5 border border-white/10" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <h3 className="text-base font-black text-white text-left" style={{ fontFamily: MANROPE }}>
                  {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h3>
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
                  className="gando-input w-full rounded-xl px-4 py-3 text-white border border-white/10 outline-none transition-all" />
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                  className="gando-input w-full rounded-xl px-4 py-3 text-white border border-white/10 outline-none transition-all" />
                {authError && <p className="text-red-400 text-xs">{authError}</p>}
                <button onClick={handleLogin} className="w-full py-3 rounded-xl font-black text-black transition-all hover:scale-[1.01]"
                  style={{ fontFamily: MANROPE, background: 'var(--gradient-brand)', boxShadow: 'var(--glow-primary-sm)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--glow-primary-lg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--glow-primary-sm)'}>
                  {authMode === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
                <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="w-full text-xs font-bold transition-colors" style={{ color: P }}>
                  {authMode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
                </button>
              </div>
            )}
            {authError && authMode === 'google' && <p className="text-red-400 text-xs">{authError}</p>}
            <button onClick={() => { setAuthMode(authMode === 'google' ? 'login' : 'google'); setAuthError(null); }}
              className="text-sm font-medium transition-colors hover:text-white text-center" style={{ color: '#767575' }}>
              {authMode === 'google' ? 'Or use email & password' : '← Back to Google Login'}
            </button>
          </div>

          {/* trust badges */}
          <div className="flex items-center gap-3 flex-wrap" style={{ fontSize: 12, color: '#52525b' }}>
            <span>🔒 SOC 2 Type II</span>
            <span style={{ color: '#3f3f46' }}>•</span>
            <span>Data stays in-region</span>
            <span style={{ color: '#3f3f46' }}>•</span>
            <span>Free during Beta</span>
          </div>
        </div>

        {/* ── RIGHT COLUMN — stacked cards ── */}
        <div className="flex-1 hidden md:flex items-center justify-center relative" style={{ height: 520 }}>
          {/* card 3 — back-left, deep purple */}
          <div className="absolute" style={{
            width: 300, height: 380, borderRadius: 24,
            background: 'linear-gradient(145deg,#6B21A8,#581C87)',
            transform: 'rotate(-8deg) translate(-90px,24px)',
            zIndex: 1, boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
          }}>
            <div style={{ padding: 24 }}><GandoLogo size={32} mono /></div>
            <div style={{ position: 'absolute', top: 24, right: 24 }}>
              <span style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', borderRadius: 9999, padding: '4px 12px', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#fff', textTransform: 'uppercase' }}>YORUBA</span>
            </div>
          </div>

          {/* card 2 — mid, lighter purple */}
          <div className="absolute" style={{
            width: 300, height: 380, borderRadius: 24,
            background: 'linear-gradient(145deg,#7C3AED,#6D28D9)',
            transform: 'rotate(-3deg) translate(-28px,12px)',
            zIndex: 2, boxShadow: '0 40px 80px rgba(0,0,0,0.55)',
          }}>
            <div style={{ padding: 24 }}><GandoLogo size={32} mono /></div>
            <div style={{ position: 'absolute', top: 24, right: 24 }}>
              <span style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', borderRadius: 9999, padding: '4px 12px', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#fff', textTransform: 'uppercase' }}>ADLAM</span>
            </div>
          </div>

          {/* card 1 — front, brown/rust */}
          <div className="absolute" style={{
            width: 300, height: 380, borderRadius: 24,
            background: 'linear-gradient(145deg,#92400E,#78350F)',
            transform: 'rotate(3deg) translate(44px,0px)',
            zIndex: 3, boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
          }}>
            <div style={{ padding: 24 }}><GandoLogo size={32} mono /></div>
            <div style={{ position: 'absolute', top: 24, right: 24 }}>
              <span style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', borderRadius: 9999, padding: '4px 12px', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#fff', textTransform: 'uppercase' }}>FRANÇAIS</span>
            </div>
            <div style={{ position: 'absolute', bottom: 32, left: 24, right: 24 }}>
              <p style={{ color: '#fff', fontFamily: MANROPE, fontWeight: 900, fontSize: 22, margin: '0 0 4px 0' }}>Marché Bamako</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: '0 0 10px 0' }}>100% built</p>
              <div style={{ height: 4, borderRadius: 9999, background: 'rgba(255,255,255,0.12)' }}>
                <div style={{ height: '100%', borderRadius: 9999, width: '100%', background: 'var(--gradient-brand)' }} />
              </div>
            </div>
          </div>
        </div>

      </motion.div>
    </div>
  );

  /* ═════════════════════════════════════════════════
     MAIN APP
  ═════════════════════════════════════════════════ */
  return (
    <div className={cn('h-screen w-screen flex flex-col overflow-hidden', isAdlam && 'font-adlam')} style={{ background: '#0e0e0e', color: '#fff' }}>

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
      <header className="fixed top-0 left-0 right-0 z-50 h-20 flex items-center justify-between px-8 flex-shrink-0"
        style={{ background: 'rgba(14,14,14,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--line-1)' }}>
        {/* brand + nav */}
        <div className="flex items-center gap-8">
          <GandoLogo size={28} />
          <span className={cn('text-2xl font-black tracking-tight cursor-pointer select-none', isAdlam && 'font-adlam')}
            style={{ fontFamily: isAdlam ? undefined : MANROPE, background: `linear-gradient(135deg,${P},${S})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            onClick={() => { setCurrentProject(null); setPage('dashboard'); }}>
            {t.appName.toUpperCase()}
          </span>
          <nav className="hidden md:flex items-center">
            {([['dashboard', t.dashboardNav], ['projects', t.projectsNav], ['assets', t.assetsNav]] as [NavPage, string][]).map(([p, label]) => (
              <button key={p} onClick={() => { setPage(p); setCurrentProject(null); }}
                className={cn('px-4 py-2 text-sm font-bold transition-all', isAdlam && 'font-adlam')}
                style={page === p && !currentProject
                  ? { color: P, borderBottom: `2px solid ${P}`, borderRadius: 0 }
                  : { color: '#767575' }}>
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* search + icons + profile */}
        <div className="flex items-center gap-4">
          {/* ── header search ── */}
          <div ref={searchRef} className="relative">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full transition-all"
              style={{ background: searchOpen ? '#1a1a1a' : '#131313', border: searchOpen ? '1px solid rgba(255,139,155,0.3)' : '1px solid transparent' }}>
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: searchOpen ? P : '#71717a' }} />
              <input
                value={headerSearch}
                onChange={e => { setHeaderSearch(e.target.value); setSearchOpen(e.target.value.length > 0); }}
                onFocus={() => { if (headerSearch.length > 0) setSearchOpen(true); }}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setHeaderSearch(''); setSearchOpen(false); }
                  if (e.key === 'Enter' && headerSearch.trim()) {
                    setProjectSearch(headerSearch.trim());
                    setPage('projects');
                    setCurrentProject(null);
                    setSearchOpen(false);
                  }
                }}
                placeholder={t.searchPlaceholder}
                className={cn('gando-input bg-transparent border-none outline-none text-sm w-40 text-white placeholder-zinc-600', isAdlam && 'font-adlam')}
              />
              {headerSearch && (
                <button onClick={() => { setHeaderSearch(''); setSearchOpen(false); }}
                  className="text-zinc-500 hover:text-white transition-colors flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* results dropdown */}
            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-72 rounded-2xl border border-white/10 shadow-2xl overflow-hidden z-50"
                  style={{ background: '#111' }}
                >
                  {(() => {
                    const q = headerSearch.toLowerCase().trim();
                    const hits = projects.filter(p =>
                      p.name.toLowerCase().includes(q) ||
                      (p.description || '').toLowerCase().includes(q) ||
                      (p.language || '').toLowerCase().includes(q)
                    ).slice(0, 5);

                    return hits.length === 0 ? (
                      <div className="px-4 py-5 text-center">
                        <Search className="w-5 h-5 mx-auto mb-2 text-zinc-600" />
                        <p className="text-sm text-zinc-500">No projects match <span className="text-white font-bold">"{headerSearch}"</span></p>
                      </div>
                    ) : (
                      <>
                        <div className="px-4 pt-3 pb-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Projects</p>
                        </div>
                        {hits.map(p => (
                          <button
                            key={p.id}
                            onClick={() => { openProject(p); setHeaderSearch(''); setSearchOpen(false); setCurrentProject(p); }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all text-left group"
                          >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `${P}18` }}>
                              <Sparkles className="w-4 h-4" style={{ color: P }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate group-hover:text-[#ff8b9b] transition-colors">{p.name}</p>
                              <p className="text-[10px] text-zinc-500 truncate">{p.language} · {p.description?.slice(0, 40) || '—'}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors flex-shrink-0" />
                          </button>
                        ))}
                        {projects.length > 5 && (
                          <button
                            onClick={() => { setProjectSearch(headerSearch); setPage('projects'); setCurrentProject(null); setSearchOpen(false); }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-t border-white/5 text-xs font-bold transition-all hover:bg-white/5"
                            style={{ color: P }}
                          >
                            View all results in Projects <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button className="p-2 rounded-xl text-zinc-400 hover:text-white transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: P }} />
          </button>

          {/* profile dropdown */}
          <div ref={profileRef} className="relative">
            <button onClick={() => setProfileOpen(o => !o)} className="flex items-center gap-2 rounded-full p-0.5 border-2 transition-all"
              style={{ borderColor: profileOpen ? P : `${P}50` }}>
              {user.photoURL
                ? <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full object-cover" />
                : <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-black"
                    style={{ background: `linear-gradient(135deg,${P},${S})` }}>
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
              }
            </button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-14 w-64 rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50"
                  style={{ background: '#131313' }}>
                  {/* user info */}
                  <div className="p-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      {user.photoURL
                        ? <img src={user.photoURL} alt="" className="w-10 h-10 rounded-xl object-cover" />
                        : <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-black"
                            style={{ background: `linear-gradient(135deg,${P},${S})` }}>
                            {(user.displayName || user.email || 'U')[0].toUpperCase()}
                          </div>
                      }
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white truncate" style={{ fontFamily: MANROPE }}>{user.displayName || 'User'}</p>
                        <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                      </div>
                    </div>
                  </div>
                  {/* actions */}
                  <div className="p-2">
                    <button onClick={() => { setPage('status'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white transition-all text-left">
                      <Activity className="w-4 h-4 flex-shrink-0" /> {t.systemStatusLabel}
                    </button>
                    <button onClick={() => { setPage('docs'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white transition-all text-left">
                      <BookOpen className="w-4 h-4 flex-shrink-0" /> {t.documentationLabel}
                    </button>
                    <div className="my-1 border-t border-white/5" />
                    <button onClick={() => { logout(); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all text-left">
                      <LogOut className="w-4 h-4 flex-shrink-0" /> {t.signOut}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* ════════ BODY ════════ */}
      <div className="flex flex-1 overflow-hidden pt-20">

        {/* ════ SIDEBAR ════ */}
        <aside className="flex-shrink-0 flex flex-col overflow-y-auto border-r border-white/5"
          style={{
            background: '#0e0e0e',
            boxShadow: '20px 0 40px rgba(0,0,0,0.4)',
            width: sidebarCollapsed ? 64 : 288,
            transition: 'width 200ms cubic-bezier(0.16,1,0.3,1)',
            overflowX: 'hidden',
          }}>

          {/* toggle button */}
          <div className="flex px-4 pt-5 pb-2" style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-end' }}>
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <PanelLeft className="w-4 h-4" style={{ color: '#767575' }} />
            </button>
          </div>

          {/* user — hidden when collapsed */}
          {!sidebarCollapsed && (
            <div className="px-8 pt-4 pb-6">
              <p className={cn('text-white font-black text-lg', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
                {user.displayName || user.email?.split('@')[0] || 'Builder'}
              </p>
              <p className={cn('text-zinc-500 text-xs font-bold uppercase tracking-widest mt-0.5', isAdlam && 'font-adlam')}>
                {projects.length} {t.projectsCreatedLabel}
              </p>
            </div>
          )}

          {/* nav */}
          <nav className="flex-1 space-y-0.5">
            {([
              { icon: LayoutDashboard, label: t.dashboardNav,        pg: 'dashboard' as NavPage },
              { icon: FolderKanban,   label: t.myProjectsLabel,     pg: 'projects'  as NavPage },
              { icon: Globe2,         label: t.languageAssetsLabel,  pg: 'assets'    as NavPage },
              { icon: Settings,       label: t.settingsNav,          pg: null },
              { icon: Users,          label: t.teamHubLabel,         pg: null },
            ]).map(({ icon: Icon, label, pg }) => {
              const active = pg && page === pg && !currentProject;
              return (
                <button key={label} onClick={() => { if (pg) { setPage(pg); setCurrentProject(null); } }}
                  className={cn('w-full flex items-center py-4 text-sm font-bold', !sidebarCollapsed && 'gap-4', isAdlam && 'font-adlam')}
                  style={{
                    color: active ? 'var(--fg-1)' : 'var(--fg-3)',
                    background: active ? 'linear-gradient(to right, rgba(255,139,155,0.12), transparent)' : 'transparent',
                    border: 'none',
                    borderLeft: active ? '4px solid var(--color-primary)' : '4px solid transparent',
                    transition: 'all 150ms cubic-bezier(0.16,1,0.3,1)',
                    justifyContent: sidebarCollapsed ? 'center' : undefined,
                    paddingLeft: sidebarCollapsed ? 0 : '28px',
                    paddingRight: sidebarCollapsed ? 0 : '24px',
                  }}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!sidebarCollapsed && <span style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{label}</span>}
                </button>
              );
            })}
          </nav>

          {/* new project */}
          <div className="py-5" style={{ paddingLeft: sidebarCollapsed ? 12 : 24, paddingRight: sidebarCollapsed ? 12 : 24 }}>
            <button onClick={() => { setCurrentProject(null); setInput(''); setPage('dashboard'); }}
              className={cn('w-full py-4 rounded-xl font-black text-black transition-all hover:scale-[1.02] active:scale-95', isAdlam && 'font-adlam')}
              style={{ fontFamily: isAdlam ? undefined : MANROPE, background: 'var(--gradient-brand)', boxShadow: 'var(--glow-primary-sm)' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--glow-primary-lg)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--glow-primary-sm)'}>
              {sidebarCollapsed ? '+' : `+ ${t.newProject}`}
            </button>
          </div>

          {/* footer */}
          <div className="py-5 border-t border-white/5 space-y-3"
            style={{ paddingLeft: sidebarCollapsed ? 12 : 32, paddingRight: sidebarCollapsed ? 12 : 32 }}>
            <button onClick={() => { setPage('docs'); setCurrentProject(null); }}
              className={cn('flex items-center text-xs font-black uppercase tracking-tight text-zinc-600 hover:text-zinc-300 transition-colors w-full', sidebarCollapsed ? 'justify-center' : 'gap-3 text-left', isAdlam && 'font-adlam')}>
              <BookOpen className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && t.documentationLabel}
            </button>
            <button onClick={() => { setPage('status'); setCurrentProject(null); }}
              className={cn('flex items-center text-xs font-black uppercase tracking-tight text-zinc-600 hover:text-zinc-300 transition-colors w-full', sidebarCollapsed ? 'justify-center' : 'gap-3 text-left', isAdlam && 'font-adlam')}>
              <Activity className="w-4 h-4 flex-shrink-0" style={{ color: S }} />
              {!sidebarCollapsed && t.systemStatusLabel}
            </button>
            <button onClick={() => logout()}
              className={cn('flex items-center text-xs font-black uppercase tracking-tight text-zinc-600 hover:text-red-400 transition-colors mt-2 w-full', sidebarCollapsed ? 'justify-center' : 'gap-3 text-left', isAdlam && 'font-adlam')}>
              <LogOut className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && t.signOut}
            </button>
          </div>
        </aside>

        {/* ════ MAIN ════ */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {/* ambient glows */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
            <div className="absolute w-96 h-96 rounded-full top-0 -left-20" style={{ background: P, filter: 'blur(80px)', opacity: 0.08 }} />
            <div className="absolute w-[500px] h-[500px] rounded-full bottom-0 -right-40" style={{ background: S, filter: 'blur(80px)', opacity: 0.08 }} />
          </div>

          {/* ── WORKSPACE (project open) ── */}
          {currentProject ? (
            <div className="flex flex-1 overflow-hidden relative z-10">
              {/* workspace top bar */}
              <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-6 border-b border-white/5 z-20"
                style={{ background: 'rgba(14,14,14,0.85)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center gap-3">
                  <button onClick={() => setCurrentProject(null)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white transition-colors" title={t.recentProjects}>
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  {isRenaming ? (
                    <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                      onBlur={handleRename} onKeyDown={e => e.key === 'Enter' && handleRename()}
                      className="gando-input bg-transparent border-b text-white text-sm font-bold outline-none w-48 px-1"
                      style={{ borderColor: `${P}60` }} />
                  ) : (
                    <span className={cn('text-sm font-black text-white cursor-pointer hover:text-[#ff8b9b] transition-colors', isAdlam && 'font-adlam')}
                      style={{ fontFamily: isAdlam ? undefined : MANROPE }}
                      onClick={() => { setIsRenaming(true); setNewName(currentProject.name); }}>
                      {currentProject.name}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest"
                    style={{ background: `${P}15`, color: P, border: `1px solid ${P}25` }}>
                    {currentProject.language}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={() => setActiveTab('preview')}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={activeTab === 'preview' ? { background: 'rgba(255,139,155,0.14)', color: '#fff' } : { color: '#adaaaa' }}>
                      <Eye className="w-3.5 h-3.5" /> {t.preview}
                    </button>
                    <button onClick={() => setActiveTab('code')}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={activeTab === 'code' ? { background: 'rgba(255,139,155,0.14)', color: '#fff' } : { color: '#adaaaa' }}>
                      <CodeIcon className="w-3.5 h-3.5" /> {t.code}
                    </button>
                  </div>
                  <button onClick={handleDownload}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <Download className="w-3.5 h-3.5" /> {t.download}
                  </button>
                </div>
              </div>

              {/* chat + preview */}
              <div className="flex flex-1 pt-14 overflow-hidden">
                {/* chat panel — wider */}
                <div className="w-[480px] flex-shrink-0 flex flex-col" style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
                  <Chat messages={messages} input={input} setInput={setInput} onSend={handleSend}
                    isGenerating={isGenerating} generationStatus={generationStatus}
                    selectedLanguage={selectedLang.name} currentLanguage={selectedLang}
                    languages={LANGS} onLanguageSelect={setSelectedLang}
                    languageCode={selectedLang.code} t={t}
                    currentCode={currentProject?.code} onRevert={handleRevert} />
                </div>
                <AnimatePresence mode="wait">
                  <motion.div key="panel" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    transition={{ type: 'spring', damping: 30, stiffness: 200 }} className="flex-1 overflow-hidden">
                    {activeTab === 'preview'
                      ? <Preview code={currentProject.code} />
                      : <CodeEditor code={currentProject.code} onChange={handleCodeChange} t={t} languageCode={selectedLang.code} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

          ) : page === 'projects' ? (
            /* ══ PROJECTS PAGE ══ */
            <div className="flex-1 overflow-y-auto relative z-10 p-8 md:p-10 space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className={cn('text-4xl font-black text-white tracking-tighter', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
                    {t.projectsPageTitle}
                  </h1>
                  <p className={cn('text-zinc-500 mt-1', isAdlam && 'font-adlam')}>{t.projectsPageSubtitle}</p>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10" style={{ background: '#131313', minWidth: 260 }}>
                  <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <input value={projectSearch} onChange={e => setProjectSearch(e.target.value)}
                    placeholder={t.searchProjectsPlaceholder}
                    className={cn('gando-input bg-transparent border-none outline-none text-sm text-white placeholder-zinc-600 flex-1', isAdlam && 'font-adlam')} />
                  {projectSearch && <button onClick={() => setProjectSearch('')}><X className="w-3.5 h-3.5 text-zinc-500 hover:text-white" /></button>}
                </div>
              </div>

              {filteredProjects.length === 0 ? (
                <div className="rounded-2xl p-12 text-center border border-dashed border-white/10" style={{ background: 'rgba(255,255,255,0.01)' }}>
                  <FolderKanban className="w-8 h-8 mx-auto mb-4" style={{ color: P }} />
                  <p className={cn('text-white font-black text-lg mb-2', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
                    {projectSearch ? 'No matching projects' : t.noProjectsTitle}
                  </p>
                  <p className={cn('text-zinc-600 text-sm', isAdlam && 'font-adlam')}>{t.noProjectsSubtitle}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredProjects.map(p => (
                    <motion.div key={p.id} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      className="group relative rounded-2xl border border-white/8 overflow-hidden transition-all hover:border-white/15"
                      style={{ background: '#131313' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${P}18`, color: P }}>
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => deleteProject(p.id)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all">
                              <Trash2 className="w-3 h-3" /> {t.deleteProjectLabel}
                            </button>
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

          ) : page === 'docs' ? (
            /* ══ DOCUMENTATION PAGE ══ */
            <div className="flex-1 overflow-y-auto relative z-10">
              <div className="w-full p-8 md:p-10 space-y-8">

                {/* ── SEARCH HERO CARD ── */}
                <div style={{ background: 'linear-gradient(135deg, rgba(255,139,155,0.1), rgba(253,139,0,0.06) 60%, rgba(19,19,19,1))', border: '1px solid rgba(255,139,155,0.2)', borderRadius: 20, padding: 28, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                  <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.15em', color: P, textTransform: 'uppercase', marginBottom: 12, fontFamily: MANROPE }}>DOCUMENTATION</p>
                  <h1 className={cn('font-black text-white tracking-tighter mb-2', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE, fontSize: 32 }}>
                    {t.docsPageTitle}
                  </h1>
                  <p className={cn('text-zinc-500 mb-5', isAdlam && 'font-adlam')} style={{ fontSize: 14 }}>{t.docsPageSubtitle}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 14 }}>
                    <Search className="w-4 h-4 flex-shrink-0" style={{ color: '#767575' }} />
                    <span style={{ fontSize: 13, color: '#52525b', fontFamily: 'Inter, sans-serif' }}>Search docs — prompting, deploy, ADLaM...</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['Getting Started', 'Prompting Guide', 'Deploy', 'API Reference', 'ADLaM support'].map(chip => (
                      <span key={chip} style={{ padding: '4px 12px', borderRadius: 9999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11, fontWeight: 600, color: '#adaaaa', fontFamily: MANROPE }}>{chip}</span>
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
                              ? { background: 'rgba(255,139,155,0.12)', border: '1px solid rgba(255,139,155,0.25)', color: '#fff', fontWeight: 700 }
                              : { background: 'transparent', border: '1px solid transparent', color: '#adaaaa', fontWeight: 500 }}>
                            <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? '#ff8b9b' : undefined }} />
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
                            style={{ color: '#767575' }}>
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
                    <div className="flex items-center gap-4 p-5 rounded-2xl relative overflow-hidden" style={{ background: '#131313', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,139,155,0.1)', border: '1px solid rgba(255,139,155,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BookOpen className="w-4 h-4" style={{ color: P }} />
                      </div>
                      <div>
                        <h2 className={cn('font-black text-white', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE, fontSize: 20, marginBottom: 2 }}>{t.docsSection1Title}</h2>
                        <p style={{ fontSize: 12, color: '#767575' }}>Your first app in under 5 minutes</p>
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
                          <div style={{ width: 22, height: 22, borderRadius: 7, background: 'rgba(255,139,155,0.1)', border: '1px solid rgba(255,139,155,0.2)', color: '#ff8b9b', fontFamily: MANROPE, fontWeight: 900, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {n}
                          </div>
                          <span className={cn(isAdlam && 'font-adlam')} style={{ fontSize: 13, fontWeight: 600, color: '#e5e5e5', fontFamily: isAdlam ? undefined : MANROPE, flex: 1 }}>{label}</span>
                          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#767575' }} />
                        </div>
                      ))}
                    </div>

                    {/* ARTICLE CARD */}
                    <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: '#131313', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#767575', textTransform: 'uppercase', marginBottom: 10, fontFamily: MANROPE }}>ARTICLE · 3 MIN READ</p>
                      <h3 className={cn('font-black text-white', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE, fontSize: 20, marginBottom: 12 }}>{t.docsSection2Title}</h3>
                      <p className={cn('text-sm leading-relaxed', isAdlam && 'font-adlam')} style={{ color: '#adaaaa', marginBottom: 16 }}>{t.docsSection2Body}</p>
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
                          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575', lineHeight: 1.3 }}>Updated 2 weeks ago</p>
                        </div>
                      </div>
                    </div>

                    {/* QUICK TIPS */}
                    <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: '#131313', border: '1px solid rgba(255,255,255,0.06)' }}>
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
                  style={{ background: '#131313' }}>
                  <RotateCcw className="w-4 h-4" /> Refresh
                </button>
              </div>

              {/* service rows */}
              {([
                { label: t.statusServer,   status: sysStatus.server,  detail: sysStatus.uptime ? `Uptime: ${Math.floor(sysStatus.uptime / 60)}m` : '' },
                { label: t.statusAI,       status: sysStatus.ai,      detail: sysStatus.aiMs ? `${sysStatus.aiMs}ms latency` : '' },
                { label: t.statusFirebase, status: sysStatus.db,      detail: user ? 'Authenticated' : 'Not connected' },
              ] as { label: string; status: 'ok'|'degraded'|'down'|'checking'; detail: string }[]).map(({ label, status, detail }) => (
                <div key={label} className="flex items-center justify-between p-6 rounded-2xl border border-white/8 relative overflow-hidden" style={{ background: '#131313' }}>
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
                      : status === 'checking' ? { background: 'rgba(255,255,255,0.05)', color: '#999' }
                      : { background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                    {status === 'ok' ? t.statusOperational : status === 'degraded' ? t.statusDegraded : status === 'checking' ? t.statusChecking : t.statusDown}
                  </span>
                </div>
              ))}

              {/* model info */}
              <div className="p-6 rounded-2xl border border-white/8 relative overflow-hidden" style={{ background: '#131313' }}>
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

          ) : (
            /* ══ DASHBOARD ══ */
            <div className="flex-1 overflow-y-auto relative z-10 p-8 md:p-10 space-y-8">

              {/* ── HERO/WELCOME CARD ── */}
              <div style={{ background: 'linear-gradient(135deg, rgba(255,139,155,0.08), rgba(253,139,0,0.04))', border: '1px solid rgba(255,139,155,0.2)', borderRadius: 22, padding: '28px 32px', position: 'relative', overflow: 'hidden' }}>
                <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.15em', color: '#ff8b9b', textTransform: 'uppercase', marginBottom: 16, fontFamily: MANROPE }}>OVERVIEW</p>
                <h1 className={cn('text-4xl md:text-5xl font-black text-white tracking-tighter', isAdlam && 'font-adlam')}
                  style={{ fontFamily: isAdlam ? undefined : MANROPE, marginBottom: 4 }}>
                  {t.gandoViewTitle}
                </h1>
                <p className={cn('text-zinc-500 font-medium', isAdlam && 'font-adlam')} style={{ marginBottom: 20 }}>{t.gandoViewSubtitle}</p>
                {/* inline prompt */}
                <div style={{ padding: '6px 6px 6px 18px', borderRadius: 16, background: 'rgba(10,10,10,0.7)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <LanguageSelector currentLanguage={selectedLang} languages={LANGS} onSelect={setSelectedLang} />
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={t.inputPlaceholder}
                    rows={1}
                    className={cn('gando-input flex-1 bg-transparent border-none outline-none resize-none text-white placeholder-zinc-600 py-2 text-sm font-medium leading-relaxed', isAdlam && 'font-adlam')}
                    style={{ minWidth: 0 }}
                  />
                  <button onClick={handleSend} disabled={isGenerating || !input.trim()}
                    className={cn('flex items-center gap-2 px-5 py-2 rounded-xl font-black text-black transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:scale-100 text-sm flex-shrink-0', isAdlam && 'font-adlam')}
                    style={{ fontFamily: isAdlam ? undefined : MANROPE, background: 'var(--gradient-brand)', boxShadow: 'var(--glow-primary-sm)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--glow-primary-lg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--glow-primary-sm)'}>
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isGenerating ? (generationStatus || t.generating) : t.generateLabel}
                  </button>
                </div>
              </div>

              {/* ── STAT CARDS ROW ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Projects — gradient variant */}
                <div style={{ padding: 20, borderRadius: 18, background: 'linear-gradient(135deg, rgba(255,139,155,0.12), rgba(253,139,0,0.06))', border: '1px solid rgba(255,139,155,0.25)' }}>
                  <p className={cn('text-[10px] font-black uppercase tracking-widest', isAdlam && 'font-adlam')} style={{ color: P, fontFamily: MANROPE, marginBottom: 8 }}>{t.projectsLabel}</p>
                  <p style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', fontFamily: MANROPE, lineHeight: 1, marginBottom: 8 }}>{projects.length}</p>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 9999, background: 'rgba(74,222,128,0.12)', color: '#4ade80', fontSize: 11, fontWeight: 700 }}>+{projects.length} total</span>
                </div>
                {/* Apps Built */}
                <div style={{ padding: 20, borderRadius: 18, background: '#131313', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className={cn('text-[10px] font-black uppercase tracking-widest', isAdlam && 'font-adlam')} style={{ color: S, fontFamily: MANROPE, marginBottom: 8 }}>{t.appsBuiltLabel}</p>
                  <p style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', fontFamily: MANROPE, lineHeight: 1 }}>{projects.length}</p>
                </div>
                {/* Prompts */}
                <div style={{ padding: 20, borderRadius: 18, background: '#131313', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className={cn('text-[10px] font-black uppercase tracking-widest', isAdlam && 'font-adlam')} style={{ color: T, fontFamily: MANROPE, marginBottom: 8 }}>{t.totalPromptsLabel}</p>
                  <p style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', fontFamily: MANROPE, lineHeight: 1 }}>{userMessages}</p>
                </div>
                {/* Performance */}
                <div style={{ padding: 20, borderRadius: 18, background: '#131313', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className={cn('text-[10px] font-black uppercase tracking-widest', isAdlam && 'font-adlam')} style={{ color: '#4ade80', fontFamily: MANROPE, marginBottom: 8 }}>{t.appPerformanceLabel}</p>
                  <p style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', fontFamily: MANROPE, lineHeight: 1, marginBottom: 8 }}>{perfPct}%</p>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 9999, background: 'rgba(74,222,128,0.12)', color: '#4ade80', fontSize: 11, fontWeight: 700 }}>{t.excellentLabel}</span>
                </div>
              </div>

              {/* ── ANALYTICS GRID (donut + gauges) ── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 rounded-2xl p-6 flex items-center justify-between gap-4 relative overflow-hidden shadow-2xl"
                  style={{ background: '#131313', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                  <div className="adinkra-mask absolute inset-0 opacity-[0.025]" />
                  <div className="relative z-10 flex-1">
                    <h2 className={cn('text-2xl font-black text-white tracking-tight mb-1', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
                      {t.projectCompletionLabel}
                    </h2>
                    <p className={cn('text-zinc-500 text-sm max-w-xs mb-6', isAdlam && 'font-adlam')}>{t.completionSubtitle}</p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: P, boxShadow: `0 0 8px ${P}` }} />
                        <span className={cn('text-xs font-black text-white uppercase tracking-wider', isAdlam && 'font-adlam')}>
                          {t.appsGeneratedLabel}: {projects.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: S, boxShadow: `0 0 8px ${S}` }} />
                        <span className={cn('text-xs font-black text-white uppercase tracking-wider', isAdlam && 'font-adlam')}>
                          {t.totalPromptsLabel}: {userMessages}
                        </span>
                      </div>
                    </div>
                  </div>
                  <DonutChart pct={completionPct || 3} label={t.totalFlowLabel} />
                </div>
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <div className="flex-1 rounded-2xl p-6 shadow-xl relative overflow-hidden" style={{ background: '#131313', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                    <div className="flex justify-between items-center mb-4">
                      <h3 className={cn('font-black text-white text-sm', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{t.tokenUsageLabel}</h3>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: `${P}15`, color: P }}>
                        {messages.length * 200} / 50k
                      </span>
                    </div>
                    <Gauge pct={tokenPct} from={P} to={S} shadow={`0 0 12px ${P}80`} />
                    <p className={cn('text-xs text-zinc-600 mt-3 leading-relaxed', isAdlam && 'font-adlam')}>
                      {t.tokenResetHint} <span style={{ color: S, fontWeight: 700 }}>{t.healthyLabel}.</span>
                    </p>
                  </div>
                  <div className="flex-1 rounded-2xl p-6 shadow-xl relative overflow-hidden" style={{ background: '#131313', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                    <div className="flex justify-between items-center mb-4">
                      <h3 className={cn('font-black text-white text-sm', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{t.appPerformanceLabel}</h3>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: `${T}15`, color: T }}>{t.excellentLabel}</span>
                    </div>
                    <Gauge pct={perfPct} from={T} to={P} shadow={`0 0 12px ${T}80`} />
                    <div className="flex justify-between mt-3">
                      {([['~20ms', t.latencyLabel], ['99.9%', t.uptimeLabel], ['Vite', t.runtimeLabel]] as [string, string][]).map(([v, l]) => (
                        <div key={l} className="text-center">
                          <p className="text-lg font-black text-white" style={{ fontFamily: MANROPE }}>{v}</p>
                          <p className={cn('text-[9px] font-black text-zinc-600 uppercase tracking-widest', isAdlam && 'font-adlam')}>{l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── RECENT PROJECTS (list rows) ── */}
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className={cn('text-xl font-black text-white flex items-center gap-3', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
                    {t.activeSiteBuildsLabel}
                    <span className="w-8 h-1 rounded-full" style={{ background: `linear-gradient(to right,${P},transparent)` }} />
                  </h2>
                  {projects.length > 3 && (
                    <button onClick={() => setPage('projects')}
                      className={cn('text-xs font-black uppercase tracking-widest hover:opacity-80 transition-opacity', isAdlam && 'font-adlam')} style={{ color: P }}>
                      {t.viewAllLabel}
                    </button>
                  )}
                </div>

                {projects.length === 0 ? (
                  <div className="rounded-2xl p-12 text-center border border-dashed border-white/10" style={{ background: 'rgba(255,255,255,0.01)' }}>
                    <Sparkles className="w-8 h-8 mx-auto mb-4" style={{ color: P }} />
                    <p className={cn('text-white font-black text-lg mb-2', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{t.noProjectsTitle}</p>
                    <p className={cn('text-zinc-600 text-sm', isAdlam && 'font-adlam')}>{t.noProjectsSubtitle}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {projects.slice(0, 6).map(p => (
                      <motion.div key={p.id} className="group flex items-center gap-3 cursor-pointer transition-all"
                        style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent' }}
                        onClick={() => openProject(p)}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,139,155,0.1)', border: '1px solid rgba(255,139,155,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Sparkles className="w-4 h-4" style={{ color: P }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('font-black text-white text-sm truncate', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{p.name}</p>
                          <p className={cn('text-zinc-500 text-xs truncate', isAdlam && 'font-adlam')}>{p.description}</p>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full flex-shrink-0" style={{ background: `${T}15`, color: T }}>{p.language}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                          <span className="text-xs font-bold text-zinc-400">Active</span>
                        </div>
                        <button onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors flex-shrink-0" />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
