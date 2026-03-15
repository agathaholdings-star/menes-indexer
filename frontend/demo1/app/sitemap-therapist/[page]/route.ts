import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { toSitemapXml, xmlResponse, BASE_URL } from "@/lib/sitemap-utils";

export const revalidate = 3600;

const PAGE_SIZE = 5000;
const FETCH_CHUNK = 1000; // Supabase PostgREST max-rows

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
  const globalOffset = pageIndex * PAGE_SIZE;

  // Supabaseは1回のクエリで最大1000行。ループで5000件まで取得
  const therapists: { id: number; updated_at: string | null; review_count: number | null }[] = [];
  for (let i = 0; i < PAGE_SIZE; i += FETCH_CHUNK) {
    const from = globalOffset + i;
    const to = from + FETCH_CHUNK - 1;
    const { data } = await supabase
      .from("therapists")
      .select("id, updated_at, review_count, salons!inner(published_at)")
      .not("salons.published_at", "is", null)
      .order("review_count", { ascending: false, nullsFirst: false })
      .order("id")
      .range(from, to);

    if (!data || data.length === 0) break;
    therapists.push(...data);
    if (data.length < FETCH_CHUNK) break; // 最終チャンク
  }

  if (therapists.length === 0) {
    return new Response("Not Found", { status: 404 });
  }

  const entries = therapists.map((t) => ({
    url: `${BASE_URL}/therapist/${t.id}`,
    lastModified: t.updated_at ? new Date(t.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: (t.review_count ?? 0) > 0 ? 0.6 : 0.5,
  }));

  return xmlResponse(toSitemapXml(entries));
}
