# Vercelデプロイルール

- **自動デプロイ**: `git push origin main` → GitHub連携で自動ビルド
- `next/image` に外部画像を通すとImage Optimization課金が発生 → Supabase Storage画像はすでにwebp最適化済みなので `unoptimized` propを必ず付ける（Hobby上限1,000枚/月で402エラー）
- `sizes` 属性は必須: 未指定だとw=3840をリクエストしてしまう
- `generateStaticParams` は空配列にする: 大量ページの静的生成はSupabase 60秒タイムアウトでビルド失敗。ISR（revalidate）でオンデマンド生成
- APIルートのCDNキャッシュ: `Cache-Control: public, s-maxage=300` でVercel Edge Cacheが効く
- env var fallback必須: `supabase-admin.ts` とStripe初期化はモジュールトップレベル。`|| "placeholder"` 必須
- Cloudflare DNS: DNS onlyモード（proxyオフ）。proxyオンだとSSL競合
- `.gitignore` の `stripe/` → `/stripe/` にすること（webhookパスにマッチ防止）
- revalidate=86400にするとDB障害中の404がISRキャッシュに24時間残る → 復旧後は `git commit --allow-empty` で再デプロイしてキャッシュパージ
