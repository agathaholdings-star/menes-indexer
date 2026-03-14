"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useReviewModal } from "./review-modal-context";
import type { PrefillContext } from "@/components/review/review-wizard-modal";

interface WriteReviewTriggerProps {
  prefill: PrefillContext;
}

export function WriteReviewTrigger({ prefill }: WriteReviewTriggerProps) {
  const searchParams = useSearchParams();
  const { openModal } = useReviewModal();

  useEffect(() => {
    if (searchParams.get("write") === "true") {
      openModal(prefill);
    }
  }, [searchParams, openModal, prefill]);

  return null;
}
