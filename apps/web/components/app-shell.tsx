"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Database } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { useT } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export function AppShell({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "authenticated">("checking");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

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

      setEmail(data.session.user.email ?? "");
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

      setEmail(session.user.email ?? "");
      setAuthState("authenticated");
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (authState === "checking") {
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-4 text-ink">
        <section className="surface w-full max-w-sm px-6 py-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-card bg-night shadow-root">
            <Database className="h-6 w-6 text-accent" strokeWidth={2.2} aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">{t.shell.checkingTitle}</h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">{t.shell.checkingBody}</p>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Sidebar email={email} />
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-3 pb-10 pt-5 sm:px-4 lg:pl-72 lg:pr-8">
        <main className="mt-2">{children}</main>
      </div>
    </div>
  );
}
