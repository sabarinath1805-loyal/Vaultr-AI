interface SnowflakeIconProps {
  size?: number;
  className?: string;
}

export function SnowflakeIcon({ size = 16, className }: SnowflakeIconProps) {
  return (
    <svg
      viewBox="0 0 22 22"
      fill="none"
      width={size}
      height={size}
      className={className}
    >
      <line x1="11" y1="1" x2="11" y2="21" stroke="#1a1916" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="1" y1="11" x2="21" y2="11" stroke="#1a1916" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="4" y1="4" x2="18" y2="18" stroke="#1a1916" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="18" y1="4" x2="4" y2="18" stroke="#1a1916" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
