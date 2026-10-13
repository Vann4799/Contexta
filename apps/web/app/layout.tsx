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
