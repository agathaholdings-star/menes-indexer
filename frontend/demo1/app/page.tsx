import { HomePageClient } from "@/components/home/home-page-client";
import { getAllAreasGrouped } from "@/lib/supabase-data";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { cleanTherapistName, isPlaceholderName } from "@/lib/therapist-utils";

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

async function getLatestReviews() {
  const { data } = await supabaseAdmin
    .from("reviews")
    .select(
      "id, score, comment_first_impression, created_at, therapist_id, therapists(name, image_urls, salon_id, salons(name))"
    )
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(5);

  return data ?? [];
}

async function getTopReviewedSalons() {
  const { data } = await supabaseAdmin
    .from("salons")
    .select(`
      id,
      name,
      display_name,
      access,
      therapist_count,
      review_count,
      salon_areas!inner(areas!inner(name))
    `)
    .gt("review_count", 0)
    .not("published_at", "is", null)
    .order("review_count", { ascending: false })
    .limit(8);

  return (data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    display_name: s.display_name,
    access: s.access,
    review_count: s.review_count || 0,
    therapist_count: s.therapist_count || 0,
    area_name: s.salon_areas?.[0]?.areas?.name || null,
  }));
}

async function getSidebarData() {
  const [{ data: rawTherapists }, { data: rawSalons }] = await Promise.all([
    supabaseAdmin
      .from("therapists")
      .select("id, name, image_urls, salons(name, display_name)")
      .eq("status", "active")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(30), // fetch extra to account for filtering
    supabaseAdmin
      .from("salons")
      .select("id, name, display_name, slug, access")
      .eq("is_active", true)
      .not("published_at", "is", null)
      .order("review_count", { ascending: false })
      .limit(5),
  ]);

  const therapists = (rawTherapists ?? [])
    .filter((t: any) => {
      if (!t.name || isPlaceholderName(t.name)) return false;
      const cleaned = cleanTherapistName(t.name);
      if (cleaned.length > 15) return false;
      const shop = t.salons as { name: string; display_name: string | null } | null;
      if (shop && (cleaned === shop.name || cleaned === shop.display_name)) return false;
      return true;
    })
    .slice(0, 5)
    .map((t: any) => {
      const imgs = t.image_urls as string[] | null;
      const shop = t.salons as { name: string; display_name: string | null } | null;
      return {
        id: Number(t.id),
        name: cleanTherapistName(t.name),
        image_url: imgs?.[0] || null,
        shop_name: shop?.display_name || shop?.name || "",
      };
    });

  const salons = (rawSalons ?? []).map((s: any) => ({
    id: Number(s.id),
    name: s.name as string,
    display_name: s.display_name as string | null,
    slug: s.slug as string | null,
    access: s.access as string | null,
  }));

  return { therapists, salons };
}

export default async function HomePage() {
  const [{ areasGrouped, popularAreas, regionOrder }, latestReviews, topReviewedSalons, sidebarData] =
    await Promise.all([getAllAreasGrouped(), getLatestReviews(), getTopReviewedSalons(), getSidebarData()]);

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
        latestReviews={latestReviews}
        topReviewedSalons={topReviewedSalons}
        initialSidebarTherapists={sidebarData.therapists}
        initialSidebarShops={sidebarData.salons}
      />
    </>
  );
}
