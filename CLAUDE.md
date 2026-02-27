# メンエスインデクサ プロジェクトガイド

> 作業ルール → `.claude/rules/work-rules.md`
> スクレイピング運用・VPS・分類マスタ → `database/therapist-scraper/CLAUDE.md`
> 過去の実装経緯 → `docs/DEVELOPMENT_LOG.md`

## 現在のステータス (2026-02-24 更新)

| 項目 | 状態 | 数値 | 備考 |
|------|------|------|------|
| サロンDB | ✅ | 6,489店 | official_urlベースdedup済み |
| エリアDB | ✅ | 821エリア | DataForSEO SV付き |
| セラピストDB | 🔄 Phase④実行中 | 104,585名 | VPS W1/W5稼働中、他完了 |
| seed口コミ | ✅ | 16,462件 | URLマッチのみ、Sonnet Batch ~$48 |
| サロン紹介文 | ✅ | 6,489件 | SERP+Sonnet Batch生成済み |
| フロントエンド | ✅ | 動作確認済み | Next.js + ローカルSupabase |
| 画像パイプライン | ⏳ Phase④完了待ち | - | Haiku抽出済み、Storage DL未実行 |

## アクティブタスク

1. **Phase④: therapists全件再構築** ← 🔄 VPS実行中（W1/W5残り）
   - 完了後: 件数確認 → 品質検証 → pg_dumpローカル同期
2. **ME口コミ再マッチング** ← Phase④完了後
3. **画像DL→Supabase Storage** ← Phase④完了後
4. **本番デプロイ準備** ← インフラ方針決定後
5. **本番データ移行** ← VPSのpg_dumpを本番Supabaseに投入

## プロジェクト概要

メンズエステ口コミサイト「メンエスインデクサ」。競合「ME」を超える「発見」体験を提供。
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

## 未解決課題

### 🟡 スクレイピング取り漏れデータ（将来対応）
SNSリンク、趣味、得意施術、コース料金表、サロン写真、指名料 — キャッシュ済みHTMLから追加抽出可能

### 🟡 Supabase長期依存リスク（要検討）
7年運営での単一障害点。代替: GCP / AWS / セルフホスト。本番デプロイ前に方針決定が望ましい
