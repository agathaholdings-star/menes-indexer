"use client";

import { therapistTypes } from "@/lib/data";
import { cn } from "@/lib/utils";

interface StepTypeProps {
  selected: string | null;
  onSelect: (type: string) => void;
}

export function StepType({ selected, onSelect }: StepTypeProps) {
  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold text-foreground mb-2">
        系統を選択してください
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        セラピストの雰囲気に最も近いものを選んでください
      </p>
      <div className="grid grid-cols-2 gap-3">
        {therapistTypes.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => onSelect(type.id)}
            className={cn(
              "flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all duration-200 active:scale-95",
              selected === type.id
                ? "border-primary bg-secondary shadow-sm"
                : "border-border bg-card hover:border-primary/50"
            )}
          >
            <span className="text-4xl mb-2" role="img" aria-label={type.label}>
              {type.icon}
            </span>
            <span className="text-sm font-medium text-foreground text-center">
              {type.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
