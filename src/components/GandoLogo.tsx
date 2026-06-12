interface GandoLogoProps {
  size?: number;
  mono?: boolean;
  className?: string;
}

const STYLE = `
@keyframes gando-spin {
  to { transform: rotate(360deg); }
}
@keyframes gando-breathe {
  0%, 100% { opacity: 0.45; transform: scale(0.92); }
  50%       { opacity: 1;    transform: scale(1.08); }
}
@keyframes gando-char-pulse {
  0%, 100% { filter: drop-shadow(0 0 3px rgba(255,139,155,0.5)); }
  50%       { filter: drop-shadow(0 0 8px rgba(253,139,0,0.9)) drop-shadow(0 0 16px rgba(255,139,155,0.4)); }
}
`;

let styleInjected = false;
function ensureStyle() {
  if (styleInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = STYLE;
  document.head.appendChild(el);
  styleInjected = true;
}

export function GandoLogo({ size = 32, mono = false, className = '' }: GandoLogoProps) {
  ensureStyle();

  const ring = Math.max(1.5, size * 0.06);
  const br   = Math.round(size * 0.28);

  return (
    <span
      aria-label="Gando"
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, flexShrink: 0, position: 'relative',
      }}
    >
      {/* spinning conic-gradient ring */}
      <span style={{
        position: 'absolute', inset: -ring,
        borderRadius: br + ring,
        background: mono
          ? 'conic-gradient(from 0deg, #3f3f46, #cfcfcf, #3f3f46)'
          : 'conic-gradient(from 0deg, #ff8b9b 0%, #fd8b00 35%, #ff6bcb 65%, #ff8b9b 100%)',
        animation: 'gando-spin 3.5s linear infinite',
      }} />

      {/* dark background — slightly inset so ring peeks through */}
      <span style={{
        position: 'absolute', inset: ring * 0.8,
        borderRadius: br,
        background: 'linear-gradient(145deg, #1c0a0f, #0e0e0e)',
      }} />

      {/* inner radial glow — breathes */}
      <span style={{
        position: 'absolute', inset: ring * 2,
        borderRadius: br - 2,
        background: mono
          ? 'radial-gradient(circle, rgba(255,255,255,0.06), transparent 70%)'
          : 'radial-gradient(circle, rgba(255,100,120,0.22), rgba(253,139,0,0.08) 55%, transparent 80%)',
        animation: 'gando-breathe 2.4s ease-in-out infinite',
      }} />

      {/* the character */}
      <span style={{
        position: 'relative',
        fontFamily: '"Noto Sans Adlam", sans-serif',
        fontSize: size * 0.58,
        lineHeight: 1,
        background: mono ? '#d4d4d8' : 'linear-gradient(135deg, #ffb3be, #ff8b9b 40%, #fd8b00)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        userSelect: 'none',
        animation: mono ? undefined : 'gando-char-pulse 2.4s ease-in-out infinite',
      }}>
        𞤘
      </span>
    </span>
  );
}
