import { notFound } from "next/navigation";
import { mockShops, getTherapistsByShopId, mockReviews } from "@/lib/data";
import { ShopPageClient } from "./shop-page-client";

interface ShopPageProps {
  params: Promise<{ id: string }>;
}

export default async function ShopPage({ params }: ShopPageProps) {
  const { id } = await params;
  const shop = mockShops.find((s) => s.id === id);

  if (!shop) {
    notFound();
  }

  const therapists = getTherapistsByShopId(id);
  const shopReviews = mockReviews.filter(r => therapists.some(t => t.id === r.therapistId));

  return <ShopPageClient shop={shop} therapists={therapists} shopReviews={shopReviews} />;
}
