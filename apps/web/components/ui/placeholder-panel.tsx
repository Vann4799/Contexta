"use client";

import { Construction } from "lucide-react";

interface PlaceholderPanelProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PlaceholderPanel({ eyebrow, title, description }: PlaceholderPanelProps) {
  return (
    <div className="space-y-3">
      <section className="surface p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10">
            <Construction className="h-7 w-7 text-accent" strokeWidth={2} aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="mt-2 text-[26px] font-semibold text-ink">{title}</h2>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-ink-muted">{description}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
