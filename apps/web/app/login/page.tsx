import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { ContextaLogo } from "@/components/contexta-logo";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background text-ink md:grid md:grid-cols-2">
      <section className="login-grid-bg relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-border bg-surface px-10 py-9 md:flex">
        <ContextaLogo />

        <div className="max-w-lg">
          <h1 className="font-heading text-5xl font-semibold leading-tight text-ink">
            Turn private documents into clear decisions.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-7 text-subtle">
            Contexta combines grounded RAG chat, citations, and document intelligence in one focused workspace.
          </p>

          <div className="mt-10 border-t border-border pt-6">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {["CT", "AI", "RG"].map((label) => (
                  <span
                    key={label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-border bg-ink text-xs font-semibold text-white"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <p className="text-sm leading-5 text-subtle">
                <span className="font-semibold text-ink">Built for focused analysis</span> across PDF and DOCX knowledge bases.
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-subtle">© 2026 Contexta. Private document intelligence.</p>
        <div className="pointer-events-none absolute bottom-[-140px] right-[-120px] h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-contexta border border-border bg-surface p-6 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
          <div className="mb-8 md:hidden">
            <ContextaLogo />
          </div>

          <div className="mb-8">
            <h2 className="font-heading text-4xl font-semibold leading-tight">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-subtle">Sign in to continue your document intelligence workspace.</p>
          </div>

          <AuthForm mode="login" />

          <div className="mt-5 flex items-center justify-between gap-3 text-sm">
            <Link href="/register" className="font-medium text-primary hover:text-ink">
              Request access
            </Link>
            <Link href="/forgot-password" className="font-medium text-primary hover:text-ink">
              Forgot password?
            </Link>
          </div>

          <div className="mt-10 border-t border-border pt-6">
            <p className="text-center text-sm text-subtle">Secure access for your private RAG document workspace.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
