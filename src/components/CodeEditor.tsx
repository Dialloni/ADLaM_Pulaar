import React from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import { FileCode, Copy, Check, Terminal } from 'lucide-react';
import { UIStrings } from '../translations';
import { cn } from '../lib/utils';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism-tomorrow.css';

interface CodeEditorProps {
  code: string;
  onChange?: (code: string) => void;
  readOnly?: boolean;
  t: UIStrings;
  languageCode: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ 
  code, 
  onChange, 
  readOnly = false,
  t,
  languageCode
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0e0e0e] p-4 md:p-6 lg:p-8 overflow-hidden">
      <div className="flex-1 flex flex-col bg-[#0d1117] rounded-[2rem] overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] border border-white/5">
        {/* Editor Header */}
        <div className="h-14 bg-[#161b22] border-b border-white/5 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#0d1117] rounded-t-xl border-t border-x border-white/5 -mb-[15px] relative z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.5)]">
              <FileCode className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px] font-mono text-zinc-300 font-medium tracking-tight">index.html</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer group">
              <Terminal className="w-3.5 h-3.5 group-hover:text-emerald-500/50 transition-colors" />
              <span className={cn(
                "text-[11px] font-medium",
                languageCode === 'ff-adlm' ? "font-adlam" : "font-mono"
              )}>
                {t.output}
              </span>
            </div>
          </div>
          
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-zinc-400 hover:text-white active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-[0.15em]",
              languageCode === 'ff-adlm' && "font-adlam"
            )}>
              {copied ? t.copied : t.copy}
            </span>
          </button>
        </div>

        {/* Editor Content */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-[#0d1117]">
          <Editor
            value={code}
            onValueChange={onChange || (() => {})}
            highlight={code => highlight(code, languages.markup, 'markup')}
            padding={32}
            className="font-mono text-sm min-h-full"
            style={{
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              fontSize: 13,
              lineHeight: '1.6',
              backgroundColor: 'transparent',
            }}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  );
};
