"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  CreditCard,
  FileCode,
  FileText,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Plug,
  Search,
  Settings,
  Trash2,
  User,
  Waypoints,
  X,
  type LucideIcon
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { ContextaLogo } from "@/components/contexta-logo";
import { type DocumentItem } from "@/lib/api";
import { fetchDocuments } from "@/lib/document-store";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import type { Dictionary } from "@/locales/en";
import { navigationItems, secondaryNavItems, type NavIcon, type NavLabelKey } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  pipeline: Waypoints,
  documents: FileText,
  chat: MessageSquare,
  convert: FileCode,
  apiKeys: KeyRound,
  usage: BarChart3,
  billing: CreditCard,
  integrations: Plug,
  activity: Activity,
  trash: Trash2
};

type SearchLabelKey = NavLabelKey | "profile" | "settings" | "help";

const SEARCHABLE_PAGES: { href: string; labelKey: SearchLabelKey }[] = [
  { href: "/", labelKey: "dashboard" },
  { href: "/pipeline", labelKey: "pipeline" },
  { href: "/documents", labelKey: "documents" },
  { href: "/chat", labelKey: "chat" },
  { href: "/convert", labelKey: "convert" },
  { href: "/api-keys", labelKey: "apiKeys" },
  { href: "/usage", labelKey: "usage" },
  { href: "/billing", labelKey: "billing" },
  { href: "/integrations", labelKey: "integrations" },
  { href: "/activity", labelKey: "activity" },
  { href: "/profile", labelKey: "profile" },
  { href: "/settings", labelKey: "settings" },
  { href: "/help", labelKey: "help" }
];

function resolveSearchLabel(shell: Dictionary["shell"], key: SearchLabelKey): string {
  if (key === "profile" || key === "settings" || key === "help") return shell[key];
  return shell.nav[key];
}

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function isActiveRoute(pathname: string, href: string, search: string) {
  if (href.includes("?")) {
    const [hrefPath, hrefQuery] = href.split("?");
    return pathname === hrefPath && search === `?${hrefQuery}`;
  }
  if (pathname === "/documents" && search.includes("filter=trash")) {
    return false;
  }
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarSearch() {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<DocumentItem[]>([]);

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        const all = await fetchDocuments(token);
        if (!cancelled) setDocs(all.filter((d) => d.status !== "trashed"));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [getAccessToken]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    const pageResults = SEARCHABLE_PAGES
      .filter((p) => resolveSearchLabel(t.shell, p.labelKey).toLowerCase().includes(q))
      .slice(0, 3)
      .map((p) => ({ type: "page" as const, href: p.href, label: resolveSearchLabel(t.shell, p.labelKey) }));

    const docResults = docs
      .filter((d) => d.filename.toLowerCase().includes(q))
      .slice(0, 5)
      .map((d) => ({ type: "doc" as const, href: `/documents/${d.id}`, label: d.filename }));

    return [...pageResults, ...docResults].slice(0, 8);
  }, [query, t, docs]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative px-3 pb-2">
      <div className="flex items-center gap-2 rounded-control border border-paper-line bg-paper-soft px-2.5 py-1.5 transition-colors focus-within:border-night/30 focus-within:bg-paper-card">
        <Search className="h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={2} aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setTimeout(() => {
              setOpen(false);
              setQuery("");
            }, 150);
          }}
          placeholder={t.shell.searchPlaceholder}
          className="w-full bg-transparent text-[12.5px] text-ink placeholder:text-ink-muted/60 focus:outline-none"
          aria-label={t.shell.searchPlaceholder}
        />
        <kbd className="hidden shrink-0 rounded border border-paper-line bg-paper-card px-1 py-0.5 text-[10px] font-medium text-ink-muted sm:inline">
          ⌘K
        </kbd>
      </div>

      {open && results.length > 0 ? (
        <div className="surface absolute left-3 right-3 top-full z-50 mt-1 overflow-hidden">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.href}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                router.push(r.href);
                setOpen(false);
                setQuery("");
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium text-ink transition-colors hover:bg-paper-soft"
            >
              {r.type === "page" ? (
                <Search className="h-3 w-3 text-ink-muted" aria-hidden="true" />
              ) : (
                <FileText className="h-3 w-3 text-ink-muted" aria-hidden="true" />
              )}
              {r.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RecentDocsSection() {
  const t = useT();
  const [recentDocs, setRecentDocs] = useState<DocumentItem[]>([]);

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        const all = await fetchDocuments(token);
        if (!cancelled) {
          const sorted = all
            .filter((d) => d.status !== "trashed")
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .slice(0, 3);
          setRecentDocs(sorted);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [getAccessToken]);

  return (
    <div className="border-t border-paper-line px-3 py-3">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
          {t.shell.recentDocs}
        </span>
        <Link
          href="/documents"
          className="text-[10.5px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {t.shell.viewAllDocs}
        </Link>
      </div>
      <div className="flex flex-col gap-0.5">
        {recentDocs.length === 0 ? (
          <p className="px-2 py-1.5 text-[11.5px] text-ink-muted">{t.shell.noRecentDocs}</p>
        ) : (
          recentDocs.map((doc) => (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className="focus-ring flex items-center gap-2.5 rounded-control px-2 py-1.5 text-[12px] transition-colors hover:bg-paper-soft"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={2} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{doc.filename}</span>
              <span className="shrink-0 text-[10px] text-ink-muted">{formatRelativeTime(doc.updated_at)}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function UpgradeBanner() {
  const t = useT();
  const router = useRouter();

  return (
    <div className="px-3 pb-3">
      <div className="rounded-control border border-accent/30 bg-accent/5 p-3">
        <p className="text-[12px] font-semibold text-ink">{t.shell.upgradeTitle}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{t.shell.upgradeBody}</p>
        <button
          type="button"
          onClick={() => router.push("/billing")}
          className="focus-ring mt-2 flex items-center gap-1.5 rounded-control bg-night px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-node transition-colors hover:bg-night/90"
        >
          {t.shell.upgradeCta}
          <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString() ? `?${searchParams.toString()}` : "";
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
        <div className="flex h-14 items-center border-b border-paper-line px-3">
          <Link href="/dashboard" aria-label={t.shell.home} className="focus-ring flex items-center rounded-control">
            <ContextaLogo />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="py-3">
            <SidebarSearch />
          </div>

          <nav aria-label={t.shell.primaryNav} className="px-3 pb-2">
            <div className="flex flex-col gap-0.5">
              {navigationItems.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                const active = isActiveRoute(pathname, item.href, search);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "focus-ring flex items-center gap-3 rounded-control px-3 py-2 text-[13px] font-medium transition-colors",
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

          <div className="mx-3 border-t border-paper-line" />

          <nav aria-label={t.shell.secondaryNav} className="px-3 py-2">
            <div className="flex flex-col gap-0.5">
              {secondaryNavItems.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                const active = isActiveRoute(pathname, item.href, search);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "focus-ring flex items-center gap-3 rounded-control px-3 py-2 text-[13px] font-medium transition-colors",
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

          <RecentDocsSection />
        </div>

        <UpgradeBanner />

        <div className="border-t border-paper-line p-3">
          <div className="relative">
            <button
              type="button"
              aria-label={t.shell.accountMenu}
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((current) => !current)}
              className="focus-ring flex w-full items-center gap-3 rounded-control px-3 py-2 text-left transition-colors hover:bg-paper-soft"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-night ring-2 ring-white/60">
                <User className="h-4 w-4 text-accent" strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-ink">
                  {email || t.shell.signedIn}
                </span>
              </span>
            </button>

            {accountOpen ? (
              <div className="surface absolute bottom-full left-0 right-0 mb-2 p-2">
                <Link
                  href="/profile"
                  className={cn(
                    "flex items-center gap-2 rounded-control px-2.5 py-2 text-[13px] font-medium text-ink hover:bg-paper-soft",
                    isActiveRoute(pathname, "/profile", search) && "bg-paper-chip"
                  )}
                >
                  <User className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                  {t.shell.profile}
                </Link>
                <Link
                  href="/settings"
                  className={cn(
                    "flex items-center gap-2 rounded-control px-2.5 py-2 text-[13px] font-medium text-ink hover:bg-paper-soft",
                    isActiveRoute(pathname, "/settings", search) && "bg-paper-chip"
                  )}
                >
                  <Settings className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                  {t.shell.settings}
                </Link>
                <Link
                  href="/help"
                  className="flex items-center gap-2 rounded-control px-2.5 py-2 text-[13px] font-medium text-ink hover:bg-paper-soft"
                >
                  <HelpCircle className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                  {t.shell.help}
                </Link>
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
            <div className="flex h-14 items-center justify-between border-b border-paper-line px-3">
              <Link href="/dashboard" aria-label={t.shell.home} className="focus-ring flex items-center rounded-control">
                <ContextaLogo />
              </Link>
              <button
                type="button"
                aria-label={t.shell.closeNav}
                onClick={() => setMobileOpen(false)}
                className="focus-ring grid h-8 w-8 place-items-center rounded-control border border-paper-line bg-paper-soft"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="py-3">
                <SidebarSearch />
              </div>

              <nav aria-label={t.shell.mobileNav} className="px-3 pb-2">
                <div className="flex flex-col gap-0.5">
                  {navigationItems.map((item) => {
                    const Icon = NAV_ICONS[item.icon];
                    const active = isActiveRoute(pathname, item.href, search);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-control px-3 py-2 text-[13px] font-medium transition-colors",
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

              <div className="mx-3 border-t border-paper-line" />

              <nav aria-label={t.shell.secondaryNav} className="px-3 py-2">
                <div className="flex flex-col gap-0.5">
                  {secondaryNavItems.map((item) => {
                    const Icon = NAV_ICONS[item.icon];
                    const active = isActiveRoute(pathname, item.href, search);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-control px-3 py-2 text-[13px] font-medium transition-colors",
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

              <RecentDocsSection />
            </div>

            <UpgradeBanner />

            <div className="border-t border-paper-line p-3">
              <div className="relative">
                <button
                  type="button"
                  aria-label={t.shell.accountMenu}
                  aria-expanded={accountOpen}
                  onClick={() => setAccountOpen((current) => !current)}
                  className="focus-ring flex w-full items-center gap-3 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-paper-soft"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-night ring-2 ring-white/60">
                    <User className="h-4 w-4 text-accent" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-ink">
                      {email || t.shell.signedIn}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-ink-muted transition-transform",
                      accountOpen && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </button>

                {accountOpen ? (
                  <div className="surface absolute bottom-full left-0 right-0 mb-2 p-2">
                    <Link
                      href="/profile"
                      className={cn(
                        "flex items-center gap-2 rounded-control px-2.5 py-2 text-[13px] font-medium text-ink hover:bg-paper-soft",
                        isActiveRoute(pathname, "/profile", search) && "bg-paper-chip"
                      )}
                    >
                      <User className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                      {t.shell.profile}
                    </Link>
                    <Link
                      href="/settings"
                      className={cn(
                        "flex items-center gap-2 rounded-control px-2.5 py-2 text-[13px] font-medium text-ink hover:bg-paper-soft",
                        isActiveRoute(pathname, "/settings", search) && "bg-paper-chip"
                      )}
                    >
                      <Settings className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                      {t.shell.settings}
                    </Link>
                    <Link
                      href="/help"
                      className="flex items-center gap-2 rounded-control px-2.5 py-2 text-[13px] font-medium text-ink hover:bg-paper-soft"
                    >
                      <HelpCircle className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                      {t.shell.help}
                    </Link>
                    <div className="mt-1 flex justify-end border-t border-paper-line px-2 pt-2">
                      <LogoutButton />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
