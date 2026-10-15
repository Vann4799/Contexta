"use client";

import Link from "next/link";
import { ContextaLogo } from "@/components/contexta-logo";
import { useHref, useT } from "@/lib/i18n";

export function LegalShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const localeHref = useHref();

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-6 sm:py-14">
        <div className="mb-10 flex items-center justify-between">
          <Link href={localeHref("/")} className="focus-ring rounded-control" aria-label={t.legal.homeAria}>
            <ContextaLogo />
          </Link>
          <Link
            href={localeHref("/")}
            className="text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            {t.legal.backToHome}
          </Link>
        </div>
        {children}
      </div>
    </main>
  );
}

export function LegalSection({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-b border-paper-line py-5 last:border-0">
      <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
      <p className="mt-2 font-secondary text-[13px] leading-6 text-ink-muted">{body}</p>
    </div>
  );
}
