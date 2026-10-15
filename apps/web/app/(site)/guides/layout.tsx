import type { Metadata } from "next";
import type { ReactNode } from "react";
import { branchMeta } from "@/lib/seo";

export const metadata: Metadata = branchMeta("/guides");

export default function PageLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
