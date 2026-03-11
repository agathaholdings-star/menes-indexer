import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Therapist } from "@/lib/data";

interface ProfileTableProps {
  therapist: Therapist;
}

export function ProfileTable({ therapist }: ProfileTableProps) {
  const threeSizes = [
    therapist.profile.bust ? `B${therapist.profile.bust}` : null,
    therapist.profile.waist ? `W${therapist.profile.waist}` : null,
    therapist.profile.hip ? `H${therapist.profile.hip}` : null,
  ].filter(Boolean).join(" ");

  const profileItems: { label: string; value: string; isLink?: boolean; href?: string; isExternalLink?: boolean }[] = [
    { label: "在籍店舗", value: therapist.salonName, isLink: true, href: `/salon/${therapist.salonId}` },
    ...(therapist.age > 0 ? [{ label: "年齢", value: `${therapist.age}歳` }] : []),
    ...(therapist.profile.height ? [{ label: "身長", value: `T${therapist.profile.height}` }] : []),
    ...(threeSizes ? [{ label: "スリーサイズ", value: threeSizes }] : []),
    ...(therapist.profile.cup ? [{ label: "カップ", value: therapist.profile.cup }] : []),
    ...(therapist.source_url ? [{ label: "公式ページ", value: therapist.source_url, isExternalLink: true }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Comment */}
      {therapist.comment?.trim() && (
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
                  ) : item.isExternalLink ? (
                    <a
                      href={item.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm"
                    >
                      公式ページを見る
                    </a>
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
