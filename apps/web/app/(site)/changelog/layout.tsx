import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("/changelog");

export default function PageLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
