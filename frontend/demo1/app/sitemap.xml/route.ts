import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { toSitemapIndexXml, xmlResponse, BASE_URL } from "@/lib/sitemap-utils";

export const revalidate = 86400;

const THERAPISTS_PER_FILE = 5000;

export async function GET() {
  const now = new Date().toISOString();

  // セラピスト総数からファイル数を計算
  const { count } = await supabase
    .from("therapists")
    .select("id", { count: "exact", head: true });

  const therapistFileCount = Math.max(1, Math.ceil((count || 0) / THERAPISTS_PER_FILE));

  const sitemaps = [
    { loc: `${BASE_URL}/sitemap-page.xml`, lastmod: now },
    { loc: `${BASE_URL}/sitemap-area.xml`, lastmod: now },
    { loc: `${BASE_URL}/sitemap-salon.xml`, lastmod: now },
    ...Array.from({ length: therapistFileCount }, (_, i) => ({
      loc: `${BASE_URL}/sitemap-therapist-${i + 1}.xml`,
      lastmod: now,
    })),
  ];

  return xmlResponse(toSitemapIndexXml(sitemaps));
}
