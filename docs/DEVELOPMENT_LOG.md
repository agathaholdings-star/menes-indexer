# 開発ログ

CLAUDE.mdから移動した過去の実装経緯・テスト結果・意思決定の詳細記録。
日付降順。別チャットでも経緯と意図が追えるようにするためのアーカイブ。

---

## 2026-02-23: Codexレビュー反映＋3回目100サロンテスト＋VPS全件実行開始

- **Codexレビュー#1: single_page増分取得漏れ**: single_page/listing fallbackパス4箇所で`existing_urls`プレフィルタが`insert_therapist_new()`手前にあり、既存1名でもいると全員ブロック → 4箇所から除去、`insert_therapist_new()`の3点dedupに委譲
- **Codexレビュー#1: ドメイン部分一致**: 外部ドメイン除外が`salon_domain in netloc`（部分文字列一致）で緩い → `endswith('.' + salon_domain)`に変更（3箇所: batch_extract×2、scrape_failed×1）
- **Codexレビュー#2: 3Days CMS増分漏れ**: 3Days CMSパス3箇所にも同じ`existing_urls`プレフィルタ残存 → 除去
- **Codexレビュー#2: サブドメイン補正判定**: single_page→has_individuals補正のドメイン判定が完全一致のみ → `endswith('.' + salon_domain)`追加
- **HTMLキャッシュ完全化**: プロジェクトルール「HTMLをgzip圧縮で保存」に準拠
    - Stage3個別ページ: `therapist/{salon_id}_{url_md5[:12]}.html.gz` で保存追加
    - 3Days CMS data.js: `data_js/{salon_id}.html.gz` で保存追加（3箇所）
    - 検証: dry-runでsalon #352（33名）→ `therapist/352_*.html.gz` 33件生成確認
- **3回目100サロン検証テスト**: dedup修正＋Codexレビュー修正後、追加で100サロンを5並列実行
    - **結果**: 91/100サロン成功、**1,253名DB登録**
    - **名前品質**: 1,253名中 **1件のみ**（松山ゴールドの「体験A」= サロン側の命名）
    - **画像あり**: 1,209/1,253（**96.5%**）
    - 画像なし44名の分析: 12サロンが該当。大半はサロン側の写真未登録（placeholder/noimage/comingsoon）
    - 画像なしの原因パターン: オフサイド（Stage2で個別URL未発見→single_page fallback）、ルール（Jimdo srcset-only）、その他はサロン側未登録
- **300サロン累計テスト結果**:
    | テスト | 成功率 | 登録数 | 画像率 | 名前問題 |
    |--------|--------|--------|--------|---------|
    | 1回目 | 89% | 1,319 | 99.5% | 12件→few-shot修正 |
    | 2回目 | 82% | 1,271 | 97.7% | 0件 |
    | 3回目 | 91% | 1,253 | 96.5% | 1件（サロン側命名） |
- **VPS全件実行開始（2026-02-23 15:21 JST）**:
    - 5並列tmux (w1-w5)、ID範囲: W1(1-1538), W2(1538-3075), W3(3075-4612), W4(4612-6149), W5(6149-7686)
    - 対象: 6,488サロン（うち279サロン12,293名は処理済み→スキップ）
    - pg_dumpバックアップ: `/opt/scraper/backup_therapists_20260223.sql.gz` (1.7MB)
    - 推定所要時間: **20〜24時間**（2026-02-24 昼〜夕方完了見込み）
- **変更ファイル**: `batch_extract_therapist_info.py`（existing_urls除去7箇所、ドメインendswith3箇所、サブドメイン補正、キャッシュ追加4箇所、hashlib import）、`scrape_failed_salons.py`（ドメインendswith1箇所）

## 2026-02-23: single_page dedup修正＋2回目100サロン検証テスト

- **バグ発見**: 1回目100サロンテストでsingle_page/listingタイプのサロンが軒並み1名しかDB登録されていなかった
- **原因**: `insert_therapist_new()`のdedup判定が`salon_id + source_url`一致でスキップ。single_pageでは全員同じURLになるため2人目以降が全弾き
- **経緯**: 以前（2026-02-22）に`salon_id + name`に修正したが、その後の「統一パイプライン実装」でsource_url dedupを追加した際に上書きされ元に戻っていた
- **修正**: `salon_id + source_url + name`の3点一致チェックに変更。同じURLでも名前が違えば別人としてINSERT許可
- **修正検証（5サロン再スクレイプ）**:
    | サロン | タイプ | 修正前 | 修正後 |
    |--------|--------|--------|--------|
    | ツリーシャドウ | listing | 1名 | **6名** |
    | ココ１９ | single_page | 1名 | **9名** |
    | ラブワン | listing | 1名 | **3名** |
    | モア | single_page | 1名 | **3名** |
    | アロマエステサロン恋(Wix) | single_page | 1名 | **4名** |
    | **合計** | | **5名** | **25名** |
- **2回目100サロン検証テスト**: few-shot修正＋dedup修正後、追加で未スクレイプ100サロンを5並列実行
    - **結果**: 82/100サロン成功、**1,271名DB登録**
    - 失敗18件: fetch失敗/ドメイン死亡7件、セラピスト非公開5件、データなし6件
    - **名前品質**: 1,271名中 **0件の問題**（few-shot修正の効果確認）
    - **画像あり**: 1,242/1,271（**97.7%**）

## 2026-02-23: レガシーカラム削除＋画像抽出バグ修正＋重複セラピスト対策

- **レガシーカラム削除**: `name_raw`, `bust_raw`, `blood_type` をtherapistsテーブルから削除。マイグレーション `20260223000001_drop_legacy_columns.sql`。Python 6ファイルから`blood_type`参照を除去
- **画像抽出バグ3件修正**（`name_extractor.py` の `collect_image_candidates()`）:
    - **Bug 1: lazy loading取りこぼし**: `<img src="data:base64..." data-src="real.jpg">` で `src` が truthy なため `data-src` が参照されなかった → `data:`プレフィックスを検出して空文字に置換し`data-src`にフォールスルー
    - **Bug 2: CSS background shorthand**: 正規表現が`background-image:`のみマッチで`background:url(...)`を見逃していた → `background(-image)?\s*:`に拡張
    - **Bug 3: `<a href>`画像未収集**: セラピスト写真が`<a href="photo.jpg"><img src="thumb.jpg"></a>`構造のサイトで大きい画像URLを収集できなかった → `<a href>`の画像拡張子スキャン追加（子imgとの重複排除付き）
- **300サロンテストで検証**: 511/12,293件（4.2%、70サロン）が画像なし → 分析の結果11/20ドメインは写真未登録（正常）、残り9ドメインが上記3バグに起因 → 修正後は全パターンで画像候補収集可能に
- **重複セラピスト対策**（300サロンテストで284件の重複を発見・分類・対策）:
    - **`_normalize_source_url()`追加**: `#`フラグメント除去、URLデコード、http→https統一
    - **外部ドメインフィルタ**: Stage 3前にindividual_urlsのドメインをサロンドメインと照合
    - **diary/blog除外**: `_LISTING_EXCLUDE_PREFIXES`に`/diary/`, `/diary_detail/`を追加
    - **listing URL除外のhttp/https対応**: `expand_individual_urls()`の除外セットにhttp/https両方のバリアントを追加
- **修正後の再テスト（10サロン）**: 画像なしだった10サロンに対してHaiku再抽出テスト実施
    - **修正で画像取得成功**: 妻色兼美（lazy load→1枚）、ギンザラッシュ（CSS bg→5枚）、マダムガーデン（lazy load→5枚）
    - **写真未登録（正常動作）**: ジェイディースパ228名(`noimage.jpg`)、セレスティンアロマージュ(`comingsoon.png`)、熟女スパ24名、東京目黒高級セレブ熟女、小悪魔スパ9名
    - **サイト側問題**: スエルテ(HTML内URL二重化)、解放区・天界のスパ(サイトダウン)

## 2026-02-23: 名前抽出few-shot追加＋1回目100サロン検証テスト

- **few-shot追加**（`name_extractor.py`）: グレイススパで発見したランク・経験値装飾の除去パターン3件追加
    - `高梨 未経験(22)` → `高梨`、`生田 GOLD(25)` → `生田`、`福士　体験(21)` → `福士`
    - `Mio（ミオ）` → `ミオ`（カナ優先）に修正
- **100サロン検証テスト結果**:
    | 項目 | 件数 | 割合 |
    |------|------|------|
    | 名前あり | 1,319/1,319 | **100%** |
    | 画像あり | 1,312/1,319 | **99.5%** |
    | 年齢あり | 1,238/1,319 | 93.9% |
    | カップあり | 793/1,319 | 60.1% |
    | 紹介文あり | 1,223/1,319 | 92.7% |

## 2026-02-23: スクレイパー簡素化（Phase④準備）

- **背景と目的**: Phase④リビルドに向けて、スクレイパーからヒューリスティック（判断不能な正規表現ベース抽出）を完全排除し、全工程をHaiku LLMに統一する
- **`batch_extract_therapist_info.py` 変更**:
    - `--existing`モード完全削除。ヒューリスティック経路（Pass 1）完全削除
    - CLI: `--full`に名称統一。`--existing`/`--new`は廃止エラー
- **`name_extractor.py` 変更**: name few-shot 4個→10個に拡充
- **dedup修正**: `insert_therapist_new()`の重複判定をsource_url優先に変更

## 2026-02-23: Phase④ 300サロンテスト実行（VPS 3並列）

- **テスト構成**: 300サロン / 3ワーカー / 各100サロン
- **VPS掃除実施済み**: pg_dump バックアップ(61MB) → TRUNCATE → html_cache/ + checkpoint全削除
- **結果**:
    | ワーカー | サロン | INSERT | name=null | DBエラー | 所要時間 |
    |---------|--------|--------|-----------|---------|---------|
    | W1 | 100 | 2,086名 | 78 | 0 | 2h42m |
    | W2 | 100 | 6,205名 | 68 | 0 | 7h37m |
    | W3 | 100 | 4,002名 | 75 | 0 | 5h03m |
    | **合計** | **300** | **12,293名** | 221 | **0** | - |
- **データ品質**: 名前あり100%、cupあり69%、紹介文あり92%、1サロン平均41名
- **メモリ**: 3並列で792MB/1961MB使用 → 本番は5並列可能

## 2026-02-22: スクレイパー強化v2（URL補完+ページネーション+フィルタ+dedup改善）

- **背景**: Phase②③で失敗した3,000店弱のサロンを改良スクレイパーで再取得するため
- **URL補完改良** (`expand_individual_urls`):
    - LLMが返したseed URLからパターン推定 → HTML全体の`<a href>`から同パターンURLを網羅的に追加
    - 複数HTML対応（TOP+一覧ページの両方をスキャン）
    - `listing_url`パラメータ追加: 一覧ページURL自体を個別URLリストから除外
- **ページネーション対応** (`detect_pagination` + `fetch_paginated_listing`):
    - WordPress `/page/N/` とクエリ `?page=N` パターンを自動検出
    - 全ページをfetch → seed URLパターンで追加URL収集
- **非セラピストURLフィルタ強化**:
    - `_NON_THERAPIST_FILENAMES`: 27ファイル名を除外
    - `_LISTING_EXCLUDE_PREFIXES`: 10パス追加
    - `_PAGINATION_RE`: パス途中でも検出して除外
- **dedup判定改善** (`insert_therapist_new`): `salon_id + name` に変更
- **テスト結果（失敗サロン10件）**:
    | サロン | タイプ | 登録 | 備考 |
    |--------|--------|------|------|
    | #16 ファティーン | - | 0 | サイトダウン |
    | #20 ドットエム | single_page | 19名 | 名前dedup済み |
    | #35 マダムの手 | single_page | 18名 | 名前dedup済み |
    | #41 ワンルーム | has_individuals | 23 | profile_*.html |
    | #42 レガリス | single_page | 10名 | ブログ型 |
    | #43 快癒工房(Wix) | listing→single_page | 9 | Wix外部URL除外→fallback |
    | #45 ライベスパ | has_individuals | 15 | フィルタ適用 |
    | #47 ストレッチプラス | no_therapists | 0 | 正常 |
    | #54 アングリッド | single_page | 10名 | ブログ型 |
    | #58 メルメルメルト | no_therapists | 0 | 404（正常） |
- **追加テスト**: アロマブラッサム0→214名、アロマモア101→130名、アロマエメラルド24→118名
- **ランダム30件本番テスト**: **30/30処理成功、499名新規登録**
- **取れないパターン（対処不可）**: サイトダウン/404、年齢確認ゲート、JS描画で名前テキストがHTMLにない、セラピスト情報非公開
- **既テスト済みサロンID**: 16, 20, 35, 41, 42, 43, 45, 47, 54, 58, 59, 65, 67, 71, 72, 73, 75, 81, 82, 102, 104, 107, 111, 112, 113, 114, 116, 117, 118, 119, 120, 132, 139, 143, 156, 238, 239, 242, 243, 246, 248, 250, 251, 252, 253, 1428, 1515, 2489, 2592, 2608, 2847, 3458, 3780, 3960, 4028, 4317, 4403, 4478, 4493, 5006, 5346, 5394, 5413, 5418, 5787, 5899, 6036, 6325, 6537, 6540, 7111, 7224, 7328

## 2026-02-22: プラットフォーム別スクレイピング戦略

- **背景**: 40件テスト（20+20）でWix（JS描画+外部URL誤返却）、.click（JS描画）、Stage 3全件失敗時のfallback不在が判明
- **detect_platform()追加**: ドメイン+HTMLマーカーでWix/3Days CMS/Crayon/age_gateを早期検知（4パターン）
- **Stage 3全件失敗→single_page fallback**: 個別ページ抽出が全滅した場合、一覧ページ自体からsingle_page一括抽出
- **Wix外部URL除外**: Wix検知時にestama.jp等の外部ドメインURLを除外し、single_pageへ誘導
- **.click Playwright強制**: .clickドメインの一覧ページはPlaywright強制取得（JS描画対策）

## 2026-02-22: セラピスト統一スクレイピングパイプライン実装

- **背景と課題**: 2スクリプト体制（`batch_extract_therapist_info.py` + `scrape_failed_salons.py`）で運用が煩雑
- **Phase 1: source_url dedup追加**: `insert_therapist_new()` にINSERT前のsource_url存在チェック追加
- **Phase 2: --fullモードに3段階Haikuフロー統合**: 全サロンHaikuフロー1本に統一
- **Fix 1: LLMドメインハルシネーション対策**: `_reanchor_url()` — LLM返却URLのドメインを公式URLと比較し、不一致なら上書き
- **Fix 2: HTML切り詰めによるURL取りこぼし対策**: `expand_individual_urls()` — seed URLからパターン検出→全HTMLの`<a href>`から同パターン収集
- **正規運用（確定）**: `python batch_extract_therapist_info.py` を唯一の実行入口とする
- **`scrape_failed_salons.py`**: 検証/テスト専用（非推奨）

## 2026-02-22: therapistsデータ全件再構築の方針決定

- **背景**: 既存92,587名はPhase②（ヒューリスティック）→Phase③（LLM）→名前修復→クレンジング→Haiku再抽出と継ぎ接ぎ
- **決定理由**:
    1. 全データを同一スクレイパーバージョンで統一（品質の一貫性）
    2. 旧`salon_scrape_cache`の誤判定キャッシュを排除（source-first原則）
    3. 未公開フェーズの今がコスト最小のタイミング
    4. 差分追加だと旧/新の表記ゆれ・重複リスクが残る
- **推定コスト**: ~$260 / **推定結果**: 12万〜13万名

## 2026-02-21: セラピスト画像パイプライン実装

- **背景**: Phase②③のimage_urlsがゴミデータ（spacer/itemList.png/バナー画像混入）
- **2プログラム構成**:
    1. **Haiku画像パス抽出**: `name_extractor.py`の`extract_therapist_info()`に画像判定を統合。`collect_image_candidates()`: img src/data-src/srcset/CSS background-imageを構造化収集
    2. **画像DL→Supabase Storage**: `batch_download_images.py`新規作成。外部URL → requests.get → Storage upload → DB URL差し替え
- **マイグレーション**: `20260221000001_therapist_images_bucket.sql`
- **テスト結果**: 3サロン9件で9/9正しい画像URL抽出（$0.02）

## 2026-02-19〜20: セラピスト情報Haiku一括抽出（VPS実行）

- 5並列tmux (hw1-hw5) で95,340件に対してHaiku抽出を実行・完了
- 推定コスト: ~$241（Haiku 4.5）
- **設計方針の変遷**: ヒューリスティック優先案 → v2(候補テキストのみ) → v3(全ページHTML) → **v4(全フィールドJSON一括)を採用**
- **テスト結果サマリ**:
    | バージョン | 方式 | 成功率 | 推定コスト |
    |-----------|------|--------|-----------|
    | v2 | 候補テキストのみ→Haiku | 13/20 (65%) | ~$30 |
    | v3 | 全ページHTML+候補→Haiku | 17/20 (85%) | ~$125 |
    | v4 | 全ページ→Haiku（全フィールドJSON） | 5/5 (100%) | ~$241 |
- **実装済みモジュール**: `fetch_utils.py`（共通fetch）、`name_extractor.py`（メインAPI）、`salon_diagnose.py`（診断CLI）、`classify_failures.py`（失敗分類）

## 2026-02-19: サロン紹介文バッチ生成

- 6,489サロンの紹介文をSERP検索+Sonnet Batch APIで生成
- コスト: DataForSEO ~$13 + Sonnet Batch ~$15 = **~$28**

## 2026-02-18: Phase③完了＋データクレンジングv2＋口コミseed投入

- **Phase③完了**: VPS 5並列で未取得3,603店をLLMスクレイピング → **+15,701名**（79,639→95,340名）
- **ローカルSupabase再同期**: VPS Phase③データをpg_dumpで投入。名前クレンジング404件＋重複削除1,964件 → **92,587名/3,506サロン**
- **口コミseed投入完了**: Batch APIで14,971件リライト→**14,879件DB投入**（平均スコア73.7、~$35）
- **セラピスト名修復完了**: v1〜v3で計~14,988件修復（残20件は死サイト）
- **フロント修正**: 口コミ表示修正、設問8問対応、分類IDマッピング修正
- **名前クレンジングv2**: 5,144件（年齢混入3,137/NEW FACE 627/ローマ字69/キャッチコピー925）＋source_url重複789件削除
- **HTMLキャッシュ統一化**: `html_cache_utils.py`共通モジュール作成。全7スクレイピングスクリプトにgzip保存を統合

## 2026-02-16〜17: ME口コミマッチング＋リライトパイプライン実装

- **マッチング結果**: ME 80,458名 vs Indexer 79,639名 → **15,690名マッチ（19.5%）、口コミ48,288件**
- **マッチング方法（3段階）**: URL直接一致 → ドメイン+名前一致 → サロン名+名前一致
- **パイプライン**: Step1:ME抽出 → Step2:LLMリライト → Step3:DB投入
- **Sonnet 100件テスト**: 100/100成功（34.2分、平均スコア76.3）

## 2026-02-12〜15: salons重複解消＋公開レベル仕上げ＋ローカル同期

- **salons重複解消**: official_urlベースでマージ（7,685→6,489店舗）
- **shops→salonsリネーム**: DB・Python(8ファイル)・フロント(16ファイル)一括
- **Phase②完了**: VPSセラピストスクレイピング完走 → **79,639名**取得
- **公開レベル仕上げ**: デバッグUI除去、mockデータ全削除、Stripe環境変数化

## 2026-02-10〜11: Smart Scraper実装＋ヒューリスティック全店スキャン

- **Smart Scraper**: CMS指紋判定→ルールベース抽出→LLMフォールバック→自動学習のパイプライン
- **テスト結果**: 25サロン処理 → 16サロン成功 → 303名取得 → 21分 → エラー0
- **ヒューリスティック全店スキャン**: 7,684店28分。Step2成功86.5%、Step3成功32.2%
- **ヒューリスティックv2**: +1,227店改善 → Phase②対象3,708店

## 2026-02-09: VPS構築＋全エリアスクレイピング

- **XServer VPS構築**: Ubuntu 25.04、2GB RAM、3vCPU
- **全エリアスクレイピング**: 821エリア一括完了（7,685店舗、エラー0件）

## 2026-02-08: エリア設計＋MCP設定＋設計フェーズ完了

- **エリアマスタ確定**: 821件（DataForSEO検索ボリューム付き）
- **競合サイト調査**: ME、メンマガとの突合完了
- **設計フェーズ完了**: SERVICE_OVERVIEW.md、SYSTEM_DESIGN.md、UX_FLOW.txt、V0_PROMPTS.md作成

---

## Smart Scraper アーキテクチャ詳細（参考）

```
サロンURL
  ↓
salon_scrape_cache確認（前回の一覧URL・CMSパターンあり？）
  ├─ あり → キャッシュされた一覧URLへ直行（Step 2省略）
  └─ なし → CMS指紋判定
                ├─ 既知CMS → ルールベース抽出（CSSセレクタ、LLM不要）
                └─ 未知CMS → LLM抽出 → パターン自動学習 → 次回からルール化
```

### 信頼度モデル
| confidence | 動作 |
|-----------|------|
| >= 0.7 | ルールのみ（LLM不使用） |
| 0.4-0.7 | ルール + LLMでサンプル検証 |
| < 0.4 | ルール破棄、LLM使用、再学習トリガー |

`confidence = success / (success + fail * 2)`

## セラピスト本番スクレイピング: 3段階パイプライン詳細（参考）

```
① ローカル: ヒューリスティック全店スキャン（28分、$0）  ← ✅ 完了
② VPS: 成功店のセラピストデータ取得（~30時間）  ← ✅ 完了（79,639名）
③ VPS: 失敗店のLLM再挑戦（~15時間、~$200）  ← ✅ 完了（+15,701名=95,340名）
```

### Phase③実行結果（2026-02-18、3,603店対象）
| ワーカー | ID範囲 | 取得セラピスト | 所要時間 |
|---------|--------|-------------|---------|
| W1 | 0-1899 | 4,785名 | 6h28m |
| W2 | 1899-3791 | 4,600名 | 6h06m |
| W3 | 3791-4918 | 1,531名 | 3h01m |
| W4 | 4918-6091 | 1,442名 | 2h29m |
| W5 | 6091-∞ | ~3,343名 | (停止) |
| **合計** | - | **+15,701名** | - |

## スクレイピングパイプライン（動作確認済み）

`database/test_scrape_to_supabase.py` で以下を1パスで実行:
1. esthe-ranking一覧取得 → サロン基本情報
2. 公式URL取得 → 詳細ページから公式サイトURL抽出
3. display_name確定 → 括弧カナ → title正規表現 → LLMフォールバック → ルール
4. salons/salon_areas INSERT → slug=数字ID
5. セラピスト取得（オプション）→ TherapistScraper経由

### display_name確定の優先順位
1. esthe-ranking括弧カナ（`ELTERAS（エルテラス）` → `エルテラス`）
2. 公式サイト`<title>`タグから正規表現抽出
3. LLMフォールバック
4. ルールベース正規化

## エリア設計詳細（参考）

### esthe-ranking.jp 完全階層構造
```
Level 0: /                              ← TOPページ
Level 1: /prefecture/XX/                ← 47都道府県
Level 2: /hakata/                       ← 163親エリア
Level 3: /hakata/tenjin-station/all/    ← 549駅
Level 3: /sapporo/asahikawa-city/all/   ← 263市
```

### 関連ファイル
| ファイル | 内容 |
|---------|------|
| `docs/AREA_DESIGN.md` | エリア設計の詳細ドキュメント |
| `database/esthe-ranking/area_resolved_filtered.csv` | 最終エリアマスタ 826件 |
| `database/esthe-ranking/area_resolved_with_counts.csv` | 全854件+salon_count |
| `database/esthe-ranking/site_hierarchy_complete.csv` | 全階層一元化（975件） |
