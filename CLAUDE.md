# メンエスインデクサ プロジェクトガイド

## 現在のステータス (2026-02-02 更新)

- **設計フェーズ完了**: サービス概要、システム設計、UXフロー、v0用プロンプトを作成済み。
- **成果物**:
    - `docs/SERVICE_OVERVIEW.md`: サービス概要・ビジネスモデル
    - `docs/SYSTEM_DESIGN.md`: システム構成・DBスキーマ
    - `docs/UX_FLOW.txt`: ユーザー体験フロー
    - `docs/V0_PROMPTS.md`: フロントエンド生成用プロンプト
- **次のステップ**:
    1. フロントエンド実装（v0.app活用）
    2. Next.jsプロジェクトのセットアップ
    3. Supabaseプロジェクトの作成とDBマイグレーション

## プロジェクト概要

メンズエステ口コミサイト「メンエスインデクサ」の開発プロジェクト。
競合サイト「ME」を超える「発見」体験を提供するプラットフォーム。

**コアコンセプト**: 「"確認"で終わるサイトから、"発見"が始まるサイトへ」

## 本番環境

| 項目 | サービス | 備考 |
|------|----------|------|
| ドメイン | Cloudflare | `menes-indexer.com` |
| フロントエンド | Vercel | Next.js App Router |
| データベース | Supabase | PostgreSQL, Auth, Storage |
| スクレイピングBot | VPS (162.43.14.182) | Python |

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

## ディレクトリ構造

```
/menethe-indexer/
├── CLAUDE.md              ← このファイル
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

## 設計済み・未実装

### 自己学習型セラピストスクレイパー（Smart Scraper）

**状態**: 設計完了、実装待ち
**設計書**: チャットトランスクリプト `202a350b-7c62-4818-8aa7-ff45a9e3f913.jsonl`

**課題**: 現行 `therapist_scraper.py` は全ステップでClaude Haiku APIを使用。5000店舗規模だとAPI費用~$900・所要~67時間。

**解決策**: サロンサイトは少数のCMSプラットフォーム（推定10〜20種類）に集約されるため、一度学習したCMSはルールベース（CSSセレクタ）で処理。LLMは未知CMSの初回学習時のみ使用。

**アーキテクチャ**:
```
サロンURL → トップHTML取得 → CMS指紋判定
  既知CMS → ルールベース抽出（無料・高速）
  未知CMS → LLM抽出 → ルールマイニング（次回からルールベース化）
```

**判明済みCMS**: `upfu8_cms`（aromamore.tokyo等）、`estama`（emerald-akasaka.com等）

**ファイル構成** (`database/therapist-scraper/`):
- `therapist_scraper.py` — 既存LLMベーススクレイパー（変更なし、"教師"として残す）
- `therapist.db` / `therapist.csv` — 抽出済みデータ
- `smart_scraper.py` — エントリポイント（未作成）
- `cms_fingerprinter.py` — CMS判定（未作成）
- `rule_extractor.py` — ルールベース抽出（未作成）
- `rule_miner.py` — 自動ルール導出・Phase 2（未作成）
- `cms_patterns_seed.json` — 初期パターン2件（未作成）

**DBスキーマ追加（未作成）**: `cms_pattern`, `scrape_log` テーブル

**コスト見積もり**: 現行$900 → Phase1(80%ルール)$180 → Phase2(95%ルール)$45

## 未解決課題

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
