import React, { useRef, useEffect, useState } from 'react';
import { Send, Loader2, Layout, GraduationCap, Globe, User, ArrowRight, ArrowUp, Mic, MicOff, Copy, RotateCcw, ThumbsUp, ThumbsDown, Code2, Plus, Paperclip, Check, ChevronDown, MessageSquare, Square, Volume2, VolumeX } from 'lucide-react';
import { GandoSpark } from './GandoSpark';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, TokenUsage } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useVoiceInput } from '../lib/useVoiceInput';
import { ModeSwitch } from './ModeSwitch';
import { type Provider, speakText } from '../services/geminiService';
import { normalizeAdlam } from '../../lib/translit';
import { PROVIDER_COLOR, PROVIDER_LABEL, MODEL_OPTIONS } from '../lib/providers';
import { collection, addDoc, serverTimestamp, db, auth } from '../firebase';
import { downscaleDataUrl, MAX_APP_IMAGES } from '../lib/appImages';

type Attachment = { id: string; name: string; kind: 'image' | 'text'; content: string; previewUrl?: string };


// Styled renderers for chat markdown — tables, code, lists, headings, links.
// Without these (and remark-gfm) a table answer shows as raw `| a | b |` pipes.
const MD_COMPONENTS = {
  table: (p: any) => (
    <div style={{ overflowX: 'auto', margin: '10px 0', borderRadius: 10, border: '1px solid var(--border)' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }} {...p} />
    </div>
  ),
  thead: (p: any) => <thead style={{ background: 'var(--hover-bg)' }} {...p} />,
  th: (p: any) => <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }} {...p} />,
  td: (p: any) => <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)', verticalAlign: 'top' }} {...p} />,
  tr: (p: any) => <tr {...p} />,
  code: ({ className, children, ...p }: any) =>
    /language-/.test(className || '') ? (
      <code className={className} {...p}>{children}</code>
    ) : (
      <code style={{ background: 'var(--hover-bg)', padding: '1px 5px', borderRadius: 5, fontSize: '0.88em', fontFamily: 'ui-monospace, monospace' }} {...p}>{children}</code>
    ),
  pre: (p: any) => (
    <pre style={{ background: 'var(--app-bg)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12, overflowX: 'auto', margin: '10px 0', fontSize: 12.5, lineHeight: 1.5 }} {...p} />
  ),
  a: (p: any) => <a style={{ color: 'var(--brand, #3b82f6)', textDecoration: 'underline', textUnderlineOffset: 2 }} target="_blank" rel="noreferrer" {...p} />,
  ul: (p: any) => <ul style={{ paddingLeft: 20, margin: '8px 0', listStyle: 'disc' }} {...p} />,
  ol: (p: any) => <ol style={{ paddingLeft: 20, margin: '8px 0', listStyle: 'decimal' }} {...p} />,
  li: (p: any) => <li style={{ margin: '3px 0' }} {...p} />,
  h1: (p: any) => <h1 style={{ fontSize: 18, fontWeight: 800, margin: '14px 0 8px', color: 'var(--text-primary)' }} {...p} />,
  h2: (p: any) => <h2 style={{ fontSize: 16, fontWeight: 800, margin: '12px 0 6px', color: 'var(--text-primary)' }} {...p} />,
  h3: (p: any) => <h3 style={{ fontSize: 14, fontWeight: 700, margin: '10px 0 5px', color: 'var(--text-primary)' }} {...p} />,
  p: (p: any) => <p style={{ margin: '6px 0' }} {...p} />,
  blockquote: (p: any) => <blockquote style={{ borderLeft: '3px solid var(--border)', paddingLeft: 12, margin: '8px 0', color: 'var(--text-muted)' }} {...p} />,
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '12px 0' }} />,
  strong: (p: any) => <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }} {...p} />,
};

interface ChatProps {
  messages: Message[];
  input: string;
  setInput: (val: string) => void;
  onSend: (extraContext?: string, images?: { data: string; mediaType: string; name?: string }[]) => void;
  isGenerating: boolean;
  generationStatus: string;
  generationSteps?: string[];
  selectedLanguage: string;
  currentLanguage?: { code: any; name: string };
  languages?: { code: any; name: string }[];
  onLanguageSelect?: (lang: { code: any; name: string }) => void;
  languageCode: string;
  t: any;
  provider?: Provider;
  onProviderChange?: (p: Provider) => void;
  byokModels?: { id: Provider; label: string; sub: string }[];
  onManageKeys?: () => void;
  userPhoto?: string | null;
  userName?: string | null;
  mode?: 'build' | 'chat';
  onModeChange?: (m: 'build' | 'chat') => void;
  currentCode?: string;
  onRevert?: (snapshot: string) => void;
  onStop?: () => void;
  lastUsage?: TokenUsage | null; // token count of the last completed build/chat
  hideHeader?: boolean; // parent renders its own title bar (full-screen chat session)
}



const SUGGESTIONS = (t: any) => [
  { 
    icon: Layout, 
    label: t.ecommerce, 
    prompt: t.ecommercePrompt, 
    color: "text-blue-400", 
    bg: "bg-blue-400/10" 
  },
  { 
    icon: GraduationCap, 
    label: t.languageLearning, 
    prompt: t.languageLearningPrompt, 
    color: "text-[#3b82f6]", 
    bg: "bg-[#3b82f6]/10" 
  },
  { 
    icon: Globe, 
    label: t.communityHub, 
    prompt: t.communityHubPrompt, 
    color: "text-purple-400", 
    bg: "bg-purple-400/10" 
  },
];

// Code Block Component for Chat
interface CodeBlockProps {
  code: string;
  language?: string;
  onCopyCode?: (code: string) => void;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'javascript', onCopyCode }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="not-prose bg-zinc-950 border border-white/10 rounded-xl overflow-hidden my-4 shadow-lg group/code hover:border-white/20 transition-all"
    >
      <div className="flex items-center justify-between bg-zinc-900/50 px-4 py-2 border-b border-white/5">
        <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">{language}</span>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
          title="Copy code"
        >
          {copied ? (
            <div className="w-4 h-4 text-[#3b82f6]">✓</div>
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className={`language-${language} text-zinc-300 text-sm font-mono leading-relaxed`}>
          {code}
        </code>
      </pre>
    </motion.div>
  );
};

// Message Action Component
interface MessageActionsProps {
  message: Message;
  onCopy: () => void;
  onRegenerate?: () => void;
  onRevert?: (snapshot: string) => void;
  isCurrentVersion?: boolean;
  onSpeak?: () => void;
  isSpeaking?: boolean;
  isSpeakLoading?: boolean;
  onRate?: (rating: 'up' | 'down') => void;
}

const TTS_RATES = [
  { rate: 0.8, label: '0.8×', name: 'Medium' },
  { rate: 0.7, label: '0.7×', name: 'Slow' },
  { rate: 1.0, label: '1×', name: 'Fast' },
] as const;

const MessageActions: React.FC<MessageActionsProps> = ({ message, onCopy, onRegenerate, onRevert, isCurrentVersion, onSpeak, isSpeaking, isSpeakLoading, onRate }) => {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<'up' | 'down' | null>(null);
  const [rateIdx, setRateIdx] = useState(() => {
    const saved = Number(localStorage.getItem('gando-tts-rate'));
    return Math.max(0, TTS_RATES.findIndex(r => r.rate === saved));
  });
  const cycleRate = () => {
    const next = (rateIdx + 1) % TTS_RATES.length;
    setRateIdx(next);
    localStorage.setItem('gando-tts-rate', String(TTS_RATES[next].rate));
  };

  const handleRate = (r: 'up' | 'down') => {
    const next = liked === r ? null : r;
    setLiked(next);
    if (next) onRate?.(next);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className="flex items-center gap-2"
    >
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all group"
        title="Copy message"
      >
        {copied ? (
          <div className="w-4 h-4 text-[#3b82f6]">✓</div>
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
      {message.role === 'assistant' && onSpeak && (
        <button
          onClick={onSpeak}
          disabled={isSpeakLoading}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
          style={{ color: isSpeaking ? '#3b82f6' : '#a1a1aa' }}
          title={isSpeaking ? 'Stop speaking' : 'Speak response'}
        >
          {isSpeakLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : isSpeaking
            ? <VolumeX className="w-4 h-4" />
            : <Volume2 className="w-4 h-4" />}
        </button>
      )}
      {message.role === 'assistant' && onSpeak && (
        <button
          onClick={cycleRate}
          className="px-1.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all text-[10px] font-bold tabular-nums"
          title={`Speech speed: ${TTS_RATES[rateIdx].name} — click to change`}
        >
          {TTS_RATES[rateIdx].label}
        </button>
      )}
      {message.role === 'assistant' && onRegenerate && (
        <button
          onClick={onRegenerate}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
          title="Regenerate response"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      )}
      {message.role === 'assistant' && message.codeSnapshot && onRevert && (
        isCurrentVersion ? (
          <span
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6] text-[10px] font-bold uppercase tracking-wider border border-[#3b82f6]/20"
            title="This is the current version"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
            Current
          </span>
        ) : (
          <button
            onClick={() => onRevert(message.codeSnapshot!)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[10px] font-bold uppercase tracking-wider border border-white/10 transition-all"
            title="Revert project to this version"
          >
            <RotateCcw className="w-3 h-3" />
            Revert
          </button>
        )
      )}
      <button
        onClick={() => handleRate('up')}
        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
        style={{ color: liked === 'up' ? '#3b82f6' : '#a1a1aa' }}
        title="Good response"
      >
        <ThumbsUp className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleRate('down')}
        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
        style={{ color: liked === 'down' ? '#fd8b00' : '#a1a1aa' }}
        title="Bad response"
      >
        <ThumbsDown className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

const ChatImpl: React.FC<ChatProps> = ({
  messages,
  input,
  setInput,
  onSend,
  isGenerating,
  generationStatus,
  generationSteps = [],
  selectedLanguage,
  currentLanguage,
  languages,
  onLanguageSelect,
  languageCode,
  t,
  provider = 'claude',
  onProviderChange,
  byokModels = [],
  onManageKeys,
  userPhoto,
  userName,
  mode = 'build',
  onModeChange,
  currentCode,
  onRevert,
  onStop,
  lastUsage,
  hideHeader = false,
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [speakError, setSpeakError] = useState<string | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  useEffect(() => {
    if (!modelOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setModelOpen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [modelOpen]);
  const modelRef = useRef<HTMLDivElement>(null);
  const modelOptions = [...MODEL_OPTIONS, ...byokModels];
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachNote, setAttachNote] = useState<string | null>(null);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let imageCount = attachments.filter(a => a.kind === 'image').length;
    Array.from(e.target.files ?? []).forEach(file => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (file.type.startsWith('image/')) {
        if (imageCount >= MAX_APP_IMAGES) {
          setAttachNote(t.maxImagesNote.replace('{n}', String(MAX_APP_IMAGES)));
          return;
        }
        imageCount++;
        const url = URL.createObjectURL(file);
        const reader = new FileReader();
        reader.onload = () => {
          // downscale BEFORE storing: smaller vision payload now, smaller
          // Storage upload later, fast pages for visitors of the built site
          downscaleDataUrl(reader.result as string)
            .catch(() => reader.result as string)
            .then(small => setAttachments(prev => [...prev, { id, name: file.name, kind: 'image', content: small, previewUrl: url }]));
        };
        reader.readAsDataURL(file);
      } else {
        file.text().then(text => setAttachments(prev => [...prev, { id, name: file.name, kind: 'text', content: text }]));
      }
    });
    e.target.value = '';
  };

  const handleSendClick = async () => {
    if (isGenerating || isSending) return;
    if (attachments.length === 0) { onSend(); return; }
    setIsSending(true);
    try {
      // Images are sent as real VISION input (the model sees them) — no OCR.
      // Text files are still inlined as context.
      const parts: string[] = [];
      const images: { data: string; mediaType: string; name?: string }[] = [];
      for (const att of attachments) {
        if (att.kind === 'image') {
          const base64 = att.content.split(',')[1] ?? att.content;
          const mime = att.content.startsWith('data:') ? att.content.split(';')[0].slice(5) : 'image/png';
          images.push({ data: base64, mediaType: mime, name: att.name });
        } else {
          parts.push(`[File: ${att.name}]\n${att.content.slice(0, 4000)}`);
        }
      }
      setAttachments([]);
      setAttachNote(null);
      onSend(parts.join('\n\n') || undefined, images.length ? images : undefined);
    } finally { setIsSending(false); }
  };

  // Voice input (shared hook — Gemini-powered for African-language support).
  const { isListening, isTranscribing, toggleListening } = useVoiceInput(input, setInput, selectedLanguage);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating, generationStatus]);

  useEffect(() => {
    if (!modelOpen) return;
    const handler = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modelOpen]);

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = next + 'px';
    el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = next + 'px';
    el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
  }, [input]);

  const handleRate = async (msg: Message, rating: 'up' | 'down') => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: uid,
        messageId: msg.id ?? null,
        rating,
        response: msg.content.slice(0, 2000),
        provider: provider ?? null,
        languageCode,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('feedback write failed:', e);
    }
  };

  const handleSpeak = (msg: Message) => {
    // ADLaM codepoint → Latin letter (reverse of App.tsx ADLAM_MAP)
    const ADLAM_SMALL: Record<number, string> = {
      0x1e922:'a',0x1e926:'b',0x1e937:'c',0x1e923:'d',0x1e92b:'e',0x1e92c:'f',0x1e93a:'g',
      0x1e938:'h',0x1e92d:'i',0x1e936:'j',0x1e933:'k',0x1e924:'l',0x1e925:'m',0x1e932:'n',
      0x1e92e:'o',0x1e928:'p',0x1e939:'q',0x1e92a:'r',0x1e927:'s',0x1e93c:'t',0x1e935:'u',
      0x1e93e:'v',0x1e931:'w',0x1e93f:'x',0x1e934:'y',0x1e941:'z',
    };
    // capitals sit 0x22 below their small counterpart
    const toLatinChar = (cp: number) =>
      ADLAM_SMALL[cp] ?? ADLAM_SMALL[cp + 0x22] ?? null;
    const adlamToLatin = (text: string) =>
      [...text].map(ch => {
        const cp = ch.codePointAt(0) ?? 0;
        const lat = toLatinChar(cp);
        if (lat) return lat;
        // keep punctuation/spaces, drop unrecognised ADLaM chars
        if (cp >= 0x1e900 && cp <= 0x1e95f) return '';
        return ch;
      }).join('');
    // Stop if already speaking this message
    if (speakingId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    setSpeakingId(null);

    // Strip markdown, then convert ADLaM → Latin so browser can pronounce it
    const stripped = msg.content
      .replace(/#{1,6}\s/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
      .replace(/`{1,3}[^`]*`{1,3}/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s*[-*+]\s/gm, '').trim();
    const clean = (languageCode === 'ff-adlm' ? adlamToLatin(stripped) : stripped).slice(0, 600);

    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = languageCode === 'fr' ? 'fr-FR' : 'en-US';
    utter.rate = 0.95;
    utter.onend = () => setSpeakingId(null);
    utter.onerror = () => setSpeakingId(null);
    setSpeakingId(msg.id);
    window.speechSynthesis.speak(utter);
  };

  const isEmpty = messages.length === 0 && !isGenerating;
  const charCount = input.length;
  const maxChars = 2000;

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative" style={{ background: 'var(--app-bg)' }}>
      {/* Header bar (skipped when the parent view provides its own) */}
      {!hideHeader && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, position: 'relative', zIndex: 10 }}>
          <span className={cn(languageCode === 'ff-adlm' && 'font-adlam')} style={{ fontFamily: 'Manrope, var(--adlam-ui), sans-serif', fontWeight: 800, fontSize: 12, color: 'var(--text-primary)' }}>{t.chatWithGando}</span>
        </div>
      )}
      {/* Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#3b82f6]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      {/* container-type lets the empty-state greeting scale with the PANEL width
          (cqw units) — md: breakpoints track the viewport, so a narrow chat panel
          on a wide screen got 72px ADLaM glyphs (unreadable wall of text) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative" style={{ containerType: 'inline-size' }}>
        <div className={cn(
          "max-w-3xl mx-auto w-full px-4 md:px-6 py-8 md:py-12 space-y-8",
          isEmpty ? "min-h-[calc(100vh-64px)] flex flex-col justify-center py-12 md:py-20" : ""
        )}>
          <AnimatePresence mode="popLayout">
            {isEmpty ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-12 text-center"
              >
                <div className="space-y-4">
                  <h1 className={cn(
                    "text-4xl font-bold tracking-tight text-white leading-[1.15]",
                    languageCode === 'ff-adlm' ? "font-adlam" : "font-display"
                  )}
                    style={{ fontSize: 'clamp(24px, 7.5cqw, 52px)' }}>
                    {languageCode === 'ff-adlm' ? (
                      t.chatWelcome
                    ) : (
                      <>
                        {t.chatWelcome.split('build')[0]} <span className="text-[#3b82f6]">{t.chatWelcome.includes('build') ? 'build' : ''}</span> {t.chatWelcome.split('build')[1]}
                      </>
                    )}
                  </h1>
                </div>

                <div className="relative max-w-3xl mx-auto group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#3b82f6]/20 via-blue-500/20 to-purple-500/20 rounded-[2.5rem] blur-2xl opacity-50 group-focus-within:opacity-100 transition-opacity duration-700" />
                  <div className="relative backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-3 shadow-2xl group-focus-within:border-[#3b82f6]/50 transition-all duration-500 input-glow" style={{ background: 'var(--card-elevated)' }}>
                    <textarea 
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          onSend();
                        }
                      }}
                      placeholder={t.chatPlaceholder.replace('{language}', selectedLanguage)}
                      className={cn(
                        "gando-input w-full bg-transparent border-none rounded-3xl px-5 pt-5 pb-2 text-lg focus:outline-none focus:ring-0 transition-all resize-none min-h-[140px] text-zinc-100 placeholder:text-zinc-600 font-medium leading-relaxed",
                        languageCode === 'ff-adlm' && "font-adlam"
                      )}
                    />
                    {/* controls in normal flow (were absolute overlays — clusters
                        collided with each other on narrow panels/mobile) */}
                    <div className="flex items-center justify-between gap-2 px-2 pb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Model picker */}
                      <div ref={modelRef} style={{ position: 'relative' }}>
                        <button
                          onClick={() => setModelOpen(o => !o)}
                          aria-haspopup="menu" aria-expanded={modelOpen}
                          title="Choose the AI model"
                          className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/5 transition-colors"
                          style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', maxWidth: 130, overflow: 'hidden' }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: PROVIDER_COLOR[provider ?? 'claude'] }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{PROVIDER_LABEL[provider ?? 'claude']}</span>
                          <ChevronDown className="w-3 h-3" style={{ flexShrink: 0, opacity: 0.6 }} />
                        </button>
                        {modelOpen && (
                          <div style={{ position: 'absolute', bottom: 38, left: 0, background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'hidden', overflowY: 'auto', minWidth: 240, maxHeight: 132, zIndex: 50 }}>
                            {modelOptions.map(m => (
                              <button
                                type="button"
                                key={m.id}
                                onClick={() => { onProviderChange?.(m.id); setModelOpen(false); }}
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
                            <button type="button" onClick={() => { onManageKeys?.(); setModelOpen(false); }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent', borderTop: '1px solid var(--border)', width: '100%', textAlign: 'left', borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}>
                              <Plus className="w-3.5 h-3.5" style={{ color: '#3b82f6', flexShrink: 0 }} />
                              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontWeight: 600 }}>{languageCode === "fr" ? "Utilisez votre clé" : "Bring your own key"}</div>
                            </button>
                          </div>
                        )}
                      </div>
                      <ModeSwitch mode={mode} onChange={onModeChange} dropUp />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={toggleListening}
                        className={cn(
                          "p-2.5 rounded-xl transition-all active:scale-95 group/mic relative overflow-hidden",
                          isListening
                            ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
                            : isTranscribing
                            ? "bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/30 animate-spin"
                            : "bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        {isTranscribing ? <Loader2 className="w-5 h-5" /> : isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>
                      {isGenerating && mode === 'build' ? (
                        <button
                          onClick={onStop}
                          className="p-2.5 rounded-xl transition-all active:scale-95 bg-white/10 text-white border border-white/20 hover:bg-white/20"
                        >
                          <Square className="w-5 h-5 fill-current" />
                        </button>
                      ) : (
                        <button
                          onClick={() => void handleSendClick()}
                          disabled={(!input.trim() && attachments.length === 0) || isSending}
                          className={cn(
                            "p-2.5 rounded-xl transition-all active:scale-95 group/btn relative overflow-hidden",
                            (input.trim() || attachments.length > 0) && !isSending
                              ? "bg-white text-black hover:bg-zinc-200"
                              : "bg-white/5 text-zinc-600 cursor-not-allowed"
                          )}
                        >
                          <ArrowUp className={cn("w-5 h-5 transition-transform", input.trim() && "group-hover/btn:-translate-y-0.5")} />
                        </button>
                      )}
                    </div>
                    </div>
                  </div>
                </div>

                {!currentCode && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl mx-auto">
                    {SUGGESTIONS(t).map((s, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + i * 0.1 }}
                        onClick={() => setInput(s.prompt)}
                        className="premium-card p-6 flex flex-col items-start text-left gap-4 group hover:bg-white/[0.03] hover:-translate-y-1 overflow-hidden"
                      >
                        <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110 flex-shrink-0", s.bg, s.color)}>
                          <s.icon className="w-6 h-6" />
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                          <h3 className={cn(
                            "text-sm font-bold text-white group-hover:text-[#3b82f6] transition-colors break-words",
                            languageCode === 'ff-adlm' && "font-adlam"
                          )}>{s.label}</h3>
                          <p className={cn(
                            "text-xs text-zinc-500 line-clamp-2 leading-relaxed break-words",
                            languageCode === 'ff-adlm' && "font-adlam"
                          )}>{s.prompt}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-white transition-all group-hover:translate-x-1 ml-auto flex-shrink-0" />
                      </motion.button>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <>
              {speakError && (
                <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#f87171', marginBottom: 8 }}>
                  TTS error: {speakError}
                </div>
              )}
              {speakingId && languageCode === 'ff-adlm' && (
                <div style={{ background: 'rgba(253,139,0,0.10)', border: '1px solid rgba(253,139,0,0.25)', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#fd8b00', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Placeholder voice — no Pulaar TTS model exists yet. Help us build one: contribute audio in the <strong>Collector</strong>.</span>
                </div>
              )}
              <div className="space-y-8">
                {/* empty assistant bubbles never render — while streaming, the typing
                    indicator below is the placeholder; stale empties (old failed saves) vanish */}
                {messages.filter(m => m.role !== 'assistant' || m.content.trim()).map((m, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group"
                  >
                    <div className={cn(
                      "flex gap-4 items-start",
                      m.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}>
                      {/* Avatar */}
                      {m.role === 'user' ? (
                        userPhoto ? (
                          <img src={userPhoto} alt={userName || 'You'} className="w-10 h-10 rounded-2xl object-cover flex-shrink-0 mt-0.5 shadow-xl border border-white/10" />
                        ) : (
                          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xl border text-white border-white/10"
                            style={{ background: `linear-gradient(135deg, #3b82f6, #fd8b00)` }}>
                            <span className="text-sm font-black">{(userName || 'U')[0].toUpperCase()}</span>
                          </div>
                        )
                      ) : (
                        <GandoSpark size={40} active={isGenerating && m.id === messages[messages.length - 1]?.id} className="mt-0.5" />
                      )}

                      {/* Message Content */}
                      <div className={cn(
                        "flex flex-col gap-2 flex-1 max-w-[85%]",
                        m.role === 'user' && "items-end"
                      )}>
                        <div className={cn(
                          "relative group/message transition-all pb-10",
                          m.role === 'user' && "flex flex-col items-end"
                        )}>
                          <div className={cn("p-4 transition-all", languageCode === 'ff-adlm' && "font-adlam")}
                            style={m.role === 'user' ? {
                              background: 'linear-gradient(135deg, rgba(59,130,246,0.14), rgba(253,139,0,0.08))',
                              border: '1px solid rgba(59,130,246,0.25)',
                              borderRadius: '14px 14px 4px 14px',
                              fontSize: 13,
                              lineHeight: 1.6,
                              color: 'var(--text-primary)',
                            } : {
                              background: 'var(--card-bg)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '14px 14px 14px 4px',
                              fontSize: 13,
                              lineHeight: 1.6,
                              color: 'var(--text-secondary)',
                            }}>
                            {m.role === 'assistant' ? (
                              <div className="max-w-none" dir="auto" style={{ overflowWrap: 'anywhere' }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{normalizeAdlam(m.content)}</ReactMarkdown>
                              </div>
                            ) : (
                              <>
                                {m.images?.length ? (
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: m.content ? 8 : 0, justifyContent: 'flex-end' }}>
                                    {m.images.map((src, i) => (
                                      <img key={i} src={src} alt="" style={{ maxWidth: 200, maxHeight: 200, borderRadius: 10, objectFit: 'cover' }} />
                                    ))}
                                  </div>
                                ) : null}
                                {m.content}
                              </>
                            )}
                          </div>

                          {/* Message Actions - Show on hover */}
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            whileHover={{ opacity: 1, y: 0 }}
                            className="absolute bottom-0 right-0 opacity-0 group-hover/message:opacity-100 transition-opacity pointer-events-none group-hover/message:pointer-events-auto"
                          >
                            <MessageActions
                              message={m}
                              onCopy={() => navigator.clipboard.writeText(m.content)}
                              onRevert={onRevert}
                              isCurrentVersion={!!m.codeSnapshot && m.codeSnapshot === currentCode}
                              onSpeak={m.role === 'assistant' ? () => handleSpeak(m) : undefined}
                              isSpeaking={speakingId === m.id}
                              isSpeakLoading={false}
                              onRate={m.role === 'assistant' ? (r) => handleRate(m, r) : undefined}
                            />
                          </motion.div>
                        </div>

                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {isGenerating && !(mode === 'chat' && (messages[messages.length - 1]?.content || '').trim().length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3"
                  >
                    <GandoSpark size={32} active className="mt-0.5" />
                    <div style={{ padding: '12px 16px', borderRadius: '14px 14px 14px 4px', background: 'var(--card-bg)', border: '1px solid rgba(59,130,246,0.2)', maxWidth: '90%' }}>
                      {generationSteps.length === 0 ? (
                        <div className="flex items-center gap-1.5">
                          {[0, 1, 2].map(i => (
                            <motion.div key={i}
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                              style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {generationSteps.map((step, i) => {
                            const isLast = i === generationSteps.length - 1;
                            const done = !isLast; // a new step arriving means previous ones finished
                            return (
                              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-2.5">
                                <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: done ? 'rgba(40,200,64,0.15)' : 'rgba(59,130,246,0.12)' }}>
                                  {done
                                    ? <Check className="w-3 h-3" style={{ color: '#28c840' }} />
                                    : <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#3b82f6' }} />}
                                </div>
                                <span style={{ fontSize: 13, lineHeight: 1.4, color: done ? '#8a8a8a' : '#e4e4e4' }}>{step}</span>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
                {!isGenerating && lastUsage && (lastUsage.inTok + lastUsage.outTok > 0) && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center gap-1.5 pl-11 -mt-1"
                    title={`${lastUsage.model} · ${lastUsage.inTok.toLocaleString()} in / ${lastUsage.outTok.toLocaleString()} out`}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ opacity: 0.7 }}>⚡</span>
                      {(lastUsage.inTok + lastUsage.outTok).toLocaleString()} tokens
                      <span style={{ opacity: 0.55 }}>({lastUsage.inTok.toLocaleString()} in / {lastUsage.outTok.toLocaleString()} out)</span>
                    </span>
                  </motion.div>
                )}
              </div>
              </>
            )}
          </AnimatePresence>
          <div ref={chatEndRef} />
        </div>
      </div>

      {!isEmpty && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ padding: '8px 16px 22px', flexShrink: 0 }}
        >
          {/* floating, centered, same width as the message column (Claude-style) */}
          <div style={{ position: 'relative', background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 20, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 768, width: '100%', margin: '0 auto', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, maxChars))}
              onInput={handleInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendClick();
                }
              }}
              placeholder={t.describeAppPlaceholder}
              className={languageCode === 'ff-adlm' ? 'font-adlam' : ''}
              style={{
                width: '100%',
                minHeight: 80,
                maxHeight: 200,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: 'var(--text-primary)',
                fontSize: 15,
                lineHeight: 1.6,
                fontFamily: 'var(--font-sans)',
                overflowY: 'hidden',
                display: 'block',
                boxSizing: 'border-box',
              }}
            />

            {attachNote && (
              <div style={{ fontSize: 11, color: '#fbbf24', padding: '2px 4px' }}>
                {attachNote}
                <button onClick={() => setAttachNote(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 6 }}>×</button>
              </div>
            )}
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {attachments.map(att => (
                  <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 8px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {att.kind === 'image' && att.previewUrl
                      ? <img src={att.previewUrl} style={{ width: 18, height: 18, borderRadius: 3, objectFit: 'cover' }} alt="" />
                      : <Paperclip className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />}
                    <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                    <button onClick={() => setAttachments(prev => prev.filter(x => x.id !== att.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              {/* Left cluster: Plus · Model picker · Build/Chat */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {/* Plus — attach files/photos (direct picker; dead screenshot/URL
                    menu items removed until actually wired) */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach files or photos"
                  style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Model picker (Claude / Gemini) */}
                <div ref={modelRef} style={{ position: 'relative', flexShrink: 1, minWidth: 0 }}>
                  <button
                    onClick={() => setModelOpen(o => !o)}
                          aria-haspopup="menu" aria-expanded={modelOpen}
                    title="Choose the AI model"
                    style={{ height: 32, borderRadius: 8, background: 'var(--btn-bg)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', color: 'var(--text-secondary)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontSize: 12, fontWeight: 600, maxWidth: 160, overflow: 'hidden' }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: PROVIDER_COLOR[provider ?? 'claude'], flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{PROVIDER_LABEL[provider ?? 'claude']}</span>
                    <ChevronDown className="w-3 h-3" style={{ flexShrink: 0, opacity: 0.6 }} />
                  </button>

                  {modelOpen && (
                    <div style={{ position: 'absolute', bottom: 40, left: 0, background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'hidden', overflowY: 'auto', minWidth: 240, maxHeight: 132, zIndex: 50 }}>
                      {modelOptions.map(m => (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => { onProviderChange?.(m.id); setModelOpen(false); }}
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
                      <button type="button" onClick={() => { onManageKeys?.(); setModelOpen(false); }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent', borderTop: '1px solid var(--border)', width: '100%', textAlign: 'left', borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}>
                        <Plus className="w-3.5 h-3.5" style={{ color: '#3b82f6', flexShrink: 0 }} />
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, var(--adlam-ui), sans-serif', fontWeight: 600 }}>{languageCode === "fr" ? "Utilisez votre clé" : "Bring your own key"}</div>
                      </button>
                    </div>
                  )}
                </div>
                {/* Build/Chat dropdown */}
                <ModeSwitch mode={mode} onChange={onModeChange} dropUp />
              </div>

              {/* Right cluster: Mic · Send */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={toggleListening}
                  title={isListening ? 'Stop recording' : 'Speak your prompt'}
                  style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: isListening ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isListening ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    color: isListening ? '#f87171' : isTranscribing ? '#3b82f6' : '#adaaaa',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  className={isListening ? 'animate-pulse' : ''}
                >
                  {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {isGenerating && mode === 'build' ? (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onStop}
                    title="Stop generation"
                    style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      background: 'rgba(255,255,255,0.1)',
                      color: '#ffffff',
                      border: '1px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={input.trim() && !isSending ? { scale: 1.05 } : {}}
                    whileTap={input.trim() && !isSending ? { scale: 0.95 } : {}}
                    onClick={() => void handleSendClick()}
                    disabled={(!input.trim() && attachments.length === 0) || isSending}
                    style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      background: (input.trim() || attachments.length > 0) && !isSending ? 'linear-gradient(135deg, #3b82f6, #fd8b00)' : 'var(--hover-bg)',
                      color: (input.trim() || attachments.length > 0) && !isSending ? '#0a0a0a' : '#52525b',
                      border: 'none', cursor: input.trim() && !isSending ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title={isSending ? "Sending..." : input.trim() ? "Send message" : "Type a message first"}
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*,.txt,.md,.csv" multiple style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  );
};

// Memoize on the *data* props only. Function props (onSend, setInput, …) get a
// fresh identity on every App render — comparing them would defeat the memo and
// force a full markdown re-parse of all messages whenever the parent re-renders
// (e.g. toggling the chat panel), which caused the 5–15s open lag on mobile.
function chatPropsEqual(a: ChatProps, b: ChatProps) {
  return (
    a.messages === b.messages &&
    a.input === b.input &&
    a.isGenerating === b.isGenerating &&
    a.generationStatus === b.generationStatus &&
    a.lastUsage === b.lastUsage &&
    a.generationSteps === b.generationSteps &&
    a.selectedLanguage === b.selectedLanguage &&
    a.currentLanguage === b.currentLanguage &&
    a.languageCode === b.languageCode &&
    a.currentCode === b.currentCode &&
    a.languages === b.languages &&
    a.t === b.t &&
    a.mode === b.mode &&
    a.provider === b.provider
  );
}

export const Chat = React.memo(ChatImpl, chatPropsEqual);
