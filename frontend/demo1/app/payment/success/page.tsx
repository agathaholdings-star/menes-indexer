import { CheckCircle } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "決済完了 | メンエスSKR",
  robots: { index: false },
};

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        <h1 className="text-2xl font-bold">決済が完了しました</h1>
        <p className="text-muted-foreground">
          ご利用ありがとうございます。決済処理が正常に完了しました。
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
