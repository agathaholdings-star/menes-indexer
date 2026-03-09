import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TherapistPageClient } from "./therapist-page-client";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { Therapist, Review } from "@/lib/data";

export const revalidate = 3600;

export async function generateStaticParams() {
  const { data } = await supabase
    .from("reviews")
    .select("therapist_id")
    .eq("moderation_status", "approved");
  const uniqueIds = [...new Set((data || []).map((r) => r.therapist_id))];
  return uniqueIds.map((id) => ({ id: String(id) }));
}

import { parseNameAge } from "@/lib/therapist-utils";
import { getShopAreaInfo } from "@/lib/supabase-data";

interface TherapistPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: TherapistPageProps): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return {};
  const { data } = await supabase
    .from("therapists")
    .select("name, age, salon_id, height, cup")
    .eq("id", Number(id))
    .single();
  if (!data) return {};
  const [{ data: shop }, areaInfo] = await Promise.all([
    supabase.from("salons").select("display_name, name").eq("id", data.salon_id).single(),
    getShopAreaInfo(data.salon_id),
  ]);
  const shopName = shop?.display_name || shop?.name || "";
  const areaText = areaInfo ? `（${areaInfo.areaName}）` : "";

  // スペック情報を組み立て
  const specs: string[] = [];
  if (data.age) specs.push(`${data.age}歳`);
  if (data.height) specs.push(`${data.height}cm`);
  if (data.cup) specs.push(`${data.cup}カップ`);
  const specText = specs.length > 0 ? `（${specs.join("・")}）` : "";

  const desc = `${shopName}${areaText}の${data.name}${specText}の口コミ体験談。サービスの質や施術内容、密着度、雰囲気などリアルな評判を掲載。`;
  return {
    title: `${shopName}「${data.name}」の口コミや評判が分かる体験談`,
    description: desc,
  };
}

export default async function TherapistPage({ params }: TherapistPageProps) {
  const { id } = await params;

  // DBから探す（数値IDのみ対応）
  const isNumeric = /^\d+$/.test(id);
  if (!isNumeric) {
    notFound();
  }

  const { data: dbTherapist } = await supabase
    .from("therapists")
    .select("*")
    .eq("id", Number(id))
    .single();

  if (!dbTherapist) {
    notFound();
  }

  const { name: parsedName, age: parsedAge } = parseNameAge(dbTherapist.name, dbTherapist.age);

  // サロン情報・エリア情報・レビューを並列取得
  const [{ data: shop }, areaInfo, { data: dbReviews }] = await Promise.all([
    supabase.from("salons").select("name, display_name, business_hours, base_price, base_duration, access").eq("id", dbTherapist.salon_id).single(),
    getShopAreaInfo(dbTherapist.salon_id),
    supabase.from("reviews").select("*, profiles:user_id(nickname, total_review_count)").eq("therapist_id", Number(id)).eq("moderation_status", "approved").order("created_at", { ascending: false }).limit(100),
  ]);

  const reviewCount = (dbReviews || []).length;
  const averageScore = reviewCount > 0
    ? Math.round((dbReviews || []).reduce((sum: number, r: any) => sum + (r.score || 0), 0) / reviewCount)
    : 0;

  const therapist: Therapist = {
    id: String(dbTherapist.id),
    name: parsedName,
    age: parsedAge,
    shopId: String(dbTherapist.salon_id),
    shopName: shop?.display_name || shop?.name || "",
    area: areaInfo?.prefSlug || "",
    district: areaInfo?.areaSlug || "",
    images: (dbTherapist.image_urls as string[]) || [],
    profile: {
      height: dbTherapist.height || 0,
      bust: dbTherapist.bust || "",
      waist: dbTherapist.waist || 0,
      hip: dbTherapist.hip || 0,
      cup: dbTherapist.cup || "",
    },
    comment: dbTherapist.profile_text || "",
    schedule: {},
    tags: [],
    typeId: "",
    primaryType: "",
    types: [],
    bodyType: "",
    parameters: { conversation: 0, distance: 0, technique: 0, personality: 0 },
    reviewCount,
    averageScore,
    rating: 0,
    source_url: dbTherapist.source_url || "",
  };

  const reviews: Review[] = (dbReviews || []).map((r: any) => ({
    id: r.id,
    therapistId: String(r.therapist_id),
    therapistName: therapist.name,
    shopName: therapist.shopName,
    score: r.score || 0,
    typeId: r.looks_type_id ? String(r.looks_type_id) : "",
    bodyType: r.body_type_id ? String(r.body_type_id) : "",
    serviceType: r.service_level_id ? String(r.service_level_id) : "",
    parameters: {
      conversation: r.param_conversation || 3,
      distance: r.param_distance || 3,
      technique: r.param_technique || 3,
      personality: r.param_personality || 3,
    },
    tags: [r.looks_type_id ? String(r.looks_type_id) : "", r.body_type_id ? String(r.body_type_id) : ""].filter(Boolean),
    commentReason: r.comment_reason || "",
    commentFirstImpression: r.comment_first_impression || "",
    commentStyle: r.comment_style || "",
    commentService: r.comment_service || "",
    commentServiceDetail: r.comment_service_detail || "",
    commentCost: r.comment_cost || "",
    commentRevisit: r.comment_revisit || "",
    commentAdvice: r.comment_advice || "",
    createdAt: new Date(r.created_at).toLocaleDateString("ja-JP"),
    userId: r.user_id || "",
    userName: (r as any).profiles?.nickname || "匿名",
    reviewerLevel: (r as any).profiles?.total_review_count || 0,
    realCount: r.real_count || 0,
    fakeCount: r.fake_count || 0,
    viewCount: r.view_count || 0,
    helpfulCount: r.helpful_count || 0,
    verificationImagePath: r.verification_image_path || null,
  }));

  const reviewStructuredData = (dbReviews || []).slice(0, 5).reduce<Record<string, unknown>[]>((items, r: any) => {
    const reviewBody = [
      r.comment_reason,
      r.comment_first_impression,
      r.comment_style,
      r.comment_service,
      r.comment_service_detail,
      r.comment_cost,
      r.comment_revisit,
      r.comment_advice,
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 300);

    if (!reviewBody && !r.score) return items;

    items.push({
      "@type": "Review",
      author: { "@type": "Person", name: r.profiles?.nickname || "匿名" },
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.score || 0,
        bestRating: 100,
        worstRating: 1,
      },
      reviewBody,
      datePublished: r.created_at,
    });
    return items;
  }, []);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://menes-skr.com";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: therapist.shopName || therapist.name,
    image: therapist.images.length > 0 ? therapist.images : undefined,
    description: `${therapist.name}${therapist.age ? `（${therapist.age}歳）` : ""}${therapist.shopName ? `（${therapist.shopName}）` : ""}${therapist.comment ? ` ${therapist.comment}` : ""}`,
    url: `${baseUrl}/therapist/${therapist.id}`,
    address: areaInfo
      ? { "@type": "PostalAddress", addressRegion: areaInfo.prefName, addressLocality: areaInfo.areaName }
      : undefined,
    employee: {
      "@type": "Person",
      name: therapist.name,
      image: therapist.images[0] || undefined,
      description: therapist.comment || undefined,
      url: `${baseUrl}/therapist/${therapist.id}`,
    },
    aggregateRating: reviewCount > 0
      ? { "@type": "AggregateRating", ratingValue: averageScore, reviewCount, bestRating: 100, worstRating: 1 }
      : undefined,
    review: reviewStructuredData.length > 0 ? reviewStructuredData : undefined,
  };

  const breadcrumbItems: { name: string; item: string }[] = [
    { name: "トップ", item: baseUrl },
  ];
  if (areaInfo?.prefSlug && areaInfo?.prefName) {
    breadcrumbItems.push({
      name: `${areaInfo.prefName}のメンズエステ`,
      item: `${baseUrl}/area/${areaInfo.prefSlug}`,
    });
  }
  if (areaInfo?.prefSlug && areaInfo?.areaSlug && areaInfo?.areaName) {
    breadcrumbItems.push({
      name: `${areaInfo.areaName}のメンズエステ`,
      item: `${baseUrl}/area/${areaInfo.prefSlug}/${areaInfo.areaSlug}`,
    });
  }
  if (therapist.shopName && therapist.shopId) {
    breadcrumbItems.push({
      name: therapist.shopName,
      item: `${baseUrl}/salon/${therapist.shopId}`,
    });
  }
  breadcrumbItems.push({
    name: therapist.name,
    item: `${baseUrl}/therapist/${therapist.id}`,
  });

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.item,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <TherapistPageClient
        therapist={therapist}
        reviews={reviews}
        areaName={areaInfo?.areaName}
        prefName={areaInfo?.prefName}
        salonInfo={{
          businessHours: shop?.business_hours || null,
          basePrice: shop?.base_price || null,
          baseDuration: shop?.base_duration || null,
          access: shop?.access || null,
        }}
      />
    </>
  );
}
