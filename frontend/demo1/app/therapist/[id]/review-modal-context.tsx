"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { ReviewWizardModal, type PrefillContext } from "@/components/review/review-wizard-modal";

interface ReviewModalContextValue {
  openModal: (prefill?: PrefillContext) => void;
}

const ReviewModalContext = createContext<ReviewModalContextValue>({
  openModal: () => {},
});

export function useReviewModal() {
  return useContext(ReviewModalContext);
}

interface ReviewModalProviderProps {
  children: ReactNode;
  defaultPrefill?: PrefillContext;
}

export function ReviewModalProvider({ children, defaultPrefill }: ReviewModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefill, setPrefill] = useState<PrefillContext | undefined>(undefined);

  const openModal = useCallback((p?: PrefillContext) => {
    // p=undefined → 汎用投稿フロー（他のセラピストも選べる）
    // p=prefill → 特定セラピスト向け
    setPrefill(p);
    setIsOpen(true);
  }, []);

  return (
    <ReviewModalContext.Provider value={{ openModal }}>
      {children}
      <ReviewWizardModal
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) setPrefill(undefined);
        }}
        prefill={prefill}
      />
    </ReviewModalContext.Provider>
  );
}
