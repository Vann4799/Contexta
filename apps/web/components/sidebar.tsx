"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  FileCode,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Settings,
  User,
  Waypoints,
  type LucideIcon
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type SidebarItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
};

const MENU_ITEMS: SidebarItem[] = [
  { href: "/", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/pipeline", labelKey: "pipeline", icon: Waypoints },
  { href: "/documents", labelKey: "documents", icon: FileText },
  { href: "/chat", labelKey: "chat", icon: MessageSquare },
  { href: "/convert", labelKey: "convert", icon: FileCode }
];

const MANAGE_ITEMS: SidebarItem[] = [
  { href: "/profile", labelKey: "profile", icon: User },
  { href: "/settings", labelKey: "settings", icon: Settings }
];

function isActiveRoute(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function resolveLabel(labelKey: string, t: ReturnType<typeof useT>): string {
  const navLabels = t.shell.nav as Record<string, string>;
  if (labelKey in navLabels) {
    return navLabels[labelKey];
  }

  const shellLabels = { profile: t.shell.profile, settings: t.shell.settings } as Record<string, string>;
  if (labelKey in shellLabels) {
    return shellLabels[labelKey];
  }

  return labelKey;
}

function SidebarNav({ items, activePathname }: { items: SidebarItem[]; activePathname: string }) {
  const t = useT();

  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(activePathname, item.href);
        const label = resolveLabel(item.labelKey, t);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-[13.5px] font-medium transition-all",
              active
                ? "bg-brand-orange text-white shadow-orange-sm"
                : "text-brand-muted hover:bg-[#1A1A22] hover:text-white"
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </>
  );
}

function SidebarSectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 px-3 mb-2.5">
      <span className="text-[11px] font-semibold tracking-wider text-brand-muted uppercase">{children}</span>
      <div className="h-px flex-1 bg-[#202029]" />
    </div>
  );
}

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const t = useT();

  return (
    <aside className="hidden w-full shrink-0 bg-[#121216] lg:flex lg:w-[285px] lg:flex-col lg:border-r lg:border-[#21212A] lg:p-6">
      <div className="flex flex-col">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-orange to-[#FF7A1A] p-[2px] shadow-orange-sm">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-brand-card">
              <Database className="h-5 w-5 text-brand-orange" strokeWidth={2.2} aria-hidden="true" />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-bold tracking-tight text-white">Contexta</span>
            <span className="inline-block h-2 w-2 rounded-full bg-brand-orange shadow-orange-sm" />
          </div>
        </div>

        <div className="mb-6">
          <SidebarSectionLabel>{t.shell.nav.dashboard === "Dashboard" ? "Menu" : "Menu"}</SidebarSectionLabel>
          <nav className="space-y-1">
            <SidebarNav items={MENU_ITEMS} activePathname={pathname} />
          </nav>
        </div>

        <div className="mb-6">
          <SidebarSectionLabel>Manage</SidebarSectionLabel>
          <nav className="space-y-1">
            <SidebarNav items={MANAGE_ITEMS} activePathname={pathname} />
          </nav>
        </div>
      </div>

      <div className="mt-auto">
        <div className="rounded-2xl border border-[#272733] bg-[#191920] p-4">
          <div className="relative z-10">
            <h4 className="mb-1.5 text-sm font-semibold text-white">Contexta Enterprise</h4>
            <p className="mb-3.5 text-[12px] leading-relaxed text-brand-muted">
              Empower your LLM apps with unlimited indexing and real-time chunking.
            </p>
            <div className="mb-2 truncate text-[11px] text-brand-muted">{email || t.shell.signedIn}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileSidebar({
  open,
  onClose,
  email
}: {
  open: boolean;
  onClose: () => void;
  email: string;
}) {
  const pathname = usePathname();
  const t = useT();

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="absolute left-0 top-0 flex h-full w-[285px] flex-col bg-[#121216] p-6">
        <div className="flex flex-col">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-orange to-[#FF7A1A] p-[2px] shadow-orange-sm">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-brand-card">
                <Database className="h-5 w-5 text-brand-orange" strokeWidth={2.2} aria-hidden="true" />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold tracking-tight text-white">Contexta</span>
              <span className="inline-block h-2 w-2 rounded-full bg-brand-orange shadow-orange-sm" />
            </div>
          </div>

          <div className="mb-6">
            <SidebarSectionLabel>Menu</SidebarSectionLabel>
            <nav className="space-y-1">
              <SidebarNav items={MENU_ITEMS} activePathname={pathname} />
            </nav>
          </div>

          <div className="mb-6">
            <SidebarSectionLabel>Manage</SidebarSectionLabel>
            <nav className="space-y-1">
              <SidebarNav items={MANAGE_ITEMS} activePathname={pathname} />
            </nav>
          </div>
        </div>

        <div className="mt-auto">
          <div className="truncate text-[11px] text-brand-muted">{email || t.shell.signedIn}</div>
        </div>
      </aside>
    </div>
  );
}
