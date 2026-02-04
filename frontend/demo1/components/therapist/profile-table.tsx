import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Therapist } from "@/lib/data";

interface ProfileTableProps {
  therapist: Therapist;
}

export function ProfileTable({ therapist }: ProfileTableProps) {
  const profileItems = [
    { label: "在籍店舗", value: therapist.shopName, isLink: true, href: `/shop/${therapist.shopId}` },
    { label: "年齢", value: `${therapist.age}歳` },
    { label: "身長", value: `T${therapist.profile.height}` },
    { label: "スリーサイズ", value: `B${therapist.profile.bust} W${therapist.profile.waist} H${therapist.profile.hip}` },
  ];

  return (
    <div className="space-y-4">
      {/* Comment */}
      {therapist.comment && (
        <p className="text-sm text-muted-foreground italic border-l-2 border-primary pl-3">
          {therapist.comment}
        </p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {therapist.tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>

      {/* Profile Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {profileItems.map((item, index) => (
              <tr
                key={item.label}
                className={index % 2 === 0 ? "bg-muted/30" : "bg-background"}
              >
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-32">
                  {item.label}
                </th>
                <td className="px-4 py-2.5">
                  {item.isLink && item.href ? (
                    <Link href={item.href} className="text-primary hover:underline">
                      {item.value}
                    </Link>
                  ) : (
                    item.value
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


    </div>
  );
}
