import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideView } from "@/components/public/guide-view";
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
  return pageMeta(`/guides/${slug}`, "en");
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  if (!isGuideSlug(slug)) {
    notFound();
  }

  return <GuideView slug={slug} />;
}
