import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { ByokProvider } from '../services/geminiService';
import { BYOK_PROVIDERS } from '../lib/providers';

// Settings modal for pasting your own provider API keys. Keys live in this browser
// (localStorage) only — never sent to our database, only forwarded per-request to
// the chosen provider. Each user's key has its own quota.
export const ByokModal: React.FC<{
  open: boolean;
  keys: Partial<Record<ByokProvider, string>>;
  onSave: (next: Partial<Record<ByokProvider, string>>) => void;
  onClose: () => void;
  fr?: boolean;
}> = ({ open, keys, onSave, onClose, fr = false }) => {
  const [draft, setDraft] = useState<Partial<Record<ByokProvider, string>>>(keys);
  useEffect(() => { if (open) setDraft(keys); }, [open, keys]);
  if (!open) return null;
  const save = () => {
    const cleaned = Object.fromEntries(
      Object.entries(draft).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, (v as string).trim()])
    );
    onSave(cleaned);
    onClose();
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="API keys" onClick={e => e.stopPropagation()} style={{ background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', padding: 24, fontFamily: 'Inter, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{fr ? 'Utilisez votre propre clé API' : 'Bring your own API key'}</h2>
          <button aria-label="Close" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.5 }}>
          {fr
            ? 'Collez une clé pour utiliser ce fournisseur avec votre propre quota. Les clés sont stockées uniquement dans ce navigateur — jamais sur nos serveurs. Laissez vide pour retirer.'
            : 'Paste a key to use that provider with your own quota. Keys are stored in this browser only — never on our servers. Leave blank to remove.'}
        </p>
        {BYOK_PROVIDERS.map(p => (
          <div key={p.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</label>
              <a href={p.keysUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none' }}>{fr ? 'Obtenir une clé →' : 'Get key →'}</a>
            </div>
            <input
              type="password" autoComplete="off" spellCheck={false}
              value={draft[p.id] || ''} placeholder={p.placeholder}
              onChange={e => setDraft(d => ({ ...d, [p.id]: e.target.value }))}
              style={{ width: '100%', boxSizing: 'border-box', height: 38, borderRadius: 10, background: 'var(--btn-bg)', border: '1px solid var(--border)', padding: '0 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'monospace' }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, height: 40, borderRadius: 10, background: 'var(--btn-bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{fr ? 'Annuler' : 'Cancel'}</button>
          <button onClick={save} style={{ flex: 1, height: 40, borderRadius: 10, background: 'var(--gradient-brand)', border: 'none', color: '#0a0a0a', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{fr ? 'Enregistrer' : 'Save keys'}</button>
        </div>
      </div>
    </div>
  );
};
