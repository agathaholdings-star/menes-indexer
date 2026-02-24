# システム設計書 & データベース構造

## 1. システムアーキテクチャ

*   **Frontend**: Next.js (App Router)
    *   UI Framework: Tailwind CSS, ShadcnUI
    *   Animation: Framer Motion (スワイプ操作などのインタラクション用)
*   **Backend / DB**: Supabase
    *   Auth: ユーザー認証
    *   Database: PostgreSQL
    *   Storage: 画像データ
*   **Infrastructure**: Vercel + Cloudflare

## 2. データベース設計 (Supabase)

マイグレーション: `supabase/migrations/`（26件）

### 2.1. マスターデータ (スクレイピング等で取得)

#### `salons` (サロン)
*   `id`: int8 (PK)
*   `name`: text
*   `display_name`: text
*   `slug`: text
*   `official_url`: text
*   `domain`: text
*   `base_price`: int
*   `image_url`: text
*   `description`: text (AI生成紹介文)
*   `source`: text
*   `status`: text

#### `salon_areas` (サロン×エリア中間テーブル)
*   `salon_id`: int8 (FK)
*   `area_id`: int8 (FK)
*   `is_primary`: bool
*   `display_order`: int

#### `therapists` (セラピスト)
*   `id`: int8 (PK)
*   `salon_id`: int8 (FK)
*   `name`: text
*   `slug`: text
*   `age`: int
*   `height`: int
*   `bust`, `waist`, `hip`: int
*   `cup`: text (公式自称)
*   `image_urls`: jsonb
*   `profile_text`: text
*   `source_url`: text
*   `status`: text
*   **`stats`**: jsonb (集計されたスコアデータ)

#### `prefectures` (都道府県)
*   `id`: int8 (PK)
*   `name`: text
*   `slug`: text
*   `region`: text
*   `display_order`: int

#### `areas` (エリア)
*   `id`: int8 (PK)
*   `prefecture_id`: int8 (FK)
*   `name`: text
*   `slug`: text
*   `seo_keyword`: text
*   `search_volume`: int
*   `salon_count`: int

### 2.2. トランザクションデータ (ユーザー投稿)

#### `profiles` (ユーザー情報拡張)
*   `id`: uuid (PK, FK -> auth.users)
*   `nickname`: text
*   `membership_type`: text ('free', 'standard', 'vip')
*   `view_permission_until`: timestamptz
*   `monthly_review_count`: int
*   `payment_customer_id`: text (Stripe)

#### `reviews` (口コミ・属性データ)
レコメンドの源泉となるテーブル。

| カラム名 | 型 | 説明 |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid | FK (auth.users) |
| `therapist_id` | int8 | FK |
| `looks_type_id` | int | FK (looks_types) |
| `body_type_id` | int | FK (body_types) |
| `cup_type_id` | int | FK (cup_types) |
| `service_level` | int | 1:健全 2:SKR 3:HR |
| `param_conversation` | int | 会話 (1-5) |
| `param_distance` | int | 距離感 (1-5) |
| `param_technique` | int | 施術 (1-5) |
| `param_looks` | int | ルックス (1-5) |
| `score` | int | 総合点 (0-100) |
| `comment_1` 〜 `comment_4` | text | 分割質問回答 |
| `is_verified` | bool | 来店確認済みフラグ |
| `created_at` | timestamp | 投稿日時 |

#### `user_rewards` (割引管理)
*   `user_id`: uuid
*   `target_month`: date (YYYY-MM-01)
*   `review_count`: int
*   `discount_amount`: int
*   `status`: text ('pending', 'applied')

### 2.3. 分類マスタ

分類マスタの値定義は `database/therapist-scraper/CLAUDE.md` を参照。

- `looks_types`: 見た目タイプ（8種）
- `body_types`: 体型（5種）
- `cup_types`: おっぱい（5種）
- `service_levels`: サービス（3段階）

## 3. レコメンドロジック (概要)

### A. セラピスト属性スコアリング
`reviews` テーブルの投稿データを集計し、各セラピストの「属性値」を算出する。

*   **系統スコア**: 全投稿のうち「ギャル系」と回答された割合。
*   **サービスレベル平均**: `service_level` の平均値。（VIP会員のみフィルタリング可）

### B. ユーザー嗜好プロファイリング
お気に入り・高評価セラピストの傾向分析 → 同系統の未訪問セラピストをレコメンド。

### C. 協調フィルタリング (将来的)
「AとBを両方高評価するユーザー群」パターンの抽出。

## 4. UI/UX フロー (投稿画面)

### Step 1: ターゲット選択
*   インクリメンタルサーチで「店名」「セラピスト名」を検索・選択。

### Step 2: 直感タッピング (データ入力)
*   **Q1. 見た目の系統は？** (8枚のカードから選択)
*   **Q2. スタイルは？** (5つのチップから選択)
*   **Q3. サービスレベルは？** (3段階から選択)
*   **Q4. パラメータ** (スライダー操作)

### Step 3: テキスト入力
*   分割質問×4問に回答。
