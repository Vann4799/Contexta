export type NavIcon = "dashboard" | "pipeline" | "documents" | "chat" | "convert";

export const navigationItems: { href: string; label: string; icon: NavIcon }[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
  { href: "/documents", label: "Documents", icon: "documents" },
  { href: "/chat", label: "Chat", icon: "chat" },
  { href: "/convert", label: "Convert", icon: "convert" }
];
