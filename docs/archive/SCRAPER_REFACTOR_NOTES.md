# 失敗サロン最大回収スクレイパー 改修記録

## 日付: 2026-02-21

## 背景・目的

Phase②③で取得できなかった2,977サロンに対し、`scrape_failed_salons.py`の3段階Haikuパイプラインで最大限セラピストを回収する。

**根本方針**: ヒューリスティック節約 → **全HTML投入で最大回収**。コストよりも取りこぼしゼロを優先。

## 対象ファイル

- `database/therapist-scraper/scrape_failed_salons.py` — メインの修正対象
- `database/therapist-scraper/playwright_fetch.py` — JS描画サイト用（実装済み、今回変更なし）
- `database/therapist-scraper/therapist_scraper.py` — 変更なし（Stage 3や他スクリプトで使用）

## 改修内容（時系列）

### v1: ベースライン（前セッションで実装済み）
- `clean_html_full()`: nav/header/footer保持、100K文字制限（既存`clean_html_for_llm()`のnav除去+8K truncを解消）
- `fetch_page_smart()`: requests.get → thin HTML検知 → Playwright fallback
- `extract_page_links()`: 補助リンクリスト
- **テスト結果**: 30サロン → 246名

### v2: 3Days CMS + max_tokens修正
**問題1**: `max_tokens=2000` でHaikuレスポンスが切れる → JSONパース失敗（ANALYZE_FAILED）
- アロマブラッサム(#139): 209件URLを返そうとして切り詰め
- アクア(#132): 同様

**対策**: `max_tokens` を 2000→4000 に引き上げ + `stop_reason`ログ追加

**問題2**: 3Days CMS（Alpine.js + S3 data.js）サイトが0件
- ギニロキカク、ホワイトティアラ、小悪魔スパ等
- HTMLに`x-data="shopData"`があるがデータは外部S3のdata.jsに格納
- Haikuに渡しても見えない

**対策**: `detect_3days_cms()` + `parse_3days_data_js()` を追加。data.jsを直接fetchしてJSオブジェクトから構造化抽出（LLM不要、$0）

**テスト結果**: 30サロン → 466名（+220）

### v3: リミット撤廃
**問題**: `individual_urls[:30]` でサロンあたり最大30名に制限していた（テスト用コスト制御だった）
- ベルエ: 49名中30名しか取得していなかった
- リンダスパ: 55名中30名
- コマダム: 58名中30名

**対策**: `[:30]`を除去 + プロンプトの「最大30件」指示も除去

**テスト結果**: 30サロン → 689名（+223）

**副作用**:
- アロマブラッサム(#139)がリグレッション: 「最大30件」指示を除去 → Haikuが209件URL返却 → 4000トークン超え → ANALYZE_FAILED
- アクア(#132): 30→152名に増加（プロンプト制限がボトルネックだった）

### v4: listing URLマージ + max_tokens 8000 + ゴミフィルタ（現在テスト中）

**問題1: has_individuals + listing の排他問題**
- コマダム(#173): トップページに62件、一覧ページ(/therapist)に102件
- Haikuが`has_individuals`と判定 → トップの62件だけでStage 3 → **40件取りこぼし**
- トップには「本日出勤」「おすすめ」等のサブセットしか載らない。一覧ページが全員

**対策**:
1. プロンプト修正: `listing_url`と`individual_urls`を排他にせず**常に両方返す**よう指示追加
2. コード修正: `has_individuals` + `listing_url`ありの場合 → 一覧ページもfetch → Haiku分析 → URLマージ（重複排除）→ Stage 3

```
Stage 1 結果:
  ├─ listing_url あり AND individual_urls あり
  │    → listing_url をfetch → URLをマージ → Stage 3（最大回収）
  ├─ listing_url あり AND individual_urls なし
  │    → 従来のlisting フロー（Stage 2 → Stage 3）
  ├─ listing_url なし AND individual_urls あり
  │    → 従来のhas_individuals フロー（Stage 3 直行）
  └─ 両方なし
       → single_page / no_therapists
```

**問題2: max_tokens不足リグレッション**
- アロマブラッサム(#139): v3で「最大30件」指示を外したらHaikuが209件URL返却 → 4000トークン超え

**対策**: `max_tokens` を 4000→8000 に引き上げ（テストモード `haiku_analyze_page()` + Batch API全箇所）

**問題3: 3Days CMSゴミデータ**
- 「💛体験💛」「店長（高橋）」「1月末五反田店オープン❕」がセラピストとしてINSERTされる

**対策**: `parse_3days_data_js()`にフィルタ追加
- 絵文字含み名前
- 店長/オーナー/スタッフ
- OPEN/オープン告知
- 「体験」で始まる名前

## テスト結果推移

| Version | 合計セラピスト | 主な変更 |
|---------|-------------|---------|
| v1 | 246 | clean_html_full + Playwright + URL validation |
| v2 | 466 | + 3Days CMS直接抽出 + max_tokens 4000 |
| v3 | 689 | + リミット撤廃（[:30]除去） |
| v4 | **テスト中** | + listing URLマージ + max_tokens 8000 + ゴミフィルタ |

### v3 サロン別詳細

| salon_id | サロン名 | v2 | v3 | 差 | 原因 |
|---|---|---|---|---|---|
| 16 | ファティーン | 0 | 22 | +22 | サイト復活 |
| 67 | 桜 | 13 | 13 | - | Playwright必須サイト |
| 81 | ギニロキカク | 28 | 25 | -3 | 3Days CMSデータ変動 |
| 82 | シンデレラガール | 22 | 22 | - | Playwright必須サイト |
| 117 | ハッピー | 10 | 10 | - | |
| 124 | サクラ | 6 | 6 | - | single_page |
| 127 | ベルエ | 30 | 49 | +19 | リミット撤廃 |
| 129 | リンダスパ | 30 | 55 | +25 | リミット撤廃 |
| 132 | アクア | 30 | 152 | +122 | プロンプト「最大30件」削除 |
| 139 | アロマブラッサム | 30 | 0 | -30 | リグレッション（v4で修正） |
| 141 | ポセイドン | 30 | 28 | -2 | 微減 |
| 154 | ザ・ハーフ | 29 | 31 | +2 | |
| 158 | モモスパ | 0 | 44 | +44 | サイト復活 |
| 160 | オーガニックスパ | 39 | 33 | -6 | サイト変動 |
| 166 | 奥様ホーテ | 9 | 9 | - | |
| 168 | ホワイトティアラ | 9 | 9 | - | 3Days CMS |
| 173 | コマダム倶楽部 | 30 | 60 | +30 | リミット撤廃（v4で更に102予定） |
| 188 | 小悪魔スパ | 121 | 121 | - | 3Days CMS |

## 3Days CMS 仕様

### 検出方法
- HTML内に `x-data="shopData"` がある
- `src="https://3days-cms-bucket-prod.s3.ap-northeast-1.amazonaws.com/.../data.js"` がある

### data.js 構造
```javascript
var shopData = {
  therapists: [
    {
      therapistName: "れもん",
      age: "24",
      height: "158",
      threeSize: "82(D)-57-84",
      bloodType: "O型",
      comment: "紹介文...",
      img1: "https://...",
      url: "/therapist/123"
    },
    ...
  ]
}
```

### 対応サイト例
- ginirokikaku.site, white-tiara.com, mens-esthe-aroma.site, cz-girls.click, ls452.click, prunus-ch.click

## 学び

1. **コスト節約のためにヒューリスティック分岐やリミットを入れるとモグラ叩きになる** — 全HTML投入+無制限が最も安定
2. **プロンプト内の制限指示もボトルネックになる** — 「最大30件」とHaikuに言うとHaikuが勝手に制限する。アクアは30→152に増加
3. **排他的分類は情報を捨てる** — page_typeで`listing` OR `has_individuals`の二択にすると、両方あるケースを取りこぼす
4. **max_tokensは余裕を持って設定** — 209件URLのサロンが存在する。8000あれば安全
5. **テスト結果を報告するとき、制限の存在を明示すべき** — individual_count=49でtherapists_found=30なのに説明しないのはNG

## 次のステップ

1. v4テスト結果確認（running）
2. 結果OKならBatch API本番パイプラインにも同じ修正を適用（stage1 prepare/process, stage2 prepare/process）
3. VPSにデプロイ → 2,977サロン全件実行
4. 推定コスト: ~$34（Batch API 50%割引）
