# メンエスインデクサ プロジェクトガイド

## 作業ルール

- 1タスク完了ごとに git commit を提案すること
- コミット時は CLAUDE.md に「何をやったか」を簡潔に、詳細な経緯は `docs/DEVELOPMENT_LOG.md` に記録すること
- 大きな決定・進捗があれば CLAUDE.md を更新すること
- コンテキスト使用率が80%を超えたら新チャットへの切り替えを提案すること
- 画像を複数枚受け取った場合はコンテキスト消費が大きいことを意識すること
- スクレイピング時は必ずHTMLをgzip圧縮でローカル保存すること（`html_cache/{id}.html.gz`）
- **セラピスト抽出の成功判定**: 成功=有効name+有効source_urlでDB保存完了

## 現在のステータス (2026-02-24 更新)

| 項目 | 状態 | 数値 | 備考 |
|------|------|------|------|
| サロンDB | ✅ | 6,489店 | official_urlベースdedup済み |
| エリアDB | ✅ | 821エリア | DataForSEO SV付き |
| セラピストDB | 🔄 Phase④実行中 | ~13万名見込み | VPS 5並列、2026-02-23 15:21開始 |
| seed口コミ | ✅ | 14,879件 | ME口コミリライト済み（Sonnet Batch ~$35） |
| サロン紹介文 | ✅ | 6,489件 | SERP+Sonnet Batch生成済み |
| フロントエンド | ✅ | 動作確認済み | Next.js + ローカルSupabase |
| 画像パイプライン | ⏳ Phase④完了待ち | - | Haiku抽出済み、Storage DL未実行 |

### Phase④進捗確認コマンド
```bash
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "for i in 1 2 3 4 5; do echo \"=== W\$i ===\"; tail -1 /opt/scraper/w\$i.log; done && sudo -u postgres psql -d menethe -t -c 'SELECT count(*) FROM therapists'"
```

## アクティブタスク

1. **Phase④: therapists全件再構築** ← 🔄 VPS実行中
   - 全6,489サロンを新スクレイパーでゼロから再スクレイピング（source-first原則）
   - 完了後: 件数確認 → 品質検証 → pg_dumpローカル同期
2. **ME口コミ再マッチング** ← Phase④完了後
   - 新therapistsのsource_urlで再マッチング → リライト → DB投入
3. **画像DL→Supabase Storage** ← Phase④完了後
   - `batch_download_images.py` で外部URL → Storage保存 → DB差し替え
4. **本番デプロイ準備** ← インフラ方針決定後
   - 本番Supabaseスキーマpush → Vercel環境変数 → デプロイ
5. **本番データ移行**
   - VPSのpg_dumpを本番Supabaseに投入

## プロジェクト概要

メンズエステ口コミサイト「メンエスインデクサ」。競合「ME」を超える「発見」体験を提供。
**コアコンセプト**: 「"確認"で終わるサイトから、"発見"が始まるサイトへ」

### 技術スタック
- **Frontend**: Next.js (App Router), Tailwind CSS, ShadcnUI, Lucide Icons, Framer Motion, Recharts
- **Backend/DB**: Supabase (PostgreSQL, Auth, Storage)
- **Infrastructure**: Vercel + Cloudflare
- **Data Pipeline**: Python + Claude API (Haiku)

### 会員体系
| 状態 | 説明 |
|------|------|
| 未登録 | 閲覧のみ |
| 無料（未投稿） | 会員登録済み |
| 無料（投稿済み） | 数日間スタンダード相当 |
| スタンダード | 月額¥4,980、SKRフィルター解放 |
| VIP | 月額¥14,980、SKR+HRフィルター解放 |

## 環境情報

### ローカル開発環境（Supabase Local）
| 項目 | URL / 値 |
|------|----------|
| Supabase Studio | http://127.0.0.1:54323 |
| Project URL (API) | http://127.0.0.1:54321 |
| DB接続 | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Publishable Key | `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH` |
| Secret Key | `sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz` |

```bash
open -a Docker && supabase start   # 起動
supabase db reset                  # マイグレーション+シード再実行
cd frontend/demo1 && pnpm dev      # フロント起動
```

### 本番環境
| 項目 | サービス | 備考 |
|------|----------|------|
| ドメイン | Cloudflare | `menes-indexer.com` |
| フロントエンド | Vercel | Next.js App Router |
| データベース | Supabase | PostgreSQL, Auth, Storage |
| スクレイピングVPS | XServer VPS (220.158.18.6) | Python + PostgreSQL |

```
Cloudflare（ドメイン + CDN + DNS）→ Vercel（Next.js）→ Supabase（DB + Auth + Storage）
                                                              ↑ VPS（スクレイピングBot）
```

### スクレイピングVPS
| 項目 | 値 |
|------|-----|
| IP | 220.158.18.6 |
| OS | Ubuntu 25.04 |
| プラン | VPS 2GB（3vCPU, 50GB NVMe SSD） |
| SSH鍵 | `/Users/agatha/Downloads/indexer.pem` |
| DB接続 | `postgresql://postgres:postgres@127.0.0.1:5432/menethe` |
| スクリプト | `/opt/scraper/` |
| 契約期間 | 2026-02-09 〜 2026-04-30 |

```bash
# SSH接続
ssh -i ~/Downloads/indexer.pem root@220.158.18.6

# 正規運用: セラピスト差分スクレイピング
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "cd /opt/scraper && python3 batch_extract_therapist_info.py"

# DB件数確認
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "sudo -u postgres psql -d menethe -c 'SELECT count(*) FROM therapists;'"

# pg_dumpでローカル同期
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "sudo -u postgres pg_dump -d menethe --data-only -t therapists" > therapists_dump.sql
```

## 外部API

### DataForSEO（SERP API）
- ダッシュボード: https://app.dataforseo.com/
- ログイン: info@agatha-holdings.co.jp
- クレデンシャル: `/database/.env`

### Anthropic Claude API
- クレデンシャル: `/database/.env`
- モデル: claude-haiku-4-5-20251001（コスト効率重視）

### MCP設定
| MCP | 状態 | スコープ |
|-----|------|---------|
| Playwright | 接続済み | user |
| Chrome DevTools | 接続済み | user |
| DataForSEO | 接続済み | local |
| Stripe | 接続済み（本番キー） | local |
| Resend | 接続済み | local |
| Supabase / Vercel / Cloudflare / Sentry / Figma | 要認証 | - |

## ディレクトリ構造

```
/menethe-indexer/
├── CLAUDE.md                 ← このファイル
├── docs/
│   ├── DEVELOPMENT_LOG.md       ← 過去の実装経緯アーカイブ
│   ├── SERVICE_OVERVIEW.md      ← サービス概要書（最重要）
│   ├── SYSTEM_DESIGN.md         ← システム設計・DBスキーマ
│   ├── UX_FLOW.txt / V0_PROMPTS.md / AI_CONCIERGE_PLAN.md
│   └── AREA_DESIGN.md           ← エリア設計詳細
├── supabase/
│   ├── config.toml / seed.sql
│   └── migrations/              ← DBマイグレーション
├── database/
│   ├── esthe-ranking/           ← エリアマスタ・サロン数データ
│   ├── seed_reviews/            ← ME口コミリライト＆投入パイプライン
│   └── therapist-scraper/       ← セラピストスクレイパー
│       ├── batch_extract_therapist_info.py  ← 🔑 正規運用スクリプト
│       ├── name_extractor.py       ← 全フィールドHaiku一括抽出
│       ├── scrape_failed_salons.py ← ⚠️ テスト専用
│       ├── fetch_utils.py / html_cache_utils.py ← 共通モジュール
│       ├── batch_download_images.py ← 画像DL→Storage
│       └── (その他: smart_scraper, rule_extractor, etc.)
├── frontend/demo1/             ← Next.js App Router
│   ├── app/                       ← ページ（area, search, therapist, shop, review等）
│   └── components/                ← home, layout, review, shared, therapist, ui
└── menesthejp/                 ← 競合MEのHTML（分析用）
```

## スクレイピング運用

### 正規運用スクリプト: `batch_extract_therapist_info.py`
- 引数なしで全6,489サロンを差分処理（3段階Haikuフロー: TOP→一覧→個別）
- `--start-id`/`--end-id`: VPS並列対応、`--resume`: チェックポイント再開、`--dry-run`
- 3Days CMS: Haiku不使用（data.js直接パース）
- source-first原則: salon_scrape_cacheの旧キャッシュに依存しない

### テスト用コマンド
```bash
cd /Users/agatha/Desktop/project/menethe-indexer/database/therapist-scraper
python3 -c "import scrape_failed_salons as s; salons = s.get_salons_by_ids([ID1, ID2]); s.run_test(salons, csv_path='/Users/agatha/Desktop/retest.csv')"
```

## 分類マスタ定義

### looks_types（見た目タイプ）
| id | ラベル |
|---|---|
| 1 | 清楚系 | 2 | 素人系 | 3 | ギャル系 | 4 | モデル系 |
| 5 | ロリ系 | 6 | 女優系 | 7 | 夜職系 | 8 | 熟女系 |

### body_types（体型）
1:華奢 / 2:スレンダー / 3:バランス / 4:グラマー / 5:ぽっちゃり

### cup_types（おっぱい）
1:なし / 2:控えめ / 3:標準 / 4:大きめ / 5:巨乳

### service_levels（サービス）
1:健全 / 2:SKR / 3:HR

**cup二重管理**: `therapists.cup`（公式自称） + `reviews.cup_type_id`（口コミ体感）

## ME口コミ移行

### マッチング方法（3段階）
1. URL直接一致: ME `therapist_url` = Indexer `source_url`
2. ドメイン+名前一致
3. サロン名+名前一致

### 実行手順
```bash
python database/seed_reviews/step1_extract_me_data.py   # ME生データ抽出
python database/seed_reviews/step2_llm_rewrite.py       # LLMリライト
python database/seed_reviews/step3_insert_reviews.py    # DB投入
```

**接続先**: ME Supabase: `~/Desktop/menesthe-db/.env` / Indexer: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

## 未解決課題

### 🟡 スクレイピング取り漏れデータ（将来対応）
SNSリンク、趣味、得意施術、コース料金表、サロン写真、指名料 — キャッシュ済みHTMLから追加抽出可能

### 🟡 Supabase長期依存リスク（要検討）
7年運営での単一障害点。代替: GCP / AWS / セルフホスト。本番デプロイ前に方針決定が望ましい

## 注意事項

- SKR/HR = サービスレベルの隠語（センシティブな内容を示す）
- 法的リスクを考慮し、表現には注意
- スクレイピングデータはリライトして使用
- 過去の詳細な実装経緯は `docs/DEVELOPMENT_LOG.md` を参照
