"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/lib/navigation";

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="mt-8 space-y-1" aria-label="Primary">
      {navigationItems.map((item) => {
        const isActive = isActiveRoute(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded px-3 py-2 text-sm font-medium transition ${
              isActive ? "bg-blue-50 text-primary" : "text-subtle hover:bg-muted hover:text-ink"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
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
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-white md:hidden" aria-label="Mobile primary">
      {navigationItems.map((item) => {
        const isActive = isActiveRoute(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`min-w-0 px-1 py-2 text-center text-xs font-medium ${
              isActive ? "bg-blue-50 text-primary" : "text-subtle hover:bg-muted hover:text-ink"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="block truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
