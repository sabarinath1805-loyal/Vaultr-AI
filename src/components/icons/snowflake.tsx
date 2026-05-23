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
      <path
        d="M11 1.6V20.4M1.6 11H20.4M4.35 4.35L17.65 17.65M17.65 4.35L4.35 17.65"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="square"
      />
      <path
        d="M11 1.6L9.4 4.2M11 1.6L12.6 4.2M11 20.4L9.4 17.8M11 20.4L12.6 17.8M1.6 11L4.2 9.4M1.6 11L4.2 12.6M20.4 11L17.8 9.4M20.4 11L17.8 12.6"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="square"
      />
    </svg>
  );
}
