import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopPageClient } from "./shop-page-client";
import { getShopById, getShopBySlug, getTherapistsByShopId, getShopAreaInfo } from "@/lib/supabase-data";
import type { Shop as DbShop, Therapist as DbTherapist } from "@/types/database";
import type { Shop, Therapist, Review } from "@/lib/data";

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
function toFrontendShop(dbShop: DbShop): Shop {
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
    description: dbShop.description || dbShop.salon_overview || "",
    therapistCount: 0,
    reviewCount: 0,
    averageScore: 0,
    rating: 0,
    thumbnail: dbShop.image_url || "/placeholder.svg",
    images: dbShop.image_url ? [dbShop.image_url] : [],
    courses: [],
  };
}

// 名前から年齢を抽出: "あやの(19)" → { name: "あやの", age: 19 }
function parseNameAge(raw: string, dbAge: number | null): { name: string; age: number } {
  const match = raw.match(/^(.+?)\((\d{2})\)$/);
  if (match) {
    return { name: match[1], age: dbAge || Number(match[2]) };
  }
  return { name: raw, age: dbAge || 0 };
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

  const shop = toFrontendShop(dbShop);
  shop.therapistCount = 0;

  // セラピスト取得
  const dbTherapists = await getTherapistsByShopId(dbShop.id);
  const therapists = dbTherapists.map((t) =>
    toFrontendTherapist(t, shop.name)
  );
  shop.therapistCount = therapists.length;

  // エリア情報取得（パンくず用）
  const areaInfo = await getShopAreaInfo(dbShop.id);

  // レビューは未実装のため空配列
  const shopReviews: Review[] = [];

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
