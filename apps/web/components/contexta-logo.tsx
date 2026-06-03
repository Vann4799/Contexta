type ContextaLogoProps = {
  compact?: boolean;
};

export function ContextaLogo({ compact = false }: ContextaLogoProps) {
  return (
    <div className="flex min-w-0 items-center gap-2" aria-label="Contexta">
      <svg className="h-8 w-8 shrink-0" viewBox="0 0 32 32" role="img" aria-hidden="true">
        <rect x="5" y="4" width="17" height="22" rx="3" fill="#2563EB" />
        <path d="M11 11H19M11 16H18M11 21H16" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="23.5" cy="22.5" r="4.5" fill="#111827" />
        <path d="M26.8 25.8L29 28" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
        <circle cx="23.5" cy="22.5" r="1.5" fill="white" />
      </svg>
      {!compact ? <span className="truncate font-heading text-lg font-semibold text-ink">Contexta</span> : null}
    </div>
  );
}
