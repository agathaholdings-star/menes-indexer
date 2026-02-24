# セラピストスクレイパー運用ガイド

## 正規運用: `batch_extract_therapist_info.py`

- 引数なしで全6,489サロンを差分処理（3段階Haikuフロー: TOP→一覧→個別）
- `--start-id`/`--end-id`: VPS並列対応、`--resume`: チェックポイント再開、`--dry-run`
- 3Days CMS: Haiku不使用（data.js直接パース）
- source-first原則: salon_scrape_cacheの旧キャッシュに依存しない

## VPS

| 項目 | 値 |
|------|-----|
| IP | 220.158.18.6 |
| SSH鍵 | `~/Downloads/indexer.pem` |
| DB | `postgresql://postgres:postgres@127.0.0.1:5432/menethe` |
| スクリプト | `/opt/scraper/` |
| 契約 | 2026-02-09 〜 2026-04-30 |

```bash
ssh -i ~/Downloads/indexer.pem root@220.158.18.6                          # SSH
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "cd /opt/scraper && python3 batch_extract_therapist_info.py"  # 実行
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "sudo -u postgres psql -d menethe -c 'SELECT count(*) FROM therapists;'"  # DB件数
ssh -i ~/Downloads/indexer.pem root@220.158.18.6 "sudo -u postgres pg_dump -d menethe --data-only -t therapists" > therapists_dump.sql  # ローカル同期
```

## テスト

```bash
cd /Users/agatha/Desktop/project/menethe-indexer/database/therapist-scraper
python3 -c "import scrape_failed_salons as s; salons = s.get_salons_by_ids([ID1, ID2]); s.run_test(salons, csv_path='/Users/agatha/Desktop/retest.csv')"
```

## 分類マスタ

| マスタ | 値 |
|--------|-----|
| looks_types | 1:清楚系 2:素人系 3:ギャル系 4:モデル系 5:ロリ系 6:女優系 7:夜職系 8:熟女系 |
| body_types | 1:華奢 2:スレンダー 3:バランス 4:グラマー 5:ぽっちゃり |
| cup_types | 1:なし 2:控えめ 3:標準 4:大きめ 5:巨乳 |
| service_levels | 1:健全 2:SKR 3:HR |

**cup二重管理**: `therapists.cup`（公式） + `reviews.cup_type_id`（体感）

## Important / 注意・落とし穴

- `scrape_failed_salons.py`は88KBの巨大ファイル。never use for production（テスト専用）
- `insert_therapist_new()`のdedup判定は`salon_id + source_url + name`の3点一致。single_pageでは全員同じURLなので名前が必須
- 3Days CMSサイトはHTMLにデータがない（Alpine.js + S3 data.js）。Haikuに渡しても無意味
- Wixサイトはestama.jp等の外部ドメインURLを返しがち。外部ドメインフィルタ必須
- `max_tokens`は8000に設定。209件URLを返すサロンが存在するため、少ないと切り詰め→JSONパース失敗
- VPSの`/opt/scraper/`はローカルの`database/therapist-scraper/`と同じコード。デプロイはscpで手動同期

## パイプライン概要

```
Stage 1: TOP→Haiku分析（page_type判定、個別URL収集）
Stage 2: 一覧ページ→Haiku分析（追加URL収集）
Stage 3: 個別ページ×N→Haiku抽出（名前・年齢・画像等）
※3Days CMS: data.js直接パース（Haiku不使用、$0）
```

## ファイル構成

| ファイル | 用途 |
|---------|------|
| `batch_extract_therapist_info.py` | 正規運用スクリプト |
| `name_extractor.py` | Haiku一括抽出 |
| `scrape_failed_salons.py` | テスト専用 |
| `fetch_utils.py` / `html_cache_utils.py` | 共通モジュール |
| `batch_download_images.py` | 画像DL→Storage |
