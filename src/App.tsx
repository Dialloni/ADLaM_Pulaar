import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Loader2, Trash2, Eye, Code as CodeIcon, Download, AlertTriangle,
  Search, Bell, LayoutDashboard, FolderKanban, Globe2, Settings,
  Users, BookOpen, Activity, Sparkles, LogOut, ChevronRight,
  RotateCcw, CheckCircle2, XCircle, AlertCircle, X,
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
function StatChip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="p-4 rounded-xl" style={{ background: '#131313', borderLeft: `4px solid ${accent}` }}>
      <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: accent }}>{label}</p>
      <p className="text-2xl font-black text-white" style={{ fontFamily: MANROPE }}>{value}</p>
    </div>
  );
}

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
    <div className={cn('min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden', isAdlam && 'font-adlam')} style={{ background: '#0e0e0e' }}>
      <div className="absolute w-[55%] h-[55%] rounded-full top-[-15%] left-[-10%] pointer-events-none" style={{ background: P, filter: 'blur(120px)', opacity: 0.1 }} />
      <div className="absolute w-[55%] h-[55%] rounded-full bottom-[-15%] right-[-10%] pointer-events-none" style={{ background: S, filter: 'blur(120px)', opacity: 0.1 }} />
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to right,#80808006 1px,transparent 1px),linear-gradient(to bottom,#80808006 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="absolute top-8 right-8 z-50">
        <LanguageSelector currentLanguage={selectedLang} languages={LANGS} onSelect={setSelectedLang} />
      </div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
        className="max-w-md w-full text-center space-y-8 relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 mb-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: P }} />
            <span className={cn('text-[11px] font-black tracking-[0.2em] uppercase text-zinc-400', isAdlam && 'font-adlam')}>{t.beta}</span>
          </div>
          <h1 className={cn('text-6xl md:text-7xl font-black tracking-tighter text-white mb-4', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE, lineHeight: 0.95 }}>
            <span style={{ background: `linear-gradient(135deg,${P},${S})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {t.heroTitle}
            </span>
          </h1>
          <p className={cn('text-zinc-500 text-base leading-relaxed', isAdlam && 'font-adlam')}>{t.heroSubtitle}</p>
        </div>
        <div className="space-y-4">
          {authMode === 'google' ? (
            <button onClick={handleLogin} className="w-full py-4 rounded-2xl font-bold text-black flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
              style={{ fontFamily: MANROPE, background: `linear-gradient(135deg,${P},${S})`, boxShadow: `0 0 24px ${P}40` }}>
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              <span className={cn(isAdlam && 'font-adlam')}>{t.loginWithGoogle}</span>
            </button>
          ) : (
            <div className="space-y-3 rounded-3xl p-6 border border-white/10" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <h3 className="text-lg font-black text-white text-left" style={{ fontFamily: MANROPE }}>
                {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h3>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white border border-white/10 outline-none transition-all" style={{ background: 'rgba(0,0,0,0.4)' }} />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white border border-white/10 outline-none transition-all" style={{ background: 'rgba(0,0,0,0.4)' }} />
              {authError && <p className="text-red-400 text-xs">{authError}</p>}
              <button onClick={handleLogin} className="w-full py-3 rounded-xl font-black text-black transition-all hover:scale-[1.01]"
                style={{ fontFamily: MANROPE, background: `linear-gradient(135deg,${P},${S})` }}>
                {authMode === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
              <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full text-xs font-bold transition-colors" style={{ color: P }}>
                {authMode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </button>
            </div>
          )}
          {authError && authMode === 'google' && <p className="text-red-400 text-xs text-center">{authError}</p>}
          <button onClick={() => { setAuthMode(authMode === 'google' ? 'login' : 'google'); setAuthError(null); }}
            className="w-full text-sm font-medium text-zinc-500 hover:text-white transition-colors">
            {authMode === 'google' ? 'Or use email & password' : '← Back to Google Login'}
          </button>
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
      <header className="fixed top-0 left-0 right-0 z-50 h-20 flex items-center justify-between px-8 border-b border-white/5 backdrop-blur-xl flex-shrink-0"
        style={{ background: 'rgba(14,14,14,0.92)' }}>
        {/* brand + nav */}
        <div className="flex items-center gap-8">
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
                className={cn('bg-transparent border-none outline-none text-sm w-40 text-white placeholder-zinc-600', isAdlam && 'font-adlam')}
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
        <aside className="w-72 flex-shrink-0 flex flex-col overflow-y-auto border-r border-white/5"
          style={{ background: '#0e0e0e', boxShadow: '20px 0 40px rgba(0,0,0,0.4)' }}>
          {/* user */}
          <div className="px-8 pt-10 pb-6">
            <p className={cn('text-white font-black text-lg', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
              {user.displayName || user.email?.split('@')[0] || 'Builder'}
            </p>
            <p className={cn('text-zinc-500 text-xs font-bold uppercase tracking-widest mt-0.5', isAdlam && 'font-adlam')}>
              {projects.length} {t.projectsCreatedLabel}
            </p>
          </div>

          {/* nav */}
          <nav className="flex-1 space-y-0.5">
            {([
              { icon: LayoutDashboard, label: t.dashboardNav,      pg: 'dashboard' as NavPage },
              { icon: FolderKanban,   label: t.myProjectsLabel,   pg: 'projects'  as NavPage },
              { icon: Globe2,         label: t.languageAssetsLabel, pg: 'assets'   as NavPage },
              { icon: Settings,       label: t.settingsNav,        pg: null },
              { icon: Users,          label: t.teamHubLabel,       pg: null },
            ]).map(({ icon: Icon, label, pg }) => {
              const active = pg && page === pg && !currentProject;
              return (
                <button key={label} onClick={() => { if (pg) { setPage(pg); setCurrentProject(null); } }}
                  className={cn('w-full flex items-center gap-4 py-4 text-sm font-bold transition-all duration-200', isAdlam && 'font-adlam')}
                  style={active
                    ? { background: `linear-gradient(to right,${P}18,transparent)`, borderLeft: `4px solid ${P}`, color: '#fff', paddingLeft: '28px', paddingRight: '24px' }
                    : { color: '#767575', borderLeft: '4px solid transparent', paddingLeft: '28px', paddingRight: '24px' }}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{label}</span>
                </button>
              );
            })}
          </nav>

          {/* new project */}
          <div className="px-6 py-5">
            <button onClick={() => { setCurrentProject(null); setInput(''); setPage('dashboard'); }}
              className={cn('w-full py-4 rounded-xl font-black text-black transition-all hover:scale-[1.02] active:scale-95', isAdlam && 'font-adlam')}
              style={{ fontFamily: isAdlam ? undefined : MANROPE, background: `linear-gradient(135deg,${P},${S})`, boxShadow: `0 0 20px ${P}40` }}>
              + {t.newProject}
            </button>
          </div>

          {/* footer */}
          <div className="px-8 py-5 border-t border-white/5 space-y-3">
            <button onClick={() => { setPage('docs'); setCurrentProject(null); }}
              className={cn('flex items-center gap-3 text-xs font-black uppercase tracking-tight text-zinc-600 hover:text-zinc-300 transition-colors w-full text-left', isAdlam && 'font-adlam')}>
              <BookOpen className="w-4 h-4" /> {t.documentationLabel}
            </button>
            <button onClick={() => { setPage('status'); setCurrentProject(null); }}
              className={cn('flex items-center gap-3 text-xs font-black uppercase tracking-tight text-zinc-600 hover:text-zinc-300 transition-colors w-full text-left', isAdlam && 'font-adlam')}>
              <Activity className="w-4 h-4" style={{ color: S }} /> {t.systemStatusLabel}
            </button>
            <button onClick={() => logout()}
              className={cn('flex items-center gap-3 text-xs font-black uppercase tracking-tight text-zinc-600 hover:text-red-400 transition-colors mt-2 w-full text-left', isAdlam && 'font-adlam')}>
              <LogOut className="w-4 h-4" /> {t.signOut}
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
                      className="bg-transparent border-b text-white text-sm font-bold outline-none w-48 px-1"
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
                      className={cn('flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all', activeTab === 'preview' ? 'bg-white text-black' : 'text-zinc-500 hover:text-zinc-300')}>
                      <Eye className="w-3.5 h-3.5" /> {t.preview}
                    </button>
                    <button onClick={() => setActiveTab('code')}
                      className={cn('flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all', activeTab === 'code' ? 'bg-white text-black' : 'text-zinc-500 hover:text-zinc-300')}>
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
                <div className="w-[480px] flex-shrink-0 border-r border-white/5 flex flex-col" style={{ background: '#0d0d0d' }}>
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
                    className={cn('bg-transparent border-none outline-none text-sm text-white placeholder-zinc-600 flex-1', isAdlam && 'font-adlam')} />
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
                      {/* color accent bar */}
                      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(to right,${P},${S})` }} />
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
                            style={{ background: `linear-gradient(135deg,${P},${S})` }}>
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
            <div className="flex-1 overflow-y-auto relative z-10 p-8 md:p-10 max-w-3xl mx-auto w-full space-y-10">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <BookOpen className="w-3.5 h-3.5" style={{ color: P }} />
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Docs</span>
                </div>
                <h1 className={cn('text-4xl font-black text-white tracking-tighter mb-2', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
                  {t.docsPageTitle}
                </h1>
                <p className={cn('text-zinc-500', isAdlam && 'font-adlam')}>{t.docsPageSubtitle}</p>
              </div>
              {([
                [t.docsSection1Title, t.docsSection1Body, P],
                [t.docsSection2Title, t.docsSection2Body, S],
                [t.docsSection3Title, t.docsSection3Body, T],
              ] as [string, string, string][]).map(([title, body, accent], i) => (
                <div key={i} className="rounded-2xl p-8 border border-white/8" style={{ background: '#131313' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-black" style={{ background: accent }}>
                      {i + 1}
                    </div>
                    <h2 className={cn('text-lg font-black text-white', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{title}</h2>
                  </div>
                  <p className={cn('text-zinc-400 leading-relaxed text-sm', isAdlam && 'font-adlam')}>{body}</p>
                </div>
              ))}

              {/* quick tips */}
              <div className="rounded-2xl p-8 border border-white/8" style={{ background: '#131313' }}>
                <h2 className={cn('text-lg font-black text-white mb-6', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
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
                      <p className="text-zinc-400 text-sm">{tip}</p>
                    </div>
                  ))}
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
                <div key={label} className="flex items-center justify-between p-6 rounded-2xl border border-white/8" style={{ background: '#131313' }}>
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
              <div className="p-6 rounded-2xl border border-white/8" style={{ background: '#131313' }}>
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
              {/* title + chips */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                  <h1 className={cn('text-4xl md:text-5xl font-black text-white tracking-tighter', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
                    {t.gandoViewTitle}
                  </h1>
                  <p className={cn('text-zinc-500 font-medium mt-1', isAdlam && 'font-adlam')}>{t.gandoViewSubtitle}</p>
                </div>
                <div className="flex gap-4">
                  <StatChip label={t.projectsLabel} value={String(projects.length)} accent={T} />
                  <StatChip label={t.appsBuiltLabel} value={String(projects.length)} accent={S} />
                </div>
              </div>

              {/* input card */}
              <div className="relative group">
                <div className="rounded-3xl border border-white/6 backdrop-blur-xl shadow-2xl transition-all group-hover:border-white/10 overflow-hidden"
                  style={{ background: 'rgba(32,32,31,0.5)' }}>
                  {/* top row: language + generate */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/5">
                    <LanguageSelector currentLanguage={selectedLang} languages={LANGS} onSelect={setSelectedLang} />
                    <button onClick={handleSend} disabled={isGenerating || !input.trim()}
                      className={cn('flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-black transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:scale-100 text-sm', isAdlam && 'font-adlam')}
                      style={{ fontFamily: isAdlam ? undefined : MANROPE, background: `linear-gradient(135deg,${P},${S})`, boxShadow: `0 4px 20px ${P}35` }}>
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {isGenerating ? (generationStatus || t.generating) : t.generateLabel}
                    </button>
                  </div>
                  {/* textarea */}
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={t.inputPlaceholder}
                    rows={4}
                    className={cn('w-full bg-transparent border-none outline-none resize-none text-white placeholder-zinc-600 px-5 py-4 text-base font-medium leading-relaxed', isAdlam && 'font-adlam')}
                  />
                </div>
                <div className="absolute -inset-px rounded-3xl blur-xl opacity-0 group-hover:opacity-60 pointer-events-none transition-opacity duration-500"
                  style={{ background: `linear-gradient(135deg,${P}25,${S}25)` }} />
              </div>

              {/* stats grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* completion donut */}
                <div className="lg:col-span-7 rounded-2xl p-6 flex items-center justify-between gap-4 relative overflow-hidden shadow-2xl"
                  style={{ background: '#131313', border: '1px solid rgba(255,255,255,0.04)' }}>
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

                {/* gauges */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <div className="flex-1 rounded-2xl p-6 shadow-xl" style={{ background: '#131313', border: '1px solid rgba(255,255,255,0.04)' }}>
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
                  <div className="flex-1 rounded-2xl p-6 shadow-xl" style={{ background: '#131313', border: '1px solid rgba(255,255,255,0.04)' }}>
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

              {/* active builds */}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {projects.slice(0, 6).map(p => (
                      <motion.div key={p.id} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="group relative cursor-pointer rounded-2xl border border-white/8 overflow-hidden transition-all hover:border-white/15"
                        style={{ background: '#131313' }} onClick={() => openProject(p)}>
                        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(to right,${P},${S})` }} />
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${P}18`, color: P }}>
                              <Sparkles className="w-5 h-5" />
                            </div>
                            <button onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <h3 className={cn('font-black text-white text-sm mb-1 truncate', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{p.name}</h3>
                          <p className={cn('text-zinc-500 text-xs mb-4 line-clamp-2', isAdlam && 'font-adlam')}>{p.description}</p>
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full" style={{ background: `${T}15`, color: T }}>
                              {p.language}
                            </span>
                            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
                          </div>
                        </div>
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
