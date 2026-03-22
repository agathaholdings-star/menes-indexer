"use client";

import { useState, useEffect } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ReviewWizardModal } from "@/components/review/review-wizard-modal";
import { Button } from "@/components/ui/button";
import { PenLine, Gift, BookOpen, CheckCircle2 } from "lucide-react";

export default function ReviewPage() {
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setModalOpen(true);
  }, []);

  const handleOpenChange = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      // モーダルを閉じてもページに留まる（SEOコンテンツを表示）
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-3">口コミ・体験談を投稿</h1>
          <p className="text-muted-foreground">
            あなたの体験をシェアして、他のユーザーの口コミを読もう。
            <br />
            1件投稿するだけで<strong>5クレジット</strong>獲得、5件の口コミが読めるようになります。
          </p>
        </div>

        <div className="mb-8 space-y-4">
          <h2 className="text-lg font-semibold text-center">投稿の流れ</h2>
          <ol className="space-y-3">
            {[
              { step: "エリア選択", desc: "都道府県からお店を探す、または店舗名で検索" },
              { step: "サロン選択", desc: "訪問したお店を選ぶ" },
              { step: "セラピスト選択", desc: "施術を受けたセラピストを選ぶ" },
              { step: "体験を記入", desc: "タイプ・評価・感想を入力（3分程度）" },
              { step: "投稿完了", desc: "承認後にクレジットが付与されます" },
            ].map(({ step, desc }, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <div>
                  <span className="font-medium">{step}</span>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-center">
          <div className="p-4 rounded-lg border">
            <Gift className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium">1件投稿で5クレジット</p>
          </div>
          <div className="p-4 rounded-lg border">
            <BookOpen className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium">他の口コミが読める</p>
          </div>
          <div className="p-4 rounded-lg border">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium">スクショ付きで10クレジット</p>
          </div>
        </div>

        <div className="text-center">
          <Button
            size="lg"
            onClick={() => setModalOpen(true)}
            className="gap-2"
          >
            <PenLine className="h-5 w-5" />
            口コミを書く
          </Button>
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
