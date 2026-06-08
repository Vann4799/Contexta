"use client";

import Link from "next/link";
import { FileCode, FileText, LayoutDashboard, MessageSquare, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/lib/navigation";

const navIcons: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Documents: FileText,
  Convert: FileCode,
  Chat: MessageSquare,
  Settings
};

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
      {navigationItems.map((item) => {
        const isActive = isActiveRoute(pathname, item.href);
        const Icon = navIcons[item.label] ?? FileText;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded px-3 py-3 text-sm font-semibold transition ${
              isActive
                ? "border-r-2 border-primary bg-[#dce2f3]/70 text-primary"
                : "text-subtle hover:bg-white/70 hover:text-ink"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[#c3c6d7] bg-white md:hidden" aria-label="Mobile primary">
      {navigationItems.map((item) => {
        const isActive = isActiveRoute(pathname, item.href);
        const Icon = navIcons[item.label] ?? FileText;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`min-w-0 px-1 py-2 text-center text-xs font-medium ${
              isActive ? "bg-[#dce2f3] text-primary" : "text-subtle hover:bg-muted hover:text-ink"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="mx-auto mb-1 h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <span className="block truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
