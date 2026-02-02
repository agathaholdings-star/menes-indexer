# システム設計書 & データベース構造

## 1. システムアーキテクチャ

*   **Frontend**: Next.js (App Router)
    *   UI Framework: Tailwind CSS, ShadcnUI
    *   Animation: Framer Motion (スワイプ操作などのインタラクション用)
*   **Backend / DB**: Supabase
    *   Auth: ユーザー認証
    *   Database: PostgreSQL
    *   Storage: 画像データ
*   **Infrastructure**: Vercel

## 2. データベース設計 (Supabase)

### 2.1. マスターデータ (スクレイピング等で取得)

#### `shops` (店舗)
*   `id`: int8 (PK)
*   `name`: text
*   `area_id`: int8
*   `prefecture`: text
*   `address`: text
*   `system_text`: text (料金システム等)
*   `urls`: jsonb

#### `therapists` (セラピスト)
*   `id`: int8 (PK)
*   `shop_id`: int8 (FK)
*   `name`: text
*   `image_path`: text
*   **`stats`**: jsonb (集計されたスコアデータ)
    *   例: `{ "gal": 80, "slender": 90, "avg_service": 3.5 }`
    *   *※検索速度向上のため、reviewsから定期集計またはトリガー更新*

### 2.2. トランザクションデータ (ユーザー投稿)

#### `profiles` (ユーザー情報拡張)
*   `id`: uuid (PK, FK -> auth.users)
*   `membership_type`: text ('free', 'standard', 'vip')
*   `view_permission_until`: timestamptz
    *   *※無料会員でも、投稿完了時に `now() + interval '24 hours'` で更新される。この時刻までは有料会員と同等の閲覧が可能。*
*   `discount_rank`: int

#### `reviews` (口コミ・属性データ)
ユーザーの1問1答入力を保存するテーブル。これがレコメンドの源泉となる。

| カラム名 | 型 | 説明 |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid | FK (auth.users) |
| `therapist_id` | int8 | FK |
| `looks_type` | text | タイプ選択 (例: 'gal', 'clean', 'idol', 'model', 'sister', 'lover') |
| `body_type` | text | スタイル選択 (例: 'slender', 'normal', 'marshmallow', 'glamour') |
| `service_level` | int | サービス満足度 (1:健全 ～ 4:過激) |
| `param_conversation` | int | 会話 (1-5) |
| `param_distance` | int | 距離感 (1-5) |
| `param_technique` | int | 施術 (1-5) |
| `tags` | text[] | 任意選択タグ (例: ['美脚', '黒髪', 'ノリが良い']) |
| `score` | int | 総合点 (0-100) |
| `comment_1` | text | 質問1回答 (第一印象など) |
| `comment_2` | text | 質問2回答 (施術内容など) |
| `is_verified` | bool | 来店確認済みフラグ |
| `created_at` | timestamp | 投稿日時 |

#### `user_rewards` (割引管理)
*   `user_id`: uuid
*   `target_month`: date (YYYY-MM-01)
*   `review_count`: int
*   `discount_amount`: int
*   `status`: text ('pending', 'applied')

## 3. レコメンドロジック (概要)

### A. セラピスト属性スコアリング
`reviews` テーブルの投稿データを集計し、各セラピストの「属性値」を算出する。

*   **系統スコア**: 全投稿のうち「ギャル系」と回答された割合。
    *   例: 10件中8人が「ギャル」→ ギャル度 80%
*   **サービスレベル平均**: `service_level` の平均値。
    *   *※VIP会員のみこの値をフィルタリングに使用可能。*

### B. ユーザー嗜好プロファイリング
ユーザーが「お気に入り」したセラピストや、「高評価(80点以上)」をつけたセラピストの傾向を分析。

*   「このユーザーは『ギャル系』かつ『スレンダー』への反応が良い」
    *   → **検索画面の「あなたへのおすすめ」に同系統の未訪問セラピストを表示。**

### C. 協調フィルタリング (将来的)
「セラピストAを高評価したユーザーは、セラピストBも高評価する傾向がある」というパターンを抽出。

## 4. UI/UX フロー (投稿画面)

### Step 1: ターゲット選択
*   インクリメンタルサーチで「店名」「セラピスト名」を検索・選択。

### Step 2: 直感タッピング (データ入力)
*   **Q1. 見た目の系統は？** (6枚のカードから選択)
*   **Q2. スタイルは？** (4つのチップから選択)
*   **Q3. サービスレベルは？** (4段階のアイコンから選択)
*   **Q4. パラメータ** (スライダー操作)

### Step 3: テキスト入力
*   100文字程度の短い質問×2〜3問に回答。
*   「送信」→ 割引カウントアップ演出。
