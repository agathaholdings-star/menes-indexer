#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
セラピスト画像URL Haiku一括抽出（Anthropic Message Batches API版）

キャッシュ済みHTMLから画像候補を抽出し、Haikuで本人写真を判定→image_urls UPDATE

4ステップ:
  prepare  → HTMLキャッシュ読み → 画像候補抽出 → プロンプト構築 → JSONL書き出し
  submit   → JSONL を Anthropic Batch API に投入
  status   → バッチ状態確認
  process  → 結果DL → パース → image_urls DB UPDATE

Usage:
  # 1. JSONL準備
  python batch_api_extract.py prepare

  # 2. Batch API投入
  python batch_api_extract.py submit

  # 3. 状態確認（完了まで繰り返し）
  python batch_api_extract.py status

  # 4. 結果処理 → DB UPDATE
  python batch_api_extract.py process

  # テスト（10件だけ）
  python batch_api_extract.py prepare --limit 10
  python batch_api_extract.py submit
  python batch_api_extract.py process --dry-run

前提:
  - html_cache/therapist/ にHTMLキャッシュ済み
  - database/.env に ANTHROPIC_API_KEY
  - DB接続可能（DATABASE_URL or localhost:54322）
"""

import json
import logging
import os
import re
import sys
import argparse

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# .env: ローカルは ../database/.env、VPSは /opt/scraper/.env
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

sys.path.insert(0, os.path.dirname(__file__))
from html_cache_utils import HtmlCache
from name_extractor import collect_image_candidates

_cache = HtmlCache()

# --- 設定 ---
DB_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 500

SCRIPT_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(SCRIPT_DIR, "batch_api_data")
REQUESTS_JSONL = os.path.join(DATA_DIR, "requests.jsonl")
RESULTS_JSONL = os.path.join(DATA_DIR, "results.jsonl")
BATCH_ID_FILE = os.path.join(DATA_DIR, "batch_id.txt")
METADATA_FILE = os.path.join(DATA_DIR, "metadata.json")

LOG_FILE = os.path.join(SCRIPT_DIR, 'batch_api_extract.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler(),
    ]
)
log = logging.getLogger(__name__)


def _get_client():
    import anthropic
    return anthropic.Anthropic()


# =============================================================================
# prepare: HTMLキャッシュ → JSONL
# =============================================================================

def cmd_prepare(args):
    """HTMLキャッシュからプロンプトを構築してJSONLに書き出す"""
    os.makedirs(DATA_DIR, exist_ok=True)

    conn = psycopg2.connect(DB_DSN)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    where_parts = ["t.source_url IS NOT NULL", "t.status = 'active'"]
    params = {}
    if args.start_id is not None:
        where_parts.append("t.id >= %(start_id)s")
        params['start_id'] = args.start_id
    if args.end_id is not None:
        where_parts.append("t.id < %(end_id)s")
        params['end_id'] = args.end_id

    cur.execute(f"""
        SELECT t.id, t.name, t.source_url, t.salon_id,
               s.name AS salon_name, s.display_name AS salon_display
        FROM therapists t
        JOIN salons s ON s.id = t.salon_id
        WHERE {" AND ".join(where_parts)}
        ORDER BY t.id
    """, params)
    rows = cur.fetchall()
    conn.close()

    if args.limit:
        rows = rows[:args.limit]

    log.info(f"対象: {len(rows)} 件")

    written = 0
    cache_miss = 0
    no_candidates = 0
    metadata = {}

    with open(REQUESTS_JSONL, 'w', encoding='utf-8') as f:
        for i, row in enumerate(rows):
            t_id = row['id']
            html = _cache.load("therapist", t_id)
            if not html:
                cache_miss += 1
                continue

            source_url = row['source_url'] or ''
            therapist_name = row['name'] or ''
            salon_name = row['salon_name'] or ''
            salon_display = row['salon_display'] or salon_name

            # 画像候補抽出
            candidates = collect_image_candidates(html, source_url)
            if not candidates:
                no_candidates += 1
                continue

            # 画像専用プロンプト構築
            prompt = _build_image_prompt(
                candidates, source_url, therapist_name, salon_display)

            custom_id = f"t_{t_id}"
            request = {
                "custom_id": custom_id,
                "params": {
                    "model": MODEL,
                    "max_tokens": MAX_TOKENS,
                    "messages": [{"role": "user", "content": prompt}],
                }
            }
            f.write(json.dumps(request, ensure_ascii=False) + "\n")

            metadata[custom_id] = {
                "therapist_id": t_id,
            }
            written += 1

            if (i + 1) % 5000 == 0:
                log.info(f"  {i + 1}/{len(rows)} 件処理済み...")

    # メタデータ保存（process時に使う）
    with open(METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False)

    file_mb = os.path.getsize(REQUESTS_JSONL) / 1024 / 1024
    log.info(f"\n{'='*60}")
    log.info(f"prepare 完了")
    log.info(f"  JSONL: {REQUESTS_JSONL} ({file_mb:.1f}MB)")
    log.info(f"  リクエスト数: {written}")
    log.info(f"  キャッシュミス: {cache_miss}")
    log.info(f"  画像候補なし: {no_candidates}")
    log.info(f"{'='*60}")


def _build_image_prompt(candidates, base_url, therapist_name, salon_name):
    """画像専用の軽量プロンプト（test_image_extract.pyと同じ）"""
    cand_lines = []
    for i, c in enumerate(candidates):
        line = f"[{i}] {c['url']}"
        if c.get("alt"):
            line += f' alt="{c["alt"]}"'
        if c.get("class"):
            line += f' class="{c["class"]}"'
        if c.get("width") or c.get("height"):
            line += f' {c.get("width", "")}x{c.get("height", "")}'
        if c.get("parent"):
            line += f' {c["parent"]}'
        cand_lines.append(line)

    return f"""このメンズエステのセラピスト個別プロフィールページの画像から、
**セラピスト本人の写真**だけを選んでください。

セラピスト名: {therapist_name or "(不明)"}
サロン名: {salon_name or "(不明)"}
URL: {base_url}

## 画像候補（{len(candidates)}件）
{chr(10).join(cand_lines)}

## 判定ルール
- セラピスト本人の写真のみ選ぶ（顔写真・全身写真・施術写真）
- 除外: ロゴ、バナー、ナビ画像、矢印、ボタン、SNSアイコン、プレースホルダー（spacer/noimage/coming_soon/loading）、他セラピストの写真、背景・装飾、極小画像
- URLパスのキーワード（cast/girl/therapist/staff/photo/profile + 個人ID）を判断材料にする
- 親要素class（profile/cast/detail等）も判断材料
- 最大5枚

## 出力: JSONのみ
```json
{{"image_urls": ["URL1", "URL2"], "reasoning": "理由1文"}}
```"""


# =============================================================================
# submit: JSONL → Batch API
# =============================================================================

MAX_BATCH_SIZE_MB = 200  # 256MB上限に余裕を持たせる


def cmd_submit(args):
    """JSONLをBatch APIに投入（256MB超は自動分割）"""
    if not os.path.exists(REQUESTS_JSONL):
        log.error(f"{REQUESTS_JSONL} が見つかりません。先に prepare を実行してください。")
        sys.exit(1)

    client = _get_client()
    file_size_mb = os.path.getsize(REQUESTS_JSONL) / 1024 / 1024

    if file_size_mb <= MAX_BATCH_SIZE_MB:
        # 1バッチで投入
        chunks = [REQUESTS_JSONL]
    else:
        # 分割
        chunks = _split_jsonl(REQUESTS_JSONL, MAX_BATCH_SIZE_MB)
        log.info(f"JSONL {file_size_mb:.0f}MB → {len(chunks)} 分割")

    batch_ids = []
    for i, chunk_path in enumerate(chunks):
        label = f"[{i+1}/{len(chunks)}] " if len(chunks) > 1 else ""
        log.info(f"{label}Batch API に投入中...")
        batch = client.messages.batches.create(
            requests=_iter_jsonl(chunk_path),
        )
        batch_ids.append(batch.id)
        log.info(f"{label}Batch ID: {batch.id} / Status: {batch.processing_status} / {batch.request_counts}")

    # batch IDを保存（複数行対応）
    with open(BATCH_ID_FILE, 'w') as f:
        f.write("\n".join(batch_ids))

    log.info(f"\n{'='*60}")
    log.info(f"submit 完了 ({len(batch_ids)} バッチ)")
    for bid in batch_ids:
        log.info(f"  {bid}")
    log.info(f"{'='*60}")
    log.info(f"\n次のステップ: python {__file__} status")


def _split_jsonl(path, max_mb):
    """JSONLを指定MB以下のチャンクに分割"""
    max_bytes = max_mb * 1024 * 1024
    chunks = []
    chunk_idx = 0
    current_size = 0
    current_f = None

    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line_bytes = len(line.encode('utf-8'))
            if current_f is None or current_size + line_bytes > max_bytes:
                if current_f:
                    current_f.close()
                chunk_idx += 1
                chunk_path = path.replace('.jsonl', f'_part{chunk_idx}.jsonl')
                chunks.append(chunk_path)
                current_f = open(chunk_path, 'w', encoding='utf-8')
                current_size = 0
            current_f.write(line)
            current_size += line_bytes

    if current_f:
        current_f.close()
    return chunks


def _iter_jsonl(path):
    """JSONLファイルからリクエストをイテレート"""
    requests = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                requests.append(json.loads(line))
    return requests


# =============================================================================
# status: バッチ状態確認
# =============================================================================

def cmd_status(args):
    """バッチの処理状態を確認（複数バッチ対応）"""
    batch_ids = _load_batch_ids(args)
    client = _get_client()

    all_ended = True
    for bid in batch_ids:
        batch = client.messages.batches.retrieve(bid)
        counts = batch.request_counts

        log.info(f"Batch ID: {bid}")
        log.info(f"  Status: {batch.processing_status}")
        log.info(f"  processing: {counts.processing}  succeeded: {counts.succeeded}  errored: {counts.errored}")
        if batch.processing_status != "ended":
            all_ended = False

    if all_ended:
        log.info(f"\n全バッチ完了！ 次のステップ: python {__file__} process")
    else:
        log.info(f"\nまだ処理中... 数分後に再確認してください。")


# =============================================================================
# process: 結果DL → パース → DB UPDATE
# =============================================================================

def cmd_process(args):
    """バッチ結果をダウンロードしてimage_urls更新（複数バッチ対応）"""
    batch_ids = _load_batch_ids(args)
    client = _get_client()

    # メタデータ読み込み
    if not os.path.exists(METADATA_FILE):
        log.error(f"{METADATA_FILE} が見つかりません。")
        sys.exit(1)
    with open(METADATA_FILE, 'r', encoding='utf-8') as f:
        metadata = json.load(f)

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur = conn.cursor()

    stats = {
        'total': 0, 'updated': 0, 'empty': 0,
        'parse_failed': 0, 'api_error': 0, 'db_error': 0,
    }

    # 結果をJSONLに保存しつつ処理
    with open(RESULTS_JSONL, 'w', encoding='utf-8') as out_f:
        for batch_id in batch_ids:
            log.info(f"Batch {batch_id} の結果をダウンロード中...")
            for result in client.messages.batches.results(batch_id):
                stats['total'] += 1
                custom_id = result.custom_id
                meta = metadata.get(custom_id)
                if not meta:
                    log.warning(f"  メタデータ不明: {custom_id}")
                    continue

                t_id = meta['therapist_id']

                # 結果保存
                out_f.write(json.dumps({
                    "custom_id": custom_id,
                    "type": result.result.type,
                }, ensure_ascii=False) + "\n")

                if result.result.type != "succeeded":
                    stats['api_error'] += 1
                    continue

                # レスポンステキスト取得
                message = result.result.message
                result_text = message.content[0].text if message.content else ""

                # JSONパース
                image_urls = _parse_image_response(result_text)

                if image_urls is None:
                    stats['parse_failed'] += 1
                    continue

                if len(image_urls) == 0:
                    stats['empty'] += 1
                    continue

                # DB UPDATE (image_urlsのみ)
                if not args.dry_run:
                    ok = _update_image_urls(cur, t_id, image_urls)
                    if ok:
                        stats['updated'] += 1
                    else:
                        stats['db_error'] += 1
                else:
                    stats['updated'] += 1

                # 進捗
                if stats['total'] % 5000 == 0:
                    if not args.dry_run:
                        conn.commit()
                    log.info(
                        f"  [{stats['total']}] "
                        f"updated={stats['updated']} "
                        f"empty={stats['empty']} "
                        f"parse_fail={stats['parse_failed']} "
                        f"api_err={stats['api_error']}"
                    )

    # 最終コミット
    if not args.dry_run:
        conn.commit()
    conn.close()

    log.info(f"\n{'='*60}")
    log.info(f"process 完了")
    log.info(f"{'='*60}")
    log.info(f"  合計:          {stats['total']}")
    log.info(f"  UPDATE成功:    {stats['updated']}")
    log.info(f"  画像なし:      {stats['empty']}")
    log.info(f"  パース失敗:    {stats['parse_failed']}")
    log.info(f"  API エラー:    {stats['api_error']}")
    log.info(f"  DB エラー:     {stats['db_error']}")


def _parse_image_response(result_text):
    """Haiku応答から image_urls 配列を抽出"""
    try:
        # ```json ... ``` ブロック除去
        json_match = re.search(r"```json\s*(.*?)\s*```", result_text, re.DOTALL)
        if json_match:
            result_text = json_match.group(1)
        js = result_text.find("{")
        je = result_text.rfind("}") + 1
        if js >= 0 and je > js:
            result_text = result_text[js:je]

        data = json.loads(result_text)
        urls = data.get("image_urls", [])
        if not isinstance(urls, list):
            return None
        # http/httpsのみ、最大5枚
        return [u for u in urls if isinstance(u, str) and u.startswith("http")][:5]
    except Exception:
        return None


def _update_image_urls(cur, therapist_id, image_urls):
    """image_urlsのみUPDATE"""
    sql = "UPDATE therapists SET image_urls = %s::jsonb WHERE id = %s"
    try:
        cur.execute("SAVEPOINT sp_update")
        cur.execute(sql, (json.dumps(image_urls, ensure_ascii=False), therapist_id))
        cur.execute("RELEASE SAVEPOINT sp_update")
        return True
    except Exception as e:
        cur.execute("ROLLBACK TO SAVEPOINT sp_update")
        log.warning(f"  DB UPDATE error id={therapist_id}: {e}")
        return False


def _load_batch_ids(args):
    """バッチIDを読み込み（複数行対応）"""
    if args.batch_id:
        return [args.batch_id]
    if os.path.exists(BATCH_ID_FILE):
        with open(BATCH_ID_FILE, 'r') as f:
            ids = [line.strip() for line in f if line.strip()]
            if ids:
                return ids
    log.error("Batch IDが見つかりません。--batch-id で指定するか、先に submit を実行してください。")
    sys.exit(1)


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='セラピスト画像URL Haiku一括抽出（Batch API版）')

    sub = parser.add_subparsers(dest='command', required=True)

    # prepare
    p_prep = sub.add_parser('prepare', help='HTMLキャッシュ → JSONL')
    p_prep.add_argument('--start-id', type=int, default=None)
    p_prep.add_argument('--end-id', type=int, default=None)
    p_prep.add_argument('--limit', type=int, default=0)

    # submit
    p_sub = sub.add_parser('submit', help='JSONL → Batch API投入')

    # status
    p_stat = sub.add_parser('status', help='バッチ状態確認')
    p_stat.add_argument('--batch-id', type=str, default=None)

    # process
    p_proc = sub.add_parser('process', help='結果DL → DB UPDATE')
    p_proc.add_argument('--batch-id', type=str, default=None)
    p_proc.add_argument('--dry-run', action='store_true')

    args = parser.parse_args()

    if args.command == 'prepare':
        cmd_prepare(args)
    elif args.command == 'submit':
        cmd_submit(args)
    elif args.command == 'status':
        cmd_status(args)
    elif args.command == 'process':
        cmd_process(args)


if __name__ == '__main__':
    main()
