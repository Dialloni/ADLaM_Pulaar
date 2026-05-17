interface GandoLogoProps {
  size?: number;
  mono?: boolean;
  className?: string;
}
export function GandoLogo({ size = 32, mono = false, className = '' }: GandoLogoProps) {
  return (
    <img
      src={mono ? '/assets/logo-mono.svg' : '/assets/logo.svg'}
      width={size}
      height={size}
      alt="Gando"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    />
  );
}
