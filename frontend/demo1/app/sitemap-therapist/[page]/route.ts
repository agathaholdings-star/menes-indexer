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

  // ページネーション付きRPCで自分の範囲だけ取得（全件取得のタイムアウトを回避）
  const offset = pageIndex * PAGE_SIZE;
  const { data: therapists } = await supabase.rpc("get_sitemap_therapists_page", {
    p_offset: offset,
    p_limit: PAGE_SIZE,
  });

  if (!therapists || therapists.length === 0) {
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
