import { mockShops, mockTherapists, therapistTypes, bodyTypes } from "@/lib/data";
import { ShopListPageClient } from "./shop-list-client";

interface ShopListPageProps {
  params: Promise<{ prefecture: string; district: string }>;
}

export default async function ShopListPage({ params }: ShopListPageProps) {
  const { prefecture, district } = await params;
  const decodedPrefecture = decodeURIComponent(prefecture);
  const decodedDistrict = decodeURIComponent(district);

  // Filter shops by area
  const shops = mockShops.filter(s => s.area === decodedPrefecture && s.district === decodedDistrict);

  return (
    <ShopListPageClient
      prefecture={prefecture}
      district={district}
      decodedPrefecture={decodedPrefecture}
      decodedDistrict={decodedDistrict}
      shops={shops}
      allTherapists={mockTherapists}
      therapistTypes={therapistTypes}
      bodyTypes={bodyTypes}
    />
  );
}
