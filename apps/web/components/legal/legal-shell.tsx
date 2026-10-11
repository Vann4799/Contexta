import Link from "next/link";
import { ContextaLogo } from "@/components/contexta-logo";

export function LegalShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-6 sm:py-14">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/" className="focus-ring rounded-control" aria-label="Contexta home">
            <ContextaLogo />
          </Link>
          <Link
            href="/"
            className="text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Back to app
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
