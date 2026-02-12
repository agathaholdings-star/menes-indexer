import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { therapistTypes, bodyTypes } from "@/lib/data";
import { ShopListPageClient } from "./shop-list-client";
import { getPrefectureBySlug, getAreaBySlug, getShopsByAreaSlug, getTherapistCountsBySalonIds } from "@/lib/supabase-data";
import type { Shop as DbShop } from "@/types/database";
import type { Shop } from "@/lib/data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ prefecture: string; district: string }>;
}): Promise<Metadata> {
  const { prefecture, district } = await params;
  const pref = await getPrefectureBySlug(prefecture);
  const area = await getAreaBySlug(district);
  if (!pref || !area) return {};
  return {
    title: area.seo_title || `${area.name}のメンズエステ | ${pref.name} | メンエスインデクサ`,
    description: area.seo_description || `${pref.name}${area.name}エリアのメンズエステ${area.salon_count || 0}店舗を掲載。料金・アクセス・口コミ情報で比較。`,
  };
}

interface ShopListPageProps {
  params: Promise<{ prefecture: string; district: string }>;
}

// DBのShop → フロントのShop型に変換
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

export default async function ShopListPage({ params }: ShopListPageProps) {
  const { prefecture, district } = await params;

  const pref = await getPrefectureBySlug(prefecture);
  if (!pref) {
    notFound();
  }

  const area = await getAreaBySlug(district);
  if (!area) {
    notFound();
  }

  const dbShops = await getShopsByAreaSlug(district);
  const salonIds = dbShops.map((s) => s.id);
  const therapistCounts = await getTherapistCountsBySalonIds(salonIds);
  const shops = dbShops.map((s) => {
    const shop = toFrontendShop(s);
    shop.therapistCount = therapistCounts.get(s.id) || 0;
    return shop;
  });

  return (
    <ShopListPageClient
      prefecture={prefecture}
      district={district}
      decodedPrefecture={pref.name}
      decodedDistrict={area.name}
      shops={shops}
      allTherapists={[]}
      therapistTypes={therapistTypes}
      bodyTypes={bodyTypes}
    />
  );
}
