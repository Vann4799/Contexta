import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { ContextaLogo } from "@/components/contexta-logo";
import { DesktopNavLinks, MobileNavLinks } from "@/components/nav-links";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-white px-4 py-5 md:block">
        <ContextaLogo />
        <DesktopNavLinks />
      </aside>
      <main className="min-h-screen pb-20 md:pl-64 md:pb-0">
        <header className="sticky top-0 z-10 border-b border-border bg-white/95 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="md:hidden">
              <ContextaLogo compact />
            </div>
            <h1 className="min-w-0 flex-1 truncate font-heading text-xl font-semibold md:flex-none">{title}</h1>
            <div className="flex shrink-0 items-center gap-2">
              <LogoutButton />
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border bg-muted text-xs font-semibold text-subtle" aria-label="User menu">
                CT
              </div>
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-6">{children}</div>
      </main>
      <MobileNavLinks />
    </div>
  );
}
