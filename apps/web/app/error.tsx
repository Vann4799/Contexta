"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ContextaLogo } from "@/components/contexta-logo";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Contexta Error]", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper p-6 text-ink">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <ContextaLogo />
        </div>

        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10">
            <AlertTriangle className="h-7 w-7 text-warning" strokeWidth={1.8} aria-hidden="true" />
          </div>
        </div>

        <p className="eyebrow">Error</p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 font-secondary text-[13px] leading-6 text-ink-muted">
          An unexpected error occurred. Please try again or return to the dashboard.
        </p>

        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-ink-faint">Reference: {error.digest}</p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center justify-center rounded-control bg-night px-5 text-[13px] font-semibold text-white shadow-node transition hover:bg-night-raised"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-control border border-paper-line bg-paper px-5 text-[13px] font-medium text-ink transition hover:border-ink/30 hover:bg-paper-card"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
