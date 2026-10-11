"use client";

import { useT } from "@/lib/i18n";
import { LegalShell, LegalSection } from "@/components/legal/legal-shell";

const SECTION_ORDER = [
  "overview",
  "dataCollected",
  "dataUse",
  "dataSharing",
  "dataRetention",
  "yourRights",
  "cookies",
  "security",
  "international",
  "children",
  "changes",
  "contact"
] as const;

export default function PrivacyPage() {
  const t = useT();
  const copy = t.legal.privacy;
  const sections = copy.sections;

  return (
    <LegalShell>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-ink">{copy.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-secondary text-[12px] text-ink-muted">
        <span>{copy.effectiveDate}</span>
        <span>{copy.lastUpdated}</span>
      </div>

      <div className="mt-8 rounded-xl border border-paper-line bg-paper-card">
        <div className="divide-y divide-paper-line px-5 sm:px-6">
          {SECTION_ORDER.map((key) => {
            const section = sections[key];
            return <LegalSection key={key} title={section.title} body={section.body} />;
          })}
        </div>
      </div>
    </LegalShell>
  );
}
