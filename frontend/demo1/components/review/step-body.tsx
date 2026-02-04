"use client";

import { bodyTypes } from "@/lib/data";
import { cn } from "@/lib/utils";

interface StepBodyProps {
  selected: string | null;
  onSelect: (type: string) => void;
}

export function StepBody({ selected, onSelect }: StepBodyProps) {
  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold text-foreground mb-2">
        スタイルを選択してください
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        セラピストの体型に最も近いものを選んでください
      </p>
      <div className="flex flex-wrap gap-3">
        {bodyTypes.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => onSelect(type.id)}
            className={cn(
              "px-6 py-4 rounded-full border-2 transition-all duration-200 active:scale-95",
              selected === type.id
                ? "border-primary bg-secondary text-secondary-foreground"
                : "border-border bg-card text-foreground hover:border-primary/50"
            )}
          >
            <span className="font-medium">{type.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
