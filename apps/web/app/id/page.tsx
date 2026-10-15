import type { Metadata } from "next";
import Landing from "@/app/(marketing)/page";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("/", "id");

// The landing page is the one public page that carries its own navigation and footer, which is
// why it is a route of its own instead of falling into the [...path] tree below.
export default function IndonesianLandingPage() {
  return <Landing />;
}
