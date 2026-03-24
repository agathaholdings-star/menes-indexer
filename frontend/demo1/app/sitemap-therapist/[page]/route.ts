import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { toSitemapXml, xmlResponse, BASE_URL } from "@/lib/sitemap-utils";

export const revalidate = 3600;

const PAGE_SIZE = 5000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ page: string }> }
) {
  const { page } = await params;
  const pageIndex = parseInt(page, 10) - 1;
  if (isNaN(pageIndex) || pageIndex < 0) {
    return new Response("Not Found", { status: 404 });
  }

  const now = new Date();

  // RPC で全件一括取得（PostgREST 1000行制限なし）
  const { data: allTherapists } = await supabase.rpc("get_sitemap_therapists");

  if (!allTherapists || allTherapists.length === 0) {
    return new Response("Not Found", { status: 404 });
  }

  // ページ分割
  const start = pageIndex * PAGE_SIZE;
  const therapists = allTherapists.slice(start, start + PAGE_SIZE);

  if (therapists.length === 0) {
    return new Response("Not Found", { status: 404 });
  }

  const entries = therapists.map((t: { id: number; updated_at: string | null; has_reviews: boolean }) => ({
    url: `${BASE_URL}/therapist/${t.id}`,
    lastModified: t.updated_at ? new Date(t.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: t.has_reviews ? 0.6 : 0.5,
  }));

  return xmlResponse(toSitemapXml(entries));
}
