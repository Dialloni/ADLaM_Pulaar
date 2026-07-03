import React, { useState, useEffect } from 'react';
import { X, User as UserIcon, Settings as SettingsIcon, Shield, Trash2, Download, Check, ChevronDown, Sun, Moon } from 'lucide-react';
import type { UIStrings } from '../translations';

export interface UserPrefs {
  preferredName?: string;
  occupation?: string;
  allowTraining?: boolean;       // default ON (opt-out) — see Privacy disclosure
  allowPreciseLocation?: boolean; // default OFF — coarse IP location is server-side
}

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  displayName: string;
  email: string;
  photoURL?: string | null;
  prefs: UserPrefs;
  theme: 'dark' | 'light';
  t: UIStrings;            // full translation strings (renders in selected language)
  fr?: boolean;            // only for a few micro-strings (cancel/confirm)
  onToggleTheme: () => void;
  onSaveName: (fullName: string) => Promise<void>;
  onChangeAvatar: (file: File) => Promise<void>;
  onSavePrefs: (partial: UserPrefs) => void;
  onExport: () => void;
  onLogout: () => void;
  onDelete: () => Promise<void>;
}

// Canonical stored value (English) + the translation key used to display it.
const OCCUPATIONS: { value: string; key: keyof UIStrings }[] = [
  { value: 'Student', key: 'roleStudent' },
  { value: 'Engineering', key: 'roleEngineering' },
  { value: 'Product management', key: 'roleProductManagement' },
  { value: 'Design', key: 'roleDesign' },
  { value: 'Data science', key: 'roleDataScience' },
  { value: 'Science', key: 'roleScience' },
  { value: 'Business', key: 'roleBusiness' },
  { value: 'Marketing', key: 'roleMarketing' },
  { value: 'Operations', key: 'roleOperations' },
  { value: 'Education', key: 'roleEducation' },
  { value: 'Other', key: 'roleOther' },
];

const P = '#3b82f6';

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
  <button onClick={() => onChange(!on)}
    style={{ width: 40, height: 22, borderRadius: 999, background: on ? P : 'var(--border)', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 150ms' }}>
    <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 150ms' }} />
  </button>
);

const Row: React.FC<{ label: string; desc?: string; children: React.ReactNode }> = ({ label, desc, children }) => (
  <div className="settings-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
    <div style={{ minWidth: 0, flex: 1 }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</p>
      {desc && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{desc}</p>}
    </div>
    <div className="settings-row-control" style={{ flexShrink: 0 }}>{children}</div>
  </div>
);

const inputStyle: React.CSSProperties = {
  width: 220, maxWidth: '45vw', boxSizing: 'border-box', height: 36, borderRadius: 8,
  background: 'var(--btn-bg)', border: '1px solid var(--border)', padding: '0 10px',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none', textAlign: 'right',
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open, onClose, displayName, email, photoURL, prefs, theme, t, fr = false,
  onToggleTheme, onSaveName, onChangeAvatar, onSavePrefs, onExport, onLogout, onDelete,
}) => {
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const pickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAvatar(true);
    try { await onChangeAvatar(file); } catch (err) { console.error('avatar upload failed', err); }
    finally { setUploadingAvatar(false); }
  };

  type Tab = 'general' | 'account' | 'privacy';
  const [tab, setTab] = useState<Tab>('general');
  const [fullName, setFullName] = useState(displayName);
  const [preferredName, setPreferredName] = useState(prefs.preferredName || '');
  const [occOpen, setOccOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFullName(displayName); setPreferredName(prefs.preferredName || '');
      setTab('general'); setConfirmDelete(false); setDeleteErr(null);
    }
  }, [open, displayName, prefs.preferredName]);

  if (!open) return null;

  const training = prefs.allowTraining !== false; // default ON
  const occupation = prefs.occupation || '';
  const occLabel = OCCUPATIONS.find(o => o.value === occupation);

  const commitName = async () => {
    if (fullName.trim() && fullName.trim() !== displayName) await onSaveName(fullName.trim());
  };
  const commitPreferred = () => {
    if ((preferredName.trim() || '') !== (prefs.preferredName || '')) onSavePrefs({ preferredName: preferredName.trim() });
  };

  const doDelete = async () => {
    setDeleting(true); setDeleteErr(null);
    try { await onDelete(); }
    catch (e: any) {
      setDeleting(false);
      setDeleteErr(e?.code === 'auth/requires-recent-login'
        ? (fr ? 'Reconnectez-vous puis réessayez de supprimer.' : 'Please log out and back in, then try deleting again.')
        : (e?.message || 'Delete failed.'));
    }
  };

  const TABS: { id: Tab; label: string; Icon: typeof UserIcon }[] = [
    { id: 'general', label: t.settingsGeneralTab, Icon: SettingsIcon },
    { id: 'account', label: t.settingsAccountTab, Icon: UserIcon },
    { id: 'privacy', label: t.settingsPrivacyTab, Icon: Shield },
  ];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 16, fontFamily: 'Inter, var(--adlam-ui), sans-serif' }}>
      <div onClick={e => e.stopPropagation()} className="settings-modal" style={{ background: 'var(--card-elevated)', border: '1px solid var(--border)', borderRadius: 20, width: '100%', maxWidth: 720, height: 560, maxHeight: '85vh', overflow: 'hidden', display: 'flex', boxShadow: '0 40px 100px rgba(0,0,0,0.6)' }}>
        {/* sidebar tabs */}
        <div className="settings-sidebar" style={{ width: 180, flexShrink: 0, borderRight: '1px solid var(--border)', padding: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p className="settings-nav-label" style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '8px 10px 6px' }}>{t.settingsNav}</p>
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 600,
                background: tab === id ? 'var(--hover-bg)' : 'transparent', color: tab === id ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              <Icon size={15} style={{ color: tab === id ? P : undefined }} /> {label}
            </button>
          ))}
        </div>

        {/* content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{TABS.find(x => x.id === tab)!.label}</h2>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px' }}>
            {tab === 'general' && (
              <>
                <Row label={t.avatarLabel} desc={t.avatarSubtitle}>
                  <input ref={avatarInputRef} type="file" accept="image/*" onChange={pickAvatar} style={{ display: 'none' }} />
                  <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} title={t.avatarSubtitle}
                    style={{ position: 'relative', width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: uploadingAvatar ? 'default' : 'pointer', padding: 0, overflow: 'hidden' }}>
                    {photoURL
                      ? <img src={photoURL} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                      : <div style={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0a0a', fontWeight: 800, background: 'var(--gradient-brand)' }}>{(displayName || email || 'U')[0].toUpperCase()}</div>}
                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 10, fontWeight: 700, opacity: uploadingAvatar ? 1 : 0, transition: 'opacity 150ms' }}>
                      {uploadingAvatar ? '…' : ''}
                    </span>
                  </button>
                </Row>
                <Row label={t.fullNameLabel} desc={t.fullNameSubtitle}>
                  <input className="settings-input" value={fullName} onChange={e => setFullName(e.target.value)} onBlur={commitName}
                    onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} placeholder={t.fullNameLabel} maxLength={80} style={inputStyle} />
                </Row>
                <Row label={t.gandoNamingQuery} desc={t.gandoNamingSubtitle}>
                  <input className="settings-input" value={preferredName} onChange={e => setPreferredName(e.target.value)} onBlur={commitPreferred}
                    onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} placeholder={displayName.split(/\s+/)[0] || ''} maxLength={40} style={inputStyle} />
                </Row>
                <Row label={t.workDescriptionQuery}>
                  <div className="settings-occ" style={{ position: 'relative' }}>
                    <button className="settings-input" onClick={() => setOccOpen(o => !o)} style={{ ...inputStyle, width: 200, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ color: occLabel ? 'var(--text-primary)' : 'var(--text-muted)' }}>{occLabel ? t[occLabel.key] : '—'}</span>
                      <ChevronDown className="w-3.5 h-3.5" style={{ opacity: 0.6 }} />
                    </button>
                    {occOpen && (
                      <div className="settings-dropdown" style={{ position: 'absolute', top: 40, right: 0, width: 200, maxHeight: 220, overflowY: 'auto', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, zIndex: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                        {OCCUPATIONS.map(o => (
                          <div key={o.value} onClick={() => { onSavePrefs({ occupation: o.value }); setOccOpen(false); }}
                            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--hover-bg)'}
                            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                            {t[o.key]} {occupation === o.value && <Check className="w-3.5 h-3.5" style={{ color: P }} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Row>
                <Row label={t.appearanceLabel} desc={t.appearanceSubtitle}>
                  <button onClick={onToggleTheme} style={{ display: 'flex', alignItems: 'center', gap: 8, ...inputStyle, width: 'auto', padding: '0 14px', cursor: 'pointer' }}>
                    {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    {theme === 'dark' ? (fr ? 'Sombre' : 'Dark') : (fr ? 'Clair' : 'Light')}
                  </button>
                </Row>
              </>
            )}

            {tab === 'account' && (
              <>
                <Row label={t.logOutActionLabel} desc={t.logOutActionSubtitle}>
                  <button onClick={onLogout} style={{ ...inputStyle, width: 'auto', padding: '0 16px', cursor: 'pointer' }}>{t.logOutActionLabel}</button>
                </Row>
                <div style={{ paddingTop: 14 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t.deleteAccountActionLabel}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5, marginBottom: 12 }}>{t.deleteAccountActionSubtitle}</p>
                  {deleteErr && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>{deleteErr}</p>}
                  {!confirmDelete ? (
                    <button onClick={() => setConfirmDelete(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 16px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      <Trash2 className="w-4 h-4" /> {t.deleteAccountActionLabel}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setConfirmDelete(false)} disabled={deleting} style={{ height: 38, padding: '0 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--btn-bg)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{fr ? 'Annuler' : 'Cancel'}</button>
                      <button onClick={doDelete} disabled={deleting} style={{ height: 38, padding: '0 16px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{deleting ? (fr ? 'Suppression…' : 'Deleting…') : (fr ? 'Oui, supprimer' : 'Yes, delete permanently')}</button>
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'privacy' && (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, padding: '10px 0 4px' }}>{t.privacyBriefHeader}</p>
                <Row label={t.improveModelsLabel} desc={t.improveModelsSubtitle}>
                  <Toggle on={training} onChange={v => onSavePrefs({ allowTraining: v })} />
                </Row>
                <Row label={t.preciseLocationLabel} desc={t.preciseLocationSubtitle}>
                  <Toggle on={!!prefs.allowPreciseLocation} onChange={v => onSavePrefs({ allowPreciseLocation: v })} />
                </Row>
                <Row label={t.exportDataLabel} desc={t.exportDataSubtitle}>
                  <button onClick={onExport} style={{ display: 'flex', alignItems: 'center', gap: 8, ...inputStyle, width: 'auto', padding: '0 16px', cursor: 'pointer' }}>
                    <Download className="w-4 h-4" /> {t.exportDataLabel}
                  </button>
                </Row>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
