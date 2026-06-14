interface GandoSparkProps {
  size?: number;
  className?: string;
  active?: boolean; // thinking/answering — intensifies glow + speeds up the embers
}

// Animated assistant avatar — the Gando 𞤘 mark alive with a rising ember/flame
// aura, a gentle up-down float, and an ember→magenta→violet gradient (not flat
// orange). Pure CSS; injected once. Replaces the generic robot icon in chat/build.
const STYLE = `
@keyframes gspark-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-2px); }
}
@keyframes gspark-aura {
  0%, 100% { opacity: 0.55; transform: scale(0.95) rotate(0deg); }
  50%      { opacity: 1;    transform: scale(1.12) rotate(180deg); }
}
@keyframes gspark-char {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(255,45,149,0.5)); }
  50%      { filter: drop-shadow(0 0 7px rgba(124,58,237,0.85)) drop-shadow(0 0 14px rgba(253,139,0,0.5)); }
}
@keyframes gspark-ember {
  0%   { transform: translateY(2px) scale(1);   opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: translateY(-11px) scale(0.4); opacity: 0; }
}
`;

let injected = false;
function ensureStyle() {
  if (injected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = STYLE;
  document.head.appendChild(el);
  injected = true;
}

export function GandoSpark({ size = 32, className = '', active = false }: GandoSparkProps) {
  ensureStyle();
  const br = Math.round(size * 0.3);
  // Embers fly faster + more often while thinking; the count doubles for a "shooting" feel.
  const emberDur = active ? '0.9s' : '1.6s';
  const ember = (left: string, delay: string, color: string) => (
    <span style={{
      position: 'absolute', bottom: size * 0.5, left, width: Math.max(2, size * 0.07), height: Math.max(2, size * 0.07),
      borderRadius: '50%', background: color, filter: 'blur(0.5px)',
      animation: `gspark-ember ${emberDur} ease-out infinite`, animationDelay: delay, pointerEvents: 'none',
    }} />
  );

  return (
    <span
      aria-label="Gando"
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, flexShrink: 0, position: 'relative',
        animation: `gspark-float ${active ? '1.4s' : '3s'} ease-in-out infinite`,
      }}
    >
      {/* swirling ember→magenta→violet aura (brighter + faster while active) */}
      <span style={{
        position: 'absolute', inset: -size * (active ? 0.14 : 0.08), borderRadius: br + 4,
        background: 'conic-gradient(from 0deg, #fd8b00, #ff2d95 35%, #7c3aed 65%, #fd8b00 100%)',
        filter: `blur(${active ? 5 : 3}px)`,
        opacity: active ? 1 : 0.85,
        animation: `gspark-aura ${active ? '2s' : '4s'} ease-in-out infinite`,
      }} />

      {/* dark core */}
      <span style={{
        position: 'absolute', inset: size * 0.06, borderRadius: br,
        background: 'linear-gradient(145deg, #1a0a14, #0e0e0e)',
      }} />

      {/* rising embers (more + faster while thinking) */}
      {ember('38%', '0s', '#fd8b00')}
      {ember('52%', '0.5s', '#ff2d95')}
      {ember('46%', '1s', '#a855f7')}
      {active && ember('30%', '0.25s', '#ffb169')}
      {active && ember('62%', '0.75s', '#c026d3')}

      {/* the character */}
      <span style={{
        position: 'relative',
        fontFamily: '"Noto Sans Adlam", sans-serif',
        fontSize: size * 0.56, lineHeight: 1,
        background: 'linear-gradient(135deg, #ffb169, #ff2d95 50%, #a855f7)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        userSelect: 'none',
        animation: 'gspark-char 3s ease-in-out infinite',
      }}>
        𞤘
      </span>
    </span>
  );
}
