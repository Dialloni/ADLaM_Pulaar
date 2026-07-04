import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { GandoLogo } from './components/GandoLogo';
import {
  Loader2, Trash2, Eye, Code as CodeIcon, Download, AlertTriangle,
  Search, LayoutDashboard, FolderKanban, Globe2, Settings,
  Users, BookOpen, Activity, Sparkles, LogOut, ChevronRight,
  RotateCcw, CheckCircle2, XCircle, AlertCircle, X, PanelLeft,
  Layers, Github, Figma, Camera,
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
import { generateProject, editProject, chatStream, resolveByok, type Provider, type ByokProvider, type ImageInput } from './services/geminiService';
import { Chat } from './components/Chat';
import { Preview } from './components/Preview';
import { LanguageSelector } from './components/LanguageSelector';
import { useVoiceInput } from './lib/useVoiceInput';
import { ModeSwitch } from './components/ModeSwitch';
import { useTheme } from './lib/useTheme';
import RotatingText from './components/RotatingText';
import type { UserPrefs } from './components/SettingsModal';

/* Heavy, rarely-hit code stays out of the main bundle:
   AdminPortal drags in pdfjs, CodeEditor drags in prismjs, GandoCollector is admin-only. */
const AdminPortal = lazy(() => import('./components/AdminPortal').then(m => ({ default: m.AdminPortal })));
const GandoCollector = lazy(() => import('./components/GandoCollector').then(m => ({ default: m.GandoCollector })));
const CodeEditor = lazy(() => import('./components/CodeEditor').then(m => ({ default: m.CodeEditor })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const LazyFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 120 }}>
    <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
  </div>
);
import { cn } from './lib/utils';
import { TRANSLATIONS, LanguageCode } from './translations';
import { LANGS } from './lib/langs';
import { latinToAdlam } from './lib/adlam';
import { pickGreeting, greetEmoji } from './lib/greeting';
import { P, S, T, MANROPE } from './lib/brand';
import { downscaleDataUrl, uploadAppImages, embedImagesPrompt, MAX_APP_IMAGES } from './lib/appImages';
import { suggestSlug, isValidSlug, claimSlug } from './lib/slug';
import { useIsMobile } from './lib/useIsMobile';
import { PROVIDER_LABEL, PROVIDER_COLOR, MODEL_OPTIONS, BYOK_PROVIDERS, BYOK_STORAGE_KEY, loadByokKeys } from './lib/providers';
import { TEMPLATE_I18N, TEMPLATES_META } from './data/templates';
import { ADLAM_UI, FRENCH_UI, ENGLISH_UI } from './data/uiMaps';
import { ByokModal } from './components/ByokModal';
import { LandingPage } from './components/LandingPage';
import { ProjectThumb } from './components/ProjectThumb';

/* ── constants ──────────────────────────────────── */


type NavPage = 'dashboard' | 'projects' | 'chats' | 'assets' | 'templates' | 'docs' | 'status' | 'collector' | 'admin';
const NAV_PAGES: NavPage[] = ['dashboard', 'projects', 'chats', 'assets', 'templates', 'docs', 'status', 'collector', 'admin'];



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
  const isMobile = useIsMobile();
  const { toggle: toggleTheme, resolved: resolvedTheme } = useTheme();
  const { user, isAdmin, loading, error: authContextError, signIn, signInWithEmail, signUpWithEmail, updateDisplayName, updateAvatar, deleteAccount, logout } = useAuth();


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
  type DashAttachment = { id: string; name: string; kind: 'image' | 'text'; content: string; previewUrl?: string };
  const [dashAttachments, setDashAttachments] = useState<DashAttachment[]>([]);
  const dashFileInputRef = useRef<HTMLInputElement>(null);
  const handleDashFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let imageCount = dashAttachments.filter(a => a.kind === 'image').length;
    Array.from(e.target.files ?? []).forEach(file => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (file.type.startsWith('image/')) {
        if (imageCount >= MAX_APP_IMAGES) {
          setGlobalError(selectedLang.code === 'fr' ? `Maximum ${MAX_APP_IMAGES} images par message.` : `Up to ${MAX_APP_IMAGES} images per message.`);
          return;
        }
        imageCount++;
        const url = URL.createObjectURL(file);
        const reader = new FileReader();
        reader.onload = () => {
          // downscale on attach: small vision payload, small Storage upload,
          // fast pages for whoever visits the built site
          downscaleDataUrl(reader.result as string)
            .catch(() => reader.result as string)
            .then(small => setDashAttachments(prev => [...prev, { id, name: file.name, kind: 'image', content: small, previewUrl: url }]));
        };
        reader.readAsDataURL(file);
      } else {
        file.text().then(text => setDashAttachments(prev => [...prev, { id, name: file.name, kind: 'text', content: text }]));
      }
    });
    e.target.value = '';
  };
  // Text files inline as context; images travel separately as real vision input.
  const buildDashContext = () => dashAttachments.filter(a => a.kind === 'text').map(a =>
    `[File: ${a.name}]\n${a.content.slice(0, 4000)}`
  ).join('\n\n');
  const buildDashImages = (): ImageInput[] => dashAttachments
    .filter(a => a.kind === 'image')
    .map(a => ({
      data: a.content.split(',')[1] ?? a.content,
      mediaType: a.content.startsWith('data:') ? a.content.split(';')[0].slice(5) : 'image/png',
      name: a.name,
    }));
  const dashVoice = useVoiceInput(input, setInput, selectedLang.name, selectedLang.code);
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
  /* Keep <html lang> in sync so screen readers pronounce the UI language correctly.
     BCP 47: ADLaM Pulaar = ff-Adlm. Layout stays LTR — ADLaM elements set dir="rtl" locally. */
  useEffect(() => {
    document.documentElement.lang = selectedLang.code === 'ff-adlm' ? 'ff-Adlm' : selectedLang.code;
  }, [selectedLang.code]);

  /* nav / UI */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [page, setPage] = useState<NavPage>('dashboard');
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES_META[0] | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [chatHidden, setChatHidden] = useState(typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  /* Workspace split-pane (VS Code-style): drag the divider to resize the chat;
     push far left → chat snap-collapses (top bar stays), far right → chat takes
     the full width. Width persists per browser. */
  const [chatWidth, setChatWidth] = useState<number>(() => {
    try { return Math.max(320, Number(localStorage.getItem('gando_chat_width')) || 480); } catch { return 480; }
  });
  const [dividerDragging, setDividerDragging] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const dividerDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const onDividerDown = (e: React.PointerEvent) => {
    dividerDragRef.current = { startX: e.clientX, startW: chatHidden ? 0 : chatWidth };
    setDividerDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDividerMove = (e: React.PointerEvent) => {
    const d = dividerDragRef.current;
    if (!d) return;
    const total = workspaceRef.current?.clientWidth ?? window.innerWidth;
    const w = d.startW + (e.clientX - d.startX);
    if (w < 240) { setChatHidden(true); return; }            // snap: collapse chat
    setChatHidden(false);
    if (w > total - 200) { setChatWidth(total - 24); return; } // snap: chat takes over
    setChatWidth(Math.max(320, Math.min(w, total - 240)));
  };
  const onDividerUp = () => {
    dividerDragRef.current = null;
    setDividerDragging(false);
    setChatWidth(cw => { try { localStorage.setItem('gando_chat_width', String(cw)); } catch { /* ignore */ } return cw; });
  };
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
  const [landingInput, setLandingInput] = useState('');
  const [twText, setTwText] = useState('');
  const [twIdx, setTwIdx] = useState(0);
  const [twDel, setTwDel] = useState(false);
  const [twCursor, setTwCursor] = useState(true);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const heroTextareaRef = useRef<HTMLTextAreaElement>(null);
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

  /* Escape closes any open dropdown/overlay */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setProfileOpen(false); setSearchOpen(false); setNotifOpen(false); setUserMenuOpen(false);
      setDashModelOpen(false); setSearchModalOpen(false); setByokModalOpen(false); setPublishOpen(false);
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  useEffect(() => { if (authContextError) setGlobalError(authContextError); }, [authContextError]);

  /* Landing prompt survives sign-in. Safari signs in via a full-page redirect
     (see AuthContext), which wipes React state — so the draft is mirrored to
     sessionStorage while signed out and restored into the dashboard input
     once the user lands. */
  useEffect(() => {
    if (!user && landingInput.trim()) {
      try { sessionStorage.setItem('gando_pending_prompt', landingInput); } catch { /* ignore */ }
    }
  }, [landingInput, user]);
  useEffect(() => {
    if (!user) return;
    try {
      const pending = sessionStorage.getItem('gando_pending_prompt');
      sessionStorage.removeItem('gando_pending_prompt');
      if (pending?.trim()) {
        setInput(pending);
        // best-effort: size the dashboard textarea to the restored text and focus it
        requestAnimationFrame(() => { handleHeroInput(); heroTextareaRef.current?.focus(); });
      }
    } catch { /* ignore */ }
  }, [user]);

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

  const handleStop = () => { abortRef.current?.abort(); };

  // Shown in the chat when the model returned no explanation text (e.g. metadata cut off).
  // ADLaM uses a neutral checkmark — never fabricate ADLaM strings (correctness matters).
  const doneFallback = () =>
    selectedLang.code === 'fr' ? 'Terminé — votre application a été mise à jour.'
    : selectedLang.code === 'ff-adlm' ? '✓'
    : 'Done — your app has been updated.';

  // Returns true if a project was built/kept, false if stopped before any code (placeholder removed).
  const createNewProject = async (prompt: string, signal: AbortSignal): Promise<boolean> => {
    // Create a placeholder project FIRST so the split workspace (chat + live preview)
    // renders while the app streams in — instead of staying on the dashboard.
    const placeholder = {
      userId: user!.uid, name: 'Building…', description: prompt,
      language: selectedLang.name, languageCode: selectedLang.code,
      code: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    let ref;
    try {
      ref = await addDoc(collection(db, 'projects'), placeholder);
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'projects'); return false; }

    const np = { id: ref.id, ...placeholder } as unknown as Project;
    setCurrentProject(np);
    try {
      await addDoc(collection(db, 'projects', ref.id, 'messages'), { projectId: ref.id, role: 'user', content: prompt, timestamp: serverTimestamp() });
    } catch { /* non-fatal — user message is best-effort */ }

    const result = await generateProject(prompt, selectedLang.name, appendStep, handleStreamCode, provider, resolveByok(provider, byokKeys), signal, pendingImagesRef.current);

    // Aborted before any code arrived — remove the empty placeholder, return to dashboard.
    if (!result.code) {
      try { await deleteDoc(doc(db, 'projects', ref.id)); } catch { /* ignore */ }
      setCurrentProject(null);
      return false;
    }

    try {
      const finalName = result.name || 'Untitled App';
      await updateDoc(doc(db, 'projects', ref.id), { name: finalName, code: result.code, updatedAt: serverTimestamp() });
      setCurrentProject(p => (p && p.id === ref!.id) ? { ...p, name: finalName, code: result.code } : p);
      if (!result.wasAborted) {
        await addDoc(collection(db, 'projects', ref.id, 'messages'), { projectId: ref.id, role: 'assistant', content: result.explanation || doneFallback(), codeSnapshot: result.code, timestamp: serverTimestamp() });
      }
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'projects'); }
    return true;
  };

  const updateExistingProject = async (prompt: string, signal: AbortSignal) => {
    if (!currentProject) return;
    try {
      await addDoc(collection(db, 'projects', currentProject.id, 'messages'), { projectId: currentProject.id, role: 'user', content: prompt, timestamp: serverTimestamp() });
      const result = await editProject(prompt, currentProject.code, messages, currentProject.language, appendStep, handleStreamCode, provider, resolveByok(provider, byokKeys), signal, pendingImagesRef.current);
      // Always save what was built — partial or complete.
      const savedCode = result.code || currentProject.code;
      await updateDoc(doc(db, 'projects', currentProject.id), { code: savedCode, updatedAt: serverTimestamp() });
      setCurrentProject(p => p ? { ...p, code: savedCode } : null);
      if (!result.wasAborted) {
        await addDoc(collection(db, 'projects', currentProject.id, 'messages'), { projectId: currentProject.id, role: 'assistant', content: result.explanation || doneFallback(), codeSnapshot: savedCode, timestamp: serverTimestamp() });
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

  /* Greeting: stable random pick per session; previous visit read once, then stamped. */
  /* ADLaM reading mode: joined (authentic cursive, default) vs unjoined
     (standalone letters — easier for new readers). Persisted per browser. */
  const [adlamStyle, setAdlamStyle] = useState<'joined' | 'unjoined'>(() => {
    try { return localStorage.getItem('gando_adlam_style') === 'joined' ? 'joined' : 'unjoined'; } catch { return 'unjoined'; }
  });
  useEffect(() => {
    document.documentElement.dataset.adlam = adlamStyle;
    try { localStorage.setItem('gando_adlam_style', adlamStyle); } catch { /* ignore */ }
  }, [adlamStyle]);

  /* Script style for GENERATED apps when building in ADLaM: unjoined default
     (easier for the general public reading the built site); fluent builders can
     switch to joined. Corpus/admin never touched by this. */
  const [buildScript, setBuildScript] = useState<'joined' | 'unjoined'>(() => {
    try { return localStorage.getItem('gando_build_script') === 'joined' ? 'joined' : 'unjoined'; } catch { return 'unjoined'; }
  });
  useEffect(() => { try { localStorage.setItem('gando_build_script', buildScript); } catch { /* ignore */ } }, [buildScript]);

  const [greetSeed] = useState(() => Math.random());
  // greeting emoji (☀️/🌙/🎉) shows briefly, then fades — decoration, not furniture
  const [greetEmojiVisible, setGreetEmojiVisible] = useState(true);
  const [greetEmojiGone, setGreetEmojiGone] = useState(false); // unmounted after fade — no phantom line box
  useEffect(() => {
    const fade = setTimeout(() => setGreetEmojiVisible(false), 12000);
    const gone = setTimeout(() => setGreetEmojiGone(true), 13600);
    return () => { clearTimeout(fade); clearTimeout(gone); };
  }, []);
  const [prevSeenMs, setPrevSeenMs] = useState<number | null>(null);
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const ts: any = snap.data()?.lastSeenAt;
        setPrevSeenMs(typeof ts?.toMillis === 'function' ? ts.toMillis() : null);
        await setDoc(doc(db, 'users', user.uid), { lastSeenAt: serverTimestamp() }, { merge: true });
      } catch { /* greeting is cosmetic — never block on it */ }
    })();
  }, [user?.uid]);

  /* Browser-tab title follows the work: project name, chat title, or page (Claude-style). */
  useEffect(() => {
    const PAGE_TITLES: Partial<Record<NavPage, string>> = {
      projects: 'Projects', chats: 'Chats', assets: 'Language Assets', templates: 'Templates',
      docs: 'Docs', status: 'Status', collector: 'Collector', admin: 'Corpus Admin',
    };
    const name = currentProject ? currentProject.name
      : chatActive ? (chats.find(c => c.id === currentChatId)?.title || 'New chat')
      : PAGE_TITLES[page] || '';
    document.title = name ? `${name} – Gando` : 'Gando';
  }, [currentProject?.name, chatActive, currentChatId, chats, page]);

  /* ── hash routing — back button, refresh, shareable #/project/<id> links ──
     The hash mirrors view state (page / open project / open chat). Back and
     forward re-parse the hash; opening things pushes a history entry. Deep
     links to a project/chat that hasn't loaded from Firestore yet park the id
     in routeProjectId/routeChatId until the listener delivers it. */
  const projectsRef = useRef(projects); projectsRef.current = projects;
  const chatsRef = useRef(chats); chatsRef.current = chats;
  const [routeProjectId, setRouteProjectId] = useState<string | null>(null);
  const [routeChatId, setRouteChatId] = useState<string | null>(null);
  const routeReadyRef = useRef(false);

  const applyHash = useCallback(() => {
    const seg = window.location.hash.replace(/^#\/?/, '').split('/');
    if (seg[0] === 'project' && seg[1]) {
      const p = projectsRef.current.find(x => x.id === seg[1]);
      if (p) { setCurrentProject(p); setChatActive(false); setMobileNavOpen(false); }
      else setRouteProjectId(seg[1]);
      return;
    }
    if (seg[0] === 'chat' && seg[1]) {
      const c = chatsRef.current.find(x => x.id === seg[1]);
      if (c) openChat(c);
      else setRouteChatId(seg[1]);
      return;
    }
    setCurrentProject(null);
    setChatActive(false);
    setMobileNavOpen(false);
    setPage(NAV_PAGES.includes(seg[0] as NavPage) ? (seg[0] as NavPage) : 'dashboard');
  }, []);

  /* parse the hash once auth resolves, then on every back/forward */
  useEffect(() => {
    if (!user) { routeReadyRef.current = false; return; }
    applyHash();
    routeReadyRef.current = true;
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [user, applyHash]);

  /* resolve deep links once Firestore data arrives */
  useEffect(() => {
    if (!routeProjectId) return;
    const p = projects.find(x => x.id === routeProjectId);
    if (p) { setCurrentProject(p); setChatActive(false); setRouteProjectId(null); }
    else if (projects.length) setRouteProjectId(null); // list loaded, id unknown → stay on dashboard
  }, [projects, routeProjectId]);
  useEffect(() => {
    if (!routeChatId) return;
    const c = chats.find(x => x.id === routeChatId);
    if (c) { openChat(c); setRouteChatId(null); }
    else if (chats.length) setRouteChatId(null);
  }, [chats, routeChatId]);

  /* view state → hash (skip while a deep link is still resolving) */
  useEffect(() => {
    if (!user || !routeReadyRef.current || routeProjectId || routeChatId) return;
    const desired =
      currentProject ? `#/project/${currentProject.id}` :
      chatActive && currentChatId ? `#/chat/${currentChatId}` :
      page === 'dashboard' ? '#/' : `#/${page}`;
    if (window.location.hash !== desired) {
      // first write replaces (no phantom back-stop on '#/'), later ones push
      if (!window.location.hash) window.history.replaceState(null, '', desired);
      else window.history.pushState(null, '', desired);
    }
  }, [user, page, currentProject?.id, chatActive, currentChatId, routeProjectId, routeChatId]);

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
  // Images attached to the current send (vision). Read by the generate/edit/chat
  // calls below, then cleared once the request is dispatched.
  const pendingImagesRef = useRef<ImageInput[] | undefined>(undefined);

  const runChat = async (typedPrompt: string, extraContext?: string) => {
    if (!currentProject) setChatActive(true); // dashboard chat opens the full-screen session
    const fullPrompt = extraContext ? `${extraContext}\n\n${typedPrompt}` : typedPrompt;
    const userImages = pendingImagesRef.current?.map(i => `data:${i.mediaType};base64,${i.data}`);
    const userMsg: Message = { id: `u-${Date.now()}`, projectId: '', role: 'user', content: typedPrompt, timestamp: Date.now(), images: userImages };
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
        resolveByok(provider, byokKeys),
        pendingImagesRef.current,
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
    // Stream ended with nothing — fill the bubble so it never sits empty (and never persists empty).
    if (!finalAnswer.trim()) {
      finalAnswer = selectedLang.code === 'fr'
        ? '⚠️ Pas de réponse du modèle — réessayez.'
        : '⚠️ No response from the model — please try again.';
      setChatMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...aiMsg, content: finalAnswer };
        return copy;
      });
    }
    // Save the exchange (dashboard chat threads only — project chats live with the project).
    // Failed exchanges (⚠️) are not worth keeping in the thread history.
    if (!currentProject && !finalAnswer.startsWith('⚠️')) await persistChat(typedPrompt, finalAnswer);
  };

  const handleSend = async (extraContext?: string, images?: ImageInput[]) => {
    if (!input.trim()) {
      setInputShake(true);
      setTimeout(() => setInputShake(false), 500);
      return;
    }
    if (!user) return;
    pendingImagesRef.current = images;
    if (mode === 'chat') { await runChat(input.trim(), extraContext); pendingImagesRef.current = undefined; return; }
    setIsGenerating(true);
    setStreamingCode(null);
    setPreviewCode(null);
    setGenerationSteps([]);
    // Show code writing live during the build (preview is blank until <body> arrives).
    setActiveTab('code');
    lastPreviewAt.current = 0;
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const basePrompt = importMode === 'github'
      ? `Clone and recreate a web app inspired by this GitHub repository: ${input}`
      : importMode === 'figma'
      ? `Build a pixel-perfect web UI matching this Figma design: ${input}`
      : input;
    let prompt = extraContext ? `${extraContext}\n\n${basePrompt}` : basePrompt;
    // Attached photos get uploaded to Storage and their URLs handed to the
    // model to EMBED in the app (they're also sent as vision so it knows what
    // each shows). Upload failure degrades to vision-only — never blocks the build.
    if (images?.length) {
      try {
        const uploaded = await uploadAppImages(user.uid, images.map((im, i) => ({
          name: im.name || `photo-${i + 1}.jpg`,
          dataUrl: `data:${im.mediaType};base64,${im.data}`,
        })));
        prompt += embedImagesPrompt(uploaded);
      } catch (err) {
        console.error('image upload failed, continuing vision-only:', err);
        setGlobalError(selectedLang.code === 'fr'
          ? "Échec de l'envoi des images — l'app sera générée sans les intégrer."
          : 'Image upload failed — building without embedding them.');
      }
    }
    if (selectedLang.code === 'ff-adlm' && buildScript === 'unjoined') {
      prompt += `\n\nADLaM font requirement: render ALL ADLaM text with the "Noto Sans Adlam Unjoined" Google Font (letters NOT connected — easier for new readers). Include <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Adlam+Unjoined:wght@400;700&display=swap" rel="stylesheet"> and use font-family: 'Noto Sans Adlam Unjoined', sans-serif. Do NOT use the joined "Noto Sans Adlam" font.`;
    }
    const originalInput = input; // restore on stop-before-any-code so the user can retry
    setInput('');
    try {
      if (!currentProject) {
        const built = await createNewProject(prompt, signal);
        if (!built) setInput(originalInput); // stopped before any code — put the prompt back
      } else await updateExistingProject(prompt, signal);
    } catch (err: any) {
      const m = err.message || '';
      setGlobalError(/429|quota|rate|RESOURCE_EXHAUSTED/i.test(m)
        ? "You've reached the AI limit. Please wait a minute." : m || 'Unexpected error.');
    } finally {
      setIsGenerating(false); setStreamingCode(null); setPreviewCode(null); setGenerationSteps([]); abortRef.current = null;
      pendingImagesRef.current = undefined;
      // Built — flip back to the live preview to show the finished app.
      setActiveTab('preview');
    }
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

  /* Publish — the project becomes publicly served at /p/<id> (no login).
     Toggle lives on the project doc; serving is done server-side (lib/publishPage). */
  const [publishOpen, setPublishOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const publishRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!publishOpen) return;
    const h = (e: MouseEvent) => {
      if (publishRef.current && !publishRef.current.contains(e.target as Node)) setPublishOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [publishOpen]);
  const [slugInput, setSlugInput] = useState('');
  const [slugErr, setSlugErr] = useState<'' | 'taken' | 'invalid' | 'error'>('');
  const [slugBusy, setSlugBusy] = useState(false);
  const publishUrl = (p: Project) => `${window.location.origin}/p/${p.slug || p.id}`;
  const openPublishPopover = () => {
    if (!currentProject) return;
    setSlugInput(currentProject.slug || suggestSlug(currentProject.name, currentProject.id));
    setSlugErr('');
    setPublishOpen(true);
  };
  // Publish (or rename the slug of an already-published app): claim the slug
  // atomically, then flip the flag. 'taken' surfaces inline, never as a toast.
  const doPublish = async () => {
    const p = currentProject;
    if (!p || !user || slugBusy) return;
    const s = slugInput.trim().toLowerCase();
    if (!isValidSlug(s)) { setSlugErr('invalid'); return; }
    setSlugBusy(true); setSlugErr('');
    try {
      await claimSlug(user.uid, p.id, s, p.slug);
      await updateDoc(doc(db, 'projects', p.id), { published: true, publishedAt: serverTimestamp() });
      setCurrentProject(cp => (cp && cp.id === p.id) ? { ...cp, slug: s, published: true } : cp);
    } catch (err) {
      const m = err instanceof Error ? err.message : '';
      setSlugErr(m === 'taken' ? 'taken' : m === 'invalid' ? 'invalid' : 'error');
    } finally { setSlugBusy(false); }
  };
  // Unpublish keeps the slug reservation so republishing gets the same name back.
  const unpublish = async (p: Project) => {
    try {
      await updateDoc(doc(db, 'projects', p.id), { published: false });
      setCurrentProject(cp => (cp && cp.id === p.id) ? { ...cp, published: false } : cp);
      setPublishOpen(false);
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, `projects/${p.id}`); }
  };
  const copyPublishLink = async (p: Project) => {
    try { await navigator.clipboard.writeText(publishUrl(p)); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1800); }
    catch { /* clipboard denied — user can select the text */ }
  };

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

  // Real status, derived — nothing ever wrote p.status, so the tabs filtered
  // against a phantom field and LIVE/BUILDING/DRAFT were always empty.
  const projStatus = (p: Project): 'live' | 'building' | 'draft' =>
    p.published ? 'live' : (!p.code || !p.code.trim()) ? 'building' : 'draft';
  const filteredProjects = projects
    .filter(p => projectFilter === 'all' || projStatus(p) === projectFilter)
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
    <LandingPage
      t={t}
      isAdlam={isAdlam}
      selectedLang={selectedLang}
      setSelectedLang={setSelectedLang}
      resolvedTheme={resolvedTheme}
      toggleTheme={toggleTheme}
      landingInput={landingInput}
      setLandingInput={setLandingInput}
      twText={twText}
      twCursor={twCursor}
      provider={provider}
      setProvider={setProvider}
      modelOptions={modelOptions}
      mode={mode}
      setMode={setMode}
      byokKeys={byokKeys}
      saveByokKeys={saveByokKeys}
      adlamStyle={adlamStyle}
      onAdlamStyle={st => { setAdlamStyle(st); setBuildScript(st); }}
    />
  );

  /* ═════════════════════════════════════════════════
     MAIN APP
  ═════════════════════════════════════════════════ */
  return (
    <div className={cn('w-screen flex flex-col overflow-hidden', isAdlam && 'font-adlam')} style={{ background: 'var(--app-bg)', color: 'var(--text-primary)', height: '100dvh' }}>

      <ByokModal open={byokModalOpen} keys={byokKeys} onSave={saveByokKeys} onClose={() => setByokModalOpen(false)} fr={selectedLang.code === "fr"} />
      {settingsOpen && <Suspense fallback={null}>
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
      </Suspense>}

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
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 15, fontFamily: 'Inter, var(--adlam-ui), sans-serif' }} />
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
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
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
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
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
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] max-w-md w-full px-4">
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/20 shadow-2xl backdrop-blur-xl" style={{ background: 'rgba(255,50,50,0.08)' }}>
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-300 flex-1">{globalError}</p>
              <button onClick={() => setGlobalError(null)}><X className="w-4 h-4 text-zinc-500 hover:text-white" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* mobile: floating sidebar toggle (top bar is gone — Claude-style) */}
      {!currentProject && !chatActive && (
        <button onClick={() => setMobileNavOpen(o => !o)}
          className="md:hidden fixed top-3 left-3 z-[120] p-2 rounded-xl"
          style={{ background: 'var(--navbar-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', backdropFilter: 'blur(12px)' }}
          aria-label="Menu">
          <PanelLeft className="w-5 h-5" />
        </button>
      )}

      {/* ════════ BODY ════════ */}
      <div className="flex flex-1 overflow-hidden">


        {/* mobile drawer backdrop */}
        {mobileNavOpen && (
          <div onClick={() => setMobileNavOpen(false)}
            className="md:hidden fixed inset-0 z-[90]" style={{ background: 'rgba(0,0,0,0.6)' }} />
        )}

        {/* ════ SIDEBAR ════ */}
        <aside className={cn(
            'flex-shrink-0 flex flex-col border-r border-white/5',
            'fixed md:static top-0 bottom-0 left-0 z-[100] md:z-auto',
            'transition-transform duration-200 md:transition-none',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          )}
          style={{ background: 'var(--sidebar-bg)', width: sidebarCollapsed ? 60 : 224, overflowX: 'hidden', overflowY: 'auto' }}>

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
            /* Expanded: brand (home) + search + collapse */
            <div className="flex items-center px-3 pt-4 pb-2 justify-between">
              <button onClick={() => { setCurrentProject(null); setPage('dashboard'); setMobileNavOpen(false); }}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-white/5 transition-all min-w-0" title="Dashboard">
                <GandoLogo size={22} />
                <span className={cn('text-base font-black tracking-tight select-none', isAdlam && 'font-adlam')}
                  style={{ fontFamily: isAdlam ? undefined : MANROPE, background: `linear-gradient(135deg,${P},${S})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {t.appName.toUpperCase()}
                </span>
              </button>
              <div className="flex items-center">
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
            </div>
          )}

          {/* new project (Claude-style, top) */}
          <div className="px-3 mb-3">
            <button onClick={() => { setCurrentProject(null); setChatActive(false); setInput(''); setPage('dashboard'); setImportMode('describe'); setMobileNavOpen(false); }}
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
                  style={{ background: active ? 'rgba(59,130,246,0.10)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', fontFamily: isAdlam ? undefined : MANROPE, fontWeight: 600, fontSize: 13 }}>
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
                    <span className="text-xs font-medium truncate" style={{ fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* spacer */}
          <div className="flex-1" />

          {/* language — always visible (core to Gando), Claude keeps it buried; we don't */}
          <div className={cn('px-3 pb-1', sidebarCollapsed && 'flex justify-center')}>
            {sidebarCollapsed ? (
              /* popup menu next to the rail — no sidebar expand needed (Claude-style) */
              <LanguageSelector currentLanguage={selectedLang} languages={LANGS} onSelect={setSelectedLang} dropUp iconOnly adlamStyle={adlamStyle} onAdlamStyle={st => { setAdlamStyle(st); setBuildScript(st); }} />
            ) : (
              <LanguageSelector currentLanguage={selectedLang} languages={LANGS} onSelect={setSelectedLang} dropUp buttonClassName="w-full justify-between" adlamStyle={adlamStyle} onAdlamStyle={st => { setAdlamStyle(st); setBuildScript(st); }} />
            )}
          </div>

          {/* user (Claude-style, bottom) */}
          <div className="p-3 user-menu-container" style={{ position: 'relative' }}>
            <div className={cn('flex items-center rounded-xl cursor-pointer hover:bg-white/5 transition-all', sidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2.5')}
              onClick={() => setUserMenuOpen(o => !o)}>
              {user.photoURL
                ? <img src={user.photoURL} alt="" className="rounded-full object-cover flex-shrink-0"
                    style={{ width: 28, height: 28, minWidth: 28, minHeight: 28, aspectRatio: '1 / 1' }} />
                : <div className="rounded-full flex items-center justify-center text-xs font-black text-black flex-shrink-0"
                    style={{ width: 28, height: 28, minWidth: 28, minHeight: 28, aspectRatio: '1 / 1', background: `linear-gradient(135deg,${P},${S})` }}>
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
              }
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-bold text-white truncate', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>
                      {user.displayName || user.email?.split('@')[0] || 'Builder'}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate" style={{ fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>{user.email}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" style={{ transform: 'rotate(-90deg)' }} />
                </>
              )}
            </div>
            {userMenuOpen && createPortal(
              /* portaled to <body>: the sidebar's transform+overflow would clip it (worst when collapsed) */
              <div className="user-menu-container" style={{ position: 'fixed', bottom: sidebarCollapsed ? 16 : 74, left: sidebarCollapsed ? 66 : 12, width: 232, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', zIndex: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>{user.email}</div>
                <button onClick={e => { e.stopPropagation(); setSettingsOpen(true); setUserMenuOpen(false); }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', cursor: 'pointer', border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}>
                  <Settings size={14} /> {t.settingsNav}
                </button>
                <button onClick={e => { e.stopPropagation(); setPage('status'); setCurrentProject(null); setUserMenuOpen(false); setMobileNavOpen(false); }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', cursor: 'pointer', border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}>
                  <Activity size={14} /> {t.systemStatusLabel}
                </button>
                <button onClick={e => { e.stopPropagation(); setPage('docs'); setCurrentProject(null); setUserMenuOpen(false); setMobileNavOpen(false); }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', cursor: 'pointer', border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}>
                  <BookOpen size={14} /> {t.documentationLabel}
                </button>
                <button onClick={e => { e.stopPropagation(); toggleTheme(); }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', cursor: 'pointer', border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}>
                  {resolvedTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                  {resolvedTheme === 'dark'
                    ? (selectedLang.code === 'fr' ? 'Mode clair' : 'Light mode')
                    : (selectedLang.code === 'fr' ? 'Mode sombre' : 'Dark mode')}
                </button>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                <button onClick={e => { e.stopPropagation(); logout(); setUserMenuOpen(false); }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', fontSize: 13, color: '#f87171', fontFamily: 'Inter, var(--adlam-ui), sans-serif', cursor: 'pointer', border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}>
                  <LogOut size={14} /> {t.signOut}
                </button>
              </div>,
              document.body
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
                  {/* Publish — live public link at /p/<id> */}
                  <div ref={publishRef} style={{ position: 'relative' }}>
                    {currentProject.published ? (
                      <button onClick={() => publishOpen ? setPublishOpen(false) : openPublishPopover()}
                        className="flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background: '#22c55e1a', color: '#4ade80', border: '1px solid #22c55e33' }}>
                        <Globe2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{selectedLang.code === 'fr' ? 'En ligne' : 'Live'}</span>
                      </button>
                    ) : (
                      <button onClick={() => publishOpen ? setPublishOpen(false) : openPublishPopover()}
                        className="flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-xl text-xs font-bold transition-all border"
                        style={{ color: P, borderColor: `${P}33`, background: `${P}0c` }}>
                        <Globe2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{selectedLang.code === 'fr' ? 'Publier' : 'Publish'}</span>
                      </button>
                    )}
                    {publishOpen && (
                      <div style={{ position: 'absolute', top: 44, right: 0, width: 320, background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, zIndex: 60, boxShadow: '0 16px 48px rgba(0,0,0,0.45)' }}>
                        <p style={{ fontSize: 11, fontWeight: 800, color: currentProject.published ? '#4ade80' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontFamily: MANROPE }}>
                          {currentProject.published
                            ? (selectedLang.code === 'fr' ? '● Votre app est en ligne' : '● Your app is live')
                            : (selectedLang.code === 'fr' ? 'Choisissez le nom du lien' : 'Choose your link name')}
                        </p>
                        {/* slug editor — /p/<name> */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--btn-bg)', border: `1px solid ${slugErr ? 'rgba(248,113,113,0.5)' : 'var(--border)'}`, borderRadius: 10, padding: '8px 10px', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>/p/</span>
                          <input
                            value={slugInput}
                            onChange={e => { setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); setSlugErr(''); }}
                            onKeyDown={e => { if (e.key === 'Enter') void doPublish(); }}
                            spellCheck={false}
                            className="gando-input"
                            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }} />
                          {currentProject.published && (
                            <button onClick={() => copyPublishLink(currentProject)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: linkCopied ? '#4ade80' : 'var(--text-muted)', flexShrink: 0, padding: 2 }}
                              title={selectedLang.code === 'fr' ? 'Copier le lien' : 'Copy link'}>
                              {linkCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                        <p style={{ fontSize: 11, minHeight: 16, marginBottom: 8, color: slugErr ? '#f87171' : 'var(--text-faint)' }}>
                          {slugErr === 'taken' ? (selectedLang.code === 'fr' ? 'Ce nom est déjà pris — essayez-en un autre.' : 'That name is taken — try another.')
                            : slugErr === 'invalid' ? (selectedLang.code === 'fr' ? '3–40 caractères : lettres minuscules, chiffres, tirets.' : '3–40 chars: lowercase letters, numbers, hyphens.')
                            : slugErr === 'error' ? (selectedLang.code === 'fr' ? 'Échec — réessayez.' : 'Failed — try again.')
                            : (selectedLang.code === 'fr' ? 'Minuscules, chiffres et tirets uniquement.' : 'Lowercase letters, numbers and hyphens only.')}
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {(!currentProject.published || slugInput.trim().toLowerCase() !== (currentProject.slug || '')) ? (
                            <button onClick={() => void doPublish()} disabled={slugBusy}
                              style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: 'var(--gradient-brand)', border: 'none', color: '#0a0a0a', fontSize: 12, fontWeight: 800, cursor: slugBusy ? 'wait' : 'pointer', fontFamily: MANROPE, opacity: slugBusy ? 0.7 : 1 }}>
                              {slugBusy ? '…' : currentProject.published
                                ? (selectedLang.code === 'fr' ? 'Renommer' : 'Save name')
                                : (selectedLang.code === 'fr' ? 'Publier' : 'Publish')}
                            </button>
                          ) : (
                            <a href={publishUrl(currentProject)} target="_blank" rel="noreferrer"
                              style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: 'var(--gradient-brand)', color: '#0a0a0a', fontSize: 12, fontWeight: 800, textDecoration: 'none', fontFamily: MANROPE }}>
                              {selectedLang.code === 'fr' ? 'Ouvrir ↗' : 'Open ↗'}
                            </a>
                          )}
                          {currentProject.published && (
                            <button onClick={() => unpublish(currentProject)}
                              style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: 'transparent', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: MANROPE }}>
                              {selectedLang.code === 'fr' ? 'Dépublier' : 'Unpublish'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--btn-bg)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={() => setActiveTab('preview')}
                      className="flex items-center gap-2 px-2.5 md:px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={activeTab === 'preview' ? { background: 'rgba(59,130,246,0.14)', color: 'var(--text-primary)' } : { color: 'var(--text-muted)' }}>
                      <Eye className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.preview}</span>
                    </button>
                    <button onClick={() => setActiveTab('code')}
                      className="flex items-center gap-2 px-2.5 md:px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={activeTab === 'code' ? { background: 'rgba(59,130,246,0.14)', color: 'var(--text-primary)' } : { color: 'var(--text-muted)' }}>
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
              <div ref={workspaceRef} className="flex flex-1 pt-14 overflow-hidden relative">
                {isMobile ? (
                  <>
                    {/* MOBILE: preview fills screen; chat is a bottom sheet toggled by chatHidden */}
                    <div className="flex-1 overflow-hidden w-full">
                      {activeTab === 'preview'
                        ? <Preview code={previewCode ?? currentProject.code} />
                        : <Suspense fallback={<LazyFallback />}><CodeEditor code={streamingCode ?? currentProject.code} onChange={handleCodeChange} t={t} languageCode={selectedLang.code} /></Suspense>}
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
                    {/* DESKTOP: chat panel — resizable + collapsible side-by-side */}
                    <motion.div className="flex-shrink-0 flex flex-col"
                      animate={{ width: chatHidden ? 0 : chatWidth, opacity: chatHidden ? 0 : 1 }}
                      transition={dividerDragging ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 200 }}
                      style={{ background: 'var(--app-bg)', border: chatHidden ? 'none' : '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
                      <div className="flex flex-col h-full" style={{ width: chatHidden ? chatWidth : '100%', minWidth: 320 }}>
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
                    {/* drag divider — the resize handle between chat and preview */}
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      title={chatHidden ? 'Drag to open chat' : 'Drag to resize'}
                      onPointerDown={onDividerDown}
                      onPointerMove={onDividerMove}
                      onPointerUp={onDividerUp}
                      onDoubleClick={() => setChatHidden(h => !h)}
                      className="flex-shrink-0 group flex items-center justify-center"
                      style={{ width: 12, cursor: 'col-resize', touchAction: 'none' }}>
                      <div className="rounded-full transition-all"
                        style={{
                          width: 3, height: 44,
                          background: dividerDragging ? P : 'var(--border)',
                        }} />
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.div key="panel" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                        transition={{ type: 'spring', damping: 30, stiffness: 200 }} className="flex-1 overflow-hidden">
                        {activeTab === 'preview'
                          ? <Preview code={previewCode ?? currentProject.code} />
                          : <Suspense fallback={<LazyFallback />}><CodeEditor code={streamingCode ?? currentProject.code} onChange={handleCodeChange} t={t} languageCode={selectedLang.code} /></Suspense>}
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
                  mode={mode} onModeChange={setMode} onStop={handleStop} hideHeader />
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
                    {projectSearch ? 'No projects match your search'
                      : projects.length > 0 && projectFilter !== 'all'
                      ? (selectedLang.code === 'fr' ? `Aucun projet « ${projectFilter} »` : `No ${projectFilter} projects`)
                      : t.noProjectsTitle}
                  </p>
                  <p className="text-zinc-500 text-sm text-center max-w-xs">
                    {projectSearch ? 'Try a different search term.'
                      : projects.length > 0 && projectFilter !== 'all'
                      ? (projectFilter === 'live'
                        ? (selectedLang.code === 'fr' ? 'Publiez un projet pour le voir ici.' : 'Publish a project and it will show up here.')
                        : (selectedLang.code === 'fr' ? 'Changez de filtre pour voir vos projets.' : 'Switch filters to see your projects.'))
                      : 'Describe an app in any language and Gando will build it for you.'}
                  </p>
                  {!projectSearch && projects.length === 0 && (
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
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)', zIndex: 1 }} />
                      <ProjectThumb code={p.code} height={150} />
                      <div className="p-6 pt-4">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full self-center" style={{ background: `${T}15`, color: T }}>
                              {p.language}
                            </span>
                            {(() => {
                              const st = projStatus(p);
                              const c = st === 'live' ? { bg: '#22c55e1a', fg: '#4ade80' }
                                : st === 'building' ? { bg: '#eab3081a', fg: '#fbbf24' }
                                : { bg: 'rgba(255,255,255,0.06)', fg: 'var(--text-muted)' };
                              const label = selectedLang.code === 'fr'
                                ? (st === 'live' ? 'en ligne' : st === 'building' ? 'en cours' : 'brouillon')
                                : st;
                              return (
                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full self-center" style={{ background: c.bg, color: c.fg }}>
                                  {label}
                                </span>
                              );
                            })()}
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
                        <div className="flex justify-end items-center">
                          <button onClick={() => openProject(p)}
                            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-black transition-all hover:scale-105', isAdlam && 'font-adlam')}
                            style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--glow-primary-sm)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = 'var(--glow-primary-lg)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'var(--glow-primary-sm)'}>
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
                          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'Inter, var(--adlam-ui), sans-serif', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fff'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#adaaaa'}>
                          <ChevronRight className="w-3 h-3 rotate-180" /> {t.templatesNav}
                        </button>
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>/</span>
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontWeight: 600 }}>{cc.name}</span>
                      </div>
                      <div className="flex-1 relative" style={{ background: 'var(--app-bg)' }}>
                        {/* community code is user-submitted — never allow-same-origin on srcDoc
                            (would run with the app's origin: localStorage BYOK keys, auth tokens) */}
                        <iframe srcDoc={cc.code} title={cc.name} className="w-full h-full border-none" sandbox="allow-scripts allow-forms allow-modals allow-popups" />
                      </div>
                    </div>
                    {/* RIGHT (mobile: BELOW): info + actions */}
                    <div className={cn(!isMobile && 'overflow-y-auto')} style={isMobile ? { width: '100%', flexShrink: 0, background: 'var(--app-bg)', padding: 20 } : { width: 340, flexShrink: 0, background: 'var(--app-bg)', padding: 28 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ cursor: 'pointer' }} onClick={() => setSelectedCommunity(null)}>{t.templatesNav}</span>
                        <ChevronRight className="w-3 h-3" />
                        <span style={{ color: 'var(--text-muted)' }}>{cc.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ padding: '3px 10px', borderRadius: 9999, background: `${T}18`, color: T, fontSize: 10, fontWeight: 700, fontFamily: 'Inter, var(--adlam-ui), sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cc.language}</span>
                        <span className={cn(isAdlam && 'font-adlam')} style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>{t.communityTitle}</span>
                      </div>
                      <h2 className={cn('font-black text-white tracking-tighter mb-3', isAdlam && 'font-adlam')}
                        style={{ fontFamily: isAdlam ? undefined : MANROPE, fontSize: 26, lineHeight: 1.15 }}>{cc.name}</h2>
                      <p style={{ fontSize: 14, color: '#a1a1aa', fontFamily: 'Inter, var(--adlam-ui), sans-serif', lineHeight: 1.6, marginBottom: 24, overflowWrap: 'anywhere' }}>{cleanPrompt(cc.description) || cc.name}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                        <button onClick={() => remixCommunity(cc)}
                          className={cn(isAdlam && 'font-adlam')}
                          style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'var(--gradient-brand)', border: 'none', color: '#0a0a0a', fontSize: 13, fontWeight: 900, fontFamily: isAdlam ? undefined : MANROPE, cursor: 'pointer', letterSpacing: '0.02em' }}>
                          {tl.useTemplate}
                        </button>
                        <button onClick={() => openFullPreview(cc.code)}
                          style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, var(--adlam-ui), sans-serif', cursor: 'pointer' }}>
                          Open full preview ↗
                        </button>
                      </div>
                      {cleanPrompt(cc.description) && (
                        <>
                          {/* original prompt (the language it was built in) */}
                          <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Original prompt</p>
                            <p style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'Inter, var(--adlam-ui), sans-serif', lineHeight: 1.6, overflowWrap: 'anywhere' }}>{cleanPrompt(cc.description)}</p>
                          </div>
                          {/* translation into the selected language */}
                          {selectedLang.code !== 'en' && (
                            <div style={{ padding: '14px 16px', borderRadius: 12, background: `${T}0c`, border: `1px solid ${T}33`, marginBottom: 24 }}>
                              <p className={cn(isAdlam && 'font-adlam')} style={{ fontSize: 10, fontWeight: 700, color: T, fontFamily: isAdlam ? undefined : 'Inter, var(--adlam-ui), sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{selectedLang.name}</p>
                              {promptTr.loading ? (
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontStyle: 'italic' }}>…</p>
                              ) : (
                                <p className={cn(isAdlam && 'font-adlam')} style={{ fontSize: 12, color: '#d4d4d8', fontFamily: isAdlam ? undefined : 'Inter, var(--adlam-ui), sans-serif', lineHeight: 1.7, overflowWrap: 'anywhere' }}>{promptTr.text || cleanPrompt(cc.description)}</p>
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
                          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'Inter, var(--adlam-ui), sans-serif', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fff'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#adaaaa'}
                        >
                          <ChevronRight className="w-3 h-3 rotate-180" /> {t.templatesNav}
                        </button>
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>/</span>
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontWeight: 600 }}>{tr.name}</span>
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
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>Preview coming soon</span>
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
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ cursor: 'pointer' }} onClick={() => setSelectedTemplate(null)}>{t.templatesNav}</span>
                        <ChevronRight className="w-3 h-3" />
                        <span style={{ color: 'var(--text-muted)' }}>{tr.name}</span>
                      </div>

                      {/* category + city */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ padding: '3px 10px', borderRadius: 9999, background: `${P}18`, color: P, fontSize: 10, fontWeight: 700, fontFamily: 'Inter, var(--adlam-ui), sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{selectedTemplate.category}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>{selectedTemplate.city}</span>
                      </div>

                      {/* name */}
                      <h2 className={cn('font-black text-white tracking-tighter mb-3', isAdlam && 'font-adlam')}
                        style={{ fontFamily: isAdlam ? undefined : MANROPE, fontSize: 26, lineHeight: 1.15 }}>{tr.name}</h2>

                      {/* description */}
                      <p style={{ fontSize: 14, color: '#a1a1aa', fontFamily: 'Inter, var(--adlam-ui), sans-serif', lineHeight: 1.6, marginBottom: 24 }}>{tr.description}</p>

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
                            style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, var(--adlam-ui), sans-serif', cursor: 'pointer' }}>
                            Open full preview ↗
                          </button>
                        )}
                      </div>

                      {/* starter prompt preview */}
                      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 24 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Starter prompt</p>
                        <p style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'Inter, var(--adlam-ui), sans-serif', lineHeight: 1.6 }}>{tr.starterPrompt}</p>
                      </div>

                      {/* credit */}
                      <p style={{ fontSize: 10, color: '#52525b', fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>{tl.credit}</p>
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
                      <p className="text-zinc-500 mt-1" style={{ fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontSize: 14 }}>{tl.pageSubtitle}</p>
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
                              <span style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '7px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontWeight: 600 }}>Preview →</span>
                            </div>
                          </div>
                          {/* info */}
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span style={{ padding: '2px 8px', borderRadius: 9999, background: `${P}18`, color: P, fontSize: 9, fontWeight: 700, fontFamily: 'Inter, var(--adlam-ui), sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tmpl.category}</span>
                              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>{tmpl.city}</span>
                            </div>
                            <h3 className={cn('font-black text-white text-sm mb-1', isAdlam && 'font-adlam')}
                              style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{tr.name}</h3>
                            <p className="text-zinc-500 text-xs line-clamp-2" style={{ fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>{tr.description}</p>
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
                                sandbox="allow-scripts"
                                style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }} />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '7px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontWeight: 600 }}>{tl.preview}</span>
                              </div>
                            </div>
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span style={{ padding: '2px 8px', borderRadius: 9999, background: `${T}18`, color: T, fontSize: 9, fontWeight: 700, fontFamily: 'Inter, var(--adlam-ui), sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{ct.language}</span>
                                <span className={cn(isAdlam && 'font-adlam')} style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>{t.communityTitle}</span>
                              </div>
                              <h3 className={cn('font-black text-white text-sm mb-1 truncate', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{ct.name}</h3>
                              <p className="text-zinc-500 text-xs line-clamp-2" style={{ fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>{ct.description}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', marginTop: 32 }}>{tl.credit}</p>
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
                <p className={cn('text-zinc-500', isAdlam && 'font-adlam')} style={{ fontSize: 14, fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>
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
                              <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>{m.script}</p>
                            </div>
                            {active && (
                              <span style={{ padding: '2px 10px', borderRadius: 9999, background: `${P}20`, color: P, fontSize: 10, fontWeight: 800, fontFamily: MANROPE, textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>Active</span>
                            )}
                          </div>

                          {/* sample text */}
                          <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)' }}>
                            <p className={cn('font-bold mb-0.5', lang.code === 'ff-adlm' && 'font-adlam')}
                              style={{ fontSize: lang.code === 'ff-adlm' ? 15 : 14, color: 'var(--text-primary)', fontFamily: lang.code === 'ff-adlm' ? undefined : MANROPE }}>{m.sample}</p>
                            <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>{m.sampleLabel}</p>
                          </div>

                          {/* stats row */}
                          <div className="flex gap-4 mb-4">
                            <div>
                              <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Speakers</p>
                              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: MANROPE }}>{m.speakers}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Region</p>
                              <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', lineHeight: 1.4 }}>{m.region}</p>
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
                      <p style={{ fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontSize: 10, color: '#52525b' }}>{region}</p>
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
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>
                          Unicode U+1E900–U+1E95F · RTL script by Ibrahima & Abdoulaye Barry · 28 core letters + 6 loan · 40M+ Fulani speakers
                        </p>
                      </div>
                    </div>

                    {/* column legend */}
                    <div className="grid grid-cols-5 gap-1 px-1" style={{ fontSize: 9, fontWeight: 700, color: '#3f3f46', fontFamily: 'Inter, var(--adlam-ui), sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
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
                            <span style={{ fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>{name}</span>
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
                            <span style={{ fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>{name}</span>
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
                            <span style={{ fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>{name}</span>
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
                            <p style={{ fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontSize: 11, color: '#52525b' }}>{meaning}</p>
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
              <div className="w-full p-4 sm:p-8 md:p-10 space-y-8">

                {/* ── SEARCH HERO CARD ── */}
                <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(253,139,0,0.06) 60%, rgba(19,19,19,1))', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: 28, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
                  <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.15em', color: P, textTransform: 'uppercase', marginBottom: 12, fontFamily: MANROPE }}>DOCUMENTATION</p>
                  <h1 className={cn('font-black tracking-tighter mb-2', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE, fontSize: 32, color: '#fff' }}>
                    {t.docsPageTitle}
                  </h1>
                  <p className={cn('text-zinc-500 mb-5', isAdlam && 'font-adlam')} style={{ fontSize: 14 }}>{t.docsPageSubtitle}</p>
                  {/* real actions only — the fake search box and decorative chips are gone */}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => { setPage('status'); setCurrentProject(null); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:border-white/20"
                      style={{ background: 'var(--btn-bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontFamily: MANROPE, cursor: 'pointer' }}>
                      <Activity className="w-3.5 h-3.5" /> {t.systemStatusLabel}
                    </button>
                    <a href="mailto:gandoadlam25@gmail.com"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:border-white/20"
                      style={{ background: 'var(--btn-bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontFamily: MANROPE, textDecoration: 'none' }}>
                      <AlertTriangle className="w-3.5 h-3.5" /> {selectedLang.code === 'fr' ? 'Contacter le support' : 'Contact Support'}
                    </a>
                  </div>
                </div>

                {/* ── CONTENT ── */}
                <div className="flex flex-col md:flex-row gap-8 items-start">

                  {/* CONTENT (fake browse-nav + dead quick-links sidebar removed — nothing
                      there was clickable; real actions live in the hero card above) */}
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { n: '01', label: 'Create your account' },
                        { n: '02', label: 'Sign in with Google' },
                        { n: '03', label: 'Your first prompt' },
                        { n: '04', label: 'Understanding previews' },
                      ].map(({ n, label }) => (
                        /* numbered steps, not links — no hover/cursor/chevron pretending otherwise */
                        <div key={n} className="flex items-center gap-3"
                          style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ width: 22, height: 22, borderRadius: 7, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6', fontFamily: MANROPE, fontWeight: 900, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {n}
                          </div>
                          <span className={cn(isAdlam && 'font-adlam')} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: isAdlam ? undefined : MANROPE, flex: 1 }}>{label}</span>
                        </div>
                      ))}
                    </div>

                    {/* ARTICLE CARD */}
                    <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-horizontal)' }} />
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
                    {/* the model the user actually builds with — not the health-probe model */}
                    <p className="text-white font-bold text-sm">{PROVIDER_LABEL[provider]}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {selectedLang.code === 'fr' ? 'Votre modèle de génération' : 'Your selected build model'}
                    </p>
                  </div>
                  <span className="text-xs font-black px-3 py-1 rounded-full" style={{ background: `${P}15`, color: P }}>Active</span>
                </div>
                {sysStatus.model !== '—' && (
                  <p className="text-zinc-600 text-[11px] mt-3">
                    {selectedLang.code === 'fr' ? 'Sonde de disponibilité' : 'Health probe'}: {sysStatus.model}
                  </p>
                )}
              </div>

              {sysStatus.checked && (
                <p className={cn('text-zinc-600 text-xs text-center', isAdlam && 'font-adlam')}>
                  {t.statusLastChecked}: {sysStatus.checked}
                </p>
              )}
            </div>

          ) : page === 'collector' ? (
            /* ══ GANDO COLLECTOR ══ */
            <Suspense fallback={<LazyFallback />}><GandoCollector user={user} langCode={selectedLang.code} /></Suspense>

          ) : page === 'admin' && isAdmin ? (
            /* ══ ADMIN PORTAL ══ */
            <Suspense fallback={<LazyFallback />}><AdminPortal user={user} langCode={selectedLang.code} /></Suspense>

          ) : (
            /* ══ DASHBOARD (Bolt-style) ══ */
            <div className="flex-1 overflow-y-auto relative z-10">

              {/* radial glow background */}
              <div className="pointer-events-none fixed inset-0 z-0" style={{ background: `radial-gradient(ellipse 80% 50% at 50% 25%, ${P}14 0%, transparent 70%)` }} />
              <div className="pointer-events-none fixed inset-0 z-0" style={{ background: `radial-gradient(ellipse 50% 40% at 70% 60%, ${S}09 0%, transparent 65%)` }} />

              {/* ── HERO SECTION ── */}
              <div className="flex flex-col items-center px-6 relative z-10" style={{ paddingTop: '16vh', paddingBottom: 48 }}>
                <div style={{ maxWidth: 760, width: '100%' }}>

                  {/* personalized greeting — time-aware (en/fr); ADLaM keeps the verified phrase */}
                  {(() => {
                    const raw = userPrefs.preferredName?.trim() || user.displayName?.trim().split(/\s+/)[0] || user.email?.split('@')[0] || 'Builder';
                    const firstName = isAdlam ? latinToAdlam(raw) : raw.charAt(0).toUpperCase() + raw.slice(1);
                    const name = (
                      <span key="n" style={{ background: `linear-gradient(135deg,${P},${S})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {firstName}
                      </span>
                    );
                    const createdMs = user.metadata?.creationTime ? Date.parse(user.metadata.creationTime) : 0;
                    const firstVisit = !prevSeenMs && Date.now() - createdMs < 10 * 60 * 1000;
                    const welcomeBack = !!prevSeenMs && Date.now() - prevSeenMs > 7 * 24 * 3600 * 1000;
                    const tpl = pickGreeting(selectedLang.code, { firstVisit, welcomeBack, seed: greetSeed });
                    const emoji = greetEmoji({ firstVisit, welcomeBack });
                    const [pre, post] = tpl.split('{name}');
                    const parts: React.ReactNode[] = post === undefined ? [pre] : [pre, name, post];
                    if (emoji && !greetEmojiGone) parts.push(
                      <span key="e" aria-hidden
                        style={{ display: 'inline-block', marginInlineStart: 10, opacity: greetEmojiVisible ? 1 : 0, transition: 'opacity 1.5s ease' }}>
                        {emoji}
                      </span>
                    );
                    return (
                      <h1 dir={isAdlam ? 'rtl' : undefined}
                        className={cn('text-center font-black text-white tracking-tight mb-8', isAdlam && 'font-adlam')}
                        style={{ fontFamily: isAdlam ? undefined : MANROPE, fontSize: 'clamp(22px, 2.6vw, 34px)', lineHeight: 1.2 }}>
                        {/* logo flows inline with the text — stays glued to the first word
                            even when a long phrase fills the row (was a flex row: logo got
                            orphaned at the container edge on long English greetings) */}
                        <span style={{ display: 'inline-block', verticalAlign: 'middle', marginInlineEnd: 12, position: 'relative', top: -3 }}>
                          <GandoLogo size={30} />
                        </span>
                        {parts}
                      </h1>
                    );
                  })()}

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
                          color: importMode === im ? 'var(--text-primary)' : 'var(--text-muted)',
                          background: importMode === im ? 'var(--border)' : 'transparent',
                          border: importMode === im ? '1px solid var(--border)' : '1px solid transparent',
                        }}>
                        <Icon className="w-3 h-3" />{label}
                      </button>
                    ))}
                    {/* script style of the GENERATED site — ADLaM builds only */}
                    {isAdlam && (
                      <button onClick={() => setBuildScript(b => b === 'unjoined' ? 'joined' : 'unjoined')}
                        title={buildScript === 'unjoined'
                          ? 'Generated app uses UNJOINED ADLaM (easy reading) — click for joined cursive'
                          : 'Generated app uses JOINED cursive ADLaM — click for unjoined (easy reading)'}
                        className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                          fontFamily: MANROPE,
                          color: 'var(--text-secondary)',
                          background: 'var(--btn-bg)',
                          border: '1px solid var(--border)',
                        }}>
                        <span style={{ fontFamily: buildScript === 'unjoined' ? '"Noto Sans Adlam Unjoined", sans-serif' : 'var(--font-adlam)', fontSize: 14, lineHeight: 1 }}>𞤢𞤣𞤤𞤢𞤥</span>
                        {buildScript === 'unjoined' ? 'unjoined' : 'joined'}
                      </button>
                    )}
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
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const ctx = buildDashContext(); const imgs = buildDashImages(); setDashAttachments([]); handleSend(ctx || undefined, imgs.length ? imgs : undefined); } }}
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
                            {/* Plus — attach files/photos (opens the picker directly; screenshot/URL
                                imports were dead menu items — removed until actually wired) */}
                            <button
                              onClick={() => dashFileInputRef.current?.click()}
                              title="Attach files or photos"
                              style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--btn-bg)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            {/* Model picker */}
                            <div ref={dashModelRef} style={{ position: 'relative' }}>
                              <button
                                onClick={() => setDashModelOpen(o => !o)}
                                title="Choose the AI model"
                                aria-haspopup="menu" aria-expanded={dashModelOpen}
                                className="flex items-center gap-1.5 py-2 px-3 rounded-xl transition-colors"
                                style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', background: 'var(--btn-bg)', border: '1px solid var(--border)' }}
                              >
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: PROVIDER_COLOR[provider] }} />
                                {PROVIDER_LABEL[provider]}
                                <ChevronDown className="w-3 h-3 opacity-60" />
                              </button>
                              {dashModelOpen && (
                                <div style={{ position: 'absolute', top: 40, left: 0, background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'hidden', overflowY: 'auto', minWidth: 240, maxHeight: 132, zIndex: 50 }}>
                                  {modelOptions.map(m => (
                                    <button
                                      type="button"
                                      key={m.id}
                                      onClick={() => { setProvider(m.id); setDashModelOpen(false); }}
                                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent', width: '100%', textAlign: 'left', border: 'none' }}
                                    >
                                      <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: PROVIDER_COLOR[m.id] }} />
                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontWeight: 600 }}>{m.label}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>{m.sub}</div>
                                      </div>
                                      {provider === m.id && <Check className="w-3.5 h-3.5" style={{ color: '#3b82f6', flexShrink: 0 }} />}
                                    </button>
                                  ))}
                                  <button type="button" onClick={() => { setByokModalOpen(true); setDashModelOpen(false); }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent', borderTop: '1px solid var(--border)', width: '100%', textAlign: 'left', borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}>
                                    <Plus className="w-3.5 h-3.5" style={{ color: '#3b82f6', flexShrink: 0 }} />
                                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontWeight: 600 }}>{selectedLang.code === "fr" ? "Utilisez votre clé" : "Bring your own key"}</div>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        : <span style={{ fontSize: 11, color: '#52525b', fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>
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
                        <button onClick={() => { const ctx = buildDashContext(); const imgs = buildDashImages(); setDashAttachments([]); handleSend(ctx || undefined, imgs.length ? imgs : undefined); }} disabled={isGenerating || (!input.trim() && dashAttachments.length === 0)}
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
                        <ProjectThumb code={p.code} height={120} />
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-3">
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

              {/* ── TEMPLATE GRID — inspiration for new users; veterans get a clean dashboard ── */}
              {projects.length <= 2 && (() => {
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
                                <span style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '6px 14px', borderRadius: 6, fontSize: 11, fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontWeight: 600 }}>Preview →</span>
                              </div>
                            </div>
                            <div className="p-3">
                              <p className={cn('font-black text-white text-xs mb-0.5 truncate', isAdlam && 'font-adlam')} style={{ fontFamily: isAdlam ? undefined : MANROPE }}>{tr.name}</p>
                              <p className="text-zinc-500 text-[10px] line-clamp-1" style={{ fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>{tr.description}</p>
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
