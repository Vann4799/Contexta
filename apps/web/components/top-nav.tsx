"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileCode,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Settings,
  User,
  Waypoints,
  type LucideIcon
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { ContextaLogo } from "@/components/contexta-logo";
import { LanguagePicker } from "@/components/ui/language-picker";
import { useT } from "@/lib/i18n";
import { navigationItems, type NavIcon } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  pipeline: Waypoints,
  documents: FileText,
  chat: MessageSquare,
  convert: FileCode
};

function isActiveRoute(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav({ email }: { email: string }) {
  const pathname = usePathname();
  const t = useT();
  const [menu, setMenu] = useState<"none" | "account" | "nav">("none");

  useEffect(() => {
    setMenu("none");
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenu("none");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="relative z-30 flex items-center justify-between gap-4">
      <Link href="/" aria-label={t.shell.home} className="focus-ring flex shrink-0 items-center rounded-control">
        <ContextaLogo />
      </Link>

      <div className="flex min-w-0 items-center gap-3">
        <nav aria-label={t.shell.primaryNav} className="hidden items-center gap-1.5 lg:flex">
          {navigationItems.map((item) => {
            const Icon = NAV_ICONS[item.icon];
            const active = isActiveRoute(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring inline-flex h-9 items-center gap-2 rounded-control border px-3.5 text-[13.5px] font-medium transition-colors",
                  active
                    ? "border-paper-line bg-paper-card text-ink shadow-node"
                    : "border-transparent bg-paper-soft text-ink-muted hover:border-paper-line hover:bg-paper-card hover:text-ink"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                {t.shell.nav[item.labelKey]}
              </Link>
            );
          })}
        </nav>

        <div className="relative">
          <button
            type="button"
            aria-label={t.shell.accountMenu}
            aria-expanded={menu === "account"}
            onClick={() => setMenu((current) => (current === "account" ? "none" : "account"))}
            className="focus-ring grid h-9 w-9 place-items-center rounded-full bg-night ring-2 ring-white/60 transition-transform hover:scale-105"
          >
            <span className="h-3.5 w-3.5 rounded-full border-[3px] border-accent" aria-hidden="true" />
          </button>

          {menu === "account" ? (
            <div className="surface absolute right-0 top-11 z-30 w-60 p-2">
              <p className="truncate px-2 py-1.5 text-[12.5px] text-ink-muted">{email || t.shell.signedIn}</p>
              <Link
                href="/profile"
                className={cn(
                  "flex items-center gap-2 rounded-control px-2.5 py-2 text-[13.5px] font-medium text-ink hover:bg-paper-soft",
                  isActiveRoute(pathname, "/profile") && "bg-paper-chip"
                )}
              >
                <User className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                {t.shell.profile}
              </Link>
              <Link
                href="/settings"
                className={cn(
                  "flex items-center gap-2 rounded-control px-2.5 py-2 text-[13.5px] font-medium text-ink hover:bg-paper-soft",
                  isActiveRoute(pathname, "/settings") && "bg-paper-chip"
                )}
              >
                <Settings className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                {t.shell.settings}
              </Link>
              <Link
                href="/help"
                className="flex items-center gap-2 rounded-control px-2.5 py-2 text-[13.5px] font-medium text-ink hover:bg-paper-soft"
              >
                <HelpCircle className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                {t.shell.help}
              </Link>
              <LanguagePicker label={t.common.language} />
              <div className="mt-1 flex justify-end border-t border-paper-line px-2 pt-2">
                <LogoutButton />
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          aria-label={t.shell.openNav}
          aria-expanded={menu === "nav"}
          onClick={() => setMenu((current) => (current === "nav" ? "none" : "nav"))}
          className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-control border border-paper-line bg-paper-card lg:hidden"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {menu === "nav" ? (
        <nav
          aria-label={t.shell.mobileNav}
          className="surface absolute left-0 right-0 top-12 z-30 grid gap-1 p-2 lg:hidden"
        >
          {navigationItems.map((item) => {
            const Icon = NAV_ICONS[item.icon];

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActiveRoute(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-control px-3 py-2 text-left text-[13.5px] font-medium",
                  isActiveRoute(pathname, item.href) ? "bg-paper-chip text-ink" : "text-ink-muted hover:bg-paper-soft"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t.shell.nav[item.labelKey]}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
