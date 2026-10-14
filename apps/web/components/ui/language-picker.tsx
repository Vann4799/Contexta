"use client";

import { Check, Languages } from "lucide-react";
import { localeOptions, setLocale, useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguagePicker({ label }: { label: string }) {
  const locale = useLocale();

  return (
    <div className="mt-2 border-t border-paper-line pt-2" role="group" aria-label={label}>
      <p className="flex items-center gap-2 px-2 pb-1.5 text-[12px] font-semibold text-ink-muted">
        <Languages className="h-4 w-4" aria-hidden="true" />
        {label}
      </p>
      <div className="space-y-1 px-1 pb-1">
        {localeOptions.map((option) => {
          const active = option.value === locale;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setLocale(option.value)}
              className={cn(
                "focus-ring flex h-10 w-full items-center justify-between gap-2 rounded-control border px-2.5 text-left text-[13px] font-medium transition-colors",
                active
                  ? "border-paper-line bg-paper-chip text-ink"
                  : "border-transparent text-ink-muted hover:bg-paper-soft hover:text-ink"
              )}
            >
              <span className="truncate">{option.label}</span>
              {active ? <Check className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
