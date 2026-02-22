# メンエスインデクサ プロジェクトガイド

## 作業ルール

- 1タスク完了ごとに git commit を提案すること
- コミット時は CLAUDE.md に「何をやったか」と「その目的（なぜやったか）」を必ず書くこと。別チャットでも経緯と意図が追えるようにする
- 大きな決定・進捗があれば CLAUDE.md を更新すること
- コンテキスト使用率が80%を超えたら新チャットへの切り替えを提案すること
- 画像を複数枚受け取った場合はコンテキスト消費が大きいことを意識すること
- スクレイピング時は必ずHTMLをgzip圧縮でローカル保存すること（`html_cache/{id}.html.gz`）。抽出ロジック改善時に再fetchなしで再処理可能にするため。
- **セラピスト抽出の成功判定**: 成功=有効name+有効source_urlでDB保存完了、抽出のみは成功扱いしない。

## 現在のステータス (2026-02-22 更新)

- **設計フェーズ完了**: サービス概要、システム設計、UXフロー、v0用プロンプトを作成済み。
- **フロントエンド公開済み**: v0.appからVercelにデプロイ → https://menes-indexer.com/
- **スクレイピングパイプライン動作確認済み**: 3エリア268件テスト完了
- **全エリアスクレイピング完了**: VPS上で821エリア一括スクレイピング完了（7,685店舗、エラー0件）
- **salons重複解消済み**: official_urlベースでマージ（7,685→6,489店舗、1サロン=1行モデル確立）
- **Smart Scraper実装完了**: 自己学習型セラピストスクレイパー実装・テスト済み（25サロン/303名で動作確認）
- **ヒューリスティック優先抽出 実装完了**: 全7,684店スキャン済み（Step2: 86.5%, Step3: 48%）
- **ヒューリスティックv2**: flat HTML構造+共通サブパス検出で+1,227店改善
- **shops→salonsリネーム完了**: DB・Python(8ファイル)・フロント(16ファイル)・CLAUDE.md一括リネーム。VPS本番DBも実行済み
- **Phase②完了**: VPSセラピストスクレイピング完走 → **79,639名**取得済み → Phase③で**95,340名**に拡大
- **ローカルSupabase最新同期済み**: VPSからpg_dumpで79,639名をローカルに投入（2026-02-16）
- **公開レベル仕上げ完了**: デバッグUI除去、mockデータ全削除、Stripe環境変数化、おすすめ実データ化
- **データクレンジング完了**: bust→cup分離651件、元データはname_raw/bust_rawに退避保持
- **ローカル動作確認済み**: トップページ（6,489店舗/821エリア表示）、セラピスト検索（実データ表示）OK
- **ME口コミマッチング完了**: ME 80,458名 vs Indexer 79,639名 → **15,690名マッチ（19.5%）、口コミ48,288件**
- **ME口コミリライトパイプライン実装完了**: 3ステップ構成（Step1:ME抽出→Step2:LLMリライト→Step3:DB投入）、DBマイグレーション（設問3→8問拡張）適用済み
- **Sonnet 100件テスト完了**: 100/100成功（34.2分、平均スコア76.3）、ローカルDB投入済み、フロント表示確認OK
- **口コミseed投入完了**: Batch APIで14,971件リライト→14,879件DB投入（2026-02-18）。平均スコア73.7、~$35
- **セラピスト名修復完了**: v1〜v3で計~14,988件修復済み（残20件は死サイト）。HTMLキャッシュ`html_cache/`保存済み
- **フロント口コミ表示修正済み**: セラピスト詳細ページでDB口コミ・スコア・件数を動的表示（ハードコード0を修正）
- **フロント口コミ設問8問対応完了**: Review型を旧3問(q1/q2/q3)→新8問(commentReason〜commentAdvice)に更新
- **フロント分類IDマッピング修正済み**: DB整数ID（looks_type_id等）にフロント全体を統一
- **データクレンジングv2完了（2026-02-18）**: 名前クレンジング5,144件（年齢混入3,137/NEW FACE 627/ローマ字69/キャッチコピー925）＋source_url重複789件削除。`clean_therapist_names.py`で実行
- **HTMLキャッシュ統一化完了（2026-02-18）**: `html_cache_utils.py`共通モジュール作成。全7スクレイピングスクリプトにgzip保存を統合。カテゴリ別（therapist/salon/salon_list/area）に自動分類
- **フロント名前パース強化済み（2026-02-18）**: `parseNameAge()`/`cleanTherapistName()`に4パターン除去追加（キャッチコピー/NEW FACE/ローマ字括弧/年齢括弧）。DB修正漏れの防御層
- **Phase③完了（2026-02-18）**: VPS 5並列ワーカーで未取得3,603店をLLMスクレイピング → **+15,701名**取得（79,639→95,340名）。3,511サロンにセラピスト紐付き済み（54.1%）。残り2,977店はサイトダウン/セラピスト非公開
- **ローカルSupabase再同期完了（2026-02-18）**: VPS Phase③データをpg_dumpでローカルに投入。名前クレンジング404件＋重複削除1,964件を適用 → ローカル**92,587名/3,506サロン**
- **🎯 ローカル本番相当到達（2026-02-18）**: データ（6,489店舗/92,587名/14,880口コミ）＋フロント全機能がローカルで動作。以降はUX改善・目視確認フェーズへ
- **プラットフォーム別スクレイピング戦略 実装完了（2026-02-22）**:
    - **背景**: 40件テスト（20+20）でWix（JS描画+外部URL誤返却）、.click（JS描画）、Stage 3全件失敗時のfallback不在が判明
    - **detect_platform()追加**: ドメイン+HTMLマーカーでWix/3Days CMS/Crayon/age_gateを早期検知（4パターン）
    - **Stage 3全件失敗→single_page fallback**: 個別ページ抽出が全滅した場合、一覧ページ自体からsingle_page一括抽出。NO_URLS時も同様にfallback
    - **Wix外部URL除外**: Wix検知時にestama.jp等の外部ドメインURLを除外し、single_pageへ誘導
    - **.click Playwright強制**: .clickドメインの一覧ページはPlaywright強制取得（JS描画対策）
    - **適用箇所**: `run_test()`と`_process_haiku_salon()`の両方
    - **次ステップ**: サロン#43（快癒工房、Wix）等で実テスト → 成功率検証
    - **検証コマンド**: `python3 -c "import scrape_failed_salons as s; salons = s.get_salons_by_ids([43]); s.run_test(salons, csv_path='/Users/agatha/Desktop/retest_wix.csv')"`
- **スクレイパー強化v2: URL補完+ページネーション+フィルタ+dedup改善（2026-02-22）**:
    - **背景**: Phase②③で失敗した3,000店弱のサロンを改良スクレイパーで再取得するため。テストで非セラピストURL混入・ページネーション未対応・single_page重複問題を発見
    - **URL補完改良** (`expand_individual_urls`):
        - LLMが返したseed URLからパターン推定（共通パスプレフィックス or クエリキー or all_internal）→ HTML全体の`<a href>`から同パターンURLを網羅的に追加
        - 複数HTML対応（TOP+一覧ページの両方をスキャン）
        - `listing_url`パラメータ追加: 一覧ページURL自体を個別URLリストから除外
    - **ページネーション対応** (`detect_pagination` + `fetch_paginated_listing`):
        - WordPress `/page/N/` とクエリ `?page=N` パターンを自動検出
        - 全ページをfetch → seed URLパターンで追加URL収集
        - 例: アロマエメラルド 24名→94名（4ページ分追加取得）
    - **非セラピストURLフィルタ強化**:
        - `_NON_THERAPIST_FILENAMES`: `schedule.html`, `reserve.html`, `menu.html`, `blog.html`等27ファイル名を除外
        - `_LISTING_EXCLUDE_PREFIXES`: `/reservation`, `/contact`, `/access`等10パス追加
        - `_PAGINATION_RE`: `/page/\d+` をパス途中でも検出して除外
        - ファイル名フィルタを`all_internal`だけでなく`path`パターンにも適用（ライベスパで検証済み）
    - **dedup判定改善** (`insert_therapist_new`):
        - 旧: `salon_id + source_url` → single_pageで全員同じURLになり1名しか登録できなかった
        - 新: `salon_id + name`（同名チェック）→ 同じURLでも名前が違えばINSERT可能
        - 例: 快癒工房（Wix） 1名→9名に改善
    - **テスト結果（失敗サロン10件）**:
        | サロン | タイプ | 登録 | 備考 |
        |--------|--------|------|------|
        | #16 ファティーン | - | 0 | サイトダウン |
        | #20 ドットエム | single_page | 19名抽出 | 名前dedup済み |
        | #35 マダムの手 | single_page | 18名抽出 | 名前dedup済み |
        | #41 ワンルーム | has_individuals | 23 | profile_*.html パターン |
        | #42 レガリス | single_page | 10名抽出 | ブログ型 |
        | #43 快癒工房(Wix) | listing→single_page | 9 | Wix外部URL除外→fallback |
        | #45 ライベスパ | has_individuals | 15 | フィルタ適用でゴミURL排除確認 |
        | #47 ストレッチプラス | no_therapists | 0 | セラピスト情報なし（正常） |
        | #54 アングリッド | single_page | 10名抽出 | ブログ型 |
        | #58 メルメルメルト | no_therapists | 0 | 404ページ（正常） |
    - **追加テスト（大規模サロン3件）**: アロマブラッサム0→214名、アロマモア101→130名、アロマエメラルド24→118名
    - **変更ファイル**: `scrape_failed_salons.py`（フィルタ・URL補完・ページネーション）, `batch_extract_therapist_info.py`（dedup改善・listing_url引数追加）
- **セラピスト統一スクレイピングパイプライン実装完了（2026-02-22）**:
    - **背景と課題**: 2スクリプト体制（`batch_extract_therapist_info.py --new` + `scrape_failed_salons.py`）で運用が煩雑。`scrape_failed_salons.py`にdedup がなく複数回実行で重複INSERT。`--new`モードはtherapist_list_urlありサロンしか処理できなかった
    - **Phase 1: source_url dedup追加**:
        - `insert_therapist_new()` にINSERT前のsource_url存在チェック追加（全呼び出し元で自動dedup）
        - `scrape_failed_salons.py` の `run_test()` Stage 3前に既存URL一括除外（不要なfetch+API呼び出し回避）
        - `cmd_stage3_prepare()` にBatch API JSONL生成前のsource_url dedup追加
    - **Phase 2: --newモードに3段階Haikuフロー統合**:
        - `run_new()` を2パス構成に拡張:
            1. therapist_list_url あり → 既存ヒューリスティックURL抽出 → Haiku個別抽出
            2. therapist_list_url なし → 3段階Haikuフロー（TOP→一覧→個別） + 3Days CMS直接抽出 + single_page一括抽出 + Playwright fallback
        - `scrape_failed_salons.py` の関数を遅延importで再利用（循環import回避）
        - DB_DSN を環境変数 `DATABASE_URL` 対応（VPS/ローカル自動切り替え）
        - 全フローで source_url dedup保証
    - **Fix 1: LLMドメインハルシネーション対策（URL再アンカー）**:
        - Haiku がURLのドメインを誤って返す問題（例: `sh-gzs.tokyo` → `sh-gzz.tokyo`）
        - `_reanchor_url()`: LLM返却URLのドメインを公式URLのTLD+1と比較し、不一致なら公式ドメインで上書き（パスは保持）
        - `_reanchor_stage1_urls()`: Stage 1結果のlisting_url/individual_urls全体に適用
        - 両スクリプトの全`haiku_analyze_page()`呼び出し後に適用（計9箇所）
    - **Fix 2: HTML切り詰めによるURL取りこぼし対策**:
        - `clean_html_full()` max_chars=100Kで巨大ページが切り詰められ、LLMが一部のURLしか見えない問題
        - `expand_individual_urls()`: LLMが返したseed URLsからパターン（query key: `?castid=` / path prefix: `/therapist/`）を検出し、全HTMLの`<a href>`から同パターンのURLを網羅的に収集
        - 両スクリプトのStage 3ループ前に適用。マロアリ・タッハ(27→40人)等のケースで回収率向上
    - **正規運用（確定）**: 新規/既存失敗再処理は `python batch_extract_therapist_info.py --new` を唯一の実行入口とする。1コマンドで全6,489サロンの差分セラピスト発見・抽出・INSERT
    - **`scrape_failed_salons.py`**: ⚠️ 検証/テスト専用（非推奨）。通常運用では使わない。Batch API JSONL生成・個別サロンデバッグ用途に限定
- **セラピスト情報Haiku一括抽出（`--existing`モード）VPS実行済み（2026-02-19〜02-20）**:
    - 5並列tmux (hw1-hw5) で95,340件に対してHaiku抽出を実行・完了
    - 推定コスト: ~$241（Haiku 4.5）
    - **スクリプト仕様**:
        - 常にfetch（キャッシュは保険用、判定には使わない）
        - fetch失敗 / Haiku name取得不可 → `status='retired'`（ゴミデータを残さない）
        - ドメインシャッフル + 1秒delay（同一サーバーへの連続アクセス防止）
        - チェックポイント: `batch_extract_existing_checkpoint_{start}_{end}.json`
        - SIGINT graceful shutdown対応
    - **完了後の手順**: DB確認 → pg_dumpでローカル同期 → 目視確認
- **セラピスト情報Haiku一括抽出 設計・テスト完了（2026-02-19）**:
    - **背景と課題**:
        - Phase②の名前抽出はh1/h2テキスト直取りのみで品質が低く、`repair_therapist_names.py`で事後修復14,988件を強いられた
        - cup/profile_textなど空欄カラムが多い（cupは大半がNone、profile_textは44%が空）
        - `fetch_page()`が3箇所に重複定義、HTTPS→HTTPフォールバックもなかった
        - Phase②③（VPS実行）でセラピスト個別ページのHTMLキャッシュを保存していなかった（`html_cache_utils.py`統合が間に合わず）。ローカルにはrepair時の40件のみ
    - **目的**: 92,587件のセラピストデータを、1回のHaiku API呼び出しで名前・年齢・スリーサイズ・カップ・紹介文を一括抽出し、DB品質を根本改善する
    - **設計方針の変遷と最終決定**:
        1. 当初案: ヒューリスティック優先→LLMフォールバック（コスト節約重視）
        2. テストで判明: ヒューリスティックは`白石りおNEW FACE`、`みみ(20歳)`等の除去パターンがモグラ叩きになる
        3. 方針転換: **常にHaiku LLM、ヒューリスティック分岐なし**（品質 > コスト）
        4. v2テスト（候補テキストのみ→Haiku）: 13/20成功。推定~$30/全件
        5. v3テスト（全ページHTML+候補→Haiku）: **17/20成功**。+4件回収。推定~$125/全件
        6. v4テスト（全フィールド一括JSON抽出）: 5/5成功。name+age+cup+3サイズ+profile_text全取得。推定**~$241/全件**
        7. **最終決定: v4（全フィールド一括抽出）を採用**。1回のAPI呼び出しで全カラムを埋める。$241は名前修復+空欄埋めの価値に十分見合う
    - **実装済みモジュール**:
        - `fetch_utils.py`: 共通fetchモジュール。HTTPS→HTTPフォールバック。6ファイルのimport統一済み
        - `name_extractor.py`: メインAPI `extract_therapist_info()` — 全ページHTML+候補テキストをHaikuに渡し、JSON形式で全フィールド返却。バリデーション（名前除外キーワード108個、サロン名比較、数値型変換、cup/blood_type正規化）内蔵。後方互換の `extract_name()` も維持
        - `salon_diagnose.py`: 診断CLIツール（diagnose/test-extract/rescrape/list-failed/list-patterns）
        - `classify_failures.py`: 失敗サロン理由分類（domain_dead/site_down/page_404等8分類）
        - マイグレーション `20260219000002`: `salon_scrape_cache`に`name_css_selector`+`fail_reason`追加
    - **テストスクリプト（検証用、read-only）**:
        - `test_haiku_name_extract.py`: 名前のみ抽出テスト（v2検証用）
        - `test_fullpage_compare.py`: 全ページ版名前抽出テスト（v3検証用）
        - `test_fullinfo_extract.py`: 全フィールド一括抽出テスト（v4検証用）
    - **テスト結果サマリ**:
        | バージョン | 方式 | 成功率 | 推定コスト(92,587件) | 備考 |
        |-----------|------|--------|---------------------|------|
        | v2 | 候補テキストのみ→Haiku（名前だけ） | 13/20 (65%) | ~$30 | 失敗7件はHTML情報不足 |
        | v3 | 全ページHTML+候補→Haiku（名前だけ） | 17/20 (85%) | ~$125 | v2失敗の4件を回収 |
        | v4 | 全ページ→Haiku（全フィールドJSON） | 5/5 (100%) | ~$241 | name+age+cup+3size+profile全取得 |
    - **v4テスト詳細（5件）**:
        - name: 全5件正しく抽出（DB壊れてた4件が修正）
        - age/height: DB既存値と完全一致（正規表現で取れてた値と同じ）
        - cup: DBでは全部Noneだったのが全5件で抽出成功（E,C,E,D,C）
        - bust/waist/hip: ページに記載ある分は取得（記載なしはnull）
        - profile_text: DBでは全部空だったのが全5件で紹介文取得
    - **本番実行（✅ VPS実行済み 2026-02-19〜02-20）**:
        - VPS 5並列でHaiku一括抽出 → DB UPDATE完了（~$241）
        - `classify_failures.py`で2,977失敗サロンを分類済み
    - **本番実行スクリプト（✅ 実装完了 2026-02-19）**:
        - `batch_extract_therapist_info.py`: 2モード対応バッチ
            - `--existing`: 既存92,587件を再抽出（UPDATE）。Haikuがnull返却のフィールドは既存値維持
            - `--new`: 新着セラピストを発見・追加（INSERT）。一覧ページdiff→Haiku抽出→INSERT
            - VPS並列対応: `--start-id`/`--end-id` でID範囲分割、`--resume`でチェックポイント再開
            - SIGINT graceful shutdown、`--dry-run`、`--batch-size`コミット間隔
        - `batch_therapist_data.py`: `insert_therapist()`に`cup`/`blood_type`カラム追加
        - マイグレーション `20260219000003`: `therapists`に`blood_type`カラム追加
- **サロン紹介文バッチ生成 VPS collect実行済み（2026-02-19〜）**:
    - **目的**: 6,489サロンの紹介文（description/salon_overview）をSERP検索+スクレイピング→Sonnet Batch APIで生成
    - **スクリプト改修内容**:
        - DSNを環境変数`DATABASE_URL`対応（VPS/ローカル自動切り替え）
        - `description`と`salon_overview`を300字1本に統一（2フィールドに同じ値を書き込み）
        - SQLクエリからsalon_areas JOINを除去（salon_areasの多対多で11,648行に膨張していた → 6,489行に修正）
        - SERP検索クエリからarea_nameを除去（`{display_name} メンエス 口コミ`で検索）
    - **Batch API投入手順**:
        1. `python3 generate_salon_descriptions.py submit` → Sonnet Batch API投入（~$15）
        2. `python3 generate_salon_descriptions.py status` → バッチ状態確認
        3. `python3 generate_salon_descriptions.py download` → 結果取得＆DB書き込み
        4. VPSからCSVダンプ → ローカル同期
    - **コスト**: DataForSEO ~$13 + Sonnet Batch ~$15 = **~$28**
- **成果物**:
    - `docs/SERVICE_OVERVIEW.md`: サービス概要・ビジネスモデル
    - `docs/SYSTEM_DESIGN.md`: システム構成・DBスキーマ
    - `docs/UX_FLOW.txt`: ユーザー体験フロー
    - `docs/V0_PROMPTS.md`: フロントエンド生成用プロンプト
- **次のステップ**:
    1. ~~全821エリアの本番スクレイピング設計・実行~~ → ✅ 完了（7,685店舗）
    2. ~~Smart Scraper実装~~ → ✅ 完了（16サロン成功/303名取得テスト済み）
    3. ~~ヒューリスティック優先抽出~~ → ✅ 完了（batch_heuristic.py + smart_scraper.py改修）
    4. ~~shops→salonsリネーム~~ → ✅ 完了（DB・コード・VPS全対応）
    5. ~~セラピスト本番スクレイピング~~ → ✅ Phase②完走（79,639名）＋Phase③完走（+15,701名=**95,340名**、3,511サロン紐付き）
    6. ~~フロントエンドとローカルSupabaseの接続~~ → ✅ 完了（pg_dump投入済み、pnpm devで実データ表示確認済み）
    7. ~~公開レベル仕上げ~~ → ✅ 完了（デバッグUI除去・mock削除・Stripe環境変数化・おすすめ実データ化）
    8. ~~ローカルSupabase最新データ同期~~ → ✅ 完了（VPS 79,639名→ローカル投入、2026-02-16）
    9. ~~ME口コミマッチングアセスメント~~ → ✅ 完了（15,690名マッチ、48,288件の口コミ移行可能）
    10. ~~ME口コミリライト＆初期データ投入~~ → ✅ 完了（2026-02-18）
        - Step1: ✅ 全件抽出完了（15,816名マッチ、48,519件口コミ）
        - Step2: ✅ Batch APIで14,971件リライト完了（Sonnet、JSONパース失敗92件のみ）
        - Step3: ✅ **14,879件DB投入完了**（平均スコア73.7、エラー0件）
        - コスト: Sonnet Batch API ~$35（通常APIの50%オフ）
        - 目的: コールドスタート解消。公開初日から「口コミ見たい→自分も書く」ループを回すため
    10b. ~~セラピスト名修復~~ → ✅ 完了（2026-02-18）
        - 目的: Phase②スクレイピングで名前がPROFILE/サロン名/ジャンクテキストになった件を修復。フロント表示品質の確保
        - `repair_therapist_names.py`: source_urlからHTML再取得→CSSセレクタ/H1/og:title→LLMフォールバック→DB UPDATE
        - v1: 10,299/10,795件修復（PROFILE完全一致+サロン名完全一致）、成功率95.4%
        - v2: 3,682/4,875件修復（サロン名部分一致+twitter系）、成功率75.5%
        - v3: 2,394/3,647件修復（v2で入った「SNSSNS」「SCHEDULE」「名前」等のジャンク除去）、成功率65.6%
        - **合計: ~14,988件修復。残り~20件は死サイトのfetch失敗で修復不可能**
        - 学び: EXCLUDE_KEYWORDS拡充（SNS/SCHEDULE/店長コメント/名前等）+ `clean_extracted_name()`追加（年齢・スケジュール・サロン名括弧除去）
        - HTMLはgzip圧縮で`html_cache/`に保存済み（再処理可能）
    10c. ~~フロント口コミ表示修正~~ → ✅ 完了（2026-02-18）
        - 目的: DB投入した14,879件のseed口コミをセラピスト詳細ページに表示するため
        - reviewsクエリをtherapistオブジェクト構築前に移動（参照順エラー修正）
        - reviewCount/averageScoreをDBから動的算出（ハードコード0を修正）
        - moderation_status='approved'フィルタ追加
    10d. ~~フロント口コミ設問8問対応~~ → ✅ 完了（2026-02-18）
        - 目的: DBスキーマ拡張（3設問→8設問）にフロントを追従させるため
        - Review型、review-card、review-listを新フィールド（commentReason〜commentAdvice）に更新
    10e. **名前クレンジングv2＋HTMLキャッシュ統一** → ✅ 完了（2026-02-18）
        - 目的: 目視レビューで発見した6件の表示問題を修正＋プロジェクトルール「HTMLをgzip保存」を全スクリプトに統一
        - `html_cache_utils.py`: 共通gzipキャッシュモジュール新規作成（save/load/exists、カテゴリ別サブディレクトリ）
        - `clean_therapist_names.py`: 4パターン名前クレンジング（5,144件更新）＋source_url重複解消（789件削除）
        - 全7スクレイピングスクリプトにcache.save()統合
        - `repair_therapist_names.py`を共通モジュールに移行
        - `therapist-utils.ts`: parseNameAge/cleanTherapistNameに防御パターン追加
    10f. ~~Phase③ セラピスト未取得店LLMスクレイピング~~ → ✅ 完了（2026-02-18）
        - 目的: Phase②で取れなかった3,603店にSmartScraperのフルパイプラインでLLM再挑戦。サロン詳細ページでセラピスト0名だった問題（リンダスパ等）を解消するため
        - 5並列tmux (p3w1-p3w5)、ID範囲分割（W1:0-1899, W2:1899-3791, W3:3791-4918, W4:4918-6091, W5:6091-∞）
        - `batch_scrape_therapists.py`に`--start-id`/`--end-id`フラグ追加で並列化対応
        - `--failed-only`クエリをsalon_scrape_cache参照→`NOT IN (SELECT DISTINCT salon_id FROM therapists)`に変更
        - **結果: +15,701名取得（79,639→95,340名）、3,511サロン紐付き（54.1%）**
        - W1: 4,785名/6h28m, W2: 4,600名/6h06m, W3: 1,531名/3h01m, W4: 1,442名/2h29m, W5: ~3,343名(停止)
        - 残り2,977サロンはサイトダウン/fetch不可/セラピスト非公開（回収不可能）
        - 次ステップ: pg_dumpでVPS→ローカル同期が必要
    11. ~~ローカルSupabase再同期~~ → ✅ 完了（2026-02-18）
        - 目的: VPS Phase③で取得した+15,701名をローカルに反映し、フロントで確認可能にするため
        - VPSからID>85460の新規15,701件をCSVダンプ→ローカルCOPY投入
        - 名前クレンジング404件＋source_url重複1,964件削除を適用
        - 最終: ローカル**92,587名/3,506サロン**
    12. **ローカルUX改善フェーズ** ← 🔄 継続中（2026-02-18〜）
        - ローカル環境を触りながらUI/UXの改善点を洗い出し・修正
        - データ品質の目視確認・微調整
    12b. ~~セラピスト情報Haiku一括抽出（`--existing`）~~ → VPS実行済み（2026-02-19〜02-20、~$241）
        - 5並列tmux (hw1-hw5) で95,340件に対してHaiku全フィールド抽出→DB UPDATE
        - 完了後: pg_dumpでVPS→ローカル同期 → 目視確認が必要
    12c. **スクレイピング課題＋インフラ懸念の洗い出し** → 📝 記録済み・検討中（2026-02-20）
        - 画像URL抽出精度（🔴→🟢対応中）: Haiku画像パイプラインで解決予定（12d参照）
        - 画像の外部直リンク（🔴→🟢対応中）: Supabase Storageに移行予定（12d参照）
        - 定期バッチへの画像DL統合（🔴→🟢対応中）: `--new`モードで自動統合（12d参照）
        - 取り漏れデータ（🟡）: SNSリンク、趣味、得意施術、コース料金表、サロン写真、指名料
        - Supabase長期依存リスク（🟡）: 7年運営での単一障害点。GCP移行は本番デプロイ前の今がコスト最小
        - 詳細は「未解決課題」セクション参照。実装は別タスク
    12d. **セラピスト画像パイプライン** ← 🔄 実装完了・VPS実行待ち（2026-02-21）
        - **背景**: Phase②③のimage_urlsがゴミデータ（spacer/itemList.png/バナー画像混入）。3サロン9件テストで全件修正成功
        - **2プログラム構成**:
            1. **Haiku画像パス抽出**: `name_extractor.py`の`extract_therapist_info()`に画像判定を統合。1回のAPI呼び出しで10フィールド（name/age/cup/3size/profile_text/image_urls）を一括抽出
                - `collect_image_candidates()`: img src/data-src/srcset/CSS background-imageを構造化収集
                - Haiku判定ルール: セラピスト本人写真のみ/プレースホルダー・ロゴ・ナビ除外/最大5枚
                - 空配列時は既存値維持（UPDATEスキップ）
            2. **画像DL→Supabase Storage**: `batch_download_images.py`新規作成
                - 外部URL → requests.get → Supabase Storage `therapist-images`バケット → DB URL差し替え
                - パス: `{salon_id}/{therapist_id}/{001|002|003}.{ext}`
                - 並列DL対応（default 10 workers）、チェックポイント、SIGINT、--dry-run
                - DL失敗時は元URL維持（壊さない）
        - **マイグレーション**: `20260221000001_therapist_images_bucket.sql` — therapist-imagesバケット作成（public読み取り、service_role書き込み）
        - **テスト結果**: 3サロン9件で9/9正しい画像URL抽出（$0.02）
        - **推定コスト・時間**:
            - プログラム1（Haiku抽出）: ~$224、~20時間（VPS 5並列）
            - プログラム2（画像DL+Storage）: ~$0（Supabase Storage無料枠内）、~3-6時間（10-20並列）
        - **VPS実行手順**:
            1. ローカル→VPSにscp（name_extractor.py, batch_extract_therapist_info.py）
            2. VPS 5並列tmux hw1-hw5で`--existing`バッチ実行
            3. pg_dump→ローカル同期→目視確認
            4. `batch_download_images.py`でStorage保存バッチ実行
    13. **本番デプロイ準備**（本番Supabaseスキーマpush → Vercel環境変数 → デプロイ） ※12cのインフラ方針決定後
    14. VPSのスクレイピングデータをpg_dumpで本番Supabaseに移行

## 開発フロー方針（確定）

**ローカル完結 → 本番デプロイ**

すべてローカル環境で構築・テスト・完成させてから本番に反映する。

```
1. Supabase Local (Docker) でDB構築・マイグレーション
2. Next.js ローカル dev で フロントエンド開発
3. ローカルでE2Eテスト完了
4. 問題なければ supabase db push で本番Supabase反映
5. Vercelにデプロイ
```

- DBスキーマ: ローカルSupabaseで検証 → 確定後に本番push
- スクレイピング: ローカルDBにデータ投入 → 検証後に本番同期
- フロント: localhost:3000 + ローカルSupabaseで完全動作確認
- 本番環境には検証済みのものだけを反映する

## MCP設定 (2026-02-08 設定済み)

### userスコープ（全プロジェクト共通）
| MCP | 用途 | 状態 |
|-----|------|------|
| Playwright | ブラウザ自動操作・スクレイピング | 接続済み |
| Chrome DevTools | デバッグ・パフォーマンス分析 | 接続済み |
| Figma | デザイン→コード変換 | 要OAuth認証 |

### localスコープ（このプロジェクト専用）
| MCP | 用途 | 状態 |
|-----|------|------|
| Supabase | DB管理・マイグレーション | 要OAuth認証 |
| Vercel | デプロイ管理・ログ分析 | 要OAuth認証（次回起動時） |
| DataForSEO | SERP分析・SV取得 | 接続済み |
| Cloudflare | DNS・CDN管理 | 要認証設定 |
| Stripe | 課金・サブスク管理 | 接続済み（本番キー） |
| Sentry | エラー監視 | 要OAuth認証（初回） |
| Resend | メール送信（会員登録確認・通知等） | 接続済み |

### 未導入（将来検討）
- **Ahrefs**: SEO本格化時（公開後、被リンク分析が必要になったら）月$129〜
- **Upstash (Redis)**: キャッシュ・レートリミット必要時
- **Google Search Console**: SEOモニタリング本格化時

## プロジェクト概要

メンズエステ口コミサイト「メンエスインデクサ」の開発プロジェクト。
競合サイト「ME」を超える「発見」体験を提供するプラットフォーム。

**コアコンセプト**: 「"確認"で終わるサイトから、"発見"が始まるサイトへ」

## ローカル開発環境（Supabase Local）

| 項目 | URL / 値 |
|------|----------|
| Supabase Studio | http://127.0.0.1:54323 |
| Project URL (API) | http://127.0.0.1:54321 |
| DB接続 | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Publishable Key | `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH` |
| Secret Key | `sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz` |
| Mailpit | http://127.0.0.1:54324 |
| Docker | Docker Desktop 4.35.0（macOS Ventura対応版） |

### 起動コマンド
```bash
# Docker Desktop起動 → supabase start
open -a Docker
supabase start     # 初回はimage pull含む
supabase db reset  # マイグレーション+シード再実行
supabase stop      # 停止
```

### DBテーブル状態（2026-02-18、ローカル本番相当）
| テーブル | 件数 | 状態 |
|---------|------|------|
| prefectures | 47 | シード済み |
| areas | 821 | シード済み（スラッグ重複解決済み） |
| salons | 6,489 | official_urlベースでデデュプ済み（1サロン=1行） |
| salon_areas | 11,648 | salons連動（複数エリア掲載含む） |
| therapists | 92,587 | Phase②+③完走→ローカル同期済み。名前修復+クレンジング+重複削除適用済み |
| cms_patterns | 2 | シード済み（upfu8_cms, estama） |
| salon_scrape_cache | 6,481 | デデュプ済み |
| scrape_log | 0 | - |
| reviews | 14,880 | seed口コミ14,879件投入済み（2026-02-18） |
| profiles | 0 | サービス開始後 |
| user_rewards | 0 | サービス開始後 |

**データモデル**: salons(1) → salon_areas(多) → areas(1)。同一サロンが複数エリアに掲載される場合、salonsは1行でsalon_areasで紐付け。

### スクレイピングパイプライン（動作確認済み）

`database/test_scrape_to_supabase.py` で以下を1パスで実行:

1. **esthe-ranking一覧取得** → サロン基本情報（名前、料金、アクセス等）
2. **公式URL取得** → 詳細ページから公式サイトURLを抽出
3. **display_name確定** → 括弧カナ → title正規表現 → LLMフォールバック → ルール
4. **salons/salon_areas INSERT** → slug=数字ID
5. **セラピスト取得**（オプション）→ TherapistScraper経由

#### display_name確定の優先順位
1. esthe-ranking括弧カナ（`ELTERAS（エルテラス）` → `エルテラス`）
2. 公式サイト`<title>`タグから正規表現抽出（`extract_kana_from_title.py`のロジック）
3. LLMフォールバック（titleを入力として渡し、カタカナ/日本語で返す）
4. ルールベース正規化（エリア名除去等）、英語残りは追加でLLM変換

#### テスト結果（268件）
| エリア | 件数 | 括弧 | title正規表現 | LLM | ルール | 英語残り |
|--------|------|------|--------------|-----|--------|---------|
| 恵比寿 | 73 | 31 | 8 | 33 | 1 | 0 |
| 松本 | 24 | 0 | 0 | 24 | 0 | 0 |
| 博多 | 171 | 53 | 9 | 80 | 29 | 1（サイトダウン） |
| **合計** | **268** | **84** | **17** | **137** | **30** | **1** |

## 本番環境

| 項目 | サービス | 備考 |
|------|----------|------|
| ドメイン | Cloudflare | `menes-indexer.com` |
| フロントエンド | Vercel | Next.js App Router |
| データベース | Supabase | PostgreSQL, Auth, Storage |
| スクレイピングBot（旧） | VPS (162.43.14.182) | Python |
| スクレイピングBot（新） | XServer VPS (220.158.18.6) | Python + PostgreSQL |

### 構成図
```
Cloudflare（ドメイン + CDN + DNS）
      ↓
Vercel（Next.js フロントエンド）
      ↓
Supabase（DB + Auth + Storage）
      ↑
VPS（スクレイピングBot → DB更新）
```

## スクレイピングVPS (2026-02-09 構築)

| 項目 | 値 |
|------|-----|
| プロバイダ | XServer VPS |
| サーバー名 | indexer |
| IP | 220.158.18.6 |
| OS | Ubuntu 25.04 |
| プラン | VPS 2GB（3vCPU, 50GB NVMe SSD） |
| SSH鍵 | `/Users/agatha/Downloads/indexer.pem` |
| rootパスワード | VPSパネルで設定済み |
| DB接続 | `postgresql://postgres:postgres@127.0.0.1:5432/menethe` |
| スクリプト配置 | `/opt/scraper/` |
| 契約期間 | 2026-02-09 〜 2026-04-30 |

### SSH接続
```bash
ssh -i /Users/agatha/Downloads/indexer.pem root@220.158.18.6
```

### 現行運用コマンド
```bash
# 正規運用: セラピスト差分スクレイピング（VPS）
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "cd /opt/scraper && python3 batch_extract_therapist_info.py --new"

# DB状況確認
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "sudo -u postgres psql -d menethe -c 'SELECT count(*) FROM therapists;'"

# pg_dumpでローカル同期
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "sudo -u postgres pg_dump -d menethe --data-only -t therapists" > therapists_dump.sql

# データ取り出し（本番移行時）
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "sudo -u postgres pg_dump -d menethe --data-only -t salons -t salon_areas" > salons_dump.sql
```

<details><summary>過去実行ログ用コマンド（初期サロンスクレイピング時に使用、現在は不要）</summary>

```bash
# ログ確認（batch_scrape_shops.py用 — 完了済み）
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "tail -20 /opt/scraper/batch_scrape.log"

# チェックポイント確認（batch_scrape_shops.py用 — 完了済み）
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "cat /opt/scraper/batch_scrape_checkpoint.json | python3 -m json.tool | tail -10"
```

</details>

## ディレクトリ構造

```
/menethe-indexer/
├── CLAUDE.md              ← このファイル
├── supabase/              ← Supabase Local設定
│   ├── config.toml            ← Supabase設定
│   ├── migrations/            ← DBマイグレーション
│   │   ├── 20260208000001_create_schema.sql  ← 全8テーブル定義
│   │   ├── 20260210000001_smart_scraper_tables.sql ← Smart Scraper用3テーブル
│   │   └── 20260212000002_rename_shops_to_salons.sql ← shops→salonsリネーム
│   ├── seed.sql               ← シードデータ（47都道府県+821エリア）
│   └── seed_areas.sql         ← エリアシードSQL（seed.sqlに結合済み）
├── database/              ← データ・スクリプト
│   ├── esthe-ranking/         ← エリアマスタ・サロン数データ
│   ├── seed_areas.py          ← CSV→SQLシード生成スクリプト
│   ├── extract_kana_from_title.py ← サロン名カナ抽出
│   ├── batch_scrape_therapists.py ← 全サロン一括セラピストスクレイピング
│   ├── seed_reviews/          ← ME口コミリライト＆投入パイプライン
│   │   ├── common.py             ← 共通ユーティリティ
│   │   ├── step1_extract_me_data.py ← ME生データ抽出
│   │   ├── step2_llm_rewrite.py    ← LLMリライト＆構造化
│   │   ├── step3_insert_reviews.py ← DB投入
│   │   └── data/                  ← 中間データ（gitignore）
│   └── therapist-scraper/     ← セラピストスクレイパー
│       ├── therapist_scraper.py   ← LLMベーススクレイパー（従来版）
│       ├── smart_scraper.py       ← Smart Scraper オーケストレーション
│       ├── cms_fingerprinter.py   ← CMS指紋判定
│       ├── rule_extractor.py      ← ルールベース抽出（CSSセレクタ）
│       ├── rule_miner.py          ← パターン自動学習
│       ├── pattern_validator.py   ← 抽出品質検証
│       ├── batch_heuristic.py     ← Phase①: ヒューリスティック全店スキャン
│       ├── fetch_utils.py         ← 共通fetchモジュール（HTTPS→HTTPフォールバック付き）
│       ├── name_extractor.py      ← セラピスト情報抽出モジュール（全フィールドHaiku一括抽出）
│       ├── html_cache_utils.py    ← 共通HTMLキャッシュモジュール（gzip圧縮、カテゴリ別）
│       ├── batch_extract_therapist_info.py ← 🔑 正規運用スクリプト（--existing UPDATE/--new 差分INSERT）。通常は `--new` で実行
│       ├── batch_download_images.py ← 画像DL→Supabase Storage保存→URL差し替え
│       ├── scrape_failed_salons.py    ← ⚠️ 検証/テスト専用（非推奨）。通常運用は batch_extract_therapist_info.py --new を使用
│       ├── clean_therapist_names.py ← 名前クレンジング＋source_url重複解消
│       ├── classify_failures.py   ← 失敗サロン理由分類スクリプト
│       ├── salon_diagnose.py      ← 診断CLIツール（diagnose/test-extract/rescrape/list-failed/list-patterns）
│       ├── test_haiku_name_extract.py ← Haiku名前抽出テスト（v2検証用）
│       ├── test_fullpage_compare.py   ← 全ページ版名前抽出テスト（v3検証用）
│       ├── test_fullinfo_extract.py   ← 全フィールド一括抽出テスト（v4検証用）
│       ├── cms_patterns_seed.json ← 初期CMSパターン2件
│       └── seed_cms_patterns.py   ← シード投入スクリプト
├── docs/                  ← ドキュメント
│   ├── SERVICE_OVERVIEW.md    ← サービス概要書（最重要）
│   ├── SYSTEM_DESIGN.md       ← システム設計・DBスキーマ
│   ├── UX_FLOW.txt            ← UXフロー
│   ├── V0_PROMPTS.md          ← v0.app用プロンプト集
│   └── AI_CONCIERGE_PLAN.md   ← 将来のAI機能計画
├── frontend/              ← フロントエンド
│   └── demo1/             ← v0.appで生成したNext.jsプロジェクト
└── menesthejp/            ← 競合MEのHTML（分析用）
```

## フロントエンド構造（frontend/demo1）

v0.appで生成したNext.js (App Router) プロジェクト。

### ページ構成
```
app/
├── page.tsx               ← トップページ
├── area/[prefecture]/     ← エリア検索
├── search/                ← セラピスト検索（メイン機能）
├── therapist/[id]/        ← セラピスト詳細
├── shop/[id]/             ← 店舗詳細
├── type/[type]/           ← タイプ別一覧
├── review/                ← 口コミ投稿
├── mypage/                ← マイページ
├── bbs/                   ← 掲示板
├── pricing/               ← 料金プラン
├── login/                 ← ログイン
└── register/              ← 新規登録
```

### コンポーネント構成
```
components/
├── home/          ← トップページ用（hero, type-grid, recommendations等）
├── layout/        ← レイアウト（header, footer, sidebar）
├── review/        ← 口コミ投稿ウィザード（step-type, step-body等）
├── shared/        ← 共通（therapist-card, review-card）
├── therapist/     ← セラピスト詳細（radar-chart, composition-chart等）
└── ui/            ← ShadcnUIコンポーネント
```

### 起動コマンド
```bash
cd frontend/demo1
pnpm install
pnpm dev
```

## 技術スタック

- **Frontend**: Next.js (App Router), Tailwind CSS, ShadcnUI, Lucide Icons, Framer Motion, Recharts
- **Backend/Database**: Supabase (PostgreSQL, Auth, Storage)
- **Infrastructure**: Vercel
- **Data Pipeline**: Python (既存スクレイパー), Claude API (セラピスト分類)

## 外部API

### DataForSEO（SERP API）
SEO調査、検索結果分析に使用。

```
ダッシュボード: https://app.dataforseo.com/
ログイン: info@agatha-holdings.co.jp
クレデンシャル: /database/.env に保存
```

**用途:**
- メンエスポータルサイトの比較調査
- 「エリア名 + メンズエステ」検索での上位サイト分析
- salon_name_kana 取得（MEサイト検索）

**使用例:**
```python
# /database/.env をロード
from dotenv import load_dotenv
load_dotenv()

import os
import requests
from requests.auth import HTTPBasicAuth

login = os.getenv('DATAFORSEO_LOGIN')
password = os.getenv('DATAFORSEO_PASSWORD')
auth = HTTPBasicAuth(login, password)
```

### Anthropic Claude API
店名カタカナ変換、AI生成コンテンツに使用。

```
クレデンシャル: /database/.env に保存
モデル: claude-haiku-4-5-20251001（コスト効率重視）
```

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

## デプロイフロー

```
1. v0.appでフロントエンドデザイン作成
      ↓
2. v0.appからVercelにデプロイ（自動）
      ↓
3. Cloudflareでドメイン取得（menes-indexer.com）
      ↓
4. VercelにカスタムドメインをVercelに登録 → DNS設定取得
      ↓
5. CloudflareでDNS設定（CNAME → Vercel）
      ↓
6. 本番公開
```

### ドメイン設定手順

**Cloudflareでドメイン購入:**
1. https://dash.cloudflare.com/ → Domain Registration → Register Domains
2. `menes-indexer.com` を検索して購入

**Vercelでカスタムドメイン追加:**
1. Vercelダッシュボード → プロジェクト → Settings → Domains
2. `menes-indexer.com` を追加
3. DNS設定をメモ（例: `cname.vercel-dns.com`）

**CloudflareでDNS設定:**
1. Cloudflare → ドメイン → DNS
2. CNAME追加: `@` → `cname.vercel-dns.com`（Proxy: OFF）

## ME口コミ移行計画（2026-02-16 一部決定済み）

### マッチング結果（確定）

`database/match_me_reviews.py` で両DB突合済み。結果: `database/match_me_reviews_result.json`

| 項目 | 件数 |
|------|------|
| ME reviews_dataあり | 80,458名 |
| Indexer therapists | 79,639名 |
| **マッチ合計** | **15,690名 (19.5%)** |
| - URL直接一致 | 12,829名 |
| - ドメイン+名前一致 | 1,449名 |
| - サロン名+名前一致 | 1,412名 |
| マッチした口コミ数 | 48,288件 |

### マッチング方法（3段階）
1. **URL直接一致**: ME `therapist_db.therapist_url` = Indexer `therapists.source_url`（URL正規化後）
2. **ドメイン+名前一致**: ME `salon_db.salon_url` ドメイン = Indexer `salons.domain` → 同サロン内で名前一致
3. **サロン名+名前一致**: ME `salon_db.salon_name` ≈ Indexer `salons.display_name` → 名前一致

### 口コミリライト＆投入

**コンセプト**: マッチした15,690名に対し、MEの口コミを1件ずつClaude APIでリライト → Indexerの初期口コミとして投入。コールドスタート問題を回避する。

**ビジネスロジック**: ユーザーが口コミを見るには自分も1件書く必要がある → 初期口コミがあれば「見たい→書く」ループが初日から回る

**方針**:
- 1セラピストにつき1件だけリライト投入（自然な「最初の投稿者」感）
- まるまるコピーではなくClaude APIでリライト（バレ防止）
- バッチ処理で全15,690件を一括処理

### 分類マスタ設計 — ✅ 決定（数字IDベース）

テキストenumではなく**数字IDのマスタテーブル**方式。ラベル変更はマスタ1行更新で済む。

#### looks_types（見た目タイプ）— 単一選択
| id | ラベル |
|---|---|
| 1 | 清楚系 |
| 2 | 素人系 |
| 3 | ギャル系 |
| 4 | モデル系 |
| 5 | ロリ系 |
| 6 | 女優系 |
| 7 | 夜職系 |
| 8 | 熟女系 |

#### body_types（体型）— 5段階
| id | ラベル |
|---|---|
| 1 | 華奢 |
| 2 | スレンダー |
| 3 | バランス |
| 4 | グラマー |
| 5 | ぽっちゃり |

#### cup_types（おっぱい）— 5段階
| id | ラベル |
|---|---|
| 1 | なし |
| 2 | 控えめ |
| 3 | 標準 |
| 4 | 大きめ |
| 5 | 巨乳 |

#### service_levels（サービス）
| id | ラベル |
|---|---|
| 1 | 健全 |
| 2 | SKR |
| 3 | HR |

**reviewsテーブル変更点**:
- `looks_type`(text) → `looks_type_id`(int) REFERENCES looks_types(id)
- `body_type`(text) → `body_type_id`(int) REFERENCES body_types(id)
- `service_level`(text) → `service_level_id`(int) REFERENCES service_levels(id)
- `cup_type_id`(int) REFERENCES cup_types(id) を新規追加
- 旧テキストCHECK制約は削除

**cup二重管理**: `therapists.cup`（公式自称） + `reviews.cup_type_id`（口コミ体感）。口コミが溜まったら体感を優先表示。

### 決定済み事項

#### 1. user_id（reviews.user_id）の扱い — ✅ 決定
- `reviews.user_id` を `NOT NULL` → `NULL可` に変更するマイグレーション追加
- `is_seed BOOL DEFAULT false` カラムを追加
- `is_seed=true` の口コミはフロントで投稿者プロフィール・DMリンクを非表示にする
- ユーザー投稿は従来通り `user_id` 必須（アプリ側でバリデーション）

#### 2. 構造化データ — ✅ 決定
- **全部LLMで推定**: looks_type_id, body_type_id, cup_type_id, service_level_id, param_*(1-5), score(0-100)
- 元口コミテキストから推定するプロンプトを設計する

#### 3. comment系カラム — ✅ 決定
- `comment_first_impression`, `comment_service`, `comment_advice` → LLMでリライト生成
- `comment_service_detail`（閲覧制限あり） → LLMで推定して埋める

#### 4. 口コミ選択 — ✅ ステイ（後で決める）
- 複数口コミがある場合の選び方は実装時に決定
- 複数口コミをまとめたものを別プロンプトで生成する予定

#### 5. created_at — ✅ 決定
- 元のME口コミ日付からランダムに±1〜30日ずらす（MEと一致しないように）

#### 6. データ移行フロー — ✅ 決定
- MEから生データを引っ張ってきてから、こちら側でLLMリライト＆生成
- ME DBは読み取り専用（ソースを汚さない）

### 実装済みパイプライン（2026-02-17）

```
database/seed_reviews/
├── __init__.py
├── common.py                  # 共通: ME/Indexer接続、URL正規化、フォールバック関数
├── step1_extract_me_data.py   # Step 1: ME生データ抽出
├── step2_llm_rewrite.py       # Step 2: LLMリライト（Claude API）
├── step3_insert_reviews.py    # Step 3: DB投入
└── data/                      # 中間データ（gitignore済み）
    ├── raw_matched_therapists.json
    ├── rewritten_reviews.json
    └── rewrite_checkpoint.json
```

**実行手順:**
```bash
# 1. DB設問拡張マイグレーション適用（✅ 済み: 20260217000004）
supabase db reset

# 2. ME生データ抽出
python database/seed_reviews/step1_extract_me_data.py --limit 10  # テスト
python database/seed_reviews/step1_extract_me_data.py              # 全件

# 3. LLMリライト（サンプル比較 → 本番）
python database/seed_reviews/step2_llm_rewrite.py --sample 10 --model claude-haiku-4-5-20251001
python database/seed_reviews/step2_llm_rewrite.py --sample 10 --model claude-sonnet-4-5-20250514
python database/seed_reviews/step2_llm_rewrite.py --model <選択モデル> --workers 3 --resume

# 4. DB投入
python database/seed_reviews/step3_insert_reviews.py --dry-run   # 確認
python database/seed_reviews/step3_insert_reviews.py              # 本番
```

### 未決事項
- [ ] 使用モデル: Sonnet推奨（~$70）、10件くらいサンプル比較してから決める。Haiku(~$6) / Opus(~$350) も選択肢
- [ ] 複数口コミからどれを選ぶかのロジック → 現在は全口コミまとめてLLMに渡す方式で実装済み
- [ ] looks_types各タイプの判定基準の明文化（LLMプロンプト用）
- [ ] param_* 1-5の各値の意味定義

**コスト見積もり（15,690件）**:
| モデル | 見積もりコスト |
|--------|-------------|
| Haiku 4.5 | ~$6 |
| Sonnet 4.5 | ~$70 |
| Opus | ~$350 |

**接続先**:
- ME Supabase: `~/Desktop/menesthe-db/.env` の `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Indexer ローカルPG: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

**関連ファイル**:
| ファイル | 内容 |
|---------|------|
| `database/match_me_reviews.py` | マッチングアセスメントスクリプト |
| `database/match_me_reviews_result.json` | マッチング結果JSON |

## 競合サイト調査・エリア設計（2026-02-08 更新）

詳細は `docs/AREA_DESIGN.md` を参照。

### エリアマスタ確定: 821件

**最終ファイル: `database/esthe-ranking/area_resolved_filtered.csv`（821件）**

| 分類 | 件数 | 表示方法 |
|------|------|---------|
| サロン3件以上 | 584 | そのエリアのサロンをそのまま表示 |
| サロン少+SV有 | 237 | 近隣/親エリアのサロンを表示 |
| 除外 | 33 | SV=0+サロン少(28) + 路線名KW(5) |

- 都道府県カバレッジ: **47/47**
- ME突合カバー率: 73.6%（192/261）
- 全件にDataForSEO検索ボリューム付き（`search_volume`列）

### esthe-ranking.jp 完全階層構造

```
Level 0: /                              ← TOPページ（日本地図）
Level 1: /prefecture/XX/                ← 47都道府県（リンク集、サロンデータ無し）
Level 2: /hakata/                       ← 163親エリア（サロン一覧 = スーパーセット）
Level 3: /hakata/tenjin-station/all/    ← 549駅（駅周辺に絞り込んだサブセット）
Level 3: /sapporo/asahikawa-city/all/   ← 263市（市単位に絞り込んだサブセット）
```

### エリア設計方針（確定）

- **1キーワード = 1ページ**（絶対原則）
- 全ページを「エリアページ」として統一。データソースがparent/station/cityかは裏側の話
- KW被り → 親データで吸収（駅/市ページは作らない）
- グループ中間ページ（恵比寿・中目黒・代官山まとめ）は作らない
- 都道府県ページがハブ、同グループのエリアは「近隣エリア」として相互リンク
- サロン少エリアはSVがあればページ作成（近隣エリアのサロンを表示）

### 完了済み

- ~~ME・メンマガとの突合を再実施~~ ✅
- ~~競合サイト（menesthe.heteml.net、mensesthe-search.com）のエリア設計分析~~ ✅
- ~~-city/all/ 取りこぼし修正~~ ✅
- ~~SEOキーワード抽出バグ修正~~ ✅
- ~~サロン数フィルタ適用~~ ✅ → 826件確定

### 次のステップ

- 都道府県ページの設計（47ページ）
- 本番スクレイピング

### 関連ファイル

| ファイル | 内容 |
|---------|------|
| `docs/AREA_DESIGN.md` | エリア設計の詳細ドキュメント |
| **`database/esthe-ranking/area_resolved_filtered.csv`** | **最終エリアマスタ 826件（salon_count付き）** |
| **`database/esthe-ranking/area_resolved_with_counts.csv`** | **全854件+salon_count（フィルタ前）** |
| `database/esthe-ranking/area_resolved_646.csv` | カニバリ解消済み854件（salon_count無し） |
| `database/esthe-ranking/site_hierarchy_complete.csv` | 都道府県→親エリア→駅→市 全階層一元化（975件） |
| `database/esthe-ranking/count_salons_v2.py` | サロン数カウントスクリプト v2 |
| `database/esthe-ranking/rebuild_area_master.py` | 階層再構築・KW修正・カニバリ解消スクリプト |
| `database/esthe-ranking/prefecture_area_map.csv` | 47都道府県→163親エリアのマッピング |
| `database/esthe-ranking/site_structure.csv` | esthe-ranking 全5,384エントリ（生データ） |
| `database/me/me_area_list.csv` | ME 161エリア |
| `database/mens-mg/mg_area_list.csv` | メンマガ 114エリア |
| `database/merged/salon_counts_cache.json` | サロン数キャッシュ（854URL分） |

## セラピスト本番スクレイピング: 3段階パイプライン（2026-02-11）

### 設計方針

**「確実に取れるものを先に全部取り切る → 残った例外だけ別途対処」**

### 3段階の流れ

```
① ローカル: ヒューリスティック全店スキャン（28分、$0）  ← ✅ 完了
   → 全7,684店のトップページにアクセス
   → リンクテキスト/URLキーワード/HTTPプローブで一覧URL特定
   → 一覧ページからURLパターンでセラピスト個別URL抽出
   → 結果: salon_scrape_cache + scrape_log に記録

② VPS: 成功店のセラピストデータ取得（~30時間）  ← ✅ 完了（79,639名）
   → ①でセラピストURL取得済みの3,708店が対象
   → 個別ページのHTMLから正規表現/BeautifulSoupでデータ抽出
   → LLMはフォールバックとしてのみ使用（成功率95.5%テスト済み）
   → therapistsテーブルに投入

③ VPS: 失敗店のLLM再挑戦（~15時間、~$200）  ← ✅ 完了（+15,701名=95,340名）
   → ①②で取れなかった3,976店が対象
   → batch_scrape_therapists.py --failed-only で実行
   → SmartScraperのフルパイプライン（ヒューリスティック→LLMフォールバック）

②と③はVPS上で同時並行で実行可能（対象salonが重複しない）
```

### スクリプト対応表

| ステップ | スクリプト | 状態 | 実行場所 |
|---------|----------|------|---------|
| ① 全店スキャン | `batch_heuristic.py` | ✅ 完了（28分） | ローカル |
| ② 成功店データ取得 | `batch_therapist_data.py` | ✅ 完了（79,639名） | VPS |
| ③ 失敗店LLM再挑戦 | `batch_scrape_therapists.py --failed-only` | ✅ 完了（+15,701名=95,340名） | VPS (5並列) |

### ヒューリスティックスキャン結果

**Phase①（全7,684店、ローカル28分）:**

| ステップ | 成功 | 失敗 | 成功率 |
|---------|------|------|--------|
| fetch（トップページ取得） | 7,003 | 681 | 91.1% |
| Step2（一覧URL発見） | 6,649 | 354 | 86.5% |
| Step3（セラピストURL抽出） | 2,475 | 4,174 | 32.2% |

**ヒューリスティックv2（改良後、4,166店再スキャン、4.5分）:**
- flat HTML構造（/staff.html → /名前.html）対応
- 共通サブパス検出（/staff/ → /prof/profXX/）対応
- **+1,227店改善** → Phase②対象: 2,481 → 3,708店（48%）

### Phase③実行結果（2026-02-18、3,603店対象）

5並列tmux（ID範囲分割）で実行。`--start-id`/`--end-id`フラグで分割。

| ワーカー | ID範囲 | 取得セラピスト | 所要時間 | エラー |
|---------|--------|-------------|---------|--------|
| W1 (p3w1) | 0-1899 | 4,785名 | 6h28m | 268 |
| W2 (p3w2) | 1899-3791 | 4,600名 | 6h06m | 296 |
| W3 (p3w3) | 3791-4918 | 1,531名 | 3h01m | 490 |
| W4 (p3w4) | 4918-6091 | 1,442名 | 2h29m | 519 |
| W5 (p3w5) | 6091-∞ | ~3,343名 | (停止) | - |
| **合計** | - | **+15,701名** | - | - |

残り2,977サロンはサイトダウン/セラピスト非公開で回収不可能。

※ VPS操作コマンドは「スクレイピングVPS」セクションの「現行運用コマンド」に統合済み

## Smart Scraper（自己学習型セラピストスクレイパー）✅ 実装済み (2026-02-10)

### 概要

CMS指紋判定→ルールベース抽出→LLMフォールバック→自動学習のパイプライン。
初回はLLMで抽出し、成功パターンをCSSセレクタとして自動学習。2回目以降は同じCMSのサロンをLLM不要で処理。

### アーキテクチャ
```
サロンURL
  ↓
salon_scrape_cache確認（前回の一覧URL・CMSパターンあり？）
  ├─ あり → キャッシュされた一覧URLへ直行（Step 2省略）
  └─ なし → CMS指紋判定
                ├─ 既知CMS → ルールベース抽出（CSSセレクタ、LLM不要）
                └─ 未知CMS → LLM抽出 → パターン自動学習 → 次回からルール化
```

### ファイル構成 (`database/therapist-scraper/`)
| ファイル | 状態 | 説明 |
|---------|------|------|
| `therapist_scraper.py` | 既存（変更なし） | LLMベーススクレイパー（SmartScraperから呼び出し） |
| `smart_scraper.py` | ✅ | オーケストレーション（キャッシュ→CMS判定→ルール→LLMフォールバック→学習） |
| `cms_fingerprinter.py` | ✅ | CMS指紋判定（metaタグ・script・CSS・URLパターンの加重スコアマッチング） |
| `rule_extractor.py` | ✅ | ルールベース抽出（CSSセレクタ + 正規表現） |
| `rule_miner.py` | ✅ | パターン自動学習（LLM結果 + HTMLからCSSセレクタ導出） |
| `pattern_validator.py` | ✅ | 抽出品質検証（name必須 + 2フィールド以上） |
| `cms_patterns_seed.json` | ✅ | 初期パターン2件（upfu8_cms, estama） |
| `seed_cms_patterns.py` | ✅ | シードデータ投入スクリプト |

### DBテーブル（migration: `20260210000001_smart_scraper_tables.sql`）
| テーブル | 用途 |
|---------|------|
| `cms_patterns` | CMS抽出ルール（指紋・セレクタ・信頼度） |
| `salon_scrape_cache` | サロン別キャッシュ（一覧URL・CMS紐づけ） |
| `scrape_log` | スクレイピングログ（ステップ・方式・成否） |
| `salons.cms_fingerprint` | 追加カラム |

### 信頼度モデル
| confidence | 動作 |
|-----------|------|
| >= 0.7 | ルールのみ（LLM不使用） |
| 0.4-0.7 | ルール + LLMでサンプル検証（ハイブリッド） |
| < 0.4 | ルール破棄、LLM使用、再学習トリガー |

`confidence = success / (success + fail * 2)` — 失敗の重みを2倍

### テスト結果 (2026-02-10)
- **25サロン処理 → 16サロン成功 → 303名取得 → 所要21分 → エラー0**
- estama系7サロン: CMS判定成功（confidence 0.77〜1.00）、Step 2（一覧URL発見）をルール処理
- Step 3/4はまだLLMフォールバック中（シードのCSSセレクタ要チューニング）
- パターン自動学習: 成功率80%閾値に未到達 → 保留中

### 実行コマンド
```bash
# Smart Scraper（デフォルト）
python database/batch_scrape_therapists.py --limit 10 --max-per-salon 0

# LLMのみ（従来動作）
python database/batch_scrape_therapists.py --llm-only

# シード投入
python database/therapist-scraper/seed_cms_patterns.py
```

### 今後の改善
- シードパターンのCSSセレクタをestama実サイトに合わせてチューニング → Step 3/4もルール化
- 学習閾値の調整（80% → 60%等）で蓄積を加速
- コスト見積もり: 現行$900 → Phase1(60%ルール)$370 → Phase2(90%ルール)$93

## 未解決課題

### セラピスト一覧ページURL特定の学習 → ✅ Smart Scraperで対応済み

`salon_scrape_cache`テーブルに一覧URLをキャッシュ。2回目以降はLLM不要で直行。
CMS判定で`/therapist/`等のパターンもルールベースで発見可能（estama系で動作確認済み）。

### 🟢 セラピスト画像URL抽出精度の問題（対応中 — 12d参照）

- **現状**: `extract_therapist_info()`にHaiku画像判定を統合済み。3サロン9件テストで9/9正しい画像URL抽出成功
- **方式**: `collect_image_candidates()`で全img/data-src/srcset/CSS bg-imageを構造化収集 → Haikuが本人写真のみ選別（最大5枚）
- **次ステップ**: VPS 5並列で95,340件バッチ実行（~$224、~20時間）

### 🟢 セラピスト画像の外部直リンク問題（対応中 — 12d参照）

- **方針決定**: Supabase Storage（therapist-imagesバケット、public）を採用
- **実装済み**: `batch_download_images.py` — 外部URL→DL→Storage upload→DB URL差し替え
    - パス: `{salon_id}/{therapist_id}/{001|002|003}.{ext}`
    - 並列DL（default 10 workers）、チェックポイント、SIGINT shutdown
    - DL失敗時は元URL維持（壊さない）
- **マイグレーション**: `20260221000001_therapist_images_bucket.sql`
- **規模**: ~19.5万枚、1枚平均200KBとして約39GB
- **次ステップ**: プログラム1（Haiku画像パス抽出）完了後にバッチ実行（~3-6時間、10-20並列）

### 🟢 定期スクレイピングへの画像DL統合（対応中 — 12d参照）

- **方式**: `extract_therapist_info()`に画像抽出を統合したため、`--new`モードで新規セラピスト発見時に自動的にimage_urlsが取れる
- **未対応**:
    - 既存セラピスト更新時の画像変更検知 → 差分DL → ストレージ更新
    - 退職セラピスト: 画像の削除 or アーカイブポリシー策定

### 🟡 スクレイピング取り漏れデータ（将来対応）

- **現状**: Haiku一括抽出で name/age/cup/3サイズ/profile_text は取得済みだが、以下が未取得
- **未取得項目**:
    - SNSリンク（Twitter/Instagram）— セラピスト個別ページに記載あるケースが多い
    - 趣味・特技 — プロフィール欄に記載あり
    - 得意施術・メニュー — サロンによってはセラピスト単位で記載
    - コース料金表 — サロン単位ではなくセラピスト個別料金のケースがある
    - サロン複数写真 — 外観・内装・施術室の写真（現在はセラピスト写真のみ）
    - 指名料 — セラピスト単位で異なるケースがある
- **対処方針**: キャッシュ済みHTMLから追加抽出可能。優先度に応じてHaikuプロンプト拡張
- **優先度**: 本番公開後、ユーザーフィードバックを見て優先度決定

### 🟡 Supabase長期依存リスク（要検討）

- **背景**: 7年運営を見据えた場合、DB+Auth+Storage全部をSupabaseに依存する単一障害点リスク
- **懸念点**:
    - 10万〜15万件の画像規模（39GB→将来100GB超）でのストレージコスト・パフォーマンス
    - Supabaseの料金改定・サービス終了リスク（スタートアップ依存）
    - Auth/Storage/Realtimeが密結合 → 部分移行が困難
    - PostgreSQL自体は移行可能だが、Supabase固有機能（RLS、Auth hooks等）の移行コスト
- **代替案**:
    - GCP（Cloud SQL + Cloud Storage + Firebase Auth）— エンタープライズグレード、長期安定
    - AWS（RDS + S3 + Cognito）— 最大シェア、実績豊富
    - セルフホスト（VPS + PostgreSQL + MinIO）— 最安だが運用負荷大
- **判断タイミング**: 本番デプロイ前の今が移行コスト最小。公開後はデータ移行・ダウンタイムが発生
- **優先度**: 本番デプロイ準備（ステップ13）の前に方針決定が望ましい

### 新規店舗URLの自動発見
esthe-ranking.jpをメインソースとして採用決定。

**決定済み:**
- esthe-ranking.jp → サロンデータのメインソース（構造マッピング完了）

**検討中のアプローチ（補助ソース）:**
- Google検索 + Claude APIでフィルタリング
- 求人サイト（リジョブ等）の監視

## コマンド例

```bash
# フロントエンド起動
cd frontend/demo1
pnpm install
pnpm dev

# Supabase CLI
supabase init
supabase db push
```

## 注意事項

- SKR/HR = サービスレベルの隠語（センシティブな内容を示す）
- 法的リスクを考慮し、表現には注意
- スクレイピングデータはリライトして使用
