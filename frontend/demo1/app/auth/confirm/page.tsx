"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export default function ConfirmPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ConfirmContent />
    </Suspense>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">メール確認中...</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type") as "signup" | "email" | "recovery" | "invite" | undefined;

    if (!tokenHash || !type) {
      setStatus("error");
      setErrorMessage("無効なリンクです。");
      return;
    }

    const verify = async () => {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (error) {
        setStatus("error");
        setErrorMessage(
          error.message.includes("expired")
            ? "リンクの有効期限が切れています。もう一度登録してください。"
            : `確認に失敗しました: ${error.message}`
        );
        return;
      }

      setStatus("success");
      // 登録時に保存したリダイレクト先を取得
      const redirectTo = localStorage.getItem("auth_redirect") || "/mypage";
      localStorage.removeItem("auth_redirect");
      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 1500);
    };

    verify();
  }, [searchParams, router]);

  if (status === "loading") {
    return <LoadingState />;
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card>
          <CardContent className="p-8 text-center">
            <XCircle className="h-10 w-10 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-2">確認に失敗しました</h2>
            <p className="text-muted-foreground mb-4">{errorMessage}</p>
            <div className="flex gap-3 justify-center">
              <Button asChild variant="outline">
                <Link href="/register">もう一度登録する</Link>
              </Button>
              <Button asChild>
                <Link href="/login">ログインはこちら</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card>
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-primary mb-4" />
          <h2 className="text-xl font-bold mb-2">メール確認完了!</h2>
          <p className="text-muted-foreground">リダイレクト中...</p>
        </CardContent>
      </Card>
    </div>
  );
}
