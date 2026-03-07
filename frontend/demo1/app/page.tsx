import { HomePageClient } from "@/components/home/home-page-client";
import { getAllAreasGrouped } from "@/lib/supabase-data";

export const revalidate = 86400; // 1 day

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "メンエスSKR",
  "url": "https://menes-skr.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://menes-skr.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

export default async function HomePage() {
  const { areasGrouped, popularAreas, regionOrder } = await getAllAreasGrouped();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <HomePageClient
        areasGrouped={areasGrouped}
        popularAreas={popularAreas}
        regionOrder={regionOrder}
      />
    </>
  );
}
