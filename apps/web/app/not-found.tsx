import Link from "next/link";
import { ContextaLogo } from "@/components/contexta-logo";
import { FileX2 } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper p-6 text-ink">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <ContextaLogo />
        </div>

        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-paper-chip">
            <FileX2 className="h-7 w-7 text-ink-muted" strokeWidth={1.8} aria-hidden="true" />
          </div>
        </div>

        <p className="eyebrow">404</p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 font-secondary text-[13px] leading-6 text-ink-muted">
          The page you are looking for does not exist or has been moved.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-control bg-night px-5 text-[13px] font-semibold text-white shadow-node transition hover:bg-night-raised"
          >
            Go to dashboard
          </Link>
          <Link
            href="/documents"
            className="inline-flex h-10 items-center justify-center rounded-control border border-paper-line bg-paper px-5 text-[13px] font-medium text-ink transition hover:border-ink/30 hover:bg-paper-card"
          >
            Browse documents
          </Link>
        </div>
      </div>
    </main>
  );
}
