"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WizardSteps } from "@/components/review/wizard-steps";
import { StepType } from "@/components/review/step-type";
import { StepBody } from "@/components/review/step-body";
import { StepService } from "@/components/review/step-service";
import { StepParameters } from "@/components/review/step-parameters";
import { StepComment } from "@/components/review/step-comment";
import { CompletionScreen } from "@/components/review/completion-screen";
import { cn } from "@/lib/utils";

interface ReviewFormData {
  type: string | null;
  body: string | null;
  service: string | null;
  parameters: {
    conversation: number;
    distance: number;
    technique: number;
    personality: number;
  };
  comments: {
    firstImpression: string;
    serviceReview: string;
  };
}

const TOTAL_STEPS = 5;

export default function ReviewPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  const [formData, setFormData] = useState<ReviewFormData>({
    type: null,
    body: null,
    service: null,
    parameters: {
      conversation: 3,
      distance: 3,
      technique: 3,
      personality: 3,
    },
    comments: {
      firstImpression: "",
      serviceReview: "",
    },
  });

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.type !== null;
      case 2:
        return formData.body !== null;
      case 3:
        return formData.service !== null;
      case 4:
        return true; // Parameters always have default values
      case 5:
        return (
          formData.comments.firstImpression.length > 0 &&
          formData.comments.serviceReview.length > 0
        );
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setDirection("forward");
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection("backward");
      setCurrentStep((prev) => prev - 1);
    }
  };

  if (isCompleted) {
    return <CompletionScreen />;
  }

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-opacity",
              currentStep === 1 ? "opacity-0" : "opacity-100"
            )}
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
            <span className="sr-only">戻る</span>
          </button>
          <span className="font-semibold text-foreground">口コミ投稿</span>
          <Link
            href="/"
            className="w-10 h-10 rounded-full flex items-center justify-center"
          >
            <X className="h-5 w-5 text-foreground" />
            <span className="sr-only">閉じる</span>
          </Link>
        </div>
        <WizardSteps currentStep={currentStep} totalSteps={TOTAL_STEPS} />
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300 ease-out",
            direction === "forward"
              ? "animate-slide-in-right"
              : "animate-slide-in-left"
          )}
          key={currentStep}
        >
          {currentStep === 1 && (
            <StepType
              selected={formData.type}
              onSelect={(type) => setFormData((prev) => ({ ...prev, type }))}
            />
          )}
          {currentStep === 2 && (
            <StepBody
              selected={formData.body}
              onSelect={(body) => setFormData((prev) => ({ ...prev, body }))}
            />
          )}
          {currentStep === 3 && (
            <StepService
              selected={formData.service}
              onSelect={(service) =>
                setFormData((prev) => ({ ...prev, service }))
              }
            />
          )}
          {currentStep === 4 && (
            <StepParameters
              parameters={formData.parameters}
              onChange={(key, value) =>
                setFormData((prev) => ({
                  ...prev,
                  parameters: { ...prev.parameters, [key]: value },
                }))
              }
            />
          )}
          {currentStep === 5 && (
            <StepComment
              comments={formData.comments}
              onChange={(key, value) =>
                setFormData((prev) => ({
                  ...prev,
                  comments: { ...prev.comments, [key]: value },
                }))
              }
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 p-4 bg-background border-t border-border safe-area-pb">
        <Button
          onClick={handleNext}
          disabled={!canProceed()}
          className="w-full h-14 text-base font-semibold rounded-xl"
        >
          {currentStep === TOTAL_STEPS ? "投稿する" : "次へ"}
        </Button>
      </footer>
    </div>
  );
}
