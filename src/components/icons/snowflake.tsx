interface SnowflakeIconProps {
  size?: number;
  className?: string;
}

export function SnowflakeIcon({ size = 16, className }: SnowflakeIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      width={size}
      height={size}
      className={className}
    >
      <line x1="16" y1="2" x2="16" y2="30" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="2" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="5.5" y1="5.5" x2="26.5" y2="26.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="26.5" y1="5.5" x2="5.5" y2="26.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
