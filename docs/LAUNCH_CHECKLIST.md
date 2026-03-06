# ローンチチェックリスト

> ゴール: シークレットモードで新規ユーザーが来て、登録→口コミ投稿→本部承認→クレジット付与→別の口コミ閲覧、が一気通貫で動く
> 作成: 2026-03-06
> 確定仕様: `memory/launch-strategy.md`

---

## 1. ゴール定義

テスト公開OKの条件 = 以下のE2Eフローが本番で完走すること:

```
1. 未登録ユーザーがセラピストページにアクセス
2. 口コミのblurを見る → 「モザイクを外すには」クリック
3. モーダル → 「投稿してクレジットGET」クリック
4. 未ログインなので登録画面に飛ぶ
5. メール・ニックネーム・パスワードで登録
6. メール認証（確認リンクをクリック）
7. 認証完了 → 口コミ投稿ウィザードが開く
8. 別のセラピスト（自分が行ったことある子）の口コミを書く
9. 投稿完了 → 「承認待ち（通常30分以内）」表示
10. 管理者が /admin で口コミを確認 → 承認
11. ユーザーにクレジット付与（5 or 10）+ メール通知
12. ユーザーが元のセラピストページに戻る
13. クレジットでアンロック → 口コミ全文が読める
```

追加テスト:
- 口コミなしページで「このセラピストの口コミを投稿しませんか？」→ 同じフロー
- ¥1,000単発購入でアンロック → Stripe決済 → 永久アンロック

---

## 2. 現状（動くもの / 壊れてるもの / 未実装）

### 動いてるもの
- [x] 登録フォーム（ニックネーム・メール・パスワード）
- [x] ログイン・ログアウト
- [x] セラピストページ表示（口コミあり・なし）
- [x] 口コミ投稿ウィザード（11ステップ、スクショ添付）
- [x] ウィザードの未ログインガード（/login にリダイレクト）
- [x] 管理画面（/admin）- 承認・却下・理由入力
- [x] approve_review RPC（クレジット5/10付与、7日失効）
- [x] reject_review RPC（理由保存）
- [x] クレジットでセラピストアンロック（unlock_therapist RPC）
- [x] Standard/VIPは全口コミ閲覧可
- [x] blur + ティーザー80文字表示
- [x] REAL/FAKE投票、参考になった、レベルシステム、フォロー
- [x] 動線修正済み: 口コミありページ→別セラピスト投稿、口コミなしページ→このセラピスト投稿
- [x] クレジット数値修正済み: 5（スクショ10）

### 壊れてる / 繋がってない
- [ ] **auth/callback/route.ts が存在しない** — メール確認リンクのトークン交換処理がない（最大ブロッカー）
- [ ] **¥1,000単発購入が表示されない** — unlock-modal.tsxにあるがreview-list.tsxのモーダルに未統合
- [ ] **Stripe env vars未設定** — STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_SINGLE_UNLOCK_PRICE_ID
- [ ] **登録後の遷移が/mypage** — ウィザード自動起動しない、元のセラピストページに戻らない
- [ ] **管理者アカウント未作成** — 本番DBにadminユーザーが存在しない（Dashboard + SQL必要）
- [ ] **クレジット表示がスマホで見えない** — ヘッダーの `hidden sm:flex` でモバイル非表示、マイページにも表示なし

### 未実装
- [ ] **auth/callback/route.ts** — メール確認リンクのトークン交換 + リダイレクト処理
- [ ] **本番Supabase Auth設定** — site_url, redirect_urls, SMTP（メール認証必須）
- [ ] **登録→ウィザード自動起動** — 登録完了後、見ていたセラピストを引き継いでウィザードを開く
- [ ] **Resendメール通知** — コード完成済み、APIキー設定のみ（E2Eテスト必須ではない）
- [ ] **sitemap分割** — セラピストページがsitemapに含まれてない（テスト公開後でOK）

---

## 3. ユーザーフロー全体図

### A. 口コミありページ（読みたい人）

```
セラピストページ（口コミあり）
  │
  ├─ [blur] 口コミ80文字 + モザイク
  │    └─ 「モザイクを外すには」クリック
  │         └─ モーダル表示:
  │              ├─ 「あなたの体験を投稿して5クレジットGET」
  │              │    ├─ ログイン済み → ウィザード開く（別セラピスト選択から）
  │              │    └─ 未ログイン → /register?redirect=/review ★要実装
  │              ├─ 「¥1,000で永久アンロック」 ★要統合
  │              ├─ 「有料会員になって読み放題」→ /pricing（開発中表示）
  │              └─ 「既に会員の方はこちら」→ /login
  │
  └─ [クレジットあり] 「クレジットで読む（残りN）」→ unlock_therapist RPC → 全文表示
```

### B. 口コミなしページ（書ける人）

```
セラピストページ（口コミなし）
  │
  └─ 「このセラピストの口コミを最初に投稿しませんか？」
       └─ 「口コミを書く」クリック
            ├─ ログイン済み → ウィザード開く（このセラピスト指定）
            └─ 未ログイン → /register?redirect=/therapist/{id}?write=true ★要実装
```

### C. 登録→口コミ投稿フロー

```
/register
  │ ニックネーム・メール・パスワード入力
  │ 利用規約チェック → 送信
  │
  ├─ メール認証リンク送信（本番SMTP必要）★要設定
  │    └─ ユーザーがメール確認リンクをクリック
  │
  └─ 認証完了 → リダイレクト先へ
       ├─ redirect=/review → ウィザード起動（別セラピスト選択）
       └─ redirect=/therapist/{id}?write=true → ウィザード起動（指定セラピスト）★要実装
```

### D. 投稿→承認→クレジット

```
ウィザード投稿完了
  │ → reviews テーブルに INSERT (moderation_status = 'pending')
  │ → 完了画面「承認待ち（通常30分以内）」表示
  │
管理者 /admin
  │ → 新着口コミ確認 → 承認 or 却下
  │
  ├─ 承認: approve_review RPC
  │    → review_credits += 5 (スクショ付き: 10)
  │    → credits_expires_at = now() + 7日
  │    → メール通知「クレジットが付与されました」★Resend設定必要
  │
  └─ 却下: reject_review RPC
       → rejection_reason 保存
       → メール通知「却下理由 + 再投稿のお願い」★Resend設定必要
```

---

## 4. 実装タスク（依存関係順）

### Phase A: インフラ設定（Dashboard操作）

| # | タスク | 作業場所 | 依存 | 備考 |
|---|--------|---------|------|------|
| A1 | 本番Supabaseの site_url を `https://menes-skr.com` に設定 | Supabase Dashboard → Auth → URL Configuration | なし | |
| A2 | redirect URLs に `https://menes-skr.com/auth/callback` 追加 | 同上 | なし | |
| A3 | メール認証を確認（Supabase組み込みメールで十分） | Supabase Dashboard → Auth → Email Templates | なし | カスタムSMTP不要 |
| A4 | 管理者アカウント作成 | Supabase Dashboard → Auth → Users → Add User | なし | `info@agatha-holdings.co.jp` で作成後SQL実行 |
| A5 | 管理者フラグ設定 | Supabase SQL Editor | A4 | `UPDATE profiles SET is_admin=true WHERE id=(SELECT id FROM auth.users WHERE email='info@agatha-holdings.co.jp')` |
| A6 | Vercel env vars: STRIPE_SECRET_KEY | Vercel Dashboard | なし | |
| A7 | Vercel env vars: STRIPE_WEBHOOK_SECRET | Stripe Dashboard → Webhooks → Add endpoint | A6 | endpoint: `https://menes-skr.com/api/webhook/stripe` |
| A8 | Vercel env vars: STRIPE_SINGLE_UNLOCK_PRICE_ID | Vercel Dashboard | A6 | `price_1T7Zoe0XBzvgRtVLEvchOUaa` |
| A9 | Vercel env vars: RESEND_API_KEY | Vercel Dashboard | なし | E2E必須ではないが設定簡単 |

### Phase B: 認証+導線修正（コード変更 — 最重要）

| # | タスク | ファイル | 依存 | 内容 |
|---|--------|---------|------|------|
| B1 | **auth/callback/route.ts 新規作成** | app/auth/callback/route.ts | なし | メール確認リンクのトークン交換 + redirect先へ転送 |
| B2 | 未ログイン時「投稿してクレジットGET」→ /register?redirect= に飛ばす | review-list.tsx | なし | useAuthでログイン判定、未ログインなら登録画面へ |
| B3 | 口コミなしの「口コミを書く」も未ログイン時 /register にリダイレクト | therapist-page-client.tsx | なし | redirect=/therapist/{id}?write=true |
| B4 | 登録後のリダイレクト先をURLパラメータから取得 | register/page.tsx | なし | `?redirect=` → signUp後にそこへ飛ぶ |
| B5 | /therapist/{id}?write=true でウィザード自動起動 | therapist-page-client.tsx | B4 | searchParamsチェックしてモーダルを開く |
| B6 | クレジット表示をモバイルでも見えるようにする | site-header.tsx | なし | `hidden sm:flex` → `flex` に変更 |

### Phase C: ¥1,000単発購入の統合

| # | タスク | ファイル | 依存 |
|---|--------|---------|------|
| C1 | review-list.tsxのモーダルに¥1,000オプション追加 | review-list.tsx | A6-A8 |

### Phase D: メール通知（E2E後でもOK）

| # | タスク | 備考 |
|---|--------|------|
| D1 | Vercelに RESEND_API_KEY 設定済みなら自動で動く | コード完成済み（lib/resend.ts + api/admin/route.ts） |
| D2 | 登録確認メール | Supabase組み込みメールで自動送信 |

### Phase E: デプロイ + E2Eテスト

| # | タスク | 依存 |
|---|--------|------|
| E1 | git push → Vercel自動デプロイ | B1-B6, C1 |
| E2 | 管理者でログイン → /admin 表示確認 | A4-A5, E1 |
| E3 | シークレットモードでE2Eテスト（ゴールの13ステップ完走） | E1, A1-A9 |
| E4 | ¥1,000 Stripe決済テスト（テストカード4242...） | A6-A8, E1 |
| E5 | バグ修正 → 再デプロイ | E3-E4 |

---

## 5. やらないことリスト（テスト公開後に回す）

| 項目 | 理由 |
|------|------|
| sitemap分割 | テスト公開にはページ数少ないので不要。全量データ投入後に実装 |
| OGP画像生成 | SNS共有はまだ不要 |
| Canonical URL | ページ数少ないうちは影響なし |
| Standard/VIP課金 | Phase 2以降。「開発中」表示のまま |
| 全量データ投入（128,636セラピスト） | テスト公開OKになってから |
| 画像移行（114,756ファイル） | 同上 |
| 段階的機能解放（Standard月3本） | Standard自体が未提供 |
| Resend経由のAuth確認メール | Supabase組み込みメールで十分 |
| 承認待ちUI（マイページ内） | あると良いが必須ではない。完了画面のテキストで代替 |

---

## 6. 作業の流れ

```
あなた（Dashboard操作）          Claude（コード修正）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A1-A3: Supabase Auth設定         B1: auth/callback 新規作成
A4-A5: 管理者アカウント作成       B2-B3: 未ログイン→登録リダイレクト
A6-A8: Stripe env vars           B4-B5: 登録後のリダイレクト+ウィザード起動
A9: Resend APIキー               B6: クレジット表示モバイル対応
                                 C1: ¥1,000モーダル統合
         ↓ 合流 ↓
      E1: git push → デプロイ
      E2-E4: E2Eテスト
```

Phase Dは後回し（RESEND_API_KEY設定すれば自動で動く）。

---

## 参照ファイル

| ファイル | 内容 |
|---------|------|
| memory/launch-strategy.md | クレジット制確定仕様 |
| docs/DEPLOY_PLAN.md | インフラ手順 |
| frontend/demo1/app/register/page.tsx | 登録画面 |
| frontend/demo1/app/admin/page.tsx | 管理画面 |
| frontend/demo1/components/therapist/review-list.tsx | 口コミリスト+アンロックモーダル |
| frontend/demo1/app/therapist/[id]/therapist-page-client.tsx | セラピストページ |
| frontend/demo1/components/shared/unlock-modal.tsx | ¥1,000付きモーダル（未使用） |
| supabase/migrations/20260306000001_credit_system_v2.sql | クレジット制DB |
