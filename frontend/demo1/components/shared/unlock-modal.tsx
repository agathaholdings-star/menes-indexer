"use client";

// フラグ: 課金CTAを表示するか（口コミ数が十分溜まったらtrueに戻す）
const SHOW_PAID_OPTIONS = false;

import { PenSquare, Coins, CreditCard, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface UnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  therapistName: string;
  therapistId: number;
  isLoggedIn: boolean;
  reviewCredits: number;
  onWriteReview: () => void;
  onUnlockWithCredits: () => void;
}

export function UnlockModal({
  isOpen,
  onClose,
  therapistName,
  therapistId,
  isLoggedIn,
  reviewCredits,
  onWriteReview,
  onUnlockWithCredits,
}: UnlockModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">口コミを読むには</DialogTitle>
          <DialogDescription>
            {therapistName}さんの口コミを閲覧するには、以下のいずれかの方法をお選びください
          </DialogDescription>
        </DialogHeader>

        {isLoggedIn ? (
          <div className="space-y-4 pt-2">
            {/* Primary CTA - Write a review */}
            <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
              <Button
                onClick={onWriteReview}
                size="lg"
                className="w-full text-base h-12"
              >
                <PenSquare className="h-5 w-5 mr-2" />
                口コミを投稿して無料で読む
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                1投稿で5件の口コミが読めます（スクショ付きなら10件）
              </p>
            </div>

            {/* Credit unlock option */}
            {reviewCredits > 0 && (
              <Button
                variant="outline"
                onClick={onUnlockWithCredits}
                className="w-full"
              >
                <Coins className="h-4 w-4 mr-2" />
                クレジットで読む（残り{reviewCredits}クレジット）
              </Button>
            )}

            {/* Divider + Single purchase（SHOW_PAID_OPTIONS で制御） */}
            {SHOW_PAID_OPTIONS && (
              <>
                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">または</span>
                  <Separator className="flex-1" />
                </div>
                <div className="text-center">
                  <a
                    href={`/api/checkout/single-unlock?therapist_id=${therapistId}`}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    ¥1,000で永久アンロック
                  </a>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Not logged in state */
          <div className="space-y-4 pt-2">
            <Button
              asChild
              size="lg"
              className="w-full text-base h-12"
            >
              <a href="/register">
                <UserPlus className="h-5 w-5 mr-2" />
                無料登録して口コミを読む
              </a>
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              登録後、口コミを投稿するとクレジットがもらえます
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
