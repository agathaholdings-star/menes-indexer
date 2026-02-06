import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30 mt-12">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-primary-foreground">ME</span>
              </div>
              <span className="text-lg font-bold">メンエスインデクサ</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              タイプで選ぶ次世代メンズエステ口コミプラットフォーム
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="mb-3 font-semibold">サイトマップ</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-foreground">
                  トップページ
                </Link>
              </li>
              <li>
                <Link href="/area" className="text-muted-foreground hover:text-foreground">
                  エリア検索
                </Link>
              </li>
              <li>
                <Link href="/ranking" className="text-muted-foreground hover:text-foreground">
                  ランキング
                </Link>
              </li>
              <li>
                <Link href="/bbs" className="text-muted-foreground hover:text-foreground">
                  掲示板
                </Link>
              </li>
            </ul>
          </div>

          {/* Member */}
          <div>
            <h3 className="mb-3 font-semibold">会員メニュー</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/login" className="text-muted-foreground hover:text-foreground">
                  ログイン
                </Link>
              </li>
              <li>
                <Link href="/login?tab=register" className="text-muted-foreground hover:text-foreground">
                  新規登録
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
                  料金プラン
                </Link>
              </li>
              <li>
                <Link href="/mypage" className="text-muted-foreground hover:text-foreground">
                  マイページ
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-3 font-semibold">運営情報</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/legal/tokushoho" className="text-muted-foreground hover:text-foreground">
                  特定商取引法に基づく表記
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="text-muted-foreground hover:text-foreground">
                  利用規約
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="text-muted-foreground hover:text-foreground">
                  プライバシーポリシー
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-foreground">
                  お問い合わせ
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>SHIMATOMO ITALY S.R.L.S.</p>
          <p>VIA DEL LAURO 9 20121 MILANO MI ITALY</p>
          <p className="mt-4">&copy; 2024 メンエスインデクサ. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
