import React, { useState, useEffect, useRef } from 'react';
import { Globe, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface PreviewProps {
  code: string;
}

// Double-buffered iframe: when `code` changes (e.g. streaming updates), the new HTML is
// loaded into the hidden buffer; we only swap it to visible once it has fully rendered.
// This eliminates the white "blink" you get from mutating a single iframe's srcDoc.
export const Preview: React.FC<PreviewProps> = ({ code }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [top, setTop] = useState<'a' | 'b'>('a');
  const [codeA, setCodeA] = useState(code);
  const [codeB, setCodeB] = useState('');
  const latest = useRef(code);

  useEffect(() => {
    if (code === latest.current) return;
    latest.current = code;
    // Write the incoming code into the currently-hidden buffer.
    if (top === 'a') setCodeB(code);
    else setCodeA(code);
  }, [code, top]);

  // Promote a buffer to visible once it finishes loading the latest code.
  const onLoad = (which: 'a' | 'b') => {
    const c = which === 'a' ? codeA : codeB;
    if (which !== top && c === latest.current) setTop(which);
  };

  const handleRefresh = () => {
    latest.current = code;
    setCodeA(code);
    setCodeB(code);
    setRefreshKey((k) => k + 1);
  };

  const frameStyle = (which: 'a' | 'b'): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    border: 'none',
    opacity: top === which ? 1 : 0,
    transition: 'opacity 150ms ease',
    pointerEvents: top === which ? 'auto' : 'none',
  });

  return (
    <div className="w-full h-full flex flex-col bg-[#0e0e0e] p-4 md:p-6 lg:p-8">
      <div className="flex-1 flex flex-col rounded-2xl overflow-hidden" style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 40px 100px -20px rgba(0,0,0,0.8)' }}>
        <div style={{ height: 46, background: 'rgba(19,19,19,0.9)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', paddingLeft: 16, paddingRight: 16, gap: 12 }}>
          <div className="flex gap-1.5">
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
          </div>

          <div className="flex items-center gap-3" style={{ color: '#52525b' }}>
            <ChevronLeft className="w-4 h-4 cursor-not-allowed opacity-30" />
            <ChevronRight className="w-4 h-4 cursor-not-allowed opacity-30" />
            <RotateCcw
              className="w-4 h-4 cursor-pointer hover:text-zinc-300 transition-colors active:rotate-180 duration-500"
              onClick={handleRefresh}
            />
          </div>

          <div style={{ flex: 1, maxWidth: 400, margin: '0 auto', height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', paddingLeft: 10, paddingRight: 10, gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#28c840', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#767575', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>gando-preview.app</span>
          </div>

          <div className="flex items-center gap-3" style={{ color: '#52525b' }}>
            <Globe className="w-4 h-4 hover:text-zinc-300 transition-colors cursor-pointer" />
          </div>
        </div>

        <div className="flex-1 bg-white relative">
          <iframe
            key={`a${refreshKey}`}
            srcDoc={codeA}
            title="Gando AI Preview A"
            style={frameStyle('a')}
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            onLoad={() => onLoad('a')}
          />
          <iframe
            key={`b${refreshKey}`}
            srcDoc={codeB}
            title="Gando AI Preview B"
            style={frameStyle('b')}
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            onLoad={() => onLoad('b')}
          />
        </div>
      </div>
    </div>
  );
};
