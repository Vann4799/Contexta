import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import { ContextaLogo } from "@/components/contexta-logo";

const capabilities = [
  { label: "Grounded RAG chat", note: "every answer carries page-level citations" },
  { label: "Document intelligence", note: "briefs, key points and detected fields" },
  { label: "Markdown conversion", note: "PDF and DOCX out to portable text" }
];

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-paper p-3 text-ink lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-3 lg:p-4">
      <section className="relative hidden flex-col justify-between overflow-hidden rounded-card bg-night p-9 shadow-root lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(to right, rgb(255 255 255 / 0.05) 1px, transparent 1px)",
            backgroundSize: "80px 100%"
          }}
        />
        <div className="relative w-fit rounded-control bg-paper-card p-3 shadow-node">
          <ContextaLogo />
        </div>

        <div className="relative max-w-xl">
          <p className="eyebrow text-white/45">Private document intelligence</p>
          <h1 className="mt-3 text-[40px] font-semibold leading-[1.08] tracking-tight text-white">
            Turn private documents into <span className="text-accent">clear decisions</span>.
          </h1>
          <p className="mt-4 max-w-md text-[14px] leading-6 text-white/60">
            Contexta combines grounded RAG chat, citations, and document intelligence in one focused workspace.
          </p>

          <ul className="mt-9 space-y-3 border-t border-white/10 pt-6">
            {capabilities.map((capability) => (
              <li className="flex items-baseline gap-3" key={capability.label}>
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <p className="text-[13px] leading-5 text-white/70">
                  <span className="font-semibold text-white">{capability.label}</span> - {capability.note}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative font-mono text-[11px] text-white/35">© 2026 Contexta. Private document intelligence.</p>
      </section>

      <section className="flex min-h-[80vh] items-center justify-center lg:min-h-0">
        <div className="w-full max-w-md rounded-card border border-paper-line bg-paper-card p-6 shadow-card sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="mb-8 lg:hidden">
            <ContextaLogo />
          </div>

          <div>
            <p className="eyebrow">Sign in</p>
            <h2 className="mt-2 text-[26px] font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-2 text-[13px] leading-6 text-ink-muted">Continue your document intelligence workspace.</p>
          </div>

          <AuthForm mode="login" />

          <div className="mt-5 flex items-center justify-between gap-3 text-[13px]">
            <Link className="font-semibold text-ink inline-flex items-center gap-1 hover:text-ink-muted" href="/register">
              Request access <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link className="font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline" href="/forgot-password">
              Forgot password?
            </Link>
          </div>

          <div className="mt-8 border-t border-paper-line pt-5">
            <p className="text-center text-[11.5px] text-ink-faint">Secure access for your private RAG document workspace.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
