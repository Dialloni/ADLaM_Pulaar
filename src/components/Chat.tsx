import React, { useRef, useEffect, useState } from 'react';
import { Send, Loader2, Sparkles, Layout, GraduationCap, Globe, User, Bot, ArrowRight, Mic, MicOff, Copy, RotateCcw, ThumbsUp, ThumbsDown, Code2, Plus, Paperclip, Camera, Link, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { LanguageSelector } from './LanguageSelector';
import { TRANSLATIONS } from '../translations';
import { transcribeAudio } from '../services/geminiService';

interface ChatProps {
  messages: Message[];
  input: string;
  setInput: (val: string) => void;
  onSend: () => void;
  isGenerating: boolean;
  generationStatus: string;
  generationSteps?: string[];
  selectedLanguage: string;
  currentLanguage?: { code: any; name: string };
  languages?: { code: any; name: string }[];
  onLanguageSelect?: (lang: { code: any; name: string }) => void;
  languageCode: string;
  t: any;
  currentCode?: string;
  onRevert?: (snapshot: string) => void;
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
  currentCode,
  onRevert,
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Voice Input Logic (Gemini-powered for better African language support)
  const toggleListening = async () => {
    if (isListening) {
      mediaRecorderRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setIsTranscribing(true);
          try {
            const transcript = await transcribeAudio(base64Audio, 'audio/webm', selectedLanguage);
            if (transcript) {
              setInput(input ? `${input} ${transcript}` : transcript);
            }
          } catch (error) {
            console.error('Transcription failed:', error);
          } finally {
            setIsTranscribing(false);
          }
        };

        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

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
        <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 12, color: '#fff' }}>Chat with Gando</span>
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
                      {currentLanguage && languages && onLanguageSelect && (
                        <LanguageSelector
                          currentLanguage={currentLanguage}
                          languages={languages}
                          onSelect={onLanguageSelect}
                          dropUp
                          buttonClassName="!py-1.5 !px-3 !rounded-lg !bg-white/[0.04] hover:!bg-white/10 !border-white/5 text-[11px]"
                        />
                      )}
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
                        onClick={onSend}
                        disabled={!input.trim() || isGenerating}
                        className={cn(
                          "p-4 rounded-2xl transition-all shadow-2xl active:scale-95 group/btn relative overflow-hidden",
                          input.trim() && !isGenerating 
                            ? "bg-white text-black hover:bg-zinc-200" 
                            : "bg-white/5 text-zinc-600 cursor-not-allowed"
                        )}
                      >
                        <Send className={cn("w-5 h-5 transition-transform", input.trim() && "group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5")} />
                      </button>
                    </div>
                  </div>
                </div>

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
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xl border",
                        m.role === 'user' 
                          ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-400/30" 
                          : "bg-gradient-to-br from-[#ff8b9b] to-[#fd8b00] text-white border-[#ff8b9b]/30"
                      )}>
                        {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                      </div>

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
                              color: '#fff',
                            } : {
                              background: '#131313',
                              border: '1px solid rgba(255,255,255,0.06)',
                              borderRadius: '14px 14px 14px 4px',
                              fontSize: 13,
                              lineHeight: 1.6,
                              color: '#e5e5e5',
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
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ff8b9b] to-[#fd8b00] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div style={{ padding: '12px 16px', borderRadius: '14px 14px 14px 4px', background: '#131313', border: '1px solid rgba(255,139,155,0.2)', maxWidth: '90%' }}>
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
          style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(10,10,10,0.7)', flexShrink: 0 }}
        >
          <div style={{ position: 'relative', background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, maxChars))}
              onInput={handleInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
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
                color: '#fff',
                fontSize: 15,
                lineHeight: 1.6,
                fontFamily: 'var(--font-sans)',
                overflowY: 'hidden',
                display: 'block',
                boxSizing: 'border-box',
              }}
            />

            {/* Bottom row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Left: Plus dropdown */}
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setDropdownOpen(o => !o)}
                  style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#adaaaa' }}
                >
                  <Plus className="w-4 h-4" />
                </button>

                {dropdownOpen && (
                  <div style={{ position: 'absolute', bottom: 40, left: 0, background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', minWidth: 220, zIndex: 50 }}>
                    {[
                      { icon: Paperclip, label: 'Add files or photos' },
                      { icon: Camera,    label: 'Take a screenshot' },
                      { icon: Link,      label: 'Add from URL' },
                    ].map(({ icon: Icon, label }) => (
                      <div
                        key={label}
                        onClick={() => setDropdownOpen(false)}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', fontSize: 13, color: '#e5e5e5', fontFamily: 'Inter, sans-serif', cursor: 'pointer', background: 'transparent' }}
                      >
                        <Icon className="w-4 h-4" style={{ color: '#767575', flexShrink: 0 }} />
                        {label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Send button */}
              <motion.button
                whileHover={input.trim() && !isGenerating ? { scale: 1.05 } : {}}
                whileTap={input.trim() && !isGenerating ? { scale: 0.95 } : {}}
                onClick={onSend}
                disabled={!input.trim() || isGenerating}
                style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: input.trim() && !isGenerating ? 'linear-gradient(135deg, #ff8b9b, #fd8b00)' : 'rgba(255,255,255,0.05)',
                  color: input.trim() && !isGenerating ? '#0a0a0a' : '#52525b',
                  border: 'none', cursor: input.trim() && !isGenerating ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title={isGenerating ? "Generating..." : input.trim() ? "Send message" : "Type a message first"}
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
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
