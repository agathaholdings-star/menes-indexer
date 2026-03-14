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

  const { data: therapists } = await supabase
    .from("therapists")
    .select("id, updated_at, review_count, salons!inner(published_at)")
    .not("salons.published_at", "is", null)
    .order("review_count", { ascending: false, nullsFirst: false })
    .order("id")
    .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);

  if (!therapists || therapists.length === 0) {
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
