import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthCallbackForwarder } from "@/components/auth/auth-callback-forwarder";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contexta",
  description: "Chat with PDF and DOCX documents using grounded citations."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&family=Public+Sans:wght@400..600&family=JetBrains+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthCallbackForwarder />
        {children}
      </body>
    </html>
  );
}
