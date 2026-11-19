interface LogoMarkProps {
  readonly size?: number;
}

/**
 * The mark is a bounded track: a dot (the agent) free to move along a line
 * that ends at a hard stop (the mandate).
 */
export function LogoMark({ size = 32 }: LogoMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="CashMandate">
      <rect width="32" height="32" rx="7" fill="var(--color-primary)" />
      <path d="M7 16H21" stroke="var(--color-paper)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12.5" cy="16" r="3.75" fill="var(--color-paper)" />
      <path d="M25 8.5V23.5" stroke="var(--color-paper)" strokeWidth="2.75" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <LogoMark size={28} />
      <span className="wordmark-text">CashMandate</span>
    </span>
  );
}
