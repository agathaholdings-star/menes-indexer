import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { toSitemapXml, xmlResponse, BASE_URL } from "@/lib/sitemap-utils";

export const revalidate = 86400;

export async function GET() {
  const now = new Date();

  const { data: salons } = await supabase
    .from("salons")
    .select("id, updated_at")
    .not("published_at", "is", null)
    .order("id");

  const entries = (salons || []).map((s) => ({
    url: `${BASE_URL}/salon/${s.id}`,
    lastModified: s.updated_at ? new Date(s.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return xmlResponse(toSitemapXml(entries));
}
