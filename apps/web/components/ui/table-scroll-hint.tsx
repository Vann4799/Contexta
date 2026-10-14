"use client";

import { useT } from "@/lib/i18n";

// These tables keep a min-w-[500px..720px] so their columns never wrap, which below that breakpoint
// leaves part of every row off-screen with nothing to suggest it scrolls. The caption is static
// because each table overflows for the whole range where the caption shows.
export function TableScrollHint({ className = "sm:hidden" }: { className?: string }) {
  const t = useT();

  return <p className={`mt-2 text-[11px] text-ink-faint ${className}`}>{t.common.scrollHint}</p>;
}
