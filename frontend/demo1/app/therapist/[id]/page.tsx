import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TherapistPageClient } from "./therapist-page-client";
import { supabase } from "@/lib/supabase";
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
    reviewCount: 0,
    averageScore: 0,
    rating: 0,
  };

  // レビューはDBから取得（現在0件）
  const { data: dbReviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("therapist_id", Number(id))
    .order("created_at", { ascending: false });

  const reviews: Review[] = (dbReviews || []).map((r: any) => ({
    id: r.id,
    therapistId: String(r.therapist_id),
    therapistName: therapist.name,
    shopName: therapist.shopName,
    score: r.score || 0,
    typeId: r.looks_type || "",
    bodyType: r.body_type || "",
    serviceType: r.service_level || "",
    parameters: {
      conversation: r.param_conversation || 3,
      distance: r.param_distance || 3,
      technique: r.param_technique || 3,
      personality: r.param_personality || 3,
    },
    tags: [r.looks_type, r.body_type].filter(Boolean),
    q1FirstImpression: r.comment_first_impression || "",
    q2Service: r.comment_service || "",
    q3Notes: r.comment_advice || "",
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
