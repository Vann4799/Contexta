"use client";

import { useT } from "@/lib/i18n";

export function ChatLoading() {
  const t = useT();

  return <section className="surface p-5 text-[13px] text-ink-muted">{t.chat.loading}</section>;
}
