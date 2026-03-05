# 本番デプロイ + テスト計画

> 作成: 2026-03-05 / 検証済み: 全ファイル読み込み + 3エージェント並列検証完了

## Phase 0: 検証で判明した事実（Discovery完了）

### 確認済み事項
- マイグレーション: **43件**（CLAUDE.mdの26件は古い）
- `grant_initial_credits` トリガー: **v2で削除済み**（新規登録は0クレジット = 正しい）
- Stripe単発購入: コード完成済み（checkout → webhook → therapist_unlocks）
- Standard/VIP: 料金ページ「開発中」表示、Payment Linkは未使用
- sitemap.ts: 都道府県47 + エリア821 + サロン6,489 生成（セラピストは含まない）
- robots.ts: `/mypage`, `/auth/`, `/api/` 除外
- 全ページ `index: true, follow: true`

### 発見された問題

#### P1: 画像URL localhost問題（最大のブロッカー）
- `therapists.image_urls` に `http://127.0.0.1:54321/storage/v1/...` が格納されている（114,756件）
- フロントエンドはDBのURLをそのまま`<Image>`に渡す（URL変換ロジックなし）
- **対策**: データ移行時にSQL REPLACEでURL書き換え + 画像ファイルを本番Storageに移す
- **代替**: 画像なしで先にテスト可（タイトル確認・Stripeテストには影響しない）

#### P2: Vercel env vars不足
- 設定済み: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 未設定: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SINGLE_UNLOCK_PRICE_ID`

#### P3: STRIPE_SINGLE_UNLOCK_PRICE_ID
- コードは `process.env.STRIPE_SINGLE_UNLOCK_PRICE_ID` を参照
- `.env.production.template` に未記載
- 値: `price_1T7Zoe0XBzvgRtVLEvchOUaa`

#### P4: Stripe Webhook未設定
- 本番エンドポイント `https://www.menes-skr.com/api/webhook/stripe` の登録が必要
- 必要なイベント: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_succeeded`

---

## Phase 1: 本番DBセットアップ（マイグレーション + データ投入）

### 前提条件
- ローカルSupabase起動済み（Docker + `supabase start`）
- 本番Supabase接続情報: `stripe/supabase_prod_credentials.txt`
  - ref: `oycayfewhqrezvhbbhzm`
  - URL: `https://oycayfewhqrezvhbbhzm.supabase.co`

### タスク

#### 1-1. 本番にマイグレーション適用
```bash
supabase db push --linked
# または
supabase migration up --db-url "postgresql://postgres:[PASSWORD]@db.oycayfewhqrezvhbbhzm.supabase.co:5432/postgres"
```
- 43件全て適用されることを確認

#### 1-2. ローカルDBからデータエクスポート
```bash
pg_dump -h 127.0.0.1 -p 54322 -U postgres \
  --data-only --no-owner --no-acl \
  -t prefectures -t areas -t salons -t salon_areas \
  -t therapists -t reviews -t profiles \
  -t looks_types -t body_types -t cup_types -t service_levels \
  postgres > /tmp/data_export.sql
```

#### 1-3. 本番DBにデータインポート
```bash
psql "postgresql://postgres:[PASSWORD]@db.oycayfewhqrezvhbbhzm.supabase.co:5432/postgres" < /tmp/data_export.sql
```

#### 1-4. 画像URL書き換え
```sql
UPDATE therapists
SET image_urls = REPLACE(
  image_urls::text,
  'http://127.0.0.1:54321',
  'https://oycayfewhqrezvhbbhzm.supabase.co'
)::jsonb
WHERE image_urls::text LIKE '%127.0.0.1%';
```

### 検証チェックリスト
- [ ] `SELECT count(*) FROM prefectures;` → 47
- [ ] `SELECT count(*) FROM areas;` → 821
- [ ] `SELECT count(*) FROM salons;` → 8,776
- [ ] `SELECT count(*) FROM therapists;` → 128,636
- [ ] `SELECT count(*) FROM reviews;` → 11,446
- [ ] `SELECT count(*) FROM looks_types;` → 8
- [ ] image_urlsに `127.0.0.1` が残っていないこと

---

## Phase 2: 画像移行（Phase 1と並行可能）

### 選択肢A: 画像なしで先にテスト（推奨：速い）
- 画像は404になるがページ自体は表示される
- タイトル・メタデータのインデックステストに影響なし
- Stripeフローも画像なしで動く
- **Phase 4完了後に画像移行を別途実施**

### 選択肢B: 画像も完全に移す（時間がかかる）
- ローカルSupabase Storage（Docker volume内）から画像ファイル取り出し
- 本番Storage APIで`therapist-images`バケットにアップロード
- 114,756ファイル（WebP、小さいファイル）
- スクリプト作成が必要

---

## Phase 3: Vercel設定 + Stripeテストモード

### 3-1. Vercel env vars追加（Dashboard → Settings → Environment Variables）

| Variable | Value | Source |
|----------|-------|--------|
| `STRIPE_SECRET_KEY` | `sk_test_...` | `.env.local` から |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Phase 3-2で取得 |
| `STRIPE_SINGLE_UNLOCK_PRICE_ID` | `price_1T7Zoe0XBzvgRtVLEvchOUaa` | Stripe Dashboard |

### 3-2. Stripe Webhookエンドポイント設定（テストモード）
- Stripe Dashboard → Developers → Webhooks → Add endpoint
- URL: `https://www.menes-skr.com/api/webhook/stripe`
- Events: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_succeeded`
- Signing secret → Vercel env varsに設定

### 3-3. Vercel再デプロイ
```bash
git push origin main
# または Vercel Dashboard → Deployments → Redeploy
```

### 検証チェックリスト
- [ ] `www.menes-skr.com` でトップページが表示される（データあり）
- [ ] `/area/tokyo` で東京都ページが表示される
- [ ] `/area/tokyo/shinjuku` で新宿エリアページが表示される
- [ ] `/salon/[id]` でサロンページが表示される
- [ ] `/therapist/[id]` でセラピストページが表示される
- [ ] `/register` で会員登録できる
- [ ] `/review` で口コミ投稿ウィザードが開く
- [ ] Stripe: テストカード `4242 4242 4242 4242` で¥1,000購入が通る
- [ ] Webhook: 購入後に `therapist_unlocks` にレコードが入る

---

## Phase 4: GSC登録 + インデックステスト

### 4-1. GSCプロパティ追加
- Google Search Console → プロパティ追加 → `www.menes-skr.com`
- 認証方法: DNS TXTレコード（Cloudflareで追加）

### 4-2. URL検査（インデックス前の確認）
各ページタイプ1つずつURL検査ツールに入力して確認：

| ページタイプ | テストURL例 | 確認するタイトル |
|-------------|------------|----------------|
| トップ | `https://www.menes-skr.com/` | メンエスSKR |
| 都道府県 | `/area/tokyo` | 東京都のメンズエステ - メンエスSKR |
| エリア | `/area/tokyo/shinjuku` | 新宿のおすすめメンズエステランキング - メンエスSKR |
| サロン | `/salon/[id]` | {店名}の口コミ体験談 - メンエスSKR |
| セラピスト | `/therapist/[id]` | {店名}「{名前}」の口コミや評判が分かる体験談 - メンエスSKR |
| ランキング | `/ranking` | セラピストランキング - メンエスSKR |
| 料金 | `/pricing` | 料金プラン - メンエスSKR |

### 4-3. sitemap送信
- GSC → Sitemaps → `https://www.menes-skr.com/sitemap.xml` 送信
- 現在のsitemap: 都道府県47 + エリア821 + サロン6,489 = 約7,357 URL

### 4-4. 少量インデックスリクエスト
- URL検査でタイトルが正しいことを確認したページから「インデックス登録をリクエスト」
- 目安: 各タイプ10-20件ずつ、合計100件程度
- 1日のリクエスト上限あり（目安: 10-20件/日）

### 検証チェックリスト
- [ ] GSCプロパティ認証完了
- [ ] 各ページタイプのタイトルが意図通り
- [ ] description が意図通り
- [ ] canonical URL が正しい
- [ ] sitemap が正常に読み込まれる
- [ ] インデックスリクエスト後、数日で「インデックス登録済み」に変わる

---

## 注意事項・アンチパターン

- `supabase db reset` は使用禁止（CLAUDE.md）
- マイグレーション適用は `supabase migration up` で差分適用
- Stripe本番キー（`sk_live_*`）はまだ使わない（審査通過まで）
- 画像移行は急がなくてよい（インデックステストに不要）
- VPS契約は2026-04-30まで（データバックアップ注意）

---

## ファイルパス参照

| ファイル | 用途 |
|---------|------|
| `stripe/supabase_prod_credentials.txt` | 本番Supabase接続情報 |
| `frontend/demo1/.env.local` | ローカル開発用env vars |
| `frontend/demo1/.env.production.template` | 本番用テンプレート |
| `supabase/migrations/` | 43マイグレーションファイル |
| `frontend/demo1/app/sitemap.ts` | sitemap生成ロジック |
| `frontend/demo1/app/robots.ts` | robots.txt生成 |
| `frontend/demo1/app/api/webhook/stripe/route.ts` | Stripe Webhook |
| `frontend/demo1/app/api/checkout/single-unlock/route.ts` | 単発購入チェックアウト |
| `frontend/demo1/components/shared/therapist-image.tsx` | 画像表示コンポーネント |
| `frontend/demo1/lib/supabase-admin.ts` | Admin client（placeholder fallback付き） |
| `database/therapist-scraper/batch_download_images.py` | 画像DLパイプライン |
