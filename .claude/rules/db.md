# DBルール

- **`supabase db reset` は使用禁止**。マイグレーション適用は `supabase migration up` で差分適用
- Supabase Local: 54322(DB) / 54321(API) / 54323(Studio)。本番とポート混同注意
- 本番DB Direct接続はIPv6のみ → Session Pooler経由で接続すること
- PL/pgSQL RETURNS TABLE → テーブルエイリアス `p` 必須（カラム名衝突回避）
- seed口コミは user_id=NULL → approve_review でプロフィール更新スキップ
- `confirmed_at` は generated column → `email_confirmed_at` のみ更新可
- 変数名は `salon` に統一済み。マイグレーション内部やVPS側に `shop_id` が残る場合あり
- `therapists.image_urls` は jsonb配列
- seed口コミのリライトはSonnet Batch API使用（直接APIは5倍コスト）
