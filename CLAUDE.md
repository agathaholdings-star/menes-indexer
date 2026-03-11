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

### 会員体系

未登録 / 無料（未投稿） / 無料（投稿済み） / スタンダード(¥4,980) / VIP(¥14,980)
→ 詳細は `docs/SERVICE_OVERVIEW.md` セクション4

## 現在のステータス（2026-03-11更新）

| 項目 | 状態 | 数値 | 備考 |
|------|------|------|------|
| サロンDB | ✅ | 8,776店(ローカル) / 37店(本番) | B1で全量投入 |
| セラピストDB | ✅ | 128,636名(ローカル) / 1,009名(本番) | B1で全量投入 |
| seed口コミ | ✅ | 11,446件(ローカル) / 252件(本番) | B1で全量投入 |
| エリアDB | ✅ | 821エリア | salon_areas 16,075件 |
| フロントエンド | ✅ | 本番稼働中 | menes-skr.com |
| 画像パイプライン | ✅ | 114,756人Storage済み | 10,926人外部URL、2,954人画像なし |
| 口コミクレジット制 | ✅ | E2E確認済み | 投稿→承認→クレジット→アンロック→ペイウォール |
| 認証 | ✅ | E2E確認済み | ゲスト投稿→登録（MEモデル） |
| 管理画面 | ✅ | E2E確認済み | 承認/却下（直接DB操作方式） |
| SEO/Sitemap | ✅ | 実装済み | sitemap index + 分割 + canonical + JSON-LD |
| Stripe決済 | ⬜ | 未接続 | env vars未設定（B2） |
| メール通知 | ⬜ | 未接続 | Resend SMTP未設定（B3） |
| 全量データ投入 | ⬜ | 未実施 | 最優先（B1） |

## 残りブランチ

| ID | 内容 | 依存 | 状態 |
|----|------|------|------|
| B1 | 全量データ投入 | - | ⬜ 最優先 |
| B2 | Stripe接続 | - | ⬜ |
| B3 | メール通知(Resend) | - | ⬜ |
| B4 | インデックス最適化 | B1 | 🔄 sitemap実装済み、GSC監視中 |
| B5 | 本番E2Eテスト | B1,B2,B3 | ⬜ |

```
B1（データ投入）──→ B4（インデックス）
                        ↘
B2（Stripe）──────────→ B5（E2E通しテスト）
                        ↗
B3（メール）────────────
```

### B1: 全量データ投入（最優先）
- ローカルDBから pg_dump → 本番Supabaseに psql で投入
- 画像Storage: ローカル114,756人分 → 本番Storageに転送
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
- `therapists.image_urls` は jsonb配列。外部URLのまま → B1で Storage移行必要
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
