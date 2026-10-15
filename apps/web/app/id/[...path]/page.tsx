import type { Metadata } from "next";
import type { ComponentType } from "react";
import AboutPage from "@/app/(site)/about/page";
import BlogPage from "@/app/(site)/blog/page";
import CareersPage from "@/app/(site)/careers/page";
import ChangelogPage from "@/app/(site)/changelog/page";
import ContactPage from "@/app/(site)/contact/page";
import DocsPage from "@/app/(site)/docs/page";
import ApiDocsPage from "@/app/(site)/docs/api/page";
import GdprPage from "@/app/(site)/gdpr/page";
import GuidesPage from "@/app/(site)/guides/page";
import PricingPage from "@/app/(site)/pricing/page";
import SecurityPage from "@/app/(site)/security/page";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import { PublicShell } from "@/components/public/public-shell";
import { pageMeta } from "@/lib/seo";
import type { PublicPath } from "@/lib/site";

/**
 * The Indonesian twin of every indexed English page, as one catch-all.
 *
 * Keyed by the same union lib/seo's copy table uses, so a page added to the public list without an
 * Indonesian route here is a compile error rather than a dangling hreflang link in the wild.
 *
 * `shell` is the only per-page difference: the (site) group gets its navigation from a layout this
 * route does not sit under, so it is applied here, while the legal pages already render their own
 * LegalShell and must not be wrapped twice.
 */
const ROUTES: Record<Exclude<PublicPath, "/">, { page: ComponentType; shell: boolean }> = {
  "/about": { page: AboutPage, shell: true },
  "/blog": { page: BlogPage, shell: true },
  "/careers": { page: CareersPage, shell: true },
  "/changelog": { page: ChangelogPage, shell: true },
  "/contact": { page: ContactPage, shell: true },
  "/docs": { page: DocsPage, shell: true },
  "/docs/api": { page: ApiDocsPage, shell: true },
  "/gdpr": { page: GdprPage, shell: true },
  "/guides": { page: GuidesPage, shell: true },
  "/pricing": { page: PricingPage, shell: true },
  "/security": { page: SecurityPage, shell: true },
  "/privacy": { page: PrivacyPage, shell: false },
  "/terms": { page: TermsPage, shell: false }
};

type IdPath = keyof typeof ROUTES;

export const dynamicParams = false;

export function generateStaticParams() {
  return (Object.keys(ROUTES) as IdPath[]).map((path) => ({ path: path.slice(1).split("/") }));
}

function toPath(segments: string[]): IdPath {
  return `/${segments.join("/")}` as IdPath;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ path: string[] }>;
}): Promise<Metadata> {
  const { path } = await params;
  return pageMeta(toPath(path), "id");
}

export default async function IndonesianPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const route = ROUTES[toPath(path)];
  const Page = route.page;

  if (!route.shell) {
    return <Page />;
  }

  return (
    <PublicShell>
      <Page />
    </PublicShell>
  );
}
