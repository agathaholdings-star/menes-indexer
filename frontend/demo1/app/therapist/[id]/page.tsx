import { notFound } from "next/navigation";
import { TherapistPageClient } from "./therapist-page-client";
import { supabase } from "@/lib/supabase";
import type { Therapist, Review } from "@/lib/data";

interface TherapistPageProps {
  params: Promise<{ id: string }>;
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
    .from("shops")
    .select("name, display_name")
    .eq("id", dbTherapist.shop_id)
    .single();

  const therapist: Therapist = {
    id: String(dbTherapist.id),
    name: dbTherapist.name,
    age: dbTherapist.age || 0,
    shopId: String(dbTherapist.shop_id),
    shopName: shop?.display_name || shop?.name || "",
    area: "",
    district: "",
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
    createdAt: new Date(r.created_at).toLocaleDateString("ja-JP"),
    tags: [r.looks_type, r.body_type].filter(Boolean),
    q1FirstImpression: r.comment_first_impression || "",
    q2Service: r.comment_service || "",
    q3Advice: r.comment_advice || "",
  }));

  return <TherapistPageClient therapist={therapist} reviews={reviews} />;
}
