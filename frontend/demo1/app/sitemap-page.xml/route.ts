import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { toSitemapXml, xmlResponse, BASE_URL } from "@/lib/sitemap-utils";

export const revalidate = 3600;

const THERAPIST_TYPES = ["1", "2", "3", "4", "5", "6", "7", "8"];

export async function GET() {
  // 最新の口コミ更新日をコンテンツ更新の指標にする
  const { data: latestReview } = await supabase
    .from("reviews")
    .select("created_at")
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const contentLastmod = latestReview?.created_at
    ? new Date(latestReview.created_at)
    : new Date("2026-03-01");

  const entries = [
    { url: BASE_URL, lastModified: contentLastmod, changeFrequency: "daily" as const, priority: 1.0 },
    { url: `${BASE_URL}/area`, lastModified: contentLastmod, changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${BASE_URL}/search`, lastModified: contentLastmod, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${BASE_URL}/ranking`, lastModified: contentLastmod, changeFrequency: "daily" as const, priority: 0.7 },
    { url: `${BASE_URL}/pricing`, lastModified: new Date("2026-03-01"), changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${BASE_URL}/contact`, lastModified: new Date("2026-03-01"), changeFrequency: "yearly" as const, priority: 0.3 },
    ...THERAPIST_TYPES.map((t) => ({
      url: `${BASE_URL}/type/${t}`,
      lastModified: contentLastmod,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  return xmlResponse(toSitemapXml(entries));
}
