import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { AuthCallbackForwarder } from "@/components/auth/auth-callback-forwarder";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const secondary = Inter({ subsets: ["latin"], variable: "--font-secondary", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

// The dashboard's data calls only start once client JS has booted (~700 ms in), and each one
// then pays its own DNS+TCP+TLS to the VPS. Warming that origin while the HTML parses takes
// the handshake off the critical path. A relative base (/api/proxy) is this same origin.
function apiOriginHint() {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? "").origin;
  } catch {
    return "";
  }
}

const apiOrigin = apiOriginHint();

// An array, not sibling elements: JSX would choke on the whitespace between them.
function apiOriginHints(): ReactNode[] {
  if (!apiOrigin) return [];
  return [
    <link key="preconnect" rel="preconnect" href={apiOrigin} crossOrigin="anonymous" />,
    <link key="lookup" rel="dns-prefetch" href={apiOrigin} />
  ];
}

// The bearer token is the only thing these requests need, and it is sitting in localStorage
// before any framework code runs. Waiting for hydration to read it costs ~2 s of wall clock on
// a throttled phone, so the calls are issued from a blocking script in <head> at parse time.
// lib/boot-prefetch.ts hands the parked promises back to the data layer, which keeps owning the
// TTL, the in-flight dedupe and invalidation.
function bootPrefetchSource(): string | null {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!apiBase || !supabaseUrl) {
    return null;
  }

  let sessionKey: string;
  try {
    // Same derivation supabase-js uses for its default storage key.
    sessionKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }

  return [
    "(function(){try{",
    // Only routes whose first paint is a data wall; every other page keeps its current timing
    // instead of spending a socket on a response nobody renders yet.
    "if(!/^\\/dashboard\\/?$/.test(location.pathname))return;",
    `var s=localStorage.getItem(${JSON.stringify(sessionKey)});if(!s)return;`,
    "var j=JSON.parse(s);",
    "var t=j.access_token||(j.currentSession&&j.currentSession.access_token);if(!t)return;",
    // An expired token would only come back 401 while the framework refreshes it; leaving the
    // slot empty hands the load to the data layer, exactly as before.
    "if(j.expires_at&&j.expires_at*1E3<=Date.now())return;",
    `var o={},b=${JSON.stringify(apiBase)};window.__CTXA_BOOT__={token:t,requests:o};`,
    "function go(n,p){var q=fetch(b+p,{cache:'no-store',headers:{Authorization:'Bearer '+t}})",
    ".then(function(r){return r.ok?r.json():Promise.reject(new Error('boot'))});",
    // An unconsumed rejection must never reach the console: only a caller that adopts the
    // promise cares that it failed.
    "q.catch(function(){});o[n]=q}",
    "go('documents','/documents');",
    "go('accountSummary','/account/summary');",
    "go('indexingHealth','/health/indexing');",
    "}catch(e){}})();",
  ].join("");
}

const bootPrefetch = bootPrefetchSource();

export const metadata: Metadata = {
  title: "Contexta",
  description: "Chat with PDF and DOCX documents using grounded citations."
};

export const viewport: Viewport = {
  themeColor: "#ebe8df"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${secondary.variable} ${mono.variable}`}>
      {/* Next appends layout head children after its own tags, so this still runs once the
          render-blocking stylesheet has landed (~0.4 s measured). That is the point: the request
          stops waiting for 388 kB of framework to parse and execute first (~2.3 s). */}
      <head>{bootPrefetch ? <script dangerouslySetInnerHTML={{ __html: bootPrefetch }} /> : null}</head>
      <body>
        {apiOriginHints()}
        <I18nProvider>
          <AuthCallbackForwarder />
          {children}
          <CookieConsent />
        </I18nProvider>
      </body>
    </html>
  );
}
