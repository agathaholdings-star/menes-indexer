import { HomePageClient } from "@/components/home/home-page-client";
import { getAllAreasGrouped } from "@/lib/supabase-data";

export const revalidate = 86400; // 1 day

export default async function HomePage() {
  const { areasGrouped, popularAreas, regionOrder } = await getAllAreasGrouped();

  return (
    <HomePageClient
      areasGrouped={areasGrouped}
      popularAreas={popularAreas}
      regionOrder={regionOrder}
    />
  );
}
