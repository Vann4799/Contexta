import type { Dictionary } from "@/locales/en";

export type NavIcon = "dashboard" | "pipeline" | "documents" | "chat" | "convert" | "apiKeys" | "usage";

export type NavLabelKey = keyof Dictionary["shell"]["nav"];

// Labels live in the dictionaries, so a nav item carries a key instead of display text.
export const navigationItems: { href: string; labelKey: NavLabelKey; icon: NavIcon }[] = [
  { href: "/", labelKey: "dashboard", icon: "dashboard" },
  { href: "/pipeline", labelKey: "pipeline", icon: "pipeline" },
  { href: "/documents", labelKey: "documents", icon: "documents" },
  { href: "/chat", labelKey: "chat", icon: "chat" },
  { href: "/convert", labelKey: "convert", icon: "convert" },
  { href: "/api-keys", labelKey: "apiKeys", icon: "apiKeys" },
  { href: "/usage", labelKey: "usage", icon: "usage" }
];
