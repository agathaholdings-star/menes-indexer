import { notFound } from "next/navigation";
import { mockTherapists, getReviewsByTherapistId } from "@/lib/data";
import { TherapistPageClient } from "./therapist-page-client";

interface TherapistPageProps {
  params: Promise<{ id: string }>;
}

export default async function TherapistPage({ params }: TherapistPageProps) {
  const { id } = await params;
  const therapist = mockTherapists.find((t) => t.id === id);

  if (!therapist) {
    notFound();
  }

  const reviews = getReviewsByTherapistId(id);

  return <TherapistPageClient therapist={therapist} reviews={reviews} />;
}
