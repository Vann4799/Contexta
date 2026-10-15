import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideView } from "@/components/public/guide-view";
import { PublicShell } from "@/components/public/public-shell";
import { GUIDE_SLUGS, isGuideSlug } from "@/lib/guides";
import { pageMeta } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isGuideSlug(slug)) {
    return {};
  }
  return pageMeta(`/guides/${slug}`, "id");
}

export default async function IndonesianGuidePage({ params }: Props) {
  const { slug } = await params;
  if (!isGuideSlug(slug)) {
    notFound();
  }

  // The (site) group's layout is not in this route's ancestry, so the shell is applied here.
  return (
    <PublicShell>
      <GuideView slug={slug} />
    </PublicShell>
  );
}
