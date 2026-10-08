import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AuthCallbackForwarder } from "@/components/auth/auth-callback-forwarder";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Contexta",
  description: "Chat with PDF and DOCX documents using grounded citations."
};

export const viewport: Viewport = {
  themeColor: "#ebe8df"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <I18nProvider>
          <AuthCallbackForwarder />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
