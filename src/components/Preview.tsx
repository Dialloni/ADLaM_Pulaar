import React, { useState, useEffect, useRef } from 'react';
import { Globe, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface PreviewProps {
  code: string;
  /** Binds generated forms' /api/submit/__GANDO_PROJECT_ID__ placeholder so
      they work in the preview, not just on the published page. */
  projectId?: string;
  /** Self-healing: called with the captured runtime error text when the user
      taps "Fix it" on the error chip. */
  onFixError?: (errorText: string) => void;
  errorLabel?: string; // "Something broke"
  fixLabel?: string;   // "Fix it"
}

/** Collect runtime errors posted by the framed app; reset when code changes. */
function useFrameErrors(code: string) {
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => { setErrors([]); }, [code]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const err = e.data && (e.data as { __gandoError?: string }).__gandoError;
      if (typeof err === 'string' && err) {
        setErrors(prev => (prev.includes(err) || prev.length >= 5 ? prev : [...prev, err]));
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  return { errors, clear: () => setErrors([]) };
}

function ErrorChip({ errors, onFix, clear, errorLabel, fixLabel }: {
  errors: string[]; onFix?: (t: string) => void; clear: () => void;
  errorLabel?: string; fixLabel?: string;
}) {
  if (errors.length === 0 || !onFix) return null;
  return (
    <div style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 20, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(127,29,29,0.92)', border: '1px solid rgba(248,113,113,0.5)', borderRadius: 9999, padding: '7px 8px 7px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <span style={{ fontSize: 12, color: '#fecaca', fontWeight: 600 }}>
        ⚠ {errorLabel || 'Something broke'}{errors.length > 1 ? ` (${errors.length})` : ''}
      </span>
      <button
        onClick={() => { const text = errors.join('\n'); clear(); onFix(text); }}
        style={{ background: '#fff', color: '#7f1d1d', border: 'none', borderRadius: 9999, padding: '5px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
        {fixLabel || 'Fix it'}
      </button>
      <button onClick={clear} aria-label="Dismiss"
        style={{ background: 'transparent', color: 'rgba(254,202,202,0.7)', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>
        ×
      </button>
    </div>
  );
}

function bindProjectId(html: string, projectId?: string): string {
  if (!html || !projectId) return html;
  return html.replaceAll('__GANDO_PROJECT_ID__', projectId);
}

// Small reporter injected into the previewed HTML. It posts the document's
// content height to the parent so we can size the iframe and let OUR page
// scroll — iOS WebKit reliably scrolls our own elements, but is unreliable at
// touch-scrolling content *inside* a sandboxed iframe. postMessage works
// across the opaque sandbox origin, so no `allow-same-origin` is needed.
const RESIZE_REPORTER = `
<script>(function(){
  var last=0,queued=false;
  function measure(){return Math.max(document.body?document.body.scrollHeight:0,document.documentElement?document.documentElement.scrollHeight:0);}
  function send(){queued=false;try{var h=measure();if(Math.abs(h-last)>4){last=h;parent.postMessage({__gandoHeight:h},'*');}}catch(e){}}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(send);}
  window.addEventListener('load',schedule);window.addEventListener('resize',schedule);
  if(window.ResizeObserver&&document.body){try{new ResizeObserver(schedule).observe(document.body);}catch(e){}}
  setTimeout(schedule,200);setTimeout(schedule,700);setTimeout(schedule,1500);
  /* self-healing: report runtime errors to the parent so the editor can offer a one-tap fix */
  var seen=[];
  function report(msg){try{msg=String(msg||'Unknown error').slice(0,500);if(seen.indexOf(msg)!==-1||seen.length>=5)return;seen.push(msg);parent.postMessage({__gandoError:msg},'*');}catch(e){}}
  window.addEventListener('error',function(ev){report((ev.message||ev.error)+(ev.lineno?' (line '+ev.lineno+')':''));});
  window.addEventListener('unhandledrejection',function(ev){report(ev.reason&&(ev.reason.message||ev.reason));});
  /* srcdoc gotcha: <a href="#/page"> resolves against the PARENT url in an
     inline document, so a click navigates the sandboxed frame away from the
     app (black screen). location.hash assignment works fine — intercept
     hash-link clicks and set it directly. Published pages don't need this
     (their base URL makes fragment links same-document). */
  document.addEventListener('click',function(e){
    var t=e.target;while(t&&t.tagName!=='A')t=t.parentElement;
    if(!t)return;
    var h=t.getAttribute('href');
    if(!h||h.charAt(0)!=='#')return;
    e.preventDefault();
    if(h.length>1&&location.hash!==h){location.hash=h;}
    else if(h.length>1){try{window.dispatchEvent(new Event('hashchange'));}catch(err){}}
  },true);
  /* blank-screen detection: rendered-but-empty pages (hidden sections, broken
     init/routing) never throw, so they'd otherwise be invisible to healing */
  window.addEventListener('load',function(){setTimeout(function(){
    try{
      var b=document.body;
      var txt=(b&&b.innerText||'').replace(/\\s+/g,'');
      if(txt.length===0){report('BLANK SCREEN: the page loaded but shows no visible content. Likely cause: all sections hidden by default and the code that reveals the first section never ran, or a routing/initialization bug.');}
    }catch(e){}
  },800);});
})();</scr`+`ipt>`;

/** Exported: any srcDoc iframe showing app code needs this — it carries the
    hash-link click interceptor (srcdoc anchors resolve against the parent URL
    and blank the frame) plus the error/height reporters. */
export function injectReporter(html: string): string {
  if (!html) return html;
  if (html.includes('</body>')) return html.replace('</body>', RESIZE_REPORTER + '</body>');
  return html + RESIZE_REPORTER;
}

function useIsMobile() {
  const [m, setM] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setM(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return m;
}

// ── MOBILE: single iframe sized to its content; our wrapper does the scrolling. ──
const MobilePreview: React.FC<PreviewProps> = ({ code, projectId, onFixError, errorLabel, fixLabel }) => {
  const [height, setHeight] = useState(2000);
  const [refreshKey, setRefreshKey] = useState(0);
  const srcDoc = injectReporter(bindProjectId(code, projectId));
  const { errors, clear } = useFrameErrors(code);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const h = e.data && (e.data as { __gandoHeight?: number }).__gandoHeight;
      if (typeof h === 'number' && h > 0) {
        const next = Math.max(h, 400);
        // ignore sub-pixel/tiny jitter to avoid re-render thrash (freeze on animated apps)
        setHeight(prev => (Math.abs(prev - next) > 8 ? next : prev));
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-white">
      <div style={{ height: 38, background: '#131313', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', paddingLeft: 12, paddingRight: 12, gap: 8, flexShrink: 0 }}>
        <div className="flex gap-1.5">
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e' }} />
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
        </div>
        <div style={{ flex: 1, height: 24, borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', paddingLeft: 8, gap: 5, overflow: 'hidden' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#28c840', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: '#767575', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>gando-preview.app</span>
        </div>
        <RotateCcw className="w-4 h-4 cursor-pointer" style={{ color: '#71717a' }} onClick={() => setRefreshKey(k => k + 1)} />
      </div>
      {/* This div is the scroller — our own element, which iOS scrolls reliably. */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: '#fff', position: 'relative' }}>
        <iframe
          key={refreshKey}
          srcDoc={srcDoc}
          title="Gando AI Preview"
          style={{ width: '100%', height, border: 'none', display: 'block' }}
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
        />
        <ErrorChip errors={errors} onFix={onFixError} clear={clear} errorLabel={errorLabel} fixLabel={fixLabel} />
      </div>
    </div>
  );
};

// Double-buffered iframe: when `code` changes (e.g. streaming updates), the new HTML is
// loaded into the hidden buffer; we only swap it to visible once it has fully rendered.
// This eliminates the white "blink" you get from mutating a single iframe's srcDoc.
export const Preview: React.FC<PreviewProps> = ({ code: rawCode, projectId, onFixError, errorLabel, fixLabel }) => {
  const code = bindProjectId(rawCode, projectId);
  const isMobile = useIsMobile();
  const [refreshKey, setRefreshKey] = useState(0);
  const [top, setTop] = useState<'a' | 'b'>('a');
  const [codeA, setCodeA] = useState(code);
  const [codeB, setCodeB] = useState('');
  const latest = useRef(code);
  const { errors, clear } = useFrameErrors(code);

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

  if (isMobile) return <MobilePreview code={code} onFixError={onFixError} errorLabel={errorLabel} fixLabel={fixLabel} />;

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
            srcDoc={injectReporter(codeA)}
            title="Gando AI Preview A"
            style={frameStyle('a')}
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            onLoad={() => onLoad('a')}
          />
          <iframe
            key={`b${refreshKey}`}
            srcDoc={injectReporter(codeB)}
            title="Gando AI Preview B"
            style={frameStyle('b')}
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            onLoad={() => onLoad('b')}
          />
          <ErrorChip errors={errors} onFix={onFixError} clear={clear} errorLabel={errorLabel} fixLabel={fixLabel} />
        </div>
      </div>
    </div>
  );
};
