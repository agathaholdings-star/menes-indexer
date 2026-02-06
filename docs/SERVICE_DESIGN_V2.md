# サービス設計書 v2（確定版）

## 概要

メンエスインデクサのサービス設計。会員ティア、投稿インセンティブ、セラピストデータ、口コミ投稿フローを定義。

---

## 1. 会員ティア構造

### 3プラン

| ティア | 料金 | キラー機能 |
|--------|------|-----------|
| **無料** | 0円 | 口コミ投稿で3日間アクセス |
| **Standard** | 4,980円/月（固定） | 口コミ読み放題 + 投稿で機能段階解放 |
| **VIP** | 14,980円/月（固定） | 全機能使い放題（投稿不要） |

### Standard会員の投稿による段階的機能解放

**料金は固定（4,980円）。投稿数に応じて使える機能が増える。毎月リセット。**

| 今月の投稿数 | 解放される機能 |
|-------------|--------------|
| 0本 | 口コミ全文読み放題（MEと同等） |
| 1本 | + 発見検索（タイプ x エリア x スコアで検索） |
| 2本 | + セラピスト分析（レーダーチャート等）+ 掲示板・DM |
| 3本 | VIP相当の全機能解放（SKRリスト、HRリスト、全フィルター、VIP掲示板） |

### 全機能マトリクス

| 機能 | 未登録 | 無料 | 無料(投稿後3日) | Standard(0本) | Standard(1本) | Standard(2本) | Standard(3本) | VIP |
|------|--------|------|----------------|--------------|--------------|--------------|--------------|-----|
| エリア・店舗検索 | o | o | o | o | o | o | o | o |
| セラピスト一覧 | o | o | o | o | o | o | o | o |
| 口コミ投稿 | x | o | o | o | o | o | o | o |
| 口コミ本文閲覧 | x | x | o(3日) | o | o | o | o | o |
| スコア閲覧 | x | x | o(3日) | o | o | o | o | o |
| 発見検索(タイプxスコア) | x | x | x | x | o | o | o | o |
| セラピスト分析 | x | x | x | x | x | o | o | o |
| 掲示板・DM | x | x | x | x | x | o | o | o |
| SKRフィルター | x | x | x | x | x | x | o | o |
| HRフィルター | x | x | x | x | x | x | o | o |
| SKRリスト | x | x | x | x | x | x | o | o |
| HRリスト | x | x | x | x | x | x | o | o |
| 全フィルター | x | x | x | x | x | x | o | o |
| VIP掲示板 | x | x | x | x | x | x | o | o |
| お気に入り | x | 5件 | 5件 | 無制限 | 無制限 | 無制限 | 無制限 | 無制限 |

### 転換ファネル

```
未登録 → 「口コミ見たい」→ 会員登録+投稿 → 3日間アクセス
  |
無料会員 → 「毎回投稿するの面倒」→ Standard (4,980円)
  |
Standard(0本) → 「発見検索使いたい」→ 月1本投稿（90秒）
  |
Standard(1-2本) → 「SKR/HRリストも見たい」→ 月3本投稿 OR VIP課金
  |
Standard → 「投稿なしで全部使いたい」→ VIP (14,980円)
```

### なぜこの設計が効くか

1. Standard(0本) = MEと同等（口コミ読み放題）。同価格で乗り換えハードルゼロ
2. Standard(1本) = MEを超える（発見検索はMEにない機能）。月1投稿、90秒で解放
3. Standard(3本) = VIP相当。投稿で「稼ぐ」か、課金で「買う」か選べる
4. VIP = 投稿不要で全機能。忙しい人・ライトユーザー向け
5. Stripe課金額は固定。機能制御はアプリ側のみ

---

## 2. セラピストデータモデル

### データソース分類

| カテゴリ | フィールド | ソース | 更新頻度 |
|---------|-----------|--------|---------|
| 公式データ | name, shop_id, image_path, height, bust, waist, hip, cup | スクレイピング | 週次 |
| 口コミ集計 | type_scores, body_type_consensus, parameter_averages, service_level_distribution, average_score, review_count | 口コミ集計 | リアルタイム |
| ステータス | status (active/retired/transferred) | スクレイピング | 週次 |

### therapists テーブル

```sql
id            int8 PK
shop_id       int8 FK -> shops
name          text
image_path    text
height        int
bust          text          -- "86(D)"
waist         int
hip           int
cup           text          -- "D", "E"
status        text          -- 'active' | 'retired' | 'transferred'
last_scraped_at timestamptz
stats         jsonb         -- 口コミ集計（下記）
```

stats JSONB:
```json
{
  "type_scores": { "idol": 0.6, "seiso": 0.3, "gal": 0.1 },
  "body_type_consensus": "slender",
  "service_level_distribution": { "kenzen": 2, "skr": 5, "hr": 1 },
  "parameter_averages": {
    "conversation": 3.2,
    "distance": 4.1,
    "technique": 2.8,
    "personality": 3.5
  },
  "average_score": 82.5,
  "review_count": 8
}
```

### マスタデータ

**タイプ（6種類）**

| ID | 表示名 |
|----|--------|
| idol | 王道アイドル系 |
| seiso | 清楚なお姉さん系 |
| gal | イマドキなギャル系 |
| model | モデル・美女系 |
| imouto | 元気なフレッシュ系 |
| yoen | 大人のお姉さん系 |

**ボディタイプ（4種類）**

| ID | 表示名 |
|----|--------|
| slender | スレンダー |
| normal | 普通 |
| glamour | グラマー |
| chubby | ぽっちゃり |

**サービスレベル（3段階）**

| ID | 表示名 |
|----|--------|
| kenzen | 健全 |
| skr | SKR |
| hr | HR |

**パラメータ（4軸・1-5スケール）**

| ID | 表示名 | 左(1) | 右(5) |
|----|--------|-------|-------|
| conversation | 会話 | 聞き上手 | 話し上手 |
| distance | 距離感 | まったり癒やし | ドキドキ密着 |
| technique | 施術 | リラックス重視 | ガッツリほぐし |
| personality | 性格 | おっとりM気質 | ちょっとS気質 |

---

## 3. 口コミ投稿フロー

### Step 0-1: 店舗選択

- エリアから絞り込み OR 店舗名でオートコンプリート検索
- 店舗カードをタップして選択

### Step 0-2: セラピスト選択

- 選択した店舗の在籍セラピスト一覧を表示（写真+名前+スペック）
- タップして選択
- 「この人がいない」ボタン → 店舗名+セラピスト名を運営に報告のみ
- ユーザーにセラピスト情報は入力させない（データ品質維持）
- 運営/スクレイパーが正規ルートで追加後、ユーザーに通知

### Step 1: タイプ選択（必須・単一）

6タイプのカードをタップ

### Step 2: ボディタイプ（必須・単一）

4チップ: スレンダー / 普通 / グラマー / ぽっちゃり

### Step 3: サービスレベル（必須・単一）

3カード: 健全 / SKR / HR

### Step 4: パラメータ（任意・4軸スライダー）

会話 / 距離感 / 施術 / 性格（各1-5）。スキップ可能

### Step 5: スコア（必須）

0-100点（10点刻み）

### Step 6: コメント（必須・短文3問）

- Q1: 第一印象は？（50-100字）
- Q2: サービス/施術の良かった点は？（100-150字）
- Q3: 気になった点・アドバイスは？（50-100字）

### 投稿完了

- 無料会員: 「3日間口コミ閲覧が解放されました！」
- Standard: 「今月の投稿: X/3本。あとY本でVIP機能解放！」+ 類似セラピスト表示
- VIP: お礼メッセージ + 類似セラピスト表示

---

## 4. DBスキーマ

### reviews テーブル

```sql
id                      uuid PK default gen_random_uuid()
user_id                 uuid FK -> auth.users
therapist_id            int8 FK -> therapists
shop_id                 int8 FK -> shops
looks_type              text        -- idol/seiso/gal/model/imouto/yoen
body_type               text        -- slender/normal/glamour/chubby
service_level           text        -- kenzen/skr/hr
param_conversation      int         -- 1-5 nullable
param_distance          int         -- 1-5 nullable
param_technique         int         -- 1-5 nullable
param_personality       int         -- 1-5 nullable
score                   int         -- 0-100
comment_first_impression text
comment_service         text
comment_notes           text
is_verified             bool default false
created_at              timestamptz default now()
```

### profiles テーブル

```sql
id                      uuid PK FK -> auth.users
nickname                text
membership_type         text        -- 'free' | 'standard' | 'vip'
view_permission_until   timestamptz -- 無料投稿後の閲覧期限（+3日）
monthly_review_count    int default 0  -- 今月の投稿数（段階的解放用）
monthly_review_reset_at timestamptz    -- 次のリセット日（月初）
total_review_count      int default 0  -- 累計投稿数
created_at              timestamptz default now()
payment_provider        text        -- 'stripe' | 'sui' | null
payment_customer_id     text        -- 各プロバイダの顧客ID
```

### 機能解放ロジック（アプリ側）

```
function getEffectiveTier(profile):
  if profile.membership_type == 'vip':
    return 'vip'

  if profile.membership_type == 'standard':
    count = profile.monthly_review_count
    if count >= 3: return 'vip'        // VIP相当
    if count >= 2: return 'standard_2' // 分析+掲示板
    if count >= 1: return 'standard_1' // 発見検索
    return 'standard_0'                // 読み放題のみ

  // 無料会員
  if profile.view_permission_until > now():
    return 'free_active'               // 3日間アクセス中
  return 'free'
```

---

## 5. サブ機能: MY満足リスト

投稿者全員（全ティア共通）に提供するボーナス機能。メインの訴求ではなくサブ機能。

- 投稿3件以上で「あなた専用のおすすめセラピストランキング」が生成される
- 投稿するほどマッチ精度が向上
- マイページに表示
- 投稿直後に「類似セラピスト」を即表示

---

## 6. 修正が必要な既存コード

### frontend/demo1/lib/data.ts
- serviceTypes: 4段階 → 3段階（kenzen/skr/hr）に統一
- bodyTypes: "marshmallow" → "chubby" に統一
- User interface: monthly_review_count, monthly_review_reset_at 追加
- memberLevelInfo: 投稿数ベースの段階解放ロジック追加

### frontend/demo1/components/review/review-wizard-modal.tsx
- Step構成を確定フロー（Step 0-6）に合わせる
- サービスレベルを3段階に修正

### frontend/demo1/app/pricing/page.tsx
- ティア説明を確定版に更新
- "Review to Earn" → 「投稿で機能解放」に変更
- 段階的解放の説明を追加

### frontend/demo1/app/mypage/page.tsx
- memberLevelInfo を投稿数ベースの段階解放に対応
- 今月の投稿数プログレスバー追加
- 「あとX本でVIP」表示追加

### frontend/demo1/components/layout/site-header.tsx
- ヘッダーに「今月の投稿数 X/3」表示追加

---

## 7. 実装タスク（優先順）

### Phase 1: DB・認証基盤
- Supabase テーブル作成（shops, therapists, reviews, profiles）
- Supabase Auth 設定
- 会員種別管理 + 投稿数カウント + 月次リセット
- 機能解放ロジック（getEffectiveTier）

### Phase 2: 口コミ投稿フロー
- 店舗検索API（オートコンプリート）
- セラピスト一覧API（店舗ID → 写真付きリスト）
- 口コミ投稿API + 投稿数カウントアップ
- 投稿後の閲覧期限更新（無料: +3日間）
- 「セラピストが見つからない」報告機能

### Phase 3: 口コミ閲覧・検索
- 口コミ一覧表示（ティアによる表示制御）
- セラピスト詳細ページ（集計データ表示）
- 発見検索（タイプ x エリア x スコア）（Standard 1本以上 or VIP）
- SKR/HRフィルター（Standard 3本 or VIP）
- セラピスト分析（レーダーチャート等）（Standard 2本以上 or VIP）

### Phase 4: 決済連携（プロバイダ抽象化）

**設計方針**: 決済プロバイダを差し替え可能にする。現在はStripeをメイン、SUI（シマトモ）をサブとして対応。

**共通インターフェース（PaymentProvider）**:
```
interface PaymentProvider {
  createSubscription(userId, plan: 'standard' | 'vip'): SubscriptionResult
  cancelSubscription(subscriptionId): void
  handleWebhook(payload): WebhookEvent  // → membership_type 更新
  getCustomerPortalUrl(customerId): string  // プラン変更・解約画面
}
```

**実装ファイル**:
- `lib/payment/provider.ts` - 共通インターフェース定義
- `lib/payment/stripe.ts` - Stripe実装（Checkout + Webhook）
- `lib/payment/sui.ts` - SUI Credit Service実装（GATEWAY式 + Webhook/通知）
- `lib/payment/index.ts` - 環境変数 `PAYMENT_PROVIDER=sui|stripe` で切り替え

**Stripe（メイン）**:
- Stripe Checkout（決済画面リダイレクト）
- Customer Portal（プラン変更・解約）
- Webhook で subscription イベント受信

**SUI Credit Service（サブ / フォールバック）**:
- GATEWAY式API連携（カード情報はSUI側で保持）
- 継続課金（サブスクリプション）機能を利用
- Webhook or 通知URLで決済結果を受信 → profiles.membership_type 更新

**profilesテーブルとの連携**:
- `payment_provider`: 'stripe' | 'sui' でどちらで課金中か記録
- `payment_customer_id`: 各プロバイダの顧客ID
- Webhook受信時に `membership_type` を自動更新

### Phase 5: コミュニティ
- 掲示板（Standard 2本以上 or VIP）
- DM/チャット
- VIP掲示板（Standard 3本 or VIP）

### Phase 6: サブ機能
- MY満足リスト（投稿3件以上でパーソナルレコメンド）
- 投稿直後の類似セラピスト表示
- レビュアープロフィール・バッジ

---

## 8. 決済プロバイダ比較

| 項目 | Stripe | SUI（シマトモ） |
|------|--------|----------------|
| ステータス | メイン（新規アカウント取得予定） | サブ（フォールバック） |
| 連携方式 | Checkout + Webhook | GATEWAY式API |
| 継続課金 | 対応 | 対応 |
| カードブランド | 5大ブランド | 5大ブランド |
| 手数料 | 3.6% | 3.7%〜 |
| 審査リスク | 凍結リスクあり | 審査は通りやすい |

**結論**: Stripeをメインプロバイダとして実装。Stripeが再凍結された場合にSUIへ即座に切り替え可能な抽象化レイヤーを持つ。環境変数 `PAYMENT_PROVIDER=stripe|sui` で切り替え。

---

## 9. 実装済みファイル一覧

### 更新済み（v2対応完了）
- `frontend/demo1/lib/data.ts` - serviceTypes 3段階化、getEffectiveTier、tierPermissions
- `frontend/demo1/components/review/review-wizard-modal.tsx` - 9ステップ化、ボディタイプ追加、報告機能
- `frontend/demo1/components/review/completion-screen.tsx` - ティア別完了画面
- `frontend/demo1/app/pricing/page.tsx` - 段階的機能解放の説明追加
- `frontend/demo1/app/mypage/page.tsx` - 投稿数プログレスバー、getEffectiveTier連動
- `frontend/demo1/components/layout/site-header.tsx` - 投稿数 X/3 表示

### 未作成（Phase 4以降）
- `frontend/demo1/lib/payment/provider.ts` - 決済プロバイダ共通インターフェース
- `frontend/demo1/lib/payment/stripe.ts` - Stripe実装
- `frontend/demo1/lib/payment/sui.ts` - SUI実装
- `frontend/demo1/lib/payment/index.ts` - プロバイダ切り替え

---

## 10. 検証方法

1. ローカルで pnpm dev → 各ティアの表示制御が正しいか確認（デバッグスイッチャー使用）
2. 投稿フローの動作確認（Step 0〜6 + 完了画面）
3. 投稿後に monthly_review_count がインクリメントされ、機能解放が変わることを確認
4. git push → Vercel自動デプロイ → 本番確認
