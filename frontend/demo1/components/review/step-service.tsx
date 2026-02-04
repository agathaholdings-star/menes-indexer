"use client";

import { serviceTypes } from "@/lib/data";
import { cn } from "@/lib/utils";

interface StepServiceProps {
  selected: string | null;
  onSelect: (type: string) => void;
}

export function StepService({ selected, onSelect }: StepServiceProps) {
  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold text-foreground mb-2">
        サービス満足度を選択
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        サービスの内容に最も近いものを選んでください
      </p>
      <div className="grid grid-cols-2 gap-3">
        {serviceTypes.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => onSelect(type.id)}
            className={cn(
              "flex flex-col items-start p-4 rounded-xl border-2 transition-all duration-200 active:scale-95 text-left",
              selected === type.id
                ? "border-primary bg-secondary"
                : "border-border bg-card hover:border-primary/50"
            )}
          >
            <span className="font-semibold text-foreground mb-1">
              {type.label}
            </span>
            <span className="text-xs text-muted-foreground leading-tight">
              {type.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
