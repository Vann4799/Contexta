import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";

export const SITE_NAME = "Contexta";

/**
 * The head for every public URL, in one table.
 *
 * A page's title and description have to describe what the page actually renders, so each entry
 * is derived from that page's own H1 and lede in locales/en.ts (`site.*`). Changing a heading
 * without changing the matching entry here is how a snippet starts lying.
 *
 * Titles are the base only: the root layout's template appends ` — Contexta`, so keep the base
 * near 48 characters to land the rendered title inside the 50-60 the SERP shows.
 */
const PAGES: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Chat with your PDF and DOCX documents",
    description:
      "Upload a PDF or Word document, ask it questions, and get answers that cite the page and section they came from. Summaries, an API, and full corpus export."
  },
  "/about": {
    title: "About: what Contexta is and what it will not do",
    description:
      "Contexta indexes PDFs and DOCX files so you can ask them questions and get answers that point back at the page they came from. Who runs it, and why."
  },
  "/blog": {
    title: "Blog: engineering notes from building Contexta",
    description:
      "Short write-ups about decisions we actually made, with the measurement that forced them: a deleted chart library, token budgets, a paywall the server agrees with."
  },
  "/careers": {
    title: "Careers: no open roles right now",
    description:
      "Contexta is run by a small independent team, and the work in flight is not something we can hand to someone we have not worked with yet."
  },
  "/changelog": {
    title: "Changelog: what shipped, newest first",
    description:
      "Written from the commits that shipped, newest first. Deployment dates, not plan dates: indexing, chat quality, billing, and the workspace redesign."
  },
  "/contact": {
    title: "Contact: how to actually reach us",
    description:
      "Contexta has no public support inbox yet. Rather than print an address nobody reads, these are the in-app routes that actually reach the product."
  },
  "/docs": {
    title: "Documentation: guides, API reference and help",
    description:
      "Everything written down about Contexta in one place: the three-step first answer, four guides, the API reference, the help centre, plans and limits."
  },
  "/docs/api": {
    title: "API reference: retrieval you can call",
    description:
      "The same retrieval the chat uses, behind a bearer token: authentication, the /v1 endpoints, error codes, quota headers, and the MCP tools."
  },
  "/gdpr": {
    title: "GDPR: your data in plain operational terms",
    description:
      "What we hold, for how long, and the exact screens you can use to exercise each right: controller, processors, export, deletion, and the 90-day log window."
  },
  "/guides": {
    title: "Guides: upload to first answer and citations",
    description:
      "Four short, ordered steps, each ending on a screen you can open right now: upload to first answer, reading a citation, using an API key, exporting your data."
  },
  "/pricing": {
    title: "Pricing: the five limits the server enforces",
    description:
      "Every plan gets the same product. The tiers differ in five limits the server actually enforces: documents, storage, API keys, API requests and chat messages."
  },
  "/privacy": {
    title: "Privacy Policy",
    description:
      "What Contexta collects and why, who processes your text, how long it is kept, cookies, international transfers, and how to export or delete your data."
  },
  "/security": {
    title: "Security: what is protected, what is not claimed",
    description:
      "Hashed API keys, row-level security, per-key quotas and scoped access, plus a plain list of what Contexta is not certified as, and cannot promise today."
  },
  "/terms": {
    title: "Terms of Service",
    description:
      "The agreement for a Contexta account: acceptable use, ownership of your documents, how generated answers are treated, billing, termination and liability."
  }
};

export const PUBLIC_PATHS = Object.keys(PAGES);

/** `%s — Contexta`, the template the root layout applies to every child title. */
export const TITLE_TEMPLATE = `%s — ${SITE_NAME}`;

// Same file and dimensions as app/opengraph-image.tsx. Declaring it here rather than relying on
// the file-based tag: a segment that sets its own `openGraph` object does not inherit it.
const SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — your documents, understood by AI`
};

/** The pages search should see. Everything else under app/ is noindex by the root default. */
export function pageMeta(path: string): Metadata {
  const page = PAGES[path];
  if (!page) throw new Error(`No SEO copy registered for ${path}`);

  const ogTitle = `${page.title} — ${SITE_NAME}`;
  const absolute = `${siteUrl()}${path}`;

  return {
    title: page.title,
    description: page.description,
    robots: { index: true, follow: true },
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: absolute,
      siteName: SITE_NAME,
      locale: "en_US",
      title: ogTitle,
      description: page.description,
      images: [SHARE_IMAGE]
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: page.description,
      images: [SHARE_IMAGE]
    }
  };
}

/**
 * For a layout that has indexed children of its own (/docs -> /docs/api). A parent that declares
 * `title` as a plain string becomes the title template for its descendants, so the child's
 * rendered title loses ` — Contexta`. Re-declaring it as an explicit branch keeps the suffix.
 */
export function branchMeta(path: string): Metadata {
  return { ...pageMeta(path), title: { default: PAGES[path].title, template: TITLE_TEMPLATE } };
}
