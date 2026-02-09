import { notFound } from "next/navigation";
import { mockTherapists, getReviewsByTherapistId } from "@/lib/data";
import { TherapistPageClient } from "./therapist-page-client";
import { supabase } from "@/lib/supabase";
import type { Therapist, Review } from "@/lib/data";

interface TherapistPageProps {
  params: Promise<{ id: string }>;
}

export default async function TherapistPage({ params }: TherapistPageProps) {
  const { id } = await params;

  // まずモックから探す
  const mockTherapist = mockTherapists.find((t) => t.id === id);
  if (mockTherapist) {
    const reviews = getReviewsByTherapistId(id);
    return <TherapistPageClient therapist={mockTherapist} reviews={reviews} />;
  }

  // DBから探す
  const isNumeric = /^\d+$/.test(id);
  if (isNumeric) {
    const { data: dbTherapist } = await supabase
      .from("therapists")
      .select("*")
      .eq("id", Number(id))
      .single();

    if (dbTherapist) {
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

      return <TherapistPageClient therapist={therapist} reviews={[]} />;
    }
  }

  notFound();
}
