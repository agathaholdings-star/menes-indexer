"use client";

import { parameterLabels } from "@/lib/data";
import { Slider } from "@/components/ui/slider";

interface Parameters {
  conversation: number;
  distance: number;
  technique: number;
  personality: number;
}

interface StepParametersProps {
  parameters: Parameters;
  onChange: (key: keyof Parameters, value: number) => void;
}

export function StepParameters({ parameters, onChange }: StepParametersProps) {
  const parameterKeys: (keyof Parameters)[] = [
    "conversation",
    "distance",
    "technique",
    "personality",
  ];

  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold text-foreground mb-2">
        パラメータを評価してください
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        各項目を1〜5の段階で評価してください
      </p>
      <div className="space-y-6">
        {parameterKeys.map((key) => {
          const label = parameterLabels.find((p) => p.id === key)?.label || key;
          return (
            <div key={key} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{label}</span>
                <span className="text-lg font-bold text-primary">
                  {parameters[key]}
                </span>
              </div>
              <Slider
                value={[parameters[key]]}
                onValueChange={([value]) => onChange(key, value)}
                min={1}
                max={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>低い</span>
                <span>高い</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
