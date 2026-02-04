"use client";

import { cn } from "@/lib/utils";

interface WizardStepsProps {
  currentStep: number;
  totalSteps: number;
}

export function WizardSteps({ currentStep, totalSteps }: WizardStepsProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <div
          key={step}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            step === currentStep
              ? "w-8 bg-primary"
              : step < currentStep
                ? "w-4 bg-primary/60"
                : "w-4 bg-muted"
          )}
        />
      ))}
    </div>
  );
}
