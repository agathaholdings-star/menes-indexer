# メンエスインデクサ プロジェクトガイド

## プロジェクト概要

メンズエステ口コミサイト「メンエスインデクサ」の開発プロジェクト。
競合サイト「ME」を超える「発見」体験を提供するプラットフォーム。

**コアコンセプト**: 「"確認"で終わるサイトから、"発見"が始まるサイトへ」

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
└── menesthejp/            ← 競合MEのHTML（分析用）
```

## 技術スタック

- **Frontend**: Next.js (App Router), Tailwind CSS, ShadcnUI, Lucide Icons, Framer Motion, Recharts
- **Backend/Database**: Supabase (PostgreSQL, Auth, Storage)
- **Infrastructure**: Vercel
- **Data Pipeline**: Python (既存スクレイパー), Claude API (セラピスト分類)

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

## コマンド例

```bash
# Next.jsプロジェクト作成（まだ未実施）
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir

# Supabase CLI
supabase init
supabase db push
```

## 注意事項

- SKR/HR = サービスレベルの隠語（センシティブな内容を示す）
- 法的リスクを考慮し、表現には注意
- スクレイピングデータはリライトして使用
