import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { LanguageCode } from '../translations';

interface LanguageSelectorProps {
  currentLanguage: { code: LanguageCode; name: string };
  languages: { code: LanguageCode; name: string }[];
  onSelect: (lang: { code: LanguageCode; name: string }) => void;
  className?: string;
  dropUp?: boolean;
  buttonClassName?: string;
}

export function LanguageSelector({
  currentLanguage, languages, onSelect, className, dropUp, buttonClassName,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);

  /* Compute dropdown position from button's real viewport rect */
  const computeStyle = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const approxMenuH = languages.length * 46 + 12;
    const spaceBelow = window.innerHeight - r.bottom;

    const openUp = dropUp || spaceBelow < approxMenuH + 8;

    setStyle(openUp
      ? { bottom: window.innerHeight - r.top + 6, left: r.left, minWidth: Math.max(r.width, 192) }
      : { top: r.bottom + 6, left: r.left, minWidth: Math.max(r.width, 192) });
  };

  const toggle = () => {
    if (!isOpen) computeStyle();
    setIsOpen(o => !o);
  };

  /* Close on outside click */
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: MouseEvent) => {
      const el = e.target as Node;
      if (!btnRef.current?.contains(el) && !(document.getElementById('lang-portal')?.contains(el))) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isOpen]);

  /* Recompute on scroll/resize while open */
  useEffect(() => {
    if (!isOpen) return;
    const h = () => computeStyle();
    window.addEventListener('scroll', h, true);
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('scroll', h, true); window.removeEventListener('resize', h); };
  }, [isOpen]);

  const menu = isOpen ? createPortal(
    <div
      id="lang-portal"
      style={{ position: 'fixed', zIndex: 99999, ...style }}
      className="bg-[#111] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden backdrop-blur-xl"
    >
      {languages.map(lang => (
        <button
          key={lang.code}
          onClick={() => { onSelect(lang); setIsOpen(false); }}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 text-xs font-bold transition-all text-left hover:bg-white/5',
            lang.code === 'ff-adlm' && 'font-adlam',
            currentLanguage.code === lang.code ? 'text-black' : 'text-zinc-300',
          )}
          style={currentLanguage.code === lang.code
            ? { background: 'linear-gradient(135deg,#ff8b9b,#fd8b00)' }
            : undefined}
        >
          <Globe className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
          {lang.name}
        </button>
      ))}
    </div>,
    document.body,
  ) : null;

  return (
    <div className={cn('relative', className)}>
      <button
        ref={btnRef}
        onClick={toggle}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-zinc-400 hover:text-white group',
          buttonClassName,
          currentLanguage.code === 'ff-adlm' && 'font-adlam',
        )}
      >
        <Globe className="w-4 h-4 group-hover:rotate-12 transition-transform flex-shrink-0" />
        <span className="text-xs font-bold tracking-wider uppercase truncate">{currentLanguage.name}</span>
        <ChevronDown className={cn('w-3 h-3 transition-transform flex-shrink-0', isOpen && 'rotate-180')} />
      </button>
      {menu}
    </div>
  );
}
