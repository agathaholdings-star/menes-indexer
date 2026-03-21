import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30 mt-12">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" prefetch={false} className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-primary leading-none">SKR</span>
              <span className="text-[10px] font-medium text-muted-foreground">メンズエステの口コミ体験談サイト</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              メンズエステの口コミ体験談サイト
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="mb-3 font-semibold">サイトマップ</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" prefetch={false} className="text-muted-foreground hover:text-foreground">
                  トップページ
                </Link>
              </li>
              <li>
                <Link href="/area" prefetch={false} className="text-muted-foreground hover:text-foreground">
                  エリア検索
                </Link>
              </li>
              <li>
                <Link href="/ranking" prefetch={false} className="text-muted-foreground hover:text-foreground">
                  ランキング
                </Link>
              </li>
              <li>
                <Link href="/search" prefetch={false} className="text-muted-foreground hover:text-foreground">
                  セラピスト検索
                </Link>
              </li>
            </ul>
            <h3 className="mb-3 mt-6 font-semibold">タイプから探す</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/type/1" prefetch={false} className="text-muted-foreground hover:text-foreground">清楚系</Link></li>
              <li><Link href="/type/2" prefetch={false} className="text-muted-foreground hover:text-foreground">素人系</Link></li>
              <li><Link href="/type/3" prefetch={false} className="text-muted-foreground hover:text-foreground">ギャル系</Link></li>
              <li><Link href="/type/4" prefetch={false} className="text-muted-foreground hover:text-foreground">モデル系</Link></li>
              <li><Link href="/type/5" prefetch={false} className="text-muted-foreground hover:text-foreground">ロリ系</Link></li>
              <li><Link href="/type/6" prefetch={false} className="text-muted-foreground hover:text-foreground">女優系</Link></li>
              <li><Link href="/type/7" prefetch={false} className="text-muted-foreground hover:text-foreground">夜職系</Link></li>
              <li><Link href="/type/8" prefetch={false} className="text-muted-foreground hover:text-foreground">熟女系</Link></li>
            </ul>
          </div>

          {/* Member */}
          <div>
            <h3 className="mb-3 font-semibold">会員メニュー</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/login" prefetch={false} className="text-muted-foreground hover:text-foreground">
                  ログイン
                </Link>
              </li>
              <li>
                <Link href="/login?tab=register" prefetch={false} className="text-muted-foreground hover:text-foreground">
                  新規登録
                </Link>
              </li>
              <li>
                <Link href="/pricing" prefetch={false} className="text-muted-foreground hover:text-foreground">
                  料金プラン
                </Link>
              </li>
              <li>
                <Link href="/mypage" prefetch={false} className="text-muted-foreground hover:text-foreground">
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
                <Link href="/legal/tokushoho" prefetch={false} className="text-muted-foreground hover:text-foreground">
                  特定商取引法に基づく表記
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" prefetch={false} className="text-muted-foreground hover:text-foreground">
                  利用規約
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" prefetch={false} className="text-muted-foreground hover:text-foreground">
                  プライバシーポリシー
                </Link>
              </li>
              <li>
                <Link href="/contact" prefetch={false} className="text-muted-foreground hover:text-foreground">
                  お問い合わせ
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2026 SKR. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
