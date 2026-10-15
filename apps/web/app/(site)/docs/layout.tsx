import type { Metadata } from "next";
import type { ReactNode } from "react";
import { branchMeta } from "@/lib/seo";

export const metadata: Metadata = branchMeta("/docs");

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
