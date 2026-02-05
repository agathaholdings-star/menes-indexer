import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export default function TokushohoPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">特定商取引法に基づく表記</h1>

          <div className="space-y-6">
            <table className="w-full border-collapse">
              <tbody className="divide-y">
                <tr>
                  <th className="py-4 px-4 text-left bg-muted/50 w-1/3 font-medium">販売事業者名</th>
                  <td className="py-4 px-4">メンエスインデクサ</td>
                </tr>
                <tr>
                  <th className="py-4 px-4 text-left bg-muted/50 font-medium">運営責任者</th>
                  <td className="py-4 px-4">
                    株式会社AGATHA<br />
                    高橋勇気
                  </td>
                </tr>
                <tr>
                  <th className="py-4 px-4 text-left bg-muted/50 font-medium">所在地</th>
                  <td className="py-4 px-4">
                    〒107-0061<br />
                    東京都港区北青山１丁目３－１－３階
                  </td>
                </tr>
                <tr>
                  <th className="py-4 px-4 text-left bg-muted/50 font-medium">電話番号</th>
                  <td className="py-4 px-4">
                    03-5414-3355<br />
                    営業時間：10:00〜18:00（土日祝を除く）
                  </td>
                </tr>
                <tr>
                  <th className="py-4 px-4 text-left bg-muted/50 font-medium">メールアドレス</th>
                  <td className="py-4 px-4">menethe-hacks@gmail.com</td>
                </tr>
                <tr>
                  <th className="py-4 px-4 text-left bg-muted/50 font-medium">販売URL</th>
                  <td className="py-4 px-4">https://menes-indexer.com</td>
                </tr>
                <tr>
                  <th className="py-4 px-4 text-left bg-muted/50 font-medium">販売価格</th>
                  <td className="py-4 px-4">
                    各商品ページに税込価格で表示します。<br />
                    スタンダード会員: 月額4,980円（税込）<br />
                    VIP会員: 月額14,980円（税込）
                  </td>
                </tr>
                <tr>
                  <th className="py-4 px-4 text-left bg-muted/50 font-medium">商品代金以外の必要料金</th>
                  <td className="py-4 px-4">
                    <ul className="list-disc list-inside space-y-1">
                      <li>インターネット接続にかかる通信費（利用者負担）</li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <th className="py-4 px-4 text-left bg-muted/50 font-medium">お支払い方法</th>
                  <td className="py-4 px-4">
                    <ul className="list-disc list-inside space-y-1">
                      <li>クレジットカード（Stripe）</li>
                      <li>デビットカード</li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <th className="py-4 px-4 text-left bg-muted/50 font-medium">決済時期</th>
                  <td className="py-4 px-4">購入時に即時決済となります。</td>
                </tr>
                <tr>
                  <th className="py-4 px-4 text-left bg-muted/50 font-medium">商品の引き渡し時期</th>
                  <td className="py-4 px-4">
                    デジタルコンテンツ（会員サービス）は、決済完了後すぐにご利用いただけます。
                  </td>
                </tr>
                <tr>
                  <th className="py-4 px-4 text-left bg-muted/50 font-medium">返品・キャンセルについて</th>
                  <td className="py-4 px-4">
                    デジタルコンテンツの性質上、お客様都合による返品・返金には応じておりません。<br />
                    解約はいつでも可能で、解約後も契約期間終了までサービスをご利用いただけます。
                  </td>
                </tr>
                <tr>
                  <th className="py-4 px-4 text-left bg-muted/50 font-medium">不良品・サービスの提供不備について</th>
                  <td className="py-4 px-4">
                    サービスに不具合が発生した場合は、メールにてご連絡ください。<br />
                    確認の上、対応いたします。
                  </td>
                </tr>
                <tr>
                  <th className="py-4 px-4 text-left bg-muted/50 font-medium">動作環境</th>
                  <td className="py-4 px-4">
                    最新のGoogle Chrome、Safari、Firefox、Microsoft Edgeに対応しています。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-sm text-muted-foreground mt-8">
            最終更新日: 2024年1月1日
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
