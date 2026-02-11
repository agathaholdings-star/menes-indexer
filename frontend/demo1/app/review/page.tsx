"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ReviewWizardModal } from "@/components/review/review-wizard-modal";
import { useAuth } from "@/lib/auth-context";

export default function ReviewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?redirect=/review");
      return;
    }
    // 認証済みならモーダルを自動オープン
    setModalOpen(true);
  }, [user, loading, router]);

  const handleOpenChange = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <div className="text-center text-muted-foreground">
          {loading ? "読み込み中..." : ""}
        </div>
      </main>
      <ReviewWizardModal
        open={modalOpen}
        onOpenChange={handleOpenChange}
      />
      <SiteFooter />
    </div>
  );
}
