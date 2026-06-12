interface GandoLogoProps {
  size?: number;
  mono?: boolean;
  className?: string;
}
export function GandoLogo({ size = 32, mono = false, className = '' }: GandoLogoProps) {
  return (
    <span
      aria-label="Gando"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        fontFamily: '"Noto Sans Adlam", sans-serif',
        fontSize: size * 0.9,
        lineHeight: 1,
        background: mono ? '#cfcfcf' : 'linear-gradient(135deg, #ff8b9b, #fd8b00)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        userSelect: 'none',
      }}
    >
      𞤘
    </span>
  );
}
