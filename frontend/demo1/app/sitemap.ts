import type { MetadataRoute } from "next";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://menes-skr.com";

  // 静的ページ
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/area`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/ranking`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  // 都道府県ページ（サロンがあるエリアを持つ県のみ）
  const { data: prefectures } = await supabase
    .from("prefectures")
    .select("slug, areas!inner(id)")
    .gt("areas.salon_count", 0);

  // 重複除去（inner joinで複数エリアあると都道府県が複数回出る）
  const uniquePrefSlugs = [...new Set((prefectures || []).map((p) => p.slug))];
  const prefPages: MetadataRoute.Sitemap = uniquePrefSlugs.map((slug) => ({
    url: `${baseUrl}/area/${slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // エリアページ
  const { data: areas } = await supabase
    .from("areas")
    .select("slug, prefectures(slug)")
    .gt("salon_count", 0);

  const areaPages: MetadataRoute.Sitemap = (areas || []).map((a) => {
    const prefSlug = (a.prefectures as unknown as { slug: string } | null)?.slug || "";
    return {
      url: `${baseUrl}/area/${prefSlug}/${a.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    };
  });

  // 店舗ページ
  const { data: shops } = await supabase
    .from("salons")
    .select("id, updated_at")
    .order("id");

  const shopPages: MetadataRoute.Sitemap = (shops || []).map((s) => ({
    url: `${baseUrl}/salon/${s.id}`,
    lastModified: s.updated_at ? new Date(s.updated_at) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...prefPages, ...areaPages, ...shopPages];
}
