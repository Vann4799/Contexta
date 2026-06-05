"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/lib/navigation";

const navIcons: Record<string, string> = {
  Dashboard: "M4 5h7v7H4V5Zm2 2v3h3V7H6Zm7-2h7v7h-7V5Zm2 2v3h3V7h-3ZM4 14h7v7H4v-7Zm2 2v3h3v-3H6Zm7-2h7v7h-7v-7Zm2 2v3h3v-3h-3Z",
  Documents: "M6 3h8l5 5v13H6V3Zm2 2v16h9V9h-4V5H8Zm2 8h5v2h-5v-2Zm0 4h5v2h-5v-2Z",
  Chat: "M4 5h16v11H8l-4 4V5Zm2 2v8.2L7.2 14H18V7H6Zm3 3h8v2H9v-2Z",
  Settings: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm8 2a7.8 7.8 0 0 1-.2 1.6l2 1.5-2 3.5-2.4-1a8.3 8.3 0 0 1-1.4.8L15.6 22h-4l-.4-2.6a8.3 8.3 0 0 1-1.4-.8l-2.4 1-2-3.5 2-1.5A7.8 7.8 0 0 1 7.2 12c0-.5.1-1.1.2-1.6l-2-1.5 2-3.5 2.4 1c.4-.3.9-.6 1.4-.8L11.6 3h4l.4 2.6c.5.2 1 .5 1.4.8l2.4-1 2 3.5-2 1.5c.1.5.2 1.1.2 1.6Z"
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
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={navIcons[item.label]} />
            </svg>
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
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-[#c3c6d7] bg-white md:hidden" aria-label="Mobile primary">
      {navigationItems.map((item) => {
        const isActive = isActiveRoute(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`min-w-0 px-1 py-2 text-center text-xs font-medium ${
              isActive ? "bg-[#dce2f3] text-primary" : "text-subtle hover:bg-muted hover:text-ink"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <svg className="mx-auto mb-1 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={navIcons[item.label]} />
            </svg>
            <span className="block truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
