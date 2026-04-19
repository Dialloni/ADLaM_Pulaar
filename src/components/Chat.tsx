import React, { useRef, useEffect, useState } from 'react';
import { Send, Loader2, Sparkles, Layout, GraduationCap, Globe, User, Bot, ArrowRight, Mic, MicOff, Copy, RotateCcw, ThumbsUp, ThumbsDown, Code2 } from 'lucide-react';
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

export const Chat: React.FC<ChatProps> = ({
  messages,
  input,
  setInput,
  onSend,
  isGenerating,
  generationStatus,
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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
    }
  }, [input]);

  const isEmpty = messages.length === 0 && !isGenerating;
  const charCount = input.length;
  const maxChars = 2000;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0e0e0e] relative">
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
                        "w-full bg-transparent border-none rounded-3xl px-6 pt-6 pb-20 pr-20 text-lg focus:outline-none focus:ring-0 transition-all resize-none min-h-[200px] text-zinc-100 placeholder:text-zinc-600 font-medium leading-relaxed",
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
                          <div className={cn(
                            "p-4 rounded-2xl text-[15px] leading-relaxed shadow-lg border transition-all hover:shadow-xl",
                            m.role === 'user' 
                              ? "bg-white text-black border-white rounded-tr-none font-medium" 
                              : "bg-zinc-900/60 backdrop-blur-sm border-white/10 text-zinc-100 rounded-tl-none hover:bg-zinc-900/80 hover:border-white/20",
                            languageCode === 'ff-adlm' && "font-adlam"
                          )}>
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
                    className="group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#ff8b9b] to-[#fd8b00] text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xl border border-[#ff8b9b]/30 animate-pulse">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col gap-2 flex-1">
                        <div className="bg-zinc-900/60 backdrop-blur-sm border border-white/10 p-4 rounded-2xl rounded-tl-none shadow-lg">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 text-[#ff8b9b] flex-wrap">
                              <div className="relative flex-shrink-0">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <div className="absolute inset-0 bg-[#ff8b9b]/20 blur-sm rounded-full animate-pulse" />
                              </div>
                              <span className={cn(
                                "text-[11px] font-bold tracking-[0.2em] uppercase break-words",
                                languageCode === 'ff-adlm' && "font-adlam"
                              )}>
                                {generationStatus || t.generating}
                              </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-1 bg-zinc-800/50 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: '70%' }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="h-full bg-gradient-to-r from-[#ff8b9b] to-[#fd8b00] rounded-full"
                              />
                            </div>

                            {/* Status Text */}
                            <p className="text-[11px] text-zinc-500 font-medium break-words line-clamp-2">
                              {generationStatus === 'analyzing' && 'Analyzing your requirements...'}
                              {generationStatus === 'generating' && 'Generating beautiful code...'}
                              {generationStatus === 'styling' && 'Adding stunning styles...'}
                              {generationStatus === 'finalizing' && 'Finalizing your project...'}
                              {!generationStatus && 'Processing your request...'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] text-zinc-600 font-medium">
                          {t.gandoAI}
                        </span>
                      </div>
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
          className="p-4 md:p-8 bg-gradient-to-t from-[#030303] via-[#030303]/80 to-transparent"
        >
          <div className="max-w-4xl mx-auto relative group">
            {/* Glow effect - more prominent on focus */}
            <div className="absolute -inset-1 bg-gradient-to-r from-[#ff8b9b]/30 via-blue-500/30 to-purple-500/30 rounded-2xl blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            
            <div className="relative bg-gradient-to-b from-zinc-900/60 to-zinc-900/40 backdrop-blur-xl rounded-2xl p-4 md:p-5 flex flex-col gap-4 border border-white/10 shadow-2xl group-focus-within:border-[#ff8b9b]/40 transition-all duration-300 hover:border-white/20">
              <textarea 
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, maxChars))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                placeholder={t.chatPlaceholder.replace('{language}', selectedLanguage)}
                className={cn(
                  "w-full bg-transparent border-none rounded-xl p-4 pr-16 text-sm focus:outline-none focus:ring-0 transition-all resize-none min-h-[120px] text-zinc-100 placeholder:text-zinc-500 font-medium leading-relaxed scroll-smooth",
                  languageCode === 'ff-adlm' && "font-adlam"
                )}
              />
              
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Mic Button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleListening}
                    className={cn(
                      "p-2.5 rounded-lg transition-all",
                      isListening 
                        ? "bg-red-500/30 text-red-400 border border-red-500/40 shadow-lg shadow-red-500/20 animate-pulse" 
                        : isTranscribing
                        ? "bg-[#ff8b9b]/30 text-[#ff8b9b] border border-[#ff8b9b]/40 animate-spin"
                        : "bg-white/10 text-zinc-400 hover:bg-white/20 hover:text-white border border-white/10 hover:border-white/20"
                    )}
                    title={isListening ? "Stop recording" : "Start voice input"}
                  >
                    {isTranscribing ? <Loader2 className="w-4 h-4" /> : isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </motion.button>
                  
                  {/* Character Counter */}
                  <motion.div
                    animate={{
                      backgroundColor: charCount > maxChars * 0.9 ? "rgb(239, 68, 68, 0.1)" : "transparent",
                    }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-[10px] font-bold uppercase tracking-wide whitespace-nowrap flex-shrink-0",
                      charCount > maxChars * 0.8 
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-400" 
                        : charCount > maxChars * 0.9
                        ? "bg-red-500/10 border-red-500/30 text-red-400"
                        : "bg-white/5 border-white/10 text-zinc-500 hover:bg-white/10"
                    )}
                  >
                    <span className="font-mono">{charCount}</span>
                    <span className="text-zinc-600">/</span>
                    <span className="font-mono text-zinc-600">{maxChars}</span>
                  </motion.div>

                  {/* Language Badge */}
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-default"
                  >
                    <Globe className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{selectedLanguage}</span>
                  </motion.div>
                </div>
                
                {/* Send Button */}
                <motion.button 
                  whileHover={input.trim() && !isGenerating ? { scale: 1.08 } : {}}
                  whileTap={input.trim() && !isGenerating ? { scale: 0.95 } : {}}
                  onClick={onSend}
                  disabled={!input.trim() || isGenerating}
                  className={cn(
                    "p-2.5 rounded-lg transition-all shadow-lg active:shadow-md group/btn overflow-hidden relative font-semibold",
                    input.trim() && !isGenerating 
                      ? "bg-gradient-to-r from-[#ff8b9b] to-[#fd8b00] text-white hover:shadow-[#ff8b9b]/40 hover:from-[#f07585] hover:to-[#e07d00]" 
                      : "bg-white/5 text-zinc-600 cursor-not-allowed border border-white/10"
                  )}
                  title={isGenerating ? "Generating..." : input.trim() ? "Send message" : "Type a message first"}
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <motion.div
                      animate={input.trim() ? { x: [0, 2, 0] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Send className="w-4 h-4" />
                    </motion.div>
                  )}
                </motion.button>
              </div>

              {/* Helpful Tips */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="px-2 py-2 flex flex-wrap items-center gap-2 border-t border-white/5"
              >
                <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#ff8b9b]" />
                  {t.tips}
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-zinc-600">
                  <span className="hover:text-zinc-400 transition-colors cursor-help">Shift+Enter</span>
                  <span className="text-zinc-700">•</span>
                  <span className="hover:text-zinc-400 transition-colors cursor-help">Voice input 🎤</span>
                  <span className="hidden sm:inline text-zinc-700">•</span>
                  <span className="hidden sm:inline hover:text-zinc-400 transition-colors cursor-help">Press Esc to clear</span>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
