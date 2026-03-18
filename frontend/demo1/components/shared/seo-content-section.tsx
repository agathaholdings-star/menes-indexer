"use client";

/**
 * SEOコンテンツセクション - page_contentsテーブルのデータを描画
 * AI生成コンテンツ（guide, highlights, area_info, salon_overview）用
 */
/**
 * プレーンテキストを構造化して描画
 * - 【見出し】→ h3タグ
 * - 連続改行 → 段落区切り
 * - 単一改行 → <br>
 */
function renderPlainText(text: string) {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, i) => {
    const trimmed = para.trim();
    if (!trimmed) return null;

    // 【見出し】パターン → 装飾付きH3
    const headingMatch = trimmed.match(/^【(.+?)】$/);
    if (headingMatch) {
      return (
        <h3
          key={i}
          className="text-base font-bold mt-8 mb-3 text-foreground pl-3 border-l-4 border-primary"
        >
          {headingMatch[1]}
        </h3>
      );
    }

    // 通常段落（改行を<br>に）
    const lines = trimmed.split("\n");
    return (
      <p key={i} className="mb-3">
        {lines.map((line, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {line}
          </span>
        ))}
      </p>
    );
  });
}

export function SeoContentSection({
  title,
  body,
  className = "",
}: {
  title?: string | null;
  body: string;
  className?: string;
}) {
  return (
    <section className={`mb-8 ${className}`}>
      {title && (
        <h2 className="text-xl font-bold mb-5 pb-2 border-b">{title}</h2>
      )}
      <div className="text-sm text-muted-foreground leading-relaxed space-y-0">
        {renderPlainText(body)}
      </div>
    </section>
  );
}

/**
 * FAQセクション - テンプレートまたはAI生成のFAQを描画
 * FAQ JSON-LDスキーマも同時に出力
 */
export function FaqSection({
  title,
  items,
}: {
  title: string;
  items: { question: string; answer: string }[];
}) {
  if (items.length === 0) return null;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <div className="space-y-4">
          {items.map((item, i) => (
            <details
              key={i}
              className="group border rounded-lg"
            >
              <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <span className="font-medium text-sm">{item.question}</span>
                <span className="text-muted-foreground group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

/**
 * セラピストページ用テンプレートセクション
 * menether.com/therapist/ の構造を参考に充実した内容
 * KW: {サロン名} {セラピスト名} 口コミ 評判 体験談
 */
export function TherapistGuideSection({
  therapistName,
  salonName,
  basePrice,
  businessHours,
  access,
  officialUrl,
  baseDuration,
  salonSummary,
}: {
  therapistName: string;
  salonName: string;
  basePrice?: number | null;
  businessHours?: string | null;
  access?: string | null;
  officialUrl?: string | null;
  baseDuration?: number | null;
  salonSummary?: string | null;
}) {
  const duration = baseDuration || 60;

  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold mb-5 pb-2 border-b">
        {salonName}{therapistName}さんの施術を受ける前に
      </h2>

      <div className="text-sm text-muted-foreground leading-relaxed space-y-6">
        {/* リード文 */}
        <p>
          {salonName}に在籍する{therapistName}さんの口コミや評判が気になっている方へ。
          初めてメンズエステを利用する場合、予約方法や料金、当日の流れなど不安に感じることも多いはずです。
          ここでは{therapistName}さんを指名する前に知っておきたい基本情報をまとめています。
        </p>

        {/* 基本情報テーブル */}
        <div>
          <h3 className="text-base font-bold mb-3 pl-3 border-l-4 border-primary text-foreground">
            {salonName}の基本情報
          </h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {access && (
                  <tr className="border-b">
                    <td className="px-4 py-2.5 bg-muted/30 font-medium text-foreground w-1/3">アクセス</td>
                    <td className="px-4 py-2.5">{access}</td>
                  </tr>
                )}
                {basePrice && (
                  <tr className="border-b">
                    <td className="px-4 py-2.5 bg-muted/30 font-medium text-foreground">料金</td>
                    <td className="px-4 py-2.5">{duration}分{basePrice.toLocaleString()}円〜</td>
                  </tr>
                )}
                {businessHours && (
                  <tr className="border-b">
                    <td className="px-4 py-2.5 bg-muted/30 font-medium text-foreground">営業時間</td>
                    <td className="px-4 py-2.5">{businessHours}</td>
                  </tr>
                )}
                {officialUrl && (
                  <tr>
                    <td className="px-4 py-2.5 bg-muted/30 font-medium text-foreground">公式サイト</td>
                    <td className="px-4 py-2.5">
                      <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        公式サイトを見る
                      </a>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* サロン紹介（短い版） */}
        {salonSummary && (
          <div>
            <h3 className="text-base font-bold mb-3 pl-3 border-l-4 border-primary text-foreground">
              {salonName}について
            </h3>
            <p>{salonSummary}</p>
          </div>
        )}

        {/* 予約方法 */}
        <div>
          <h3 className="text-base font-bold mb-3 pl-3 border-l-4 border-primary text-foreground">
            {salonName}で{therapistName}さんを予約する方法
          </h3>
          <p className="mb-2">
            {salonName}は完全予約制です。
            予約方法は主に電話予約とWEB予約の2種類があります。
          </p>
          <p className="mb-2">
            {therapistName}さんを指名したい場合は、予約時に「{therapistName}さんでお願いします」と伝えてください。
            人気のセラピストは予約が埋まりやすいため、希望日の2〜3日前には予約を入れておくと安心です。
          </p>
          {officialUrl && (
            <p>
              {salonName}の予約は{" "}
              <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                公式サイト
              </a>
              {" "}から行えます。
            </p>
          )}
        </div>

        {/* 料金について */}
        {basePrice && (
          <div>
            <h3 className="text-base font-bold mb-3 pl-3 border-l-4 border-primary text-foreground">
              {therapistName}さんの料金について
            </h3>
            <p className="mb-2">
              {salonName}の基本料金は{duration}分{basePrice.toLocaleString()}円〜です。
              これに加えて、セラピストのランクによる指名料（一般的に1,000〜3,000円程度）が別途かかる場合があります。
            </p>
            <p>
              コース時間は長いほど実質的な施術時間が増えるため、初めての方は90分以上のコースがおすすめです。
              {duration}分コースの場合、受付やシャワーの時間を含むため、実際の施術時間はやや短くなります。
            </p>
          </div>
        )}

        {/* 来店の流れ */}
        <div>
          <h3 className="text-base font-bold mb-3 pl-3 border-l-4 border-primary text-foreground">
            {salonName}での施術の流れ
          </h3>
          <div className="space-y-2">
            {[
              { step: "1", title: "予約", desc: `電話またはWEBで${salonName}に予約。${therapistName}さんの指名も可能です。` },
              { step: "2", title: "来店", desc: "予約時間の5分前を目安に到着。服装は普段着で問題ありません。" },
              { step: "3", title: "受付と着替え", desc: "受付を済ませたら、用意された施術着に着替えます。貴重品はロッカーへ。" },
              { step: "4", title: "シャワー", desc: "施術前にシャワーを浴びます。タオルやアメニティは店舗に完備されています。" },
              { step: "5", title: "施術", desc: `${therapistName}さんによるアロマオイルマッサージが始まります。` },
              { step: "6", title: "シャワーとお支払い", desc: "施術後にシャワーを浴びて着替え、受付でお支払いをして完了です。" },
            ].map((item) => (
              <div key={item.step} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                  {item.step}
                </span>
                <div>
                  <span className="font-medium text-foreground">{item.title}</span>
                  <span className="ml-2">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 持ち物とマナー */}
        <div>
          <h3 className="text-base font-bold mb-3 pl-3 border-l-4 border-primary text-foreground">
            持ち物とマナー
          </h3>
          <p className="mb-2">
            持ち物は特に必要ありません。タオル、施術着、アメニティ等は{salonName}に用意されています。
            財布とスマートフォンがあれば十分です。
          </p>
          <p>
            マナーとして大切なのは、時間を守ること、清潔感を保つこと、そしてセラピストへの敬意を持つことです。
            施術前のシャワーはマナーの基本です。気持ちよく過ごすために、お互いへの配慮を心がけましょう。
          </p>
        </div>

        {/* 口コミについて */}
        <div>
          <h3 className="text-base font-bold mb-3 pl-3 border-l-4 border-primary text-foreground">
            {therapistName}さんの口コミや評判を確認するには
          </h3>
          <p>
            {salonName}の{therapistName}さんの口コミや評判は、メンエスSKRに掲載されています。
            実際に施術を受けた方の体験談を参考にすることで、指名前の不安を解消できます。
            口コミの閲覧には会員登録が必要です。
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * サロンページ用テンプレートガイドセクション
 */
export function SalonGuideSection({
  salonName,
  basePrice,
  businessHours,
  access,
  officialUrl,
}: {
  salonName: string;
  basePrice?: number | null;
  businessHours?: string | null;
  access?: string | null;
  officialUrl?: string | null;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold mb-4">
        {salonName}に行く前に知っておくこと
      </h2>
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">予約方法</p>
            <p>
              {salonName}は完全予約制です。電話またはWEB予約でご予約ください。
              {officialUrl && (
                <>
                  {" "}
                  <a
                    href={officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    公式サイトはこちら
                  </a>
                </>
              )}
            </p>
          </div>
          {basePrice && (
            <div className="border rounded-lg p-3">
              <p className="font-medium text-foreground mb-1">料金目安</p>
              <p>60分{basePrice.toLocaleString()}円〜</p>
            </div>
          )}
          {businessHours && (
            <div className="border rounded-lg p-3">
              <p className="font-medium text-foreground mb-1">営業時間</p>
              <p>{businessHours}</p>
            </div>
          )}
          {access && (
            <div className="border rounded-lg p-3">
              <p className="font-medium text-foreground mb-1">アクセス</p>
              <p>{access}</p>
            </div>
          )}
        </div>
        <div className="border rounded-lg p-4 bg-muted/30">
          <p className="font-medium text-foreground mb-2">初めて{salonName}を利用する方へ</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>電話またはWEBで予約（セラピスト指名も可能）</li>
            <li>予約時間の5分前に来店</li>
            <li>受付後、施術着に着替え</li>
            <li>シャワーを浴びてから施術開始</li>
            <li>施術後、シャワー→着替え→お支払い</li>
          </ol>
          <p className="mt-2">持ち物は不要です。タオル・アメニティ等は店舗に完備されています。</p>
        </div>
      </div>
    </section>
  );
}
