# メンエスインデクサ プロジェクトガイド

## 作業ルール

- 1タスク完了ごとに git commit を提案すること
- 大きな決定・進捗があれば CLAUDE.md を更新すること
- やりとりが20往復を超えたら新チャットへの切り替えを提案すること
- 画像を複数枚受け取った場合はコンテキスト消費が大きいことを意識すること

## 現在のステータス (2026-02-12 更新)

- **設計フェーズ完了**: サービス概要、システム設計、UXフロー、v0用プロンプトを作成済み。
- **フロントエンド公開済み**: v0.appからVercelにデプロイ → https://menes-indexer.com/
- **スクレイピングパイプライン動作確認済み**: 3エリア268件テスト完了
- **全エリアスクレイピング完了**: VPS上で821エリア一括スクレイピング完了（7,685店舗、エラー0件）
- **salons重複解消済み**: official_urlベースでマージ（7,685→6,489店舗、1サロン=1行モデル確立）
- **Smart Scraper実装完了**: 自己学習型セラピストスクレイパー実装・テスト済み（25サロン/303名で動作確認）
- **ヒューリスティック優先抽出 実装完了**: 全7,684店スキャン済み（Step2: 86.5%, Step3: 48%）
- **ヒューリスティックv2**: flat HTML構造+共通サブパス検出で+1,227店改善
- **Phase② VPS稼働中**: セラピストデータ抽出（マージ後残り~2,240店対象、tmux phase2）
- **成果物**:
    - `docs/SERVICE_OVERVIEW.md`: サービス概要・ビジネスモデル
    - `docs/SYSTEM_DESIGN.md`: システム構成・DBスキーマ
    - `docs/UX_FLOW.txt`: ユーザー体験フロー
    - `docs/V0_PROMPTS.md`: フロントエンド生成用プロンプト
- **次のステップ**:
    1. ~~全821エリアの本番スクレイピング設計・実行~~ → ✅ 完了（7,685店舗）
    2. ~~Smart Scraper実装~~ → ✅ 完了（16サロン成功/303名取得テスト済み）
    3. ~~ヒューリスティック優先抽出~~ → ✅ 完了（batch_heuristic.py + smart_scraper.py改修）
    4. **セラピスト本番スクレイピング（3段階パイプライン）** ← Phase②稼働中、Phase③待ち
    5. フロントエンドとローカルSupabaseの接続
    6. Vercel/Supabase MCP OAuth認証
    7. VPSのスクレイピングデータをpg_dumpで本番Supabaseに移行

## 開発フロー方針（確定）

**ローカル完結 → 本番デプロイ**

すべてローカル環境で構築・テスト・完成させてから本番に反映する。

```
1. Supabase Local (Docker) でDB構築・マイグレーション
2. Next.js ローカル dev で フロントエンド開発
3. ローカルでE2Eテスト完了
4. 問題なければ supabase db push で本番Supabase反映
5. Vercelにデプロイ
```

- DBスキーマ: ローカルSupabaseで検証 → 確定後に本番push
- スクレイピング: ローカルDBにデータ投入 → 検証後に本番同期
- フロント: localhost:3000 + ローカルSupabaseで完全動作確認
- 本番環境には検証済みのものだけを反映する

## MCP設定 (2026-02-08 設定済み)

### userスコープ（全プロジェクト共通）
| MCP | 用途 | 状態 |
|-----|------|------|
| Playwright | ブラウザ自動操作・スクレイピング | 接続済み |
| Chrome DevTools | デバッグ・パフォーマンス分析 | 接続済み |
| Figma | デザイン→コード変換 | 要OAuth認証 |

### localスコープ（このプロジェクト専用）
| MCP | 用途 | 状態 |
|-----|------|------|
| Supabase | DB管理・マイグレーション | 要OAuth認証 |
| Vercel | デプロイ管理・ログ分析 | 要OAuth認証（次回起動時） |
| DataForSEO | SERP分析・SV取得 | 接続済み |
| Cloudflare | DNS・CDN管理 | 要認証設定 |
| Stripe | 課金・サブスク管理 | 接続済み（本番キー） |
| Sentry | エラー監視 | 要OAuth認証（初回） |
| Resend | メール送信（会員登録確認・通知等） | 接続済み |

### 未導入（将来検討）
- **Ahrefs**: SEO本格化時（公開後、被リンク分析が必要になったら）月$129〜
- **Upstash (Redis)**: キャッシュ・レートリミット必要時
- **Google Search Console**: SEOモニタリング本格化時

## プロジェクト概要

メンズエステ口コミサイト「メンエスインデクサ」の開発プロジェクト。
競合サイト「ME」を超える「発見」体験を提供するプラットフォーム。

**コアコンセプト**: 「"確認"で終わるサイトから、"発見"が始まるサイトへ」

## ローカル開発環境（Supabase Local）

| 項目 | URL / 値 |
|------|----------|
| Supabase Studio | http://127.0.0.1:54323 |
| Project URL (API) | http://127.0.0.1:54321 |
| DB接続 | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Publishable Key | `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH` |
| Secret Key | `sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz` |
| Mailpit | http://127.0.0.1:54324 |
| Docker | Docker Desktop 4.35.0（macOS Ventura対応版） |

### 起動コマンド
```bash
# Docker Desktop起動 → supabase start
open -a Docker
supabase start     # 初回はimage pull含む
supabase db reset  # マイグレーション+シード再実行
supabase stop      # 停止
```

### DBテーブル状態（2026-02-12、VPS）
| テーブル | 件数 | 状態 |
|---------|------|------|
| prefectures | 47 | シード済み |
| areas | 821 | シード済み（スラッグ重複解決済み） |
| salons | 6,489 | official_urlベースでデデュプ済み（1サロン=1行） |
| salon_areas | 11,648 | salons連動（複数エリア掲載含む） |
| therapists | ~16,000+ | Phase②進行中 |
| cms_patterns | 2 | シード済み（upfu8_cms, estama） |
| salon_scrape_cache | 6,481 | デデュプ済み |
| scrape_log | 0 | - |
| reviews | 0 | サービス開始後 |
| profiles | 0 | サービス開始後 |
| user_rewards | 0 | サービス開始後 |

**データモデル**: salons(1) → salon_areas(多) → areas(1)。同一サロンが複数エリアに掲載される場合、salonsは1行でsalon_areasで紐付け。

### スクレイピングパイプライン（動作確認済み）

`database/test_scrape_to_supabase.py` で以下を1パスで実行:

1. **esthe-ranking一覧取得** → サロン基本情報（名前、料金、アクセス等）
2. **公式URL取得** → 詳細ページから公式サイトURLを抽出
3. **display_name確定** → 括弧カナ → title正規表現 → LLMフォールバック → ルール
4. **salons/salon_areas INSERT** → slug=数字ID
5. **セラピスト取得**（オプション）→ TherapistScraper経由

#### display_name確定の優先順位
1. esthe-ranking括弧カナ（`ELTERAS（エルテラス）` → `エルテラス`）
2. 公式サイト`<title>`タグから正規表現抽出（`extract_kana_from_title.py`のロジック）
3. LLMフォールバック（titleを入力として渡し、カタカナ/日本語で返す）
4. ルールベース正規化（エリア名除去等）、英語残りは追加でLLM変換

#### テスト結果（268件）
| エリア | 件数 | 括弧 | title正規表現 | LLM | ルール | 英語残り |
|--------|------|------|--------------|-----|--------|---------|
| 恵比寿 | 73 | 31 | 8 | 33 | 1 | 0 |
| 松本 | 24 | 0 | 0 | 24 | 0 | 0 |
| 博多 | 171 | 53 | 9 | 80 | 29 | 1（サイトダウン） |
| **合計** | **268** | **84** | **17** | **137** | **30** | **1** |

## 本番環境

| 項目 | サービス | 備考 |
|------|----------|------|
| ドメイン | Cloudflare | `menes-indexer.com` |
| フロントエンド | Vercel | Next.js App Router |
| データベース | Supabase | PostgreSQL, Auth, Storage |
| スクレイピングBot（旧） | VPS (162.43.14.182) | Python |
| スクレイピングBot（新） | XServer VPS (220.158.18.6) | Python + PostgreSQL |

### 構成図
```
Cloudflare（ドメイン + CDN + DNS）
      ↓
Vercel（Next.js フロントエンド）
      ↓
Supabase（DB + Auth + Storage）
      ↑
VPS（スクレイピングBot → DB更新）
```

## スクレイピングVPS (2026-02-09 構築)

| 項目 | 値 |
|------|-----|
| プロバイダ | XServer VPS |
| サーバー名 | indexer |
| IP | 220.158.18.6 |
| OS | Ubuntu 25.04 |
| プラン | VPS 2GB（3vCPU, 50GB NVMe SSD） |
| SSH鍵 | `/Users/agatha/Downloads/indexer.pem` |
| rootパスワード | VPSパネルで設定済み |
| DB接続 | `postgresql://postgres:postgres@127.0.0.1:5432/menethe` |
| スクリプト配置 | `/opt/scraper/` |
| 契約期間 | 2026-02-09 〜 2026-04-30 |

### SSH接続
```bash
ssh -i /Users/agatha/Downloads/indexer.pem root@220.158.18.6
```

### スクレイピング操作
```bash
# ログ確認
ssh -i /Users/agatha/Downloads/indexer.pem root@220.158.18.6 "tail -20 /opt/scraper/batch_scrape.log"

# チェックポイント確認
ssh -i /Users/agatha/Downloads/indexer.pem root@220.158.18.6 "cat /opt/scraper/batch_scrape_checkpoint.json | python3 -m json.tool | tail -10"

# 再開（停止した場合）
ssh -i /Users/agatha/Downloads/indexer.pem root@220.158.18.6 "cd /opt/scraper && nohup python3 batch_scrape_shops.py --resume > /dev/null 2>&1 &"

# データ取り出し（本番移行時）
ssh -i /Users/agatha/Downloads/indexer.pem root@220.158.18.6 "sudo -u postgres pg_dump -d menethe --data-only -t salons -t salon_areas" > salons_dump.sql
```

## ディレクトリ構造

```
/menethe-indexer/
├── CLAUDE.md              ← このファイル
├── supabase/              ← Supabase Local設定
│   ├── config.toml            ← Supabase設定
│   ├── migrations/            ← DBマイグレーション
│   │   ├── 20260208000001_create_schema.sql  ← 全8テーブル定義
│   │   ├── 20260210000001_smart_scraper_tables.sql ← Smart Scraper用3テーブル
│   │   └── 20260212000002_rename_shops_to_salons.sql ← shops→salonsリネーム
│   ├── seed.sql               ← シードデータ（47都道府県+821エリア）
│   └── seed_areas.sql         ← エリアシードSQL（seed.sqlに結合済み）
├── database/              ← データ・スクリプト
│   ├── esthe-ranking/         ← エリアマスタ・サロン数データ
│   ├── seed_areas.py          ← CSV→SQLシード生成スクリプト
│   ├── extract_kana_from_title.py ← サロン名カナ抽出
│   ├── batch_scrape_therapists.py ← 全サロン一括セラピストスクレイピング
│   └── therapist-scraper/     ← セラピストスクレイパー
│       ├── therapist_scraper.py   ← LLMベーススクレイパー（従来版）
│       ├── smart_scraper.py       ← Smart Scraper オーケストレーション
│       ├── cms_fingerprinter.py   ← CMS指紋判定
│       ├── rule_extractor.py      ← ルールベース抽出（CSSセレクタ）
│       ├── rule_miner.py          ← パターン自動学習
│       ├── pattern_validator.py   ← 抽出品質検証
│       ├── batch_heuristic.py     ← Phase①: ヒューリスティック全店スキャン
│       ├── cms_patterns_seed.json ← 初期CMSパターン2件
│       └── seed_cms_patterns.py   ← シード投入スクリプト
├── docs/                  ← ドキュメント
│   ├── SERVICE_OVERVIEW.md    ← サービス概要書（最重要）
│   ├── SYSTEM_DESIGN.md       ← システム設計・DBスキーマ
│   ├── UX_FLOW.txt            ← UXフロー
│   ├── V0_PROMPTS.md          ← v0.app用プロンプト集
│   └── AI_CONCIERGE_PLAN.md   ← 将来のAI機能計画
├── frontend/              ← フロントエンド
│   └── demo1/             ← v0.appで生成したNext.jsプロジェクト
└── menesthejp/            ← 競合MEのHTML（分析用）
```

## フロントエンド構造（frontend/demo1）

v0.appで生成したNext.js (App Router) プロジェクト。

### ページ構成
```
app/
├── page.tsx               ← トップページ
├── area/[prefecture]/     ← エリア検索
├── search/                ← セラピスト検索（メイン機能）
├── therapist/[id]/        ← セラピスト詳細
├── shop/[id]/             ← 店舗詳細
├── type/[type]/           ← タイプ別一覧
├── review/                ← 口コミ投稿
├── mypage/                ← マイページ
├── bbs/                   ← 掲示板
├── pricing/               ← 料金プラン
├── login/                 ← ログイン
└── register/              ← 新規登録
```

### コンポーネント構成
```
components/
├── home/          ← トップページ用（hero, type-grid, recommendations等）
├── layout/        ← レイアウト（header, footer, sidebar）
├── review/        ← 口コミ投稿ウィザード（step-type, step-body等）
├── shared/        ← 共通（therapist-card, review-card）
├── therapist/     ← セラピスト詳細（radar-chart, composition-chart等）
└── ui/            ← ShadcnUIコンポーネント
```

### 起動コマンド
```bash
cd frontend/demo1
pnpm install
pnpm dev
```

## 技術スタック

- **Frontend**: Next.js (App Router), Tailwind CSS, ShadcnUI, Lucide Icons, Framer Motion, Recharts
- **Backend/Database**: Supabase (PostgreSQL, Auth, Storage)
- **Infrastructure**: Vercel
- **Data Pipeline**: Python (既存スクレイパー), Claude API (セラピスト分類)

## 外部API

### DataForSEO（SERP API）
SEO調査、検索結果分析に使用。

```
ダッシュボード: https://app.dataforseo.com/
ログイン: info@agatha-holdings.co.jp
クレデンシャル: /database/.env に保存
```

**用途:**
- メンエスポータルサイトの比較調査
- 「エリア名 + メンズエステ」検索での上位サイト分析
- salon_name_kana 取得（MEサイト検索）

**使用例:**
```python
# /database/.env をロード
from dotenv import load_dotenv
load_dotenv()

import os
import requests
from requests.auth import HTTPBasicAuth

login = os.getenv('DATAFORSEO_LOGIN')
password = os.getenv('DATAFORSEO_PASSWORD')
auth = HTTPBasicAuth(login, password)
```

### Anthropic Claude API
店名カタカナ変換、AI生成コンテンツに使用。

```
クレデンシャル: /database/.env に保存
モデル: claude-haiku-4-5-20251001（コスト効率重視）
```

## 会員体系（5段階）

| 状態 | 説明 |
|------|------|
| 未登録 | サイトを見ているだけ |
| 無料（未投稿） | 会員登録だけした状態 |
| 無料（投稿済み） | 口コミ投稿で数日間スタンダード相当の機能が使える |
| スタンダード | 月額¥4,980、SKRフィルター解放 |
| VIP | 月額¥14,980、SKR+HRフィルター解放 |

## 主要機能

### セラピスト検索（メイン機能）
- タイプ×スタイル×エリア×点数×SKR/HRで絞り込み
- フィルターは会員種別により段階的に解放

### 口コミ投稿（タップ式ウィザード）
- 1問1答形式でサクサク投稿
- 構造化データを収集（タイプ、スタイル、サービスレベル、パラメータ）

### レコメンドエンジン
- 「同じタイプ×近いエリア×高評価」のセラピストを提案
- 口コミ単位でレコメンド

### コミュニティ機能
- 掲示板（一般/VIP）
- DM、グループチャット
- お気に入りリスト共有

## 既存データ

Supabaseに格納済み（MEスクレイピングデータ）:
- `salon_db`: サロン情報（約数千件）
- `therapist_db`: セラピスト情報（約20万件）
- `area_db`: エリアマスタ

詳細は `/Users/agatha/Desktop/menesthe-db/newly_reviews_unified/newly_reviews_unified.py` 参照

## 開発方針

1. **PCファースト + レスポンシブ**: MEの情報量を維持しつつモダンUI
2. **段階的機能解放**: 無料→スタンダード→VIPで課金動機を明確に
3. **Review to Earn**: 有料会員も投稿すると翌月¥1,000割引（最大¥4,000/月）

## 重要ドキュメント

作業前に必ず読むこと:
1. `docs/SERVICE_OVERVIEW.md` - サービス全体像、会員体系、機能マトリクス
2. `docs/V0_PROMPTS.md` - フロントエンド生成用プロンプト

## デプロイフロー

```
1. v0.appでフロントエンドデザイン作成
      ↓
2. v0.appからVercelにデプロイ（自動）
      ↓
3. Cloudflareでドメイン取得（menes-indexer.com）
      ↓
4. VercelにカスタムドメインをVercelに登録 → DNS設定取得
      ↓
5. CloudflareでDNS設定（CNAME → Vercel）
      ↓
6. 本番公開
```

### ドメイン設定手順

**Cloudflareでドメイン購入:**
1. https://dash.cloudflare.com/ → Domain Registration → Register Domains
2. `menes-indexer.com` を検索して購入

**Vercelでカスタムドメイン追加:**
1. Vercelダッシュボード → プロジェクト → Settings → Domains
2. `menes-indexer.com` を追加
3. DNS設定をメモ（例: `cname.vercel-dns.com`）

**CloudflareでDNS設定:**
1. Cloudflare → ドメイン → DNS
2. CNAME追加: `@` → `cname.vercel-dns.com`（Proxy: OFF）

## 競合サイト調査・エリア設計（2026-02-08 更新）

詳細は `docs/AREA_DESIGN.md` を参照。

### エリアマスタ確定: 821件

**最終ファイル: `database/esthe-ranking/area_resolved_filtered.csv`（821件）**

| 分類 | 件数 | 表示方法 |
|------|------|---------|
| サロン3件以上 | 584 | そのエリアのサロンをそのまま表示 |
| サロン少+SV有 | 237 | 近隣/親エリアのサロンを表示 |
| 除外 | 33 | SV=0+サロン少(28) + 路線名KW(5) |

- 都道府県カバレッジ: **47/47**
- ME突合カバー率: 73.6%（192/261）
- 全件にDataForSEO検索ボリューム付き（`search_volume`列）

### esthe-ranking.jp 完全階層構造

```
Level 0: /                              ← TOPページ（日本地図）
Level 1: /prefecture/XX/                ← 47都道府県（リンク集、サロンデータ無し）
Level 2: /hakata/                       ← 163親エリア（サロン一覧 = スーパーセット）
Level 3: /hakata/tenjin-station/all/    ← 549駅（駅周辺に絞り込んだサブセット）
Level 3: /sapporo/asahikawa-city/all/   ← 263市（市単位に絞り込んだサブセット）
```

### エリア設計方針（確定）

- **1キーワード = 1ページ**（絶対原則）
- 全ページを「エリアページ」として統一。データソースがparent/station/cityかは裏側の話
- KW被り → 親データで吸収（駅/市ページは作らない）
- グループ中間ページ（恵比寿・中目黒・代官山まとめ）は作らない
- 都道府県ページがハブ、同グループのエリアは「近隣エリア」として相互リンク
- サロン少エリアはSVがあればページ作成（近隣エリアのサロンを表示）

### 完了済み

- ~~ME・メンマガとの突合を再実施~~ ✅
- ~~競合サイト（menesthe.heteml.net、mensesthe-search.com）のエリア設計分析~~ ✅
- ~~-city/all/ 取りこぼし修正~~ ✅
- ~~SEOキーワード抽出バグ修正~~ ✅
- ~~サロン数フィルタ適用~~ ✅ → 826件確定

### 次のステップ

- 都道府県ページの設計（47ページ）
- 本番スクレイピング

### 関連ファイル

| ファイル | 内容 |
|---------|------|
| `docs/AREA_DESIGN.md` | エリア設計の詳細ドキュメント |
| **`database/esthe-ranking/area_resolved_filtered.csv`** | **最終エリアマスタ 826件（salon_count付き）** |
| **`database/esthe-ranking/area_resolved_with_counts.csv`** | **全854件+salon_count（フィルタ前）** |
| `database/esthe-ranking/area_resolved_646.csv` | カニバリ解消済み854件（salon_count無し） |
| `database/esthe-ranking/site_hierarchy_complete.csv` | 都道府県→親エリア→駅→市 全階層一元化（975件） |
| `database/esthe-ranking/count_salons_v2.py` | サロン数カウントスクリプト v2 |
| `database/esthe-ranking/rebuild_area_master.py` | 階層再構築・KW修正・カニバリ解消スクリプト |
| `database/esthe-ranking/prefecture_area_map.csv` | 47都道府県→163親エリアのマッピング |
| `database/esthe-ranking/site_structure.csv` | esthe-ranking 全5,384エントリ（生データ） |
| `database/me/me_area_list.csv` | ME 161エリア |
| `database/mens-mg/mg_area_list.csv` | メンマガ 114エリア |
| `database/merged/salon_counts_cache.json` | サロン数キャッシュ（854URL分） |

## セラピスト本番スクレイピング: 3段階パイプライン（2026-02-11）

### 設計方針

**「確実に取れるものを先に全部取り切る → 残った例外だけ別途対処」**

### 3段階の流れ

```
① ローカル: ヒューリスティック全店スキャン（28分、$0）  ← ✅ 完了
   → 全7,684店のトップページにアクセス
   → リンクテキスト/URLキーワード/HTTPプローブで一覧URL特定
   → 一覧ページからURLパターンでセラピスト個別URL抽出
   → 結果: salon_scrape_cache + scrape_log に記録

② VPS: 成功店のセラピストデータ取得（~30時間）  ← 🔄 稼働中 (tmux phase2)
   → ①でセラピストURL取得済みの3,708店が対象
   → 個別ページのHTMLから正規表現/BeautifulSoupでデータ抽出
   → LLMはフォールバックとしてのみ使用（成功率95.5%テスト済み）
   → therapistsテーブルに投入

③ VPS: 失敗店のLLM再挑戦（~15時間、~$200）  ← 待ち
   → ①②で取れなかった3,976店が対象
   → batch_scrape_therapists.py --failed-only で実行
   → SmartScraperのフルパイプライン（ヒューリスティック→LLMフォールバック）

②と③はVPS上で同時並行で実行可能（対象salonが重複しない）
```

### スクリプト対応表

| ステップ | スクリプト | 状態 | 実行場所 |
|---------|----------|------|---------|
| ① 全店スキャン | `batch_heuristic.py` | ✅ 完了（28分） | ローカル |
| ② 成功店データ取得 | `batch_therapist_data.py` | 🔄 VPS稼働中 | VPS (tmux phase2) |
| ③ 失敗店LLM再挑戦 | `batch_scrape_therapists.py --failed-only` | ⏳ 待ち | VPS |

### ヒューリスティックスキャン結果

**Phase①（全7,684店、ローカル28分）:**

| ステップ | 成功 | 失敗 | 成功率 |
|---------|------|------|--------|
| fetch（トップページ取得） | 7,003 | 681 | 91.1% |
| Step2（一覧URL発見） | 6,649 | 354 | 86.5% |
| Step3（セラピストURL抽出） | 2,475 | 4,174 | 32.2% |

**ヒューリスティックv2（改良後、4,166店再スキャン、4.5分）:**
- flat HTML構造（/staff.html → /名前.html）対応
- 共通サブパス検出（/staff/ → /prof/profXX/）対応
- **+1,227店改善** → Phase②対象: 2,481 → 3,708店（48%）

### 失敗パターン分析（Phase③対象 ~3,976店）

| パターン | 件数 | LLM改善見込み |
|----------|------|-------------|
| extract_urls失敗（一覧URLはあるがURL抽出不可） | 2,939 | 高い |
| fetch失敗（サイト死亡/403/タイムアウト） | 681 | 低い（スキップ推奨） |
| find_list_url失敗（一覧URL自体不明） | 346 | 中 |
| fetch_list失敗（一覧ページだけ404） | 8 | 低い |

### VPS操作コマンド

```bash
# Phase②進捗確認
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "tail -20 /opt/scraper/batch_therapist_data.log"

# Phase②tmux接続
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 -t "tmux attach -t phase2"

# Phase②完了後 → 追加1,227店分も処理（--resumeで自動）
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "cd /opt/scraper && tmux new-session -d -s phase2 'python3 batch_therapist_data.py --resume --workers 5 2>&1 | tee -a batch_therapist_data.log'"

# Phase③開始（②と並行可能）
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "cd /opt/scraper && tmux new-session -d -s phase3 'python3 batch_scrape_therapists.py --failed-only --resume 2>&1 | tee batch_therapist_phase3.log'"

# DB状況確認
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "sudo -u postgres psql -d menethe -c 'SELECT count(*) FROM therapists;'"
```

## Smart Scraper（自己学習型セラピストスクレイパー）✅ 実装済み (2026-02-10)

### 概要

CMS指紋判定→ルールベース抽出→LLMフォールバック→自動学習のパイプライン。
初回はLLMで抽出し、成功パターンをCSSセレクタとして自動学習。2回目以降は同じCMSのサロンをLLM不要で処理。

### アーキテクチャ
```
サロンURL
  ↓
salon_scrape_cache確認（前回の一覧URL・CMSパターンあり？）
  ├─ あり → キャッシュされた一覧URLへ直行（Step 2省略）
  └─ なし → CMS指紋判定
                ├─ 既知CMS → ルールベース抽出（CSSセレクタ、LLM不要）
                └─ 未知CMS → LLM抽出 → パターン自動学習 → 次回からルール化
```

### ファイル構成 (`database/therapist-scraper/`)
| ファイル | 状態 | 説明 |
|---------|------|------|
| `therapist_scraper.py` | 既存（変更なし） | LLMベーススクレイパー（SmartScraperから呼び出し） |
| `smart_scraper.py` | ✅ | オーケストレーション（キャッシュ→CMS判定→ルール→LLMフォールバック→学習） |
| `cms_fingerprinter.py` | ✅ | CMS指紋判定（metaタグ・script・CSS・URLパターンの加重スコアマッチング） |
| `rule_extractor.py` | ✅ | ルールベース抽出（CSSセレクタ + 正規表現） |
| `rule_miner.py` | ✅ | パターン自動学習（LLM結果 + HTMLからCSSセレクタ導出） |
| `pattern_validator.py` | ✅ | 抽出品質検証（name必須 + 2フィールド以上） |
| `cms_patterns_seed.json` | ✅ | 初期パターン2件（upfu8_cms, estama） |
| `seed_cms_patterns.py` | ✅ | シードデータ投入スクリプト |

### DBテーブル（migration: `20260210000001_smart_scraper_tables.sql`）
| テーブル | 用途 |
|---------|------|
| `cms_patterns` | CMS抽出ルール（指紋・セレクタ・信頼度） |
| `salon_scrape_cache` | サロン別キャッシュ（一覧URL・CMS紐づけ） |
| `scrape_log` | スクレイピングログ（ステップ・方式・成否） |
| `salons.cms_fingerprint` | 追加カラム |

### 信頼度モデル
| confidence | 動作 |
|-----------|------|
| >= 0.7 | ルールのみ（LLM不使用） |
| 0.4-0.7 | ルール + LLMでサンプル検証（ハイブリッド） |
| < 0.4 | ルール破棄、LLM使用、再学習トリガー |

`confidence = success / (success + fail * 2)` — 失敗の重みを2倍

### テスト結果 (2026-02-10)
- **25サロン処理 → 16サロン成功 → 303名取得 → 所要21分 → エラー0**
- estama系7サロン: CMS判定成功（confidence 0.77〜1.00）、Step 2（一覧URL発見）をルール処理
- Step 3/4はまだLLMフォールバック中（シードのCSSセレクタ要チューニング）
- パターン自動学習: 成功率80%閾値に未到達 → 保留中

### 実行コマンド
```bash
# Smart Scraper（デフォルト）
python database/batch_scrape_therapists.py --limit 10 --max-per-salon 0

# LLMのみ（従来動作）
python database/batch_scrape_therapists.py --llm-only

# シード投入
python database/therapist-scraper/seed_cms_patterns.py
```

### 今後の改善
- シードパターンのCSSセレクタをestama実サイトに合わせてチューニング → Step 3/4もルール化
- 学習閾値の調整（80% → 60%等）で蓄積を加速
- コスト見積もり: 現行$900 → Phase1(60%ルール)$370 → Phase2(90%ルール)$93

## 未解決課題

### セラピスト一覧ページURL特定の学習 → ✅ Smart Scraperで対応済み

`salon_scrape_cache`テーブルに一覧URLをキャッシュ。2回目以降はLLM不要で直行。
CMS判定で`/therapist/`等のパターンもルールベースで発見可能（estama系で動作確認済み）。

### 新規店舗URLの自動発見
esthe-ranking.jpをメインソースとして採用決定。

**決定済み:**
- esthe-ranking.jp → サロンデータのメインソース（構造マッピング完了）

**検討中のアプローチ（補助ソース）:**
- Google検索 + Claude APIでフィルタリング
- 求人サイト（リジョブ等）の監視

## コマンド例

```bash
# フロントエンド起動
cd frontend/demo1
pnpm install
pnpm dev

# Supabase CLI
supabase init
supabase db push
```

## 注意事項

- SKR/HR = サービスレベルの隠語（センシティブな内容を示す）
- 法的リスクを考慮し、表現には注意
- スクレイピングデータはリライトして使用
