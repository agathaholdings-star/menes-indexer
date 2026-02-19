import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopPageClient } from "./shop-page-client";
import { getShopById, getShopBySlug, getTherapistsByShopId, getShopAreaInfo, getSalonReviewStatsBatch } from "@/lib/supabase-data";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { Shop as DbShop, Therapist as DbTherapist } from "@/types/database";
import type { Shop, Therapist, Review } from "@/lib/data";
import { parseNameAge } from "@/lib/therapist-utils";

interface ShopPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  const { id } = await params;
  const isNumeric = /^\d+$/.test(id);
  const dbShop = isNumeric ? await getShopById(Number(id)) : await getShopBySlug(id);
  if (!dbShop) return {};
  const name = dbShop.display_name || dbShop.name;
  const areaInfo = await getShopAreaInfo(dbShop.id);
  const areaText = areaInfo ? `${areaInfo.prefName}${areaInfo.areaName}` : "";
  return {
    title: dbShop.seo_title || `${name} | ${areaText}メンズエステ | メンエスインデクサ`,
    description: `${name}の店舗情報・セラピスト一覧・口コミ。${areaText}${dbShop.access ? `（${dbShop.access}）` : ""}`,
  };
}

// DBのShop → フロントのShop型
function toFrontendShop(
  dbShop: DbShop,
  stats?: { review_count: number; avg_score: number; therapist_count: number }
): Shop {
  const reviewCount = stats?.review_count ?? 0;
  const avgScore = stats?.avg_score ?? 0;

  return {
    id: String(dbShop.id),
    name: dbShop.display_name || dbShop.name,
    area: "",
    district: "",
    access: dbShop.access || "",
    hours: dbShop.business_hours || "",
    priceRange: dbShop.base_price
      ? `${dbShop.base_duration || 60}分 ¥${dbShop.base_price.toLocaleString()}〜`
      : "",
    genres: dbShop.service_tags || [],
    description: dbShop.description || (dbShop as Record<string, unknown>).salon_overview as string || "",
    therapistCount: stats?.therapist_count ?? 0,
    reviewCount,
    averageScore: avgScore,
    rating: avgScore,
    thumbnail: dbShop.image_url || "/placeholder.svg",
    images: dbShop.image_url ? [dbShop.image_url] : [],
    courses: [],
  };
}

// DBのTherapist → フロントのTherapist型
function toFrontendTherapist(t: DbTherapist, shopName: string): Therapist {
  const { name, age } = parseNameAge(t.name, t.age);
  return {
    id: String(t.id),
    name,
    age,
    shopId: String(t.salon_id),
    shopName,
    area: "",
    district: "",
    images: (t.image_urls as string[]) || [],
    profile: {
      height: t.height || 0,
      bust: t.bust || "",
      waist: t.waist || 0,
      hip: t.hip || 0,
      cup: t.cup || "",
    },
    comment: t.profile_text || "",
    schedule: {},
    tags: [],
    typeId: "",
    primaryType: "",
    types: [],
    bodyType: "",
    parameters: {
      conversation: 0,
      distance: 0,
      technique: 0,
      personality: 0,
    },
    reviewCount: 0,
    averageScore: 0,
    rating: 0,
  };
}

// DB reviewsレコード → フロントのReview型
function toFrontendReview(r: Record<string, unknown>): Review {
  return {
    id: String(r.id),
    therapistId: String(r.therapist_id),
    therapistName: "",
    shopName: "",
    score: (r.score as number) || 0,
    typeId: r.looks_type_id ? String(r.looks_type_id) : "",
    bodyType: r.body_type_id ? String(r.body_type_id) : "",
    serviceType: r.service_level_id ? String(r.service_level_id) : "",
    parameters: {
      conversation: (r.param_conversation as number) || 0,
      distance: (r.param_distance as number) || 0,
      technique: (r.param_technique as number) || 0,
      personality: (r.param_personality as number) || 0,
    },
    tags: [],
    commentReason: (r.comment_reason as string) || "",
    commentFirstImpression: (r.comment_first_impression as string) || "",
    commentStyle: (r.comment_style as string) || "",
    commentService: (r.comment_service as string) || "",
    commentServiceDetail: (r.comment_service_detail as string) || "",
    commentCost: (r.comment_cost as string) || "",
    commentRevisit: (r.comment_revisit as string) || "",
    commentAdvice: (r.comment_advice as string) || "",
    createdAt: (r.created_at as string) || "",
    userId: (r.user_id as string) || "",
  };
}

export default async function ShopPage({ params }: ShopPageProps) {
  const { id } = await params;

  // IDが数値ならIDで検索、そうでなければslugで検索
  const isNumeric = /^\d+$/.test(id);
  const dbShop = isNumeric
    ? await getShopById(Number(id))
    : await getShopBySlug(id);

  if (!dbShop) {
    notFound();
  }

  // 口コミ統計をバッチ取得
  const statsMap = await getSalonReviewStatsBatch([dbShop.id]);
  const stats = statsMap.get(dbShop.id);

  const shop = toFrontendShop(dbShop, stats);

  // セラピスト取得
  const dbTherapists = await getTherapistsByShopId(dbShop.id);
  const therapists = dbTherapists.map((t) =>
    toFrontendTherapist(t, shop.name)
  );
  shop.therapistCount = therapists.length;

  // エリア情報取得（パンくず用）
  const areaInfo = await getShopAreaInfo(dbShop.id);

  // 口コミ取得（approved のみ）
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("*")
    .eq("salon_id", dbShop.id)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);

  const shopReviews: Review[] = (reviewRows || []).map((r) =>
    toFrontendReview(r as Record<string, unknown>)
  );

  return (
    <ShopPageClient
      shop={shop}
      therapists={therapists}
      shopReviews={shopReviews}
      officialUrl={dbShop.official_url || null}
      areaName={areaInfo?.areaName || ""}
      areaSlug={areaInfo?.areaSlug || ""}
      prefName={areaInfo?.prefName || ""}
      prefSlug={areaInfo?.prefSlug || ""}
    />
  );
}
