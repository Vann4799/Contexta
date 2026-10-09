"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Database, Menu } from "lucide-react";
import { MobileSidebar, Sidebar } from "@/components/sidebar";
import { useT } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export function AppShell({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "authenticated">("checking");
  const [email, setEmail] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (authState === "checking") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#08080A] px-4 text-white">
        <section className="w-full max-w-sm rounded-2xl border border-[#262632] bg-[#17171D] px-6 py-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-tr from-brand-orange to-[#FF7A1A] shadow-orange-sm">
            <Database className="h-6 w-6 text-white" strokeWidth={2.2} aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">{t.shell.checkingTitle}</h1>
          <p className="mt-1 text-[13.5px] text-brand-muted">{t.shell.checkingBody}</p>
        </section>
      </main>
    );
  }

  return (
    <div className="dark-scrollbar flex min-h-screen w-full overflow-hidden bg-[#08080A]">
      <Sidebar email={email} />
      <MobileSidebar email={email} onClose={() => setMobileNavOpen(false)} open={mobileNavOpen} />

      <main className="dark-scrollbar flex-1 overflow-y-auto">
        <div className="lg:hidden flex items-center justify-between border-b border-[#21212A] bg-[#121216] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-orange to-[#FF7A1A] p-[2px]">
              <div className="flex h-full w-full items-center justify-center rounded-[7px] bg-brand-card">
                <Database className="h-4 w-4 text-brand-orange" strokeWidth={2.2} aria-hidden="true" />
              </div>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">Contexta</span>
          </div>
          <button
            type="button"
            aria-label={t.shell.openNav}
            onClick={() => setMobileNavOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#2B2B38] bg-[#1A1A22] text-gray-200"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="ambient-glow min-h-screen p-5 md:p-8 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
