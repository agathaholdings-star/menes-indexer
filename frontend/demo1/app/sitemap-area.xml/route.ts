import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { toSitemapXml, xmlResponse, BASE_URL } from "@/lib/sitemap-utils";

export const revalidate = 86400;

export async function GET() {
  const now = new Date();

  // 都道府県（サロンがあるエリアを持つ県のみ）
  const { data: prefectures } = await supabase
    .from("prefectures")
    .select("slug, areas!inner(id)")
    .gt("areas.salon_count", 0);

  const uniquePrefSlugs = [...new Set((prefectures || []).map((p) => p.slug))];
  const prefEntries = uniquePrefSlugs.map((slug) => ({
    url: `${BASE_URL}/area/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // エリア
  const { data: areas } = await supabase
    .from("areas")
    .select("slug, prefectures(slug)")
    .gt("salon_count", 0);

  const areaEntries = (areas || []).map((a) => {
    const prefSlug = (a.prefectures as unknown as { slug: string } | null)?.slug || "";
    return {
      url: `${BASE_URL}/area/${prefSlug}/${a.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    };
  });

  return xmlResponse(toSitemapXml([...prefEntries, ...areaEntries]));
}
