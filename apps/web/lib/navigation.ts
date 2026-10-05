export type NavIcon = "dashboard" | "documents" | "chat" | "convert" | "settings";

export const navigationItems: { href: string; label: string; icon: NavIcon }[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/documents", label: "Documents", icon: "documents" },
  { href: "/chat", label: "Chat", icon: "chat" },
  { href: "/convert", label: "Convert", icon: "convert" },
  { href: "/settings", label: "Settings", icon: "settings" }
];
