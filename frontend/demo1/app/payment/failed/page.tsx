import { XCircle } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "決済失敗 | メンエスSKR",
  robots: { index: false },
};

export default function PaymentFailedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        <XCircle className="h-16 w-16 text-red-500 mx-auto" />
        <h1 className="text-2xl font-bold">決済に失敗しました</h1>
        <p className="text-muted-foreground">
          申し訳ありません。決済処理に失敗しました。
          <br />
          カード情報をご確認の上、再度お試しください。
        </p>
        <Link
          href="/"
          className="inline-block mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          トップページへ戻る
        </Link>
      </div>
    </div>
  );
}
