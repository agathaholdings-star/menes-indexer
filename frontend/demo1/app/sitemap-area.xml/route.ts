import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { toSitemapXml, xmlResponse, BASE_URL } from "@/lib/sitemap-utils";

export const revalidate = 3600;

export async function GET() {
  // 都道府県（サロンがあるエリアを持つ県のみ）+ 各県の最新エリア更新日
  const { data: prefectures } = await supabase
    .from("prefectures")
    .select("slug, areas!inner(id, updated_at)")
    .gt("areas.salon_count", 0);

  // 都道府県ごとの最新 updated_at を計算
  const prefLastModMap = new Map<string, Date>();
  for (const p of prefectures || []) {
    const areasArr = p.areas as unknown as { id: number; updated_at: string }[];
    const maxDate = areasArr.reduce((latest, a) => {
      const d = new Date(a.updated_at);
      return d > latest ? d : latest;
    }, new Date(0));
    const existing = prefLastModMap.get(p.slug);
    if (!existing || maxDate > existing) {
      prefLastModMap.set(p.slug, maxDate);
    }
  }

  const uniquePrefSlugs = [...new Set((prefectures || []).map((p) => p.slug))];
  const prefEntries = uniquePrefSlugs.map((slug) => ({
    url: `${BASE_URL}/area/${slug}`,
    lastModified: prefLastModMap.get(slug) || new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // エリア
  const { data: areas } = await supabase
    .from("areas")
    .select("slug, updated_at, prefectures(slug)")
    .gt("salon_count", 0);

  const areaEntries = (areas || []).map((a) => {
    const prefSlug = (a.prefectures as unknown as { slug: string } | null)?.slug || "";
    return {
      url: `${BASE_URL}/area/${prefSlug}/${a.slug}`,
      lastModified: a.updated_at ? new Date(a.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    };
  });

  return xmlResponse(toSitemapXml([...prefEntries, ...areaEntries]));
}
