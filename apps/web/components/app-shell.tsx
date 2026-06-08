"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileSearch } from "lucide-react";
import { ContextaLogo } from "@/components/contexta-logo";
import { DesktopNavLinks, MobileNavLinks } from "@/components/nav-links";
import { createSupabaseBrowserClient } from "@/lib/supabase";

function initialsFromUser(email?: string, fullName?: string) {
  const source = fullName?.trim() || email?.split("@")[0] || "Contexta";
  const words = source.split(/[\s._-]+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
  return initials || "CT";
}

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "authenticated">("checking");
  const [userInitials, setUserInitials] = useState("CT");

  useEffect(() => {
    let isMounted = true;
    const supabase = createSupabaseBrowserClient();

    async function verifySession() {
      const { data } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (!data.session) {
        const searchString = window.location.search.replace(/^\?/, "");
        const currentPath = `${pathname || "/"}${searchString ? `?${searchString}` : ""}`;
        const nextPath = currentPath !== "/" ? `?next=${encodeURIComponent(currentPath)}` : "";
        router.replace(`/login${nextPath}`);
        return;
      }

      setUserInitials(initialsFromUser(data.session.user.email, data.session.user.user_metadata?.full_name));
      setAuthState("authenticated");
    }

    void verifySession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      if (event === "SIGNED_OUT" || !session) {
        router.replace("/login");
        return;
      }

      setUserInitials(initialsFromUser(session.user.email, session.user.user_metadata?.full_name));
      setAuthState("authenticated");
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (authState === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f9f9ff] px-4 text-ink">
        <section className="w-full max-w-sm rounded border border-[#c3c6d7] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-primary text-white">
            <FileSearch className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
          </div>
          <h1 className="mt-4 font-heading text-xl font-semibold">Checking access</h1>
          <p className="mt-2 text-sm text-subtle">Please sign in to open your Contexta workspace.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f9ff] text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[#c3c6d7] bg-[#f0f3ff] px-4 py-6 md:flex md:flex-col">
        <div className="mb-8">
          <ContextaLogo />
          <p className="mt-1 pl-10 text-xs font-medium uppercase tracking-[0.16em] text-subtle">Document Workspace</p>
        </div>
        <DesktopNavLinks />
        <div className="mt-auto border-t border-[#c3c6d7] pt-3">
          <Link className="flex items-center rounded px-3 py-2 text-sm font-medium text-subtle transition hover:bg-white/70 hover:text-ink" href="/help">
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
            <div className="hidden min-w-0 flex-1 lg:block" aria-hidden="true" />
            <h1 className="min-w-0 flex-1 truncate font-heading text-xl font-semibold lg:hidden">{title}</h1>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border bg-muted text-xs font-semibold text-subtle transition hover:border-primary hover:bg-white hover:text-primary"
                href="/profile"
                aria-label="Open profile"
              >
                {userInitials}
              </Link>
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
      <MobileNavLinks />
    </div>
  );
}
