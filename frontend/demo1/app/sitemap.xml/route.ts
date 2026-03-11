import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { toSitemapIndexXml, xmlResponse, BASE_URL } from "@/lib/sitemap-utils";

export const revalidate = 86400;

const THERAPISTS_PER_FILE = 5000;

export async function GET() {
  // 各テーブルの最新 updated_at を取得
  const [
    { count },
    { data: latestArea },
    { data: latestSalon },
    { data: latestTherapist },
  ] = await Promise.all([
    supabase
      .from("therapists")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("areas")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("salons")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("therapists")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const therapistFileCount = Math.max(1, Math.ceil((count || 0) / THERAPISTS_PER_FILE));

  const areaLastmod = latestArea?.updated_at ?? new Date().toISOString();
  const salonLastmod = latestSalon?.updated_at ?? new Date().toISOString();
  const therapistLastmod = latestTherapist?.updated_at ?? new Date().toISOString();

  const sitemaps = [
    { loc: `${BASE_URL}/sitemap-page.xml`, lastmod: therapistLastmod },
    { loc: `${BASE_URL}/sitemap-area.xml`, lastmod: areaLastmod },
    { loc: `${BASE_URL}/sitemap-salon.xml`, lastmod: salonLastmod },
    ...Array.from({ length: therapistFileCount }, (_, i) => ({
      loc: `${BASE_URL}/sitemap-therapist-${i + 1}.xml`,
      lastmod: therapistLastmod,
    })),
  ];

  return xmlResponse(toSitemapIndexXml(sitemaps));
}
