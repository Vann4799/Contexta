import { PRICING_TIERS } from "@/lib/pricing";
import { SITE_NAME } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

/**
 * Structured data, kept to what the product does today: no rating, no review count, no
 * certification and no social profiles, because none of those exist to point at.
 *
 * Offers come from lib/pricing, so a tier the server refuses to sell cannot appear as purchasable
 * here either.
 */
function organization(url: string) {
  return {
    "@type": "Organization",
    "@id": `${url}/#organization`,
    name: SITE_NAME,
    url,
    logo: {
      "@type": "ImageObject",
      "@id": `${url}/#logo`,
      url: `${url}/contexta-neon-logo.png`,
      width: 1972,
      height: 724,
      caption: SITE_NAME
    }
  };
}

function webSite(url: string) {
  return {
    "@type": "WebSite",
    "@id": `${url}/#website`,
    url,
    name: SITE_NAME,
    inLanguage: "en",
    publisher: { "@id": `${url}/#organization` }
  };
}

function application(url: string) {
  const offers = PRICING_TIERS.filter((tier) => tier.sellable).map((tier) => ({
    "@type": "Offer",
    name: tier.tier,
    price: String(tier.priceMonthly),
    priceCurrency: "USD",
    url: `${url}/pricing`,
    category: "subscription"
  }));

  return {
    "@type": "SoftwareApplication",
    "@id": `${url}/#app`,
    name: SITE_NAME,
    url,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "Chat with PDF and DOCX documents and get answers that cite the page they came from.",
    offers
  };
}

export function SiteJsonLd() {
  const url = siteUrl();
  const graph = {
    "@context": "https://schema.org",
    "@graph": [organization(url), webSite(url), application(url)]
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
  );
}
