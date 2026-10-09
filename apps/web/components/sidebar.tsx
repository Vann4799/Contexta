"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileCode,
  FileText,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Settings,
  User,
  Waypoints,
  X,
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
  convert: FileCode,
  apiKeys: KeyRound,
  usage: BarChart3
};

function isActiveRoute(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const t = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setAccountOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-paper-line bg-paper-card lg:flex">
        <div className="flex h-16 items-center border-b border-paper-line px-5">
          <Link href="/" aria-label={t.shell.home} className="focus-ring flex items-center rounded-control">
            <ContextaLogo />
          </Link>
        </div>

        <nav aria-label={t.shell.primaryNav} className="flex-1 overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-1">
            {navigationItems.map((item) => {
              const Icon = NAV_ICONS[item.icon];
              const active = isActiveRoute(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring flex items-center gap-3 rounded-control px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                    active
                      ? "bg-night text-white shadow-node"
                      : "text-ink-muted hover:bg-paper-soft hover:text-ink"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                  {t.shell.nav[item.labelKey]}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-paper-line p-3">
          <div className="relative">
            <button
              type="button"
              aria-label={t.shell.accountMenu}
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((current) => !current)}
              className="focus-ring flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors hover:bg-paper-soft"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-night ring-2 ring-white/60">
                <span className="h-3 w-3 rounded-full border-[3px] border-accent" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">
                  {email || t.shell.signedIn}
                </span>
              </span>
            </button>

            {accountOpen ? (
              <div className="surface absolute bottom-full left-0 right-0 mb-2 p-2">
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
        </div>
      </aside>

      <button
        type="button"
        aria-label={t.shell.openNav}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
        className="focus-ring fixed left-4 top-4 z-40 grid h-10 w-10 place-items-center rounded-control border border-paper-line bg-paper-card shadow-node lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-night/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="surface absolute left-0 top-0 flex h-full w-72 flex-col">
            <div className="flex h-16 items-center justify-between border-b border-paper-line px-5">
              <Link href="/" aria-label={t.shell.home} className="focus-ring flex items-center rounded-control">
                <ContextaLogo />
              </Link>
              <button
                type="button"
                aria-label={t.shell.closeNav}
                onClick={() => setMobileOpen(false)}
                className="focus-ring grid h-9 w-9 place-items-center rounded-control border border-paper-line bg-paper-soft"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <nav aria-label={t.shell.mobileNav} className="flex-1 overflow-y-auto px-3 py-4">
              <div className="flex flex-col gap-1">
                {navigationItems.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  const active = isActiveRoute(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-control px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                        active
                          ? "bg-night text-white shadow-node"
                          : "text-ink-muted hover:bg-paper-soft hover:text-ink"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                      {t.shell.nav[item.labelKey]}
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="border-t border-paper-line p-3">
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-night ring-2 ring-white/60">
                  <span className="h-3 w-3 rounded-full border-[3px] border-accent" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {email || t.shell.signedIn}
                  </span>
                </span>
              </div>
              <div className="mt-2 flex flex-col gap-1">
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
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
