"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";

const CONSENT_KEY = "contexta-cookie-consent";

export function CookieConsent() {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) {
        setVisible(true);
      }
    } catch {}
  }, []);

  function handleAccept() {
    try {
      localStorage.setItem(CONSENT_KEY, "1");
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-paper-line bg-paper-card p-4 shadow-[0_-4px_24px_rgb(0_0_0_/_0.06)]"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-secondary text-[12.5px] leading-5 text-ink-muted">
          {t.cookieConsent.message}{" "}
          <Link
            href="/privacy"
            className="font-medium text-ink underline-offset-4 hover:text-ink-muted hover:underline"
          >
            {t.cookieConsent.learnMore}
          </Link>
        </p>
        <button
          type="button"
          onClick={handleAccept}
          className="shrink-0 rounded-control bg-night px-4 py-2 text-[12.5px] font-semibold text-white shadow-node transition hover:bg-night-raised"
        >
          {t.cookieConsent.accept}
        </button>
      </div>
    </div>
  );
}
