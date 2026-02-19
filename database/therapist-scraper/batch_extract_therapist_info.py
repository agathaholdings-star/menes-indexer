#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
セラピスト情報 Haiku 一括抽出バッチ

2つのモード:
  --existing  既存92,587件を再抽出してUPDATE（一回きりの品質修復）
  --new       新着セラピストを発見・追加してINSERT（月次）

Usage:
  # テスト（5件、DB書き込みなし）
  python batch_extract_therapist_info.py --existing --limit 5 --dry-run

  # 本番（全件）
  python batch_extract_therapist_info.py --existing --workers 5

  # VPS並列（ID範囲分割）
  python batch_extract_therapist_info.py --existing --start-id 0 --end-id 20000 --workers 5

  # 新着追加
  python batch_extract_therapist_info.py --new --workers 5

  # チェックポイントから再開
  python batch_extract_therapist_info.py --existing --resume

前提:
  - supabase start 済み (127.0.0.1:54322)
  - database/.env に ANTHROPIC_API_KEY
"""

import json
import logging
import os
import random
import signal
import sys
import time
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from urllib.parse import urlparse

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# .env読み込み
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# ローカルモジュール
sys.path.insert(0, os.path.dirname(__file__))
from fetch_utils import fetch_page
from html_cache_utils import HtmlCache
from name_extractor import extract_therapist_info

_cache = HtmlCache()

# --- 設定 ---
DB_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
REQUEST_DELAY = 1.0

# ログ設定
SCRIPT_DIR = os.path.dirname(__file__)
LOG_FILE = os.path.join(SCRIPT_DIR, 'batch_extract_therapist_info.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler(),
    ]
)
log = logging.getLogger(__name__)

# graceful shutdown
_shutdown = False


def _handle_sigint(signum, frame):
    global _shutdown
    _shutdown = True
    log.info("\nSIGINT受信 — 現バッチ完了後に終了します...")


signal.signal(signal.SIGINT, _handle_sigint)


# =============================================================================
# チェックポイント
# =============================================================================

def _checkpoint_path(mode, start_id=None, end_id=None):
    suffix = f"_{start_id}_{end_id}" if start_id is not None else ""
    return os.path.join(SCRIPT_DIR, f"batch_extract_{mode}_checkpoint{suffix}.json")


def _default_checkpoint():
    return {
        'done_ids': [],
        'stats': {
            'processed': 0,
            'updated': 0,
            'inserted': 0,
            'fetch_failed': 0,
            'extract_failed': 0,
            'skipped_no_name': 0,
            'db_error': 0,
            'total_input_tokens': 0,
            'total_output_tokens': 0,
            'started_at': None,
        }
    }


def load_checkpoint(path):
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return _default_checkpoint()


def save_checkpoint(checkpoint, path):
    checkpoint['stats']['last_updated'] = datetime.now().isoformat()
    with open(path, 'w') as f:
        json.dump(checkpoint, f, ensure_ascii=False, indent=2)


# =============================================================================
# fetch + cache + extract（スレッドセーフ）
# =============================================================================

def fetch_and_extract_one(therapist_id, source_url, salon_name, salon_display):
    """
    1件分: 常にfetch → cache保存 → Haiku抽出

    Returns:
        (therapist_id, data_dict_or_None, error_type_or_None)
        error_type: 'fetch_failed' | 'extract_failed' | 'no_name' | None
    """
    html = fetch_page(source_url)
    if not html:
        return therapist_id, None, 'fetch_failed'
    _cache.save("therapist", therapist_id, html)

    try:
        data = extract_therapist_info(
            html,
            salon_name=salon_name or '',
            salon_display=salon_display or '',
            url=source_url,
        )
    except Exception as e:
        log.debug(f"  extract error id={therapist_id}: {e}")
        return therapist_id, None, 'extract_failed'

    if data is None:
        return therapist_id, None, 'extract_failed'

    if not data.get('name'):
        return therapist_id, None, 'no_name'

    return therapist_id, data, None


# =============================================================================
# --existing モード: UPDATE
# =============================================================================

UPDATE_FIELDS = [
    'name', 'age', 'height', 'cup', 'bust', 'waist', 'hip',
    'blood_type', 'profile_text',
]


def update_therapist(cur, therapist_id, data):
    """Haikuがnullを返したフィールドは既存値を維持。SAVEPOINT付き。"""
    set_parts = []
    params = {}

    for field in UPDATE_FIELDS:
        val = data.get(field)
        if val is not None:
            set_parts.append(f"{field} = %({field})s")
            # bust は text 型
            if field == 'bust' and val is not None:
                params[field] = str(val)
            else:
                params[field] = val

    if not set_parts:
        return False

    set_parts.append("last_scraped_at = now()")
    params['id'] = therapist_id

    sql = f"UPDATE therapists SET {', '.join(set_parts)} WHERE id = %(id)s"

    try:
        cur.execute("SAVEPOINT sp_update")
        cur.execute(sql, params)
        cur.execute("RELEASE SAVEPOINT sp_update")
        return True
    except Exception as e:
        cur.execute("ROLLBACK TO SAVEPOINT sp_update")
        log.warning(f"  DB UPDATE error id={therapist_id}: {e}")
        return False


def run_existing(args):
    """--existing モード: 既存レコードを再抽出してUPDATE"""
    cp_path = _checkpoint_path("existing", args.start_id, args.end_id)
    checkpoint = load_checkpoint(cp_path) if args.resume else _default_checkpoint()
    done_ids = set(checkpoint['done_ids'])
    stats = checkpoint['stats']

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # 対象取得
    where_parts = ["t.source_url IS NOT NULL"]
    params = {}
    if args.start_id is not None:
        where_parts.append("t.id >= %(start_id)s")
        params['start_id'] = args.start_id
    if args.end_id is not None:
        where_parts.append("t.id < %(end_id)s")
        params['end_id'] = args.end_id

    where_sql = " AND ".join(where_parts)
    cur.execute(f"""
        SELECT t.id, t.source_url, t.salon_id,
               s.name AS salon_name, s.display_name AS salon_display
        FROM therapists t
        JOIN salons s ON s.id = t.salon_id
        WHERE {where_sql}
        ORDER BY t.id
    """, params)
    rows = cur.fetchall()

    if args.limit:
        rows = rows[:args.limit]

    # 処理済みスキップ
    rows = [r for r in rows if r['id'] not in done_ids]

    # ドメインシャッフル: 同一サーバーへの連続アクセスを分散
    random.shuffle(rows)

    total = len(rows)
    log.info(f"--existing モード: 対象 {total} 件"
             f" (start_id={args.start_id}, end_id={args.end_id})")
    if done_ids:
        log.info(f"  処理済みスキップ: {len(done_ids)} 件")

    if not total:
        log.info("処理対象が0件のため終了")
        conn.close()
        return

    if not stats.get('started_at'):
        stats['started_at'] = datetime.now().isoformat()

    start_time = time.time()
    batch_count = 0

    for idx, row in enumerate(rows):
        if _shutdown:
            log.info("シャットダウン — チェックポイント保存中...")
            break

        t_id = row['id']
        source_url = row['source_url']

        # fetch + extract（メインスレッド — Haiku APIコールがボトルネック）
        _, data, err = fetch_and_extract_one(
            t_id, source_url,
            row['salon_name'], row['salon_display'])

        if err in ('fetch_failed', 'extract_failed', 'no_name'):
            stats[err] = stats.get(err, 0) + 1
            # 情報取れない → retired化
            if not args.dry_run:
                try:
                    cur.execute("SAVEPOINT sp_retire")
                    cur.execute("""
                        UPDATE therapists
                        SET status = 'retired', last_scraped_at = now()
                        WHERE id = %s
                    """, (t_id,))
                    cur.execute("RELEASE SAVEPOINT sp_retire")
                    stats['retired'] = stats.get('retired', 0) + 1
                except Exception:
                    cur.execute("ROLLBACK TO SAVEPOINT sp_retire")
        elif data:
            stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + data.get('input_tokens', 0)
            stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + data.get('output_tokens', 0)

            if not args.dry_run:
                ok = update_therapist(cur, t_id, data)
                if ok:
                    stats['updated'] = stats.get('updated', 0) + 1
                else:
                    stats['db_error'] = stats.get('db_error', 0) + 1
            else:
                stats['updated'] = stats.get('updated', 0) + 1

        done_ids.add(t_id)
        stats['processed'] = stats.get('processed', 0) + 1
        batch_count += 1

        # 進捗表示
        if (idx + 1) % 10 == 0 or idx == total - 1:
            elapsed = timedelta(seconds=int(time.time() - start_time))
            rate = (idx + 1) / (time.time() - start_time) if time.time() > start_time else 0
            eta = timedelta(seconds=int((total - idx - 1) / rate)) if rate > 0 else "?"
            log.info(
                f"[{idx + 1}/{total}] "
                f"updated={stats.get('updated', 0)} "
                f"fetch_fail={stats.get('fetch_failed', 0)} "
                f"extract_fail={stats.get('extract_failed', 0)} "
                f"no_name={stats.get('skipped_no_name', 0)} "
                f"[{elapsed} / ETA {eta}]"
            )

        # batch-size ごとにコミット + チェックポイント
        if batch_count >= args.batch_size:
            if not args.dry_run:
                conn.commit()
            checkpoint['done_ids'] = list(done_ids)
            checkpoint['stats'] = stats
            save_checkpoint(checkpoint, cp_path)
            batch_count = 0

        time.sleep(REQUEST_DELAY)

    # 最終コミット
    if not args.dry_run:
        conn.commit()
    checkpoint['done_ids'] = list(done_ids)
    checkpoint['stats'] = stats
    save_checkpoint(checkpoint, cp_path)

    # サマリー
    elapsed = timedelta(seconds=int(time.time() - start_time))
    log.info(f"\n{'=' * 60}")
    log.info(f" --existing 完了 ({elapsed})")
    log.info(f"{'=' * 60}")
    log.info(f"  処理:          {stats.get('processed', 0)} 件")
    log.info(f"  UPDATE成功:    {stats.get('updated', 0)} 件")
    log.info(f"  retired化:     {stats.get('retired', 0)} 件")
    log.info(f"    fetch失敗:   {stats.get('fetch_failed', 0)} 件")
    log.info(f"    extract失敗: {stats.get('extract_failed', 0)} 件")
    log.info(f"    name無し:    {stats.get('no_name', 0)} 件")
    log.info(f"  DBエラー:      {stats.get('db_error', 0)} 件")
    log.info(f"  入力トークン:  {stats.get('total_input_tokens', 0):,}")
    log.info(f"  出力トークン:  {stats.get('total_output_tokens', 0):,}")

    conn.close()


# =============================================================================
# --new モード: INSERT
# =============================================================================

def _safe_int(val):
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def insert_therapist_new(cur, salon_id, data):
    """新規セラピストをINSERT。SAVEPOINT付き。Returns id or None."""
    t_name = data.get('name')
    if not t_name:
        return None

    bust_val = data.get('bust')
    if bust_val is not None:
        bust_val = str(bust_val)

    image_urls = data.get('image_urls') or []
    if isinstance(image_urls, str):
        try:
            image_urls = json.loads(image_urls)
        except json.JSONDecodeError:
            image_urls = [image_urls]

    try:
        cur.execute("SAVEPOINT sp_insert")
        cur.execute("""
            INSERT INTO therapists (
                salon_id, name, age, height,
                bust, waist, hip, cup, blood_type,
                image_urls, profile_text, source_url,
                status, last_scraped_at
            ) VALUES (
                %(salon_id)s, %(name)s, %(age)s, %(height)s,
                %(bust)s, %(waist)s, %(hip)s, %(cup)s, %(blood_type)s,
                %(image_urls)s::jsonb, %(profile_text)s, %(source_url)s,
                'active', now()
            )
            ON CONFLICT (salon_id, slug) DO NOTHING
            RETURNING id
        """, {
            'salon_id': salon_id,
            'name': t_name,
            'age': _safe_int(data.get('age')),
            'height': _safe_int(data.get('height')),
            'bust': bust_val,
            'waist': _safe_int(data.get('waist')),
            'hip': _safe_int(data.get('hip')),
            'cup': data.get('cup'),
            'blood_type': data.get('blood_type'),
            'image_urls': json.dumps(image_urls, ensure_ascii=False),
            'profile_text': data.get('profile_text'),
            'source_url': data.get('source_url'),
        })
        row = cur.fetchone()
        if row:
            t_id = row['id']
            cur.execute("UPDATE therapists SET slug = %s WHERE id = %s",
                        (str(t_id), t_id))
            cur.execute("RELEASE SAVEPOINT sp_insert")
            return t_id
        cur.execute("RELEASE SAVEPOINT sp_insert")
        return None
    except Exception as e:
        cur.execute("ROLLBACK TO SAVEPOINT sp_insert")
        log.warning(f"  DB INSERT error: {t_name}: {e}")
        return None


def run_new(args):
    """--new モード: 新着セラピストを発見してINSERT"""
    # batch_therapist_data から heuristic URL抽出を借用
    from batch_therapist_data import extract_therapist_urls_heuristic

    cp_path = _checkpoint_path("new", args.start_id, args.end_id)
    checkpoint = load_checkpoint(cp_path) if args.resume else _default_checkpoint()
    done_ids = set(checkpoint['done_ids'])  # done salon_ids
    stats = checkpoint['stats']

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # therapist_list_url ありのサロンを取得
    where_parts = ["c.therapist_list_url IS NOT NULL", "c.last_therapist_count > 0"]
    params = {}
    if args.start_id is not None:
        where_parts.append("c.salon_id >= %(start_id)s")
        params['start_id'] = args.start_id
    if args.end_id is not None:
        where_parts.append("c.salon_id < %(end_id)s")
        params['end_id'] = args.end_id

    where_sql = " AND ".join(where_parts)
    cur.execute(f"""
        SELECT DISTINCT ON (c.salon_id)
               c.salon_id, c.therapist_list_url,
               s.name AS salon_name, s.display_name AS salon_display
        FROM salon_scrape_cache c
        JOIN salons s ON s.id = c.salon_id
        WHERE {where_sql}
        ORDER BY c.salon_id
    """, params)
    salons = cur.fetchall()

    if args.limit:
        salons = salons[:args.limit]

    # 処理済みスキップ
    salons = [s for s in salons if s['salon_id'] not in done_ids]

    total = len(salons)
    log.info(f"--new モード: 対象サロン {total} 件")

    if not total:
        log.info("処理対象が0件のため終了")
        conn.close()
        return

    if not stats.get('started_at'):
        stats['started_at'] = datetime.now().isoformat()

    start_time = time.time()
    batch_count = 0

    for idx, salon in enumerate(salons):
        if _shutdown:
            log.info("シャットダウン — チェックポイント保存中...")
            break

        salon_id = salon['salon_id']
        list_url = salon['therapist_list_url']
        salon_name = salon['salon_name'] or ''
        salon_display = salon['salon_display'] or salon_name

        # 一覧ページ fetch
        list_html = fetch_page(list_url)
        if not list_html:
            done_ids.add(salon_id)
            stats['fetch_failed'] = stats.get('fetch_failed', 0) + 1
            continue

        # セラピストURL抽出
        entries = extract_therapist_urls_heuristic(list_html, list_url)
        if not entries:
            done_ids.add(salon_id)
            continue

        # DB既存URLと比較 → 差分のみ
        cur.execute(
            "SELECT source_url FROM therapists WHERE salon_id = %s AND source_url IS NOT NULL",
            (salon_id,))
        existing_urls = {r['source_url'] for r in cur.fetchall()}
        new_entries = [e for e in entries if e['url'] not in existing_urls]

        if not new_entries:
            done_ids.add(salon_id)
            continue

        salon_inserted = 0
        for entry in new_entries:
            if _shutdown:
                break

            t_url = entry['url']
            html = fetch_page(t_url)
            if not html:
                stats['fetch_failed'] = stats.get('fetch_failed', 0) + 1
                continue

            # URL末尾をキーとしてキャッシュ
            cache_key = t_url.rstrip('/').split('/')[-1]
            _cache.save("therapist", cache_key, html)

            try:
                data = extract_therapist_info(
                    html,
                    salon_name=salon_name,
                    salon_display=salon_display,
                    url=t_url,
                )
            except Exception as e:
                stats['extract_failed'] = stats.get('extract_failed', 0) + 1
                continue

            if data is None:
                stats['extract_failed'] = stats.get('extract_failed', 0) + 1
                continue

            if not data.get('name'):
                stats['skipped_no_name'] = stats.get('skipped_no_name', 0) + 1
                continue

            stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + data.get('input_tokens', 0)
            stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + data.get('output_tokens', 0)

            # source_url をデータに追加
            data['source_url'] = t_url

            # image_urls: リスト画像をフォールバック
            if not data.get('image_urls') and entry.get('list_image_url'):
                data['image_urls'] = [entry['list_image_url']]

            if not args.dry_run:
                t_id = insert_therapist_new(cur, salon_id, data)
                if t_id:
                    stats['inserted'] = stats.get('inserted', 0) + 1
                    salon_inserted += 1
                else:
                    stats['db_error'] = stats.get('db_error', 0) + 1
            else:
                stats['inserted'] = stats.get('inserted', 0) + 1
                salon_inserted += 1

            time.sleep(REQUEST_DELAY)

        done_ids.add(salon_id)
        stats['processed'] = stats.get('processed', 0) + 1
        batch_count += 1

        if salon_inserted > 0:
            log.info(f"[{idx + 1}/{total}] {salon_display}: +{salon_inserted}名 (新着{len(new_entries)}件中)")

        # batch-size ごとにコミット
        if batch_count >= args.batch_size:
            if not args.dry_run:
                conn.commit()
            checkpoint['done_ids'] = list(done_ids)
            checkpoint['stats'] = stats
            save_checkpoint(checkpoint, cp_path)
            batch_count = 0

    # 最終コミット
    if not args.dry_run:
        conn.commit()
    checkpoint['done_ids'] = list(done_ids)
    checkpoint['stats'] = stats
    save_checkpoint(checkpoint, cp_path)

    elapsed = timedelta(seconds=int(time.time() - start_time))
    log.info(f"\n{'=' * 60}")
    log.info(f" --new 完了 ({elapsed})")
    log.info(f"{'=' * 60}")
    log.info(f"  サロン処理:    {stats.get('processed', 0)} 件")
    log.info(f"  INSERT成功:    {stats.get('inserted', 0)} 件")
    log.info(f"  fetch失敗:     {stats.get('fetch_failed', 0)} 件")
    log.info(f"  extract失敗:   {stats.get('extract_failed', 0)} 件")
    log.info(f"  name=null:     {stats.get('skipped_no_name', 0)} 件")
    log.info(f"  DBエラー:      {stats.get('db_error', 0)} 件")
    log.info(f"  入力トークン:  {stats.get('total_input_tokens', 0):,}")
    log.info(f"  出力トークン:  {stats.get('total_output_tokens', 0):,}")

    conn.close()


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='セラピスト情報 Haiku 一括抽出バッチ')

    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--existing', action='store_true',
                      help='既存レコードを再抽出（UPDATE）')
    mode.add_argument('--new', action='store_true',
                      help='新着セラピストを発見・追加（INSERT）')

    parser.add_argument('--start-id', type=int, default=None,
                        help='開始ID（VPS並列用）')
    parser.add_argument('--end-id', type=int, default=None,
                        help='終了ID（VPS並列用）')
    parser.add_argument('--resume', action='store_true',
                        help='チェックポイントから再開')
    parser.add_argument('--workers', type=int, default=5,
                        help='並列fetchワーカー数（default: 5）')
    parser.add_argument('--limit', type=int, default=0,
                        help='処理件数制限（テスト用）')
    parser.add_argument('--dry-run', action='store_true',
                        help='DB書き込みスキップ')
    parser.add_argument('--batch-size', type=int, default=100,
                        help='コミット+チェックポイント間隔（default: 100）')

    args = parser.parse_args()

    log.info("=" * 60)
    log.info(" セラピスト情報 Haiku 一括抽出バッチ")
    log.info(f" モード: {'--existing (UPDATE)' if args.existing else '--new (INSERT)'}")
    log.info(f" workers={args.workers} batch_size={args.batch_size}"
             f" dry_run={args.dry_run} resume={args.resume}")
    if args.start_id is not None or args.end_id is not None:
        log.info(f" ID範囲: [{args.start_id} .. {args.end_id})")
    log.info("=" * 60)

    if args.existing:
        run_existing(args)
    else:
        run_new(args)


if __name__ == '__main__':
    main()
