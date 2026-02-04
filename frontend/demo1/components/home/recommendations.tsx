"use client";

import { TherapistCard } from "./therapist-card";
import { mockTherapists } from "@/lib/data";

export function Recommendations() {
  return (
    <section className="py-6">
      <div className="px-4 mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          あなたへのおすすめ
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          人気のセラピストをチェック
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
        {mockTherapists.map((therapist) => (
          <TherapistCard key={therapist.id} therapist={therapist} />
        ))}
      </div>
    </section>
  );
}
