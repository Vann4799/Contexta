"use client";

import type { ReactNode } from "react";
import { ContextaLogo } from "@/components/contexta-logo";
import { LanguagePicker } from "@/components/ui/language-picker";
import { useT } from "@/lib/i18n";

type AuthCardProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function AuthCard({ eyebrow, title, description, children }: AuthCardProps) {
  const t = useT();

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-8">
      <section className="surface w-full max-w-md p-6 sm:p-8">
        <ContextaLogo />
        <div className="mt-8">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-1.5 text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
          {description ? <p className="mt-2 font-secondary text-[13px] leading-6 text-ink-muted">{description}</p> : null}
        </div>
        {children}
        <LanguagePicker label={t.common.language} />
      </section>
    </main>
  );
}
