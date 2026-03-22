# SEOルール

- **フロントエンドのページ改良時は常に `nextjs-seo` スキルをロードし、SEOベストプラクティスと照合してから修正すること**
- SEO重要コンテンツはServer Componentで直接レンダリング。クライアントに丸投げしない。`curl URL` でコンテンツが見えるか検証
- `"use client"` コンポーネントに `useSearchParams()` を入れるとBAILOUT_TO_CLIENT_SIDE_RENDERING → Googlebotにスケルトンしか見えなくなる。必ずSuspenseで隔離
- 口コミペイウォール: CSSブラー（filter: blur(5px)）で表示し、isAccessibleForFree構造化データを付ける。テキストはHTMLに入れてGooglebotに読ませる
- canonical全ページ設定済み。JSON-LD: BreadcrumbList + WebSite SearchAction設定済み
- 全ページ `index, follow`（noindex不使用）
