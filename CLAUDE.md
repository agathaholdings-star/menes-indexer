# メンエスインデクサ プロジェクトガイド

> 作業ルール → `.claude/rules/work-rules.md`
> スクレイピング運用・VPS・分類マスタ → `database/therapist-scraper/CLAUDE.md`
> 過去の実装経緯 → `docs/DEVELOPMENT_LOG.md`

## 開発ワークフロー: Agent Loop（推奨）

複数ファイルの修正・機能追加には以下のCodex協調ループを使う。ユーザー確認は最小限にし、AI同士でビルド通過まで回す。

```
1. Claude: タスク分解 → 独立した修正トラックに分割
2. Codex (GPT-5.4): 並列でコード生成（codex exec でdiff出力）
3. Claude: diffをレビュー → 適用
4. next build: ビルド確認
5. Codex: codex review --uncommitted で最終レビュー
6. 問題あり → 3に戻る / 問題なし → ユーザーに結果サマリを返す
```

**原則:**
- Codex にはコード生成とレビューを任せ、Claude がオーケストレーション（タスク分解・適用・統合）
- 3トラック以上を並列で回してスループット最大化
- ビルド + Codexレビューが両方通るまでループ。ユーザーに聞くのは設計判断が必要な時だけ
- `codex exec` で unified diff を出力させ、Claude が Edit で適用する形式が安定

**チーム構成:**
| メンバー | モデル | 役割 |
|---------|--------|------|
| Claude Code | Opus 4.6 | オーケストレーション・設計判断・適用 |
| Codex CLI | GPT-5.4 | コード生成・レビュー・セカンドオピニオン |

## 現在のステータス (2026-03-06 更新)

| 項目 | 状態 | 数値 | 備考 |
|------|------|------|------|
| サロンDB | ✅ | 8,776店 | ローカル完了。本番は7店のみ（B1で全量投入） |
| エリアDB | ✅ | 821エリア | salon_areas 16,075件（216エリア補完済み） |
| セラピストDB | ✅ | 128,636名 | ローカル完了。本番は70名のみ（B1で全量投入） |
| seed口コミ | ✅ | 11,446件 | ローカル完了。本番は71件のみ（B1で全量投入） |
| サロン紹介文 | ✅ | 6,489件 | SERP+Sonnet Batch生成済み |
| フロントエンド | ✅ | 本番稼働中 | menes-skr.com |
| 画像パイプライン | ✅ | 114,756人Storage済み | 10,926人外部URL、2,954人画像なし |
| 口コミクレジット制 | ✅ | E2E確認済み | 投稿→承認→クレジット→アンロック→枯渇時ペイウォール |
| 認証 | ✅ | E2E確認済み | 登録→メール確認→ログイン→マイページ |
| 管理画面 | ✅ | E2E確認済み | 承認/却下（直接DB操作方式、RPC不使用） |
| Stripe決済 | ⬜ | 未接続 | env vars未設定（B2） |
| メール通知 | ⬜ | 未接続 | Resend SMTP未設定（B3） |
| 全量データ投入 | ⬜ | 未実施 | 最優先（B1） |

## セッション開始時の確認事項

**新しいセッションを開始したら、まずユーザーに以下を聞くこと:**

1. 「今日はどのブランチをやりますか？」（下の表を提示）
2. 「前回の作業で気になった点や方針変更はありますか？」
3. 「作業時間の目安はどのくらいですか？」（ブランチの優先順位調整用）

## 残りブランチ表（2026-03-06 時点）

| ID | ブランチ | 依存 | 完了条件 | 所要目安 | 状態 |
|----|---------|------|---------|---------|------|
| B1 | 全量データ投入 | - | 本番DBに8,776サロン+128,636セラピスト+11,446口コミ | 半日 | ⬜ |
| B2 | Stripe接続 | - | Vercel env vars設定→サブスク購入→会員タイプ変更が動作 | 半日 | ⬜ |
| B3 | メール通知(Resend SMTP) | - | 承認/却下/登録確認メールが実際に届く | 2時間 | ⬜ |
| B4 | インデックス確認 | B1 | GSCでクロール状況確認→sitemap分割実装→優先sitemap送信 | 1時間+待ち | ⬜ |
| B5 | 本番E2Eテスト | B1,B2,B3 | 全量データで登録→投稿→承認→クレジット→アンロック→課金の全フロー通し | 半日 | ⬜ |

### 依存グラフ

```
B1（データ投入）──→ B4（インデックス）
                        ↘
B2（Stripe）──────────→ B5（E2E通しテスト）
                        ↗
B3（メール）────────────
```

B1, B2, B3 は並列可能（ディレクトリが被らない）。B4はB1完了後。B5は全部揃ってから。

### 各ブランチの作業概要

**B1: 全量データ投入（最重要・最優先）**
- ローカルDBから pg_dump（salons, therapists, reviews, areas, salon_areas等）
- 本番Supabaseに psql で投入
- 画像Storage: ローカル114,756人分 → 本番Storageに転送（バックグラウンド）
- 注意: VPS契約は2026-04-30まで

**B2: Stripe接続**
- Vercel env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SINGLE_UNLOCK_PRICE_ID`
- Stripe dashboardでwebhookエンドポイント登録（`/api/stripe/webhook`）
- テストモードで購入→会員タイプ変更テスト

**B3: メール通知**
- Resendでドメイン認証（menes-skr.com）
- Supabase Auth → SMTP設定にResendクレデンシャル入力
- 管理画面の承認/却下メール送信テスト

**B4: インデックス確認**
- `sitemap.ts` → sitemap index + 分割ファイル構成に改修
- GSCで優先sitemapのみ送信
- クロール状況モニタリング開始

**B5: 本番E2Eテスト**
- 全量データで全ページ表示確認
- 新規登録→投稿→承認→クレジット→アンロックの通しテスト
- Stripe課金テスト
- メール受信確認

## プロジェクト概要

メンズエステ口コミサイト「メンエスSKR」。競合「ME」を超える「発見」体験を提供。
**コアコンセプト**: 「"確認"で終わるサイトから、"発見"が始まるサイトへ」

### 技術スタック

- **Frontend**: Next.js (App Router), Tailwind CSS, ShadcnUI, Lucide Icons, Framer Motion, Recharts
- **Backend/DB**: Supabase (PostgreSQL, Auth, Storage)
- **Infrastructure**: Vercel + Cloudflare
- **Data Pipeline**: Python + Claude API (Haiku)

### 会員体系

未登録 / 無料（未投稿） / 無料（投稿済み） / スタンダード(¥4,980) / VIP(¥14,980)
→ 詳細は `docs/SERVICE_OVERVIEW.md` セクション4

### ME口コミ移行

マッチング: URL直接一致 → ドメイン+名前 → サロン名+名前。実行は `database/seed_reviews/` の step1〜3。
接続先: ME Supabase `~/Desktop/menesthe-db/.env` / Indexer `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

## 環境情報

### ローカル開発

```bash
open -a Docker && supabase start   # 起動
supabase db reset                  # マイグレーション+シード再実行
cd frontend/demo1 && pnpm dev      # フロント起動
```

- Studio: http://127.0.0.1:54323
- DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

### 本番環境

```
Cloudflare（menes-indexer.com + CDN + DNS）→ Vercel（Next.js）→ Supabase（DB + Auth + Storage）
                                                                      ↑ VPS（スクレイピングBot）
```

### VPS

→ 詳細は `database/therapist-scraper/CLAUDE.md`

```bash
ssh -i ~/Downloads/indexer.pem root@220.158.18.6
```

## 外部API

- **DataForSEO**: https://app.dataforseo.com/ / クレデンシャル: `database/.env`
- **Claude API**: claude-haiku-4-5-20251001 / クレデンシャル: `database/.env`

## Directory Structure

```
/menethe-indexer/
├── CLAUDE.md                    ← このファイル
├── .claude/rules/               ← 作業ルール
├── docs/
│   ├── DEVELOPMENT_LOG.md       ← 過去の実装経緯アーカイブ
│   ├── SERVICE_OVERVIEW.md      ← サービス概要書（最重要）
│   ├── SYSTEM_DESIGN.md         ← システム設計・DBスキーマ
│   ├── AREA_DESIGN.md           ← エリア設計詳細
│   ├── SALON_DISCOVERY_DESIGN.md ← サロン発見パイプライン
│   ├── SERVICE_DESIGN_V2.md     ← サービス設計v2
│   ├── V0_PROMPTS.md            ← フロントエンド生成プロンプト
│   └── archive/                 ← 陳腐化ドキュメント
├── supabase/
│   ├── config.toml / seed.sql
│   └── migrations/              ← DBマイグレーション（26件）
├── database/
│   ├── .env                     ← API認証情報（git管理外）
│   ├── esthe-ranking/           ← エリアマスタ・サロン数データ
│   ├── seed_reviews/            ← ME口コミリライト＆投入パイプライン
│   └── therapist-scraper/       ← セラピストスクレイパー（CLAUDE.mdあり）
├── frontend/demo1/              ← Next.js App Router
│   ├── app/                     ← ページ（area, search, therapist, shop, review等）
│   └── components/              ← home, layout, review, shared, therapist, ui
└── menesthejp/                  ← 競合MEのHTML（分析用）
```

## Important / 注意・落とし穴

- `shops`は`salons`にリネーム済みだが、マイグレーション内部やVPS側の一部コードに`shop_id`が残っている場合がある
- Supabase Localのポートは54322（DB）/ 54321（API）/ 54323（Studio）。本番とポートが違うので混同注意
- `therapists.image_urls`はjsonb配列。外部URLのままなので本番前にStorage移行が必要。don't skip this
- seed口コミのリライトはSonnet Batch API使用。直接APIだと5倍以上コストがかかる
- VPS契約は2026-04-30まで。それまでにデータ移行を完了すること

## 機能戦略（N1分析ベース）

→ 詳細は `docs/N1_FEATURE_STRATEGY.md`

N1ペルソナ「ケンジ」の5つの欲から逆算した機能設計:
1. **ハズレ回避** → 相性ラベル・同好ユーザー評価分布
2. **発見** → 発見検索 + 根拠付きレコメンド（コア機能）
3. **推し追跡** → 移籍検知 + 通知（person_idでDB紐づけ）
4. **共有** → 掲示板は作らない。口コミの反響可視化（閲覧数・参考になった・リプライ）で代替
5. **自己理解** → 嗜好マップ（円グラフ、投稿するほど精度UP）

設計原則: 口コミが全ての中心。掲示板・DM・レビュアーランクは不要。MEのコピーではなく独自の価値提供。

## インデックス戦略（ローンチ時最重要）

### 前提

- 全228,816セラピスト + 6,489サロンのデータは**Day 1から全件存在**（口コミの紐づけ先＝器が必要）
- 全ページ `index, follow`（noindexは使わない。口コミなしページも検索流入→口コミ獲得の導線になる）
- ただし新規ドメインで22万URL一気にsitemap送信はクロールバジェット的に非効率

### 方針: sitemap分割 + 優先送信

sitemapに全件載せるが、GSCへの**明示的送信は優先ファイルだけ**。残りはsitemap indexから自然発見させる。

```
sitemap-index.xml
  ├ sitemap-areas.xml               ← GSC送信（868件: 都道府県47+エリア821）
  ├ sitemap-salons.xml              ← GSC送信（6,489件）
  ├ sitemap-therapists-reviewed.xml ← GSC送信（動的: 口コミありセラピスト）
  ├ sitemap-therapists-1.xml        ← 送信しない（indexから辿れる）
  ├ sitemap-therapists-2.xml
  └ ...
```

### なぜこれがベストか

1. **器は全部ある** — ユーザーはどのセラピストにも口コミ投稿可能
2. **Googleの第一印象を最適化** — 優先送信するのはコンテンツ充実ページのみ → ドメイン評価UP → クロールバジェット増加
3. **管理コストゼロ** — Phase管理不要。内部リンク（エリア→サロン→セラピスト）が自然にクロール導線になる
4. **口コミドリブン** — 新規口コミ投稿 → そのセラピストをreviewed sitemapに自動追加

### セラピストページ品質（薄くない根拠）

画像98.5%、プロフィール文88.5%、年齢90.6%、身長80.2%。口コミなしでもME同等以上の情報密度。

### GSC監視項目

- 「クロール済み - インデックス未登録」の推移 → 増えすぎたらページ品質改善
- エリアページのインデックス率 → 100%近くないと導線不全
- クロール頻度の推移 → 増加傾向なら健全

### 実装タスク（本番デプロイ後）

1. `sitemap.ts` → sitemap index + 分割ファイル構成に改修
2. GSCプロパティ登録 → 優先sitemapのみ送信
3. 口コミ投稿トリガー → reviewed sitemapへの自動追加

## 未解決課題

### 🟡 スクレイピング取り漏れデータ（将来対応）
SNSリンク、趣味、得意施術、コース料金表、サロン写真、指名料 — キャッシュ済みHTMLから追加抽出可能

### 🟡 Supabase長期依存リスク（要検討）
7年運営での単一障害点。代替: GCP / AWS / セルフホスト。本番デプロイ前に方針決定が望ましい
