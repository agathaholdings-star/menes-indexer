import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TherapistPageClient } from "./therapist-page-client";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { Therapist, Review } from "@/lib/data";
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
    .select("name, age, salon_id")
    .eq("id", Number(id))
    .single();
  if (!data) return {};
  const { data: shop } = await supabase
    .from("salons")
    .select("display_name, name")
    .eq("id", data.salon_id)
    .single();
  const shopName = shop?.display_name || shop?.name || "";
  const desc = `${data.name}${data.age ? `（${data.age}歳）` : ""}${shopName ? ` | ${shopName}` : ""}の詳細・口コミ`;
  return {
    title: `${data.name} | ${shopName}`,
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

  const { data: shop } = await supabase
    .from("salons")
    .select("name, display_name")
    .eq("id", dbTherapist.salon_id)
    .single();

  const { name: parsedName, age: parsedAge } = parseNameAge(dbTherapist.name, dbTherapist.age);
  const areaInfo = await getShopAreaInfo(dbTherapist.salon_id);

  // レビューをDBから取得
  const { data: dbReviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("therapist_id", Number(id))
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false });

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
  }));

  return (
    <TherapistPageClient
      therapist={therapist}
      reviews={reviews}
      areaName={areaInfo?.areaName}
      prefName={areaInfo?.prefName}
    />
  );
}
