# メンエスSKR プロジェクトガイド

> 作業ルール → `.claude/rules/work-rules.md`
> スクレイピング運用・VPS・分類マスタ → `database/therapist-scraper/CLAUDE.md`
> 過去の実装経緯 → `docs/DEVELOPMENT_LOG.md`

## プロジェクト概要

メンズエステ口コミサイト「メンエスSKR」。競合「ME」を超える「発見」体験を提供。
**コアコンセプト**: 「"確認"で終わるサイトから、"発見"が始まるサイトへ」

### 技術スタック

- **Frontend**: Next.js (App Router), Tailwind CSS, ShadcnUI, Lucide Icons, Framer Motion, Recharts
- **Backend/DB**: Supabase (PostgreSQL, Auth, Storage)
- **Infrastructure**: Vercel (GitHub連携自動デプロイ) + Cloudflare (DNS only)
- **Data Pipeline**: Python + Claude API (Haiku)

### ビジネスモデルと現在のフェーズ

**収益モデル**: スタンダード(¥4,980/月) / VIP(¥14,980/月) のサブスクリプション
**現在のフェーズ**: サイト公開キャンペーン（口コミ数でMEを超えるまで）

- 今は口コミ投稿数を最大化するフェーズ。有料プランは「準備中」
- **「無料」「¥0」「永久無料」という表現は使わない**。正しくは「キャンペーン中」「期間限定」
- 理由: 永久無料と見せると投稿の緊急性がなくなる。「今のうちに投稿しないと損」という動機づけが重要
- 口コミが十分集まったタイミングでStripe接続（B2）して有料プランに切り替え
- UI上の判断に迷ったら「口コミ投稿数が最大化するか？」を基準にする

### 会員体系

未登録 / 無料（未投稿） / 無料（投稿済み） / スタンダード(¥4,980) / VIP(¥14,980)
→ 詳細は `docs/SERVICE_OVERVIEW.md` セクション4

## 現在のステータス（2026-03-22更新）

| 項目 | 状態 | 数値 | 備考 |
|------|------|------|------|
| サロンDB | ✅ | 8,776店（本番投入済み） | 151件公開済み、段階公開中（~1,000/日） |
| セラピストDB | ✅ | 129,645名（本番投入済み） | 4,745件が公開サロンに紐づく |
| seed口コミ | ✅ | 11,132件（本番投入済み） | |
| エリアDB | ✅ | 821エリア | salon_areas 16,047件 |
| フロントエンド | ✅ | 本番稼働中 | menes-skr.com |
| 画像パイプライン | ✅ | 406,620枚 Storage転送済み（10GB） | |
| 口コミクレジット制 | ✅ | E2E確認済み | 投稿→承認→クレジット→アンロック→ペイウォール |
| 認証 | ✅ | E2E確認済み | ゲスト投稿→登録（MEモデル） |
| 管理画面 | ✅ | E2E確認済み | 承認/却下（直接DB操作方式）、タブ別lazy fetch |
| SEO/Sitemap | ✅ | 実装済み | SSR化 + sitemap分割 + canonical + JSON-LD + Indexing API + SEOコンテンツ19,285件 |
| Stripe決済 | ⬜ | 未接続 | env vars未設定（B2）。コード実装済み、フラグでUI非表示 |
| メール通知 | ⬜ | 未接続 | Resend SMTP未設定（B3） |

## 残りブランチ

| ID | 内容 | 依存 | 状態 |
|----|------|------|------|
| B1 | 全量データ投入 | - | ✅ 完了（段階公開中、pg_cronで毎朝~1,000件公開） |
| B2 | Stripe接続 | - | ⬜ コード実装済み、env vars未設定 |
| B3 | メール通知(Resend) | - | ⬜ |
| B4 | インデックス最適化 | B1 | ✅ SSR化完了、サイトマップ修正、Indexing API設定済み、SEOコンテンツ投入済み |
| B5 | 本番E2Eテスト | B2,B3 | ⬜ |

```
B1（データ投入）──→ B4（インデックス）
                        ↘
B2（Stripe）──────────→ B5（E2E通しテスト）
                        ↗
B3（メール）────────────
```

### B1: 全量データ投入（✅ 完了）
- 全量投入済み。段階公開: pg_cronで毎朝JST 9:00にpublished_atをセット
- 画像: 406,620枚 Supabase Storage転送済み（10GB）
- VPS契約は2026-04-30まで

### B2: Stripe接続
- Vercel env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SINGLE_UNLOCK_PRICE_ID`
- Stripe dashboardでwebhookエンドポイント登録（`/api/stripe/webhook`）

### B3: メール通知
- Resendでドメイン認証（menes-skr.com）→ Supabase Auth SMTP設定
- 3種: 承認通知 / 却下通知 / 登録確認

### B5: 本番E2Eテスト
- 全フロー通し: 登録→投稿→承認→クレジット→アンロック→課金→メール

## 開発ワークフロー: Agent Loop

```
1. Claude: タスク分解 → 独立した修正トラックに分割
2. Codex (GPT-5.4): 並列でコード生成（codex exec でdiff出力）
3. Claude: diffをレビュー → 適用
4. next build: ビルド確認
5. Codex: codex review --uncommitted で最終レビュー
6. 問題あり → 3に戻る / 問題なし → ユーザーに結果サマリを返す
```

| メンバー | モデル | 役割 |
|---------|--------|------|
| Claude Code | Opus 4.6 | オーケストレーション・設計判断・適用 |
| Codex CLI | GPT-5.4 | コード生成・レビュー・セカンドオピニオン |

## 環境情報

### ローカル開発
```bash
open -a Docker && supabase start   # 起動
cd frontend/demo1 && pnpm dev      # フロント起動
```
- Studio: http://127.0.0.1:54323
- DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- **`supabase db reset` は使用禁止**（work-rules.md参照）

### 本番環境
```
Cloudflare（menes-skr.com, DNS only）→ Vercel（Next.js）→ Supabase（DB + Auth + Storage）
                                                              ↑ VPS（スクレイピングBot）
```

### VPS
→ 詳細は `database/therapist-scraper/CLAUDE.md`
```bash
ssh -i ~/Downloads/indexer.pem root@220.158.18.6
```

### 外部API
- **DataForSEO**: https://app.dataforseo.com/ / クレデンシャル: `database/.env`
- **Claude API**: claude-haiku-4-5-20251001 / クレデンシャル: `database/.env`

## ディレクトリ構造

```
/menethe-indexer/
├── CLAUDE.md                    ← このファイル
├── .claude/rules/               ← 作業ルール
├── docs/
│   ├── SERVICE_OVERVIEW.md      ← サービス概要書（最重要）
│   ├── SYSTEM_DESIGN.md         ← システム設計・DBスキーマ
│   ├── DEVELOPMENT_LOG.md       ← 過去の実装経緯
│   ├── N1_FEATURE_STRATEGY.md   ← N1ペルソナ機能戦略
│   └── archive/                 ← 陳腐化ドキュメント
├── supabase/
│   ├── config.toml / seed.sql
│   └── migrations/              ← DBマイグレーション
├── database/
│   ├── .env                     ← API認証情報（git管理外）
│   ├── esthe-ranking/           ← エリアマスタ・サロン数データ
│   ├── seed_reviews/            ← ME口コミリライト＆投入パイプライン
│   └── therapist-scraper/       ← セラピストスクレイパー（CLAUDE.mdあり）
├── frontend/demo1/              ← Next.js App Router
│   ├── app/                     ← ページ（area, search, therapist, salon, review等）
│   └── components/              ← home, layout, review, shared, therapist, ui
└── menesthejp/                  ← 競合MEのHTML（分析用）
```

## 注意・落とし穴

- 変数名は `salon` に統一済み（3/11）。マイグレーション内部やVPS側に `shop_id` が残る場合あり
- Supabase Local: 54322(DB) / 54321(API) / 54323(Studio)。本番とポート混同注意
- `therapists.image_urls` は jsonb配列。Storage転送済み（406,620枚）
- seed口コミのリライトはSonnet Batch API使用（直接APIは5倍コスト）
- VPS契約は2026-04-30まで

## インデックス戦略

### 方針: sitemap分割 + 優先送信（実装済み）

```
sitemap-index.xml
  ├ sitemap-areas.xml               ← GSC送信済み
  ├ sitemap-salons.xml              ← GSC送信済み
  ├ sitemap-therapists-reviewed.xml ← GSC送信済み（口コミありセラピスト）
  ├ sitemap-therapists-1.xml        ← 送信しない（indexから辿れる）
  └ ...
```

- 全ページ `index, follow`（noindex不使用）
- canonical全ページ設定済み
- JSON-LD: BreadcrumbList + WebSite SearchAction設定済み

### GSC監視項目
- 「クロール済み - インデックス未登録」の推移
- エリアページのインデックス率
- クロール頻度の推移

## 機能戦略（N1分析ベース）

→ 詳細は `docs/N1_FEATURE_STRATEGY.md`

1. **ハズレ回避** → 相性ラベル・同好ユーザー評価分布
2. **発見** → 発見検索 + 根拠付きレコメンド（コア機能）
3. **推し追跡** → 移籍検知 + 通知（person_idでDB紐づけ）
4. **共有** → 口コミの反響可視化（閲覧数・参考になった・リプライ）
5. **自己理解** → 嗜好マップ（円グラフ、投稿するほど精度UP）

設計原則: 口コミが全ての中心。掲示板・DM・レビュアーランクは不要。

## ME口コミ移行

マッチング: URL直接一致 → ドメイン+名前 → サロン名+名前
実行: `database/seed_reviews/` の step1〜3
接続先: ME Supabase `~/Desktop/menesthe-db/.env`

## 未解決課題

- **スクレイピング取り漏れ**: SNSリンク、趣味、得意施術、コース料金表、サロン写真、指名料（キャッシュHTMLから追加抽出可能）
- **Supabase長期依存リスク**: 7年運営での単一障害点。代替: GCP / AWS / セルフホスト
