import type { ReactNode } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { ContextaLogo } from "@/components/contexta-logo";
import { DesktopNavLinks, MobileNavLinks } from "@/components/nav-links";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f9f9ff] text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[#c3c6d7] bg-[#f0f3ff] px-4 py-6 md:flex md:flex-col">
        <div className="mb-6">
          <ContextaLogo />
          <p className="mt-1 pl-10 text-xs font-medium uppercase tracking-[0.16em] text-subtle">Document Workspace</p>
        </div>
        <Link
          className="mb-6 inline-flex h-11 items-center justify-center gap-2 rounded border border-primary bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          href="/documents"
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span>
          New Analysis
        </Link>
        <DesktopNavLinks />
        <div className="mt-auto border-t border-[#c3c6d7] pt-3">
          <Link className="flex items-center rounded px-3 py-2 text-sm font-medium text-subtle transition hover:bg-white/70 hover:text-ink" href="/settings">
            Help
          </Link>
        </div>
      </aside>
      <main className="min-h-screen pb-20 md:pl-64 md:pb-0">
        <header className="sticky top-0 z-10 border-b border-[#c3c6d7] bg-[#f9f9ff]/95 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center justify-between gap-4">
            <div className="md:hidden">
              <ContextaLogo compact />
            </div>
            <div className="hidden min-w-0 flex-1 items-center gap-6 lg:flex">
              <label className="relative block w-full max-w-sm">
                <span className="sr-only">Search documents</span>
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m20 20-4-4m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  className="h-9 w-full rounded border border-[#c3c6d7] bg-white px-9 text-sm text-ink placeholder:text-subtle focus:border-primary focus:outline-none"
                  placeholder="Search documents, entities..."
                  type="search"
                />
              </label>
              <nav className="flex items-center gap-4 text-sm font-medium text-subtle" aria-label="Quick links">
                <Link className="transition hover:text-primary" href="/documents">Recent</Link>
                <Link className="transition hover:text-primary" href="/chat">Chat</Link>
              </nav>
            </div>
            <h1 className="min-w-0 flex-1 truncate font-heading text-xl font-semibold lg:hidden">{title}</h1>
            <div className="flex shrink-0 items-center gap-2">
              <Link className="hidden h-8 items-center rounded border border-[#c3c6d7] bg-white px-3 text-sm font-medium transition hover:border-primary hover:text-primary sm:inline-flex" href="/documents">
                Upload
              </Link>
              <LogoutButton />
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border bg-muted text-xs font-semibold text-subtle" aria-label="User menu">
                CT
              </div>
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
      <MobileNavLinks />
    </div>
  );
}
