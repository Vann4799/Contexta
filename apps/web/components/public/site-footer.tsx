"use client";

import Link from "next/link";
import { ContextaLogo } from "@/components/contexta-logo";
import { useT } from "@/lib/i18n";

// Single source for the footer so a link can no longer exist in the markup but not in the router.
// The "#" entries are sections of the landing page; off the landing they have to become "/#…".
export const FOOTER_COLUMNS = [
  {
    key: "product",
    links: [
      { key: "features", href: "#features" },
      { key: "howItWorks", href: "#how-it-works" },
      { key: "pricing", href: "/pricing" },
      { key: "changelog", href: "/changelog" },
    ],
  },
  {
    key: "company",
    links: [
      { key: "about", href: "/about" },
      { key: "blog", href: "/blog" },
      { key: "careers", href: "/careers" },
      { key: "contact", href: "/contact" },
    ],
  },
  {
    key: "resources",
    links: [
      { key: "documentation", href: "/docs" },
      { key: "apiReference", href: "/docs/api" },
      { key: "guides", href: "/guides" },
      { key: "support", href: "/help" },
    ],
  },
  {
    key: "legal",
    links: [
      { key: "privacy", href: "/privacy" },
      { key: "terms", href: "/terms" },
      { key: "security", href: "/security" },
      { key: "gdpr", href: "/gdpr" },
    ],
  },
] as const;

function resolveHref(href: string, onLanding: boolean): string {
  if (onLanding || !href.startsWith("#")) {
    return href;
  }

  return `/${href}`;
}

export function SiteFooter({ onLanding = false }: { onLanding?: boolean }) {
  const t = useT();
  const copy = t.site.footer;

  return (
    <footer className="bg-night text-paper/70">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-6">
          <div className="md:col-span-2">
            <ContextaLogo variant="dark" size={140} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-paper/50">{copy.tagline}</p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.key}>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-paper/40">
                {copy.columns[column.key]}
              </h4>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.key}>
                    <Link
                      href={resolveHref(link.href, onLanding)}
                      className="block py-1 text-sm text-paper/60 transition-colors hover:text-paper"
                    >
                      {copy.links[link.key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-paper/10 pt-8 md:flex-row">
          <p className="text-xs text-paper/40">{copy.rights}</p>
          <Link href="/contact" className="text-xs text-paper/40 transition-colors hover:text-paper">
            {copy.contactCta}
          </Link>
        </div>
      </div>
    </footer>
  );
}
