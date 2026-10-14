import { PublicShell } from "@/components/public/public-shell";
import type { ReactNode } from "react";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
