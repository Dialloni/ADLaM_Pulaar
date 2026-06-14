import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, MessageSquare, ChevronDown, Check } from 'lucide-react';

const OPTIONS: { id: 'build' | 'chat'; Icon: typeof Sparkles; label: string; sub: string }[] = [
  { id: 'build', Icon: Sparkles, label: 'Build', sub: 'Generate an app' },
  { id: 'chat', Icon: MessageSquare, label: 'Chat', sub: 'Just talk, no build' },
];

/**
 * Build / Chat selector — a dropdown styled to match the model (Claude/Gemini) picker:
 * a single button showing the current mode + chevron, opening a menu to choose.
 * `dropUp` opens the menu upward (for the compact chat bar at the bottom of the screen).
 */
export const ModeSwitch: React.FC<{
  mode: 'build' | 'chat';
  onChange?: (m: 'build' | 'chat') => void;
  dropUp?: boolean;
}> = ({ mode, onChange, dropUp = false }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = OPTIONS.find(o => o.id === mode) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Choose Build or Chat"
        style={{
          height: 32, borderRadius: 8, background: 'var(--btn-bg)', border: '1px solid var(--border)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px',
          color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600,
        }}
      >
        <active.Icon className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
        <span style={{ whiteSpace: 'nowrap' }}>{active.label}</span>
        <ChevronDown className="w-3 h-3" style={{ opacity: 0.6, flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ position: 'absolute', [dropUp ? 'bottom' : 'top']: 40, left: 0, background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', minWidth: 200, zIndex: 50 } as React.CSSProperties}>
          {OPTIONS.map(o => (
            <div
              key={o.id}
              onClick={() => { onChange?.(o.id); setOpen(false); }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--hover-bg)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent' }}
            >
              <o.Icon className="w-3.5 h-3.5" style={{ color: '#3b82f6', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{o.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{o.sub}</div>
              </div>
              {mode === o.id && <Check className="w-3.5 h-3.5" style={{ color: '#3b82f6', flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
