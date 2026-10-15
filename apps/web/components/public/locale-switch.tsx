"use client";

import { useRouter } from "next/navigation";
import { localePath, setLocale, useLocale, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "id", label: "ID" }
];

/**
 * Public pages take their language from the URL, so switching means jumping to the same page's
 * twin rather than restyling the one on screen. The choice is stored too: the workspace behind
 * these pages has no per-language URL, and it should open in the language just picked.
 *
 * The current path is read on click instead of render, so a statically generated page cannot ship
 * a switcher pointing at somebody else's URL.
 */
export function LocaleSwitch({ tone = "light" }: { tone?: "light" | "dark" }) {
  const locale = useLocale();
  const router = useRouter();

  return (
    <div
      role="group"
      aria-label={locale === "id" ? "Ganti bahasa" : "Change language"}
      className="flex items-center gap-1"
    >
      {OPTIONS.map((option) => {
        const active = option.value === locale;
        return (
          <button
            key={option.value}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => {
              if (active) return;
              const base = window.location.pathname.replace(/^\/id(?=\/|$)/, "") || "/";
              setLocale(option.value);
              router.push(localePath(base, option.value));
            }}
            className={cn(
              "focus-ring rounded-full px-2 py-1 font-mono text-[11px] font-semibold transition-colors",
              active
                ? tone === "dark"
                  ? "bg-paper/15 text-paper"
                  : "bg-night text-paper"
                : tone === "dark"
                  ? "text-paper/50 hover:text-paper"
                  : "text-ink-faint hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
