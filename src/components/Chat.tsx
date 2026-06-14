import React, { useRef, useEffect, useState } from 'react';
import { Send, Loader2, Sparkles, Layout, GraduationCap, Globe, User, ArrowRight, ArrowUp, Mic, MicOff, Copy, RotateCcw, ThumbsUp, ThumbsDown, Code2, Plus, Paperclip, Camera, Link, Check, ChevronDown, MessageSquare } from 'lucide-react';
import { GandoSpark } from './GandoSpark';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useVoiceInput } from '../lib/useVoiceInput';
import { ModeSwitch } from './ModeSwitch';
import { type Provider } from '../services/geminiService';

type Attachment = { id: string; name: string; kind: 'image' | 'text'; content: string; previewUrl?: string };

const PROVIDER_COLOR: Record<Provider, string> = {
  'claude': '#ff8b9b',
  'gemini': '#5b9bff',
  'groq-llama': '#22c55e',
  'groq-scout': '#f59e0b',
  'byok-openai': '#10a37f',
  'byok-anthropic': '#d97757',
  'byok-gemini': '#5b9bff',
  'byok-deepseek': '#4d6bfe',
  'byok-groq': '#f55036',
};
const PROVIDER_LABEL: Record<Provider, string> = {
  'claude': 'Claude',
  'gemini': 'Gemini',
  'groq-llama': 'Llama 3.3',
  'groq-scout': 'Llama 4 Scout',
  'byok-openai': 'OpenAI',
  'byok-anthropic': 'Claude',
  'byok-gemini': 'Gemini',
  'byok-deepseek': 'DeepSeek',
  'byok-groq': 'Groq',
};

interface ChatProps {
  messages: Message[];
  input: string;
  setInput: (val: string) => void;
  onSend: (extraContext?: string) => void;
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
  mode?: 'build' | 'chat';
  onModeChange?: (m: 'build' | 'chat') => void;
  currentCode?: string;
  onRevert?: (snapshot: string) => void;
}

const MODELS: { id: Provider; label: string; sub: string }[] = [
  { id: 'claude', label: 'Claude Sonnet 4.6', sub: 'Best ADLaM quality' },
  { id: 'gemini', label: 'Gemini 2.5 Flash', sub: 'Free tier · Google' },
  { id: 'groq-llama', label: 'Llama 3.3 70B', sub: 'Free · Groq · Fast' },
  { id: 'groq-scout', label: 'Llama 4 Scout', sub: 'Free · Groq · Multimodal' },
];


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
    color: "text-[#ff8b9b]", 
    bg: "bg-[#ff8b9b]/10" 
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
            <div className="w-4 h-4 text-[#ff8b9b]">✓</div>
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
}

const MessageActions: React.FC<MessageActionsProps> = ({ message, onCopy, onRegenerate, onRevert, isCurrentVersion }) => {
  const [copied, setCopied] = useState(false);

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
          <div className="w-4 h-4 text-[#ff8b9b]">✓</div>
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
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
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#ff8b9b]/10 text-[#ff8b9b] text-[10px] font-bold uppercase tracking-wider border border-[#ff8b9b]/20"
            title="This is the current version"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff8b9b]" />
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
      <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
        <ThumbsUp className="w-4 h-4" />
      </button>
      <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
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
  mode = 'build',
  onModeChange,
  currentCode,
  onRevert,
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  const modelOptions = [...MODELS, ...byokModels];
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(file => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        const reader = new FileReader();
        reader.onload = () => setAttachments(prev => [...prev, { id, name: file.name, kind: 'image', content: reader.result as string, previewUrl: url }]);
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
      const parts: string[] = [];
      for (const att of attachments) {
        if (att.kind === 'image') {
          try {
            const base64 = att.content.split(',')[1] ?? att.content;
            const mime = att.content.startsWith('data:') ? att.content.split(';')[0].slice(5) : 'image/png';
            const res = await fetch('/api/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mimeType: mime }) });
            const ocr = res.ok ? (await res.json() as { text: string }).text : '';
            parts.push(`[Image: ${att.name}]${ocr ? `\n${ocr}` : ''}`);
          } catch { parts.push(`[Image: ${att.name}]`); }
        } else {
          parts.push(`[File: ${att.name}]\n${att.content.slice(0, 4000)}`);
        }
      }
      setAttachments([]);
      onSend(parts.join('\n\n') || undefined);
    } finally { setIsSending(false); }
  };

  // Voice input (shared hook — Gemini-powered for African-language support).
  const { isListening, isTranscribing, toggleListening } = useVoiceInput(input, setInput, selectedLanguage);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating, generationStatus]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

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

  const isEmpty = messages.length === 0 && !isGenerating;
  const charCount = input.length;
  const maxChars = 2000;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0e0e0e] relative">
      {/* Header bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, position: 'relative', zIndex: 10 }}>
        <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 12, color: 'var(--text-primary)' }}>Chat with Gando</span>
      </div>
      {/* Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ff8b9b]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className={cn(
          "max-w-4xl mx-auto w-full px-4 md:px-6 py-8 md:py-12 space-y-8",
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
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff8b9b]/10 border border-[#ff8b9b]/20 text-[#ff8b9b] text-[10px] font-bold uppercase tracking-widest mb-4"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{t.appName} {t.beta}</span>
                  </motion.div>
                  <h1 className={cn(
                    "text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.1]",
                    languageCode === 'ff-adlm' ? "font-adlam" : "font-display"
                  )}>
                    {languageCode === 'ff-adlm' ? (
                      t.chatWelcome
                    ) : (
                      <>
                        {t.chatWelcome.split('build')[0]} <span className="text-[#ff8b9b]">{t.chatWelcome.includes('build') ? 'build' : ''}</span> {t.chatWelcome.split('build')[1]}
                      </>
                    )}
                  </h1>
                  <p className={cn(
                    "text-zinc-500 text-lg md:text-xl max-w-2xl mx-auto font-medium",
                    languageCode === 'ff-adlm' && "font-adlam"
                  )}>
                    {t.chatSubtitle.replace('{language}', selectedLanguage)}
                  </p>
                </div>

                <div className="relative max-w-3xl mx-auto group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#ff8b9b]/20 via-blue-500/20 to-purple-500/20 rounded-[2.5rem] blur-2xl opacity-50 group-focus-within:opacity-100 transition-opacity duration-700" />
                  <div className="relative bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-3 shadow-2xl group-focus-within:border-[#ff8b9b]/50 transition-all duration-500 input-glow">
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
                        "gando-input w-full bg-transparent border-none rounded-3xl px-6 pt-6 pb-20 pr-20 text-lg focus:outline-none focus:ring-0 transition-all resize-none min-h-[200px] text-zinc-100 placeholder:text-zinc-600 font-medium leading-relaxed",
                        languageCode === 'ff-adlm' && "font-adlam"
                      )}
                    />
                    <div className="absolute bottom-5 left-5 flex items-center gap-2">
                      {/* Model picker */}
                      <div ref={modelRef} style={{ position: 'relative' }}>
                        <button
                          onClick={() => setModelOpen(o => !o)}
                          title="Choose the AI model"
                          className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/5 transition-colors"
                          style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: PROVIDER_COLOR[provider ?? 'claude'] }} />
                          {PROVIDER_LABEL[provider ?? 'claude']}
                          <ChevronDown className="w-3 h-3 opacity-60" />
                        </button>
                        {modelOpen && (
                          <div style={{ position: 'absolute', bottom: 38, left: 0, background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'hidden', overflowY: 'auto', minWidth: 240, maxHeight: 132, zIndex: 50 }}>
                            {modelOptions.map(m => (
                              <div
                                key={m.id}
                                onClick={() => { onProviderChange?.(m.id); setModelOpen(false); }}
                                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--hover-bg)'}
                                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent' }}
                              >
                                <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: PROVIDER_COLOR[m.id] }} />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{m.label}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{m.sub}</div>
                                </div>
                                {provider === m.id && <Check className="w-3.5 h-3.5" style={{ color: '#ff8b9b', flexShrink: 0 }} />}
                              </div>
                            ))}
                            <div onClick={() => { onManageKeys?.(); setModelOpen(false); }}
                              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--hover-bg)'}
                              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent', borderTop: '1px solid var(--border)' }}>
                              <Plus className="w-3.5 h-3.5" style={{ color: '#ff8b9b', flexShrink: 0 }} />
                              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Bring your own key</div>
                            </div>
                          </div>
                        )}
                      </div>
                      <ModeSwitch mode={mode} onChange={onModeChange} dropUp />
                    </div>
                    <div className="absolute bottom-6 right-6 flex items-center gap-3">
                      <button
                        onClick={toggleListening}
                        className={cn(
                          "p-4 rounded-2xl transition-all shadow-2xl active:scale-95 group/mic relative overflow-hidden",
                          isListening 
                            ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse" 
                            : isTranscribing
                            ? "bg-[#ff8b9b]/20 text-[#ff8b9b] border border-[#ff8b9b]/30 animate-spin"
                            : "bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        {isTranscribing ? <Loader2 className="w-5 h-5" /> : isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => void handleSendClick()}
                        disabled={(!input.trim() && attachments.length === 0) || isGenerating || isSending}
                        className={cn(
                          "p-4 rounded-2xl transition-all shadow-2xl active:scale-95 group/btn relative overflow-hidden",
                          (input.trim() || attachments.length > 0) && !isGenerating && !isSending
                            ? "bg-white text-black hover:bg-zinc-200"
                            : "bg-white/5 text-zinc-600 cursor-not-allowed"
                        )}
                      >
                        <ArrowUp className={cn("w-5 h-5 transition-transform", input.trim() && "group-hover/btn:-translate-y-0.5")} />
                      </button>
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
                            "text-sm font-bold text-white group-hover:text-[#ff8b9b] transition-colors break-words",
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
              <div className="space-y-8">
                {messages.map((m, i) => (
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
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xl border bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-400/30">
                          <User className="w-5 h-5" />
                        </div>
                      ) : (
                        <GandoSpark size={40} className="mt-0.5" />
                      )}

                      {/* Message Content */}
                      <div className={cn(
                        "flex flex-col gap-2 flex-1 max-w-[85%]",
                        m.role === 'user' && "items-end"
                      )}>
                        <div className={cn(
                          "relative group/message transition-all",
                          m.role === 'user' && "flex flex-col items-end"
                        )}>
                          <div className={cn("p-4 transition-all", languageCode === 'ff-adlm' && "font-adlam")}
                            style={m.role === 'user' ? {
                              background: 'linear-gradient(135deg, rgba(255,139,155,0.14), rgba(253,139,0,0.08))',
                              border: '1px solid rgba(255,139,155,0.25)',
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
                              <div className="prose prose-invert max-w-none">
                                <ReactMarkdown>{m.content}</ReactMarkdown>
                              </div>
                            ) : (
                              m.content
                            )}
                          </div>

                          {/* Message Actions - Show on hover */}
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            whileHover={{ opacity: 1, y: 0 }}
                            className="absolute -bottom-8 right-0 opacity-0 group-hover/message:opacity-100 transition-opacity pointer-events-none group-hover/message:pointer-events-auto"
                          >
                            <MessageActions
                              message={m}
                              onCopy={() => navigator.clipboard.writeText(m.content)}
                              onRevert={onRevert}
                              isCurrentVersion={!!m.codeSnapshot && m.codeSnapshot === currentCode}
                            />
                          </motion.div>
                        </div>

                        {/* Metadata */}
                        <span className="text-[11px] text-zinc-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          {m.role === 'user' ? t.you : t.gandoAI}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {isGenerating && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3"
                  >
                    <GandoSpark size={32} className="mt-0.5" />
                    <div style={{ padding: '12px 16px', borderRadius: '14px 14px 14px 4px', background: 'var(--card-bg)', border: '1px solid rgba(255,139,155,0.2)', maxWidth: '90%' }}>
                      {generationSteps.length === 0 ? (
                        <div className="flex items-center gap-1.5">
                          {[0, 1, 2].map(i => (
                            <motion.div key={i}
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                              style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff8b9b' }}
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
                                  background: done ? 'rgba(40,200,64,0.15)' : 'rgba(255,139,155,0.12)' }}>
                                  {done
                                    ? <Check className="w-3 h-3" style={{ color: '#28c840' }} />
                                    : <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#ff8b9b' }} />}
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
              </div>
            )}
          </AnimatePresence>
          <div ref={chatEndRef} />
        </div>
      </div>

      {!isEmpty && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--chat-bar-bg)', flexShrink: 0 }}
        >
          <div style={{ position: 'relative', background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 20, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              placeholder="Describe your app..."
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
                {/* Plus dropdown */}
                <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    onClick={() => setDropdownOpen(o => !o)}
                    title="Attach files, photos or a URL"
                    style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  {dropdownOpen && (
                    <div style={{ position: 'absolute', bottom: 40, left: 0, background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', minWidth: 220, zIndex: 50 }}>
                      {[
                        { icon: Paperclip, label: 'Add files or photos', action: () => { setDropdownOpen(false); fileInputRef.current?.click(); } },
                        { icon: Camera,    label: 'Take a screenshot',   action: () => setDropdownOpen(false) },
                        { icon: Link,      label: 'Add from URL',         action: () => setDropdownOpen(false) },
                      ].map(({ icon: Icon, label, action }) => (
                        <div
                          key={label}
                          onClick={action}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--hover-bg)'}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', background: 'transparent' }}
                        >
                          <Icon className="w-4 h-4" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Model picker (Claude / Gemini) */}
                <div ref={modelRef} style={{ position: 'relative', flexShrink: 1, minWidth: 0 }}>
                  <button
                    onClick={() => setModelOpen(o => !o)}
                    title="Choose the AI model"
                    style={{ height: 32, borderRadius: 8, background: 'var(--btn-bg)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, maxWidth: 160, overflow: 'hidden' }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: PROVIDER_COLOR[provider ?? 'claude'], flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{PROVIDER_LABEL[provider ?? 'claude']}</span>
                    <ChevronDown className="w-3 h-3" style={{ flexShrink: 0, opacity: 0.6 }} />
                  </button>

                  {modelOpen && (
                    <div style={{ position: 'absolute', bottom: 40, left: 0, background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'hidden', overflowY: 'auto', minWidth: 240, maxHeight: 132, zIndex: 50 }}>
                      {modelOptions.map(m => (
                        <div
                          key={m.id}
                          onClick={() => { onProviderChange?.(m.id); setModelOpen(false); }}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--hover-bg)'}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent' }}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: PROVIDER_COLOR[m.id] }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{m.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{m.sub}</div>
                          </div>
                          {provider === m.id && <Check className="w-3.5 h-3.5" style={{ color: '#ff8b9b', flexShrink: 0 }} />}
                        </div>
                      ))}
                      <div onClick={() => { onManageKeys?.(); setModelOpen(false); }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--hover-bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent', borderTop: '1px solid var(--border)' }}>
                        <Plus className="w-3.5 h-3.5" style={{ color: '#ff8b9b', flexShrink: 0 }} />
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Bring your own key</div>
                      </div>
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
                    color: isListening ? '#f87171' : isTranscribing ? '#ff8b9b' : '#adaaaa',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  className={isListening ? 'animate-pulse' : ''}
                >
                  {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <motion.button
                  whileHover={input.trim() && !isGenerating ? { scale: 1.05 } : {}}
                  whileTap={input.trim() && !isGenerating ? { scale: 0.95 } : {}}
                  onClick={() => void handleSendClick()}
                  disabled={(!input.trim() && attachments.length === 0) || isGenerating || isSending}
                  style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: (input.trim() || attachments.length > 0) && !isGenerating && !isSending ? 'linear-gradient(135deg, #ff8b9b, #fd8b00)' : 'var(--hover-bg)',
                    color: (input.trim() || attachments.length > 0) && !isGenerating && !isSending ? '#0a0a0a' : '#52525b',
                    border: 'none', cursor: input.trim() && !isGenerating ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title={isGenerating ? "Generating..." : input.trim() ? "Send message" : "Type a message first"}
                >
                  {isGenerating || isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                </motion.button>
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
    a.generationSteps === b.generationSteps &&
    a.selectedLanguage === b.selectedLanguage &&
    a.currentLanguage === b.currentLanguage &&
    a.languageCode === b.languageCode &&
    a.currentCode === b.currentCode &&
    a.languages === b.languages &&
    a.t === b.t
  );
}

export const Chat = React.memo(ChatImpl, chatPropsEqual);
