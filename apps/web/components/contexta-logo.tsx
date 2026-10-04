import { FileSearch } from "lucide-react";

type ContextaLogoProps = {
  compact?: boolean;
};

export function ContextaLogo({ compact = false }: ContextaLogoProps) {
  return (
    <div className="flex min-w-0 items-center gap-2" aria-label="Contexta">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-contexta bg-primary text-accent-ink shadow-sm">
        <FileSearch className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
      </span>
      {!compact ? <span className="truncate font-heading text-lg font-semibold text-ink">Contexta</span> : null}
    </div>
  );
}
