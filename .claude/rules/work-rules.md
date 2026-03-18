# 作業ルール

- コミット時: メモリ更新もセットで行う（ユーザーCLAUDE.mdのSession Lifecycle参照）
- プロジェクト固有の詳細は `docs/DEVELOPMENT_LOG.md` にも記録
- 画像複数枚はコンテキスト消費大、注意
- スクレイピングHTMLは必ずgzip保存（`html_cache/{id}.html.gz`）
- セラピスト抽出の成功判定: 有効name + 有効source_url でDB保存完了
- SKR/HR はセンシティブ内容の隠語、表現に注意
- スクレイピングデータはリライトして使用（法的リスク対策）
- **`supabase db reset` は使用禁止**。本番デプロイフェーズのため不要。マイグレーション適用は `supabase migration up` で差分適用すること
- **フロントエンドのページ改良時は常に `nextjs-seo` スキルをロードし、SEOベストプラクティスと照合してから修正すること**
