"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SiblingTherapist {
  id: number;
  name: string;
  age: number | null;
  image_url: string | null;
  salon_id: number;
  shop_name: string;
  status: string;
  created_at: string;
}

interface TransferHistoryProps {
  therapistId: string;
  therapistName: string;
}

export function TransferHistory({ therapistId, therapistName }: TransferHistoryProps) {
  const [siblings, setSiblings] = useState<SiblingTherapist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/therapists/history?therapist_id=${therapistId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setSiblings(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [therapistId]);

  if (loading || siblings.length === 0) return null;

  const active = siblings.filter((s) => s.status === "active");
  const inactive = siblings.filter((s) => s.status !== "active");

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowRight className="h-5 w-5 text-amber-600" />
          在籍履歴
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {therapistName}さんの他の在籍情報
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {active.length > 0 && (
          <div>
            <p className="text-xs font-medium text-amber-700 mb-2">現在の在籍</p>
            {active.map((s) => (
              <SiblingCard key={s.id} sibling={s} isCurrent />
            ))}
          </div>
        )}
        {inactive.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">過去の在籍</p>
            {inactive.map((s) => (
              <SiblingCard key={s.id} sibling={s} isCurrent={false} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SiblingCard({ sibling, isCurrent }: { sibling: SiblingTherapist; isCurrent: boolean }) {
  return (
    <Link href={`/therapist/${sibling.id}`}>
      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-100/50 transition-colors">
        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
          {sibling.image_url ? (
            <Image
              src={sibling.image_url}
              alt={sibling.name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
              {sibling.name[0]}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{sibling.name}</span>
            {isCurrent ? (
              <Badge className="bg-emerald-100 text-emerald-700 text-xs">在籍中</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">退店</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {sibling.shop_name}
          </p>
        </div>
      </div>
    </Link>
  );
}
