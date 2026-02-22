#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
セラピスト情報 Haiku 一括抽出バッチ（統一パイプライン）

2つのモード:
  --existing  既存レコードを再抽出してUPDATE（一回きりの品質修復）
  --new       全サロン対象の差分スクレイピング（月次定期実行推奨）

--new モードは2パスで全サロンを処理:
  パス1: therapist_list_url あり → ヒューリスティックURL抽出 → source_url diff → Haiku個別抽出
  パス2: therapist_list_url なし → 3段階Haikuフロー（TOP→一覧→個別）
         + 3Days CMS直接抽出 / single_page一括抽出 / Playwright fallback

全フローで source_url dedup 保証（INSERT前に既存チェック）。

Usage:
  # テスト（5件、DB書き込みなし）
  python batch_extract_therapist_info.py --existing --limit 5 --dry-run

  # 本番（全件）
  python batch_extract_therapist_info.py --existing --workers 5

  # VPS並列（ID範囲分割）
  python batch_extract_therapist_info.py --existing --start-id 0 --end-id 20000 --workers 5

  # 全サロン月次差分スクレイピング（推奨）
  python batch_extract_therapist_info.py --new

  # VPS並列
  python batch_extract_therapist_info.py --new --start-id 0 --end-id 3000
  python batch_extract_therapist_info.py --new --start-id 3000 --end-id 6489

  # チェックポイントから再開
  python batch_extract_therapist_info.py --new --resume

前提:
  - supabase start 済み (127.0.0.1:54322) or DATABASE_URL 環境変数
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
DB_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
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
    1件分: キャッシュ読み込み → Haiku抽出（外部fetchしない）

    Returns:
        (therapist_id, data_dict_or_None, error_type_or_None)
        error_type: 'cache_miss' | 'extract_failed' | 'no_name' | None
    """
    html = _cache.load("therapist", therapist_id)
    if not html:
        return therapist_id, None, 'cache_miss'

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
    'blood_type', 'profile_text', 'image_urls',
]


def update_therapist(cur, therapist_id, data):
    """Haikuがnullを返したフィールドは既存値を維持。SAVEPOINT付き。"""
    set_parts = []
    params = {}

    for field in UPDATE_FIELDS:
        val = data.get(field)
        if field == 'image_urls':
            # image_urls: 空配列は既存値維持（スキップ）
            if isinstance(val, list) and len(val) > 0:
                set_parts.append("image_urls = %(image_urls)s::jsonb")
                params['image_urls'] = json.dumps(val, ensure_ascii=False)
            continue
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

        # キャッシュ読み込み + Haiku抽出
        _, data, err = fetch_and_extract_one(
            t_id, source_url,
            row['salon_name'], row['salon_display'])

        if err in ('cache_miss', 'extract_failed', 'no_name'):
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
    """新規セラピストをINSERT。SAVEPOINT付き。Returns id or None.

    source_url が既に同一サロンに存在する場合はスキップ（重複防止）。
    """
    t_name = data.get('name')
    if not t_name:
        return None

    # source_url 重複チェック（同一サロン内）
    source_url = data.get('source_url')
    if source_url:
        cur.execute(
            "SELECT id FROM therapists WHERE salon_id = %s AND source_url = %s LIMIT 1",
            (salon_id, source_url))
        if cur.fetchone():
            return None  # 既存 → スキップ

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


def _get_existing_source_urls(cur, salon_id):
    """サロン内の既存source_urlセットを取得"""
    cur.execute(
        "SELECT source_url FROM therapists WHERE salon_id = %s AND source_url IS NOT NULL",
        (salon_id,))
    return {r['source_url'] for r in cur.fetchall()}


def _process_heuristic_salon(cur, salon, args, stats, _shutdown_ref):
    """therapist_list_url ありのサロン: ヒューリスティックURL抽出 → Haiku個別抽出"""
    from batch_therapist_data import extract_therapist_urls_heuristic

    salon_id = salon['salon_id']
    list_url = salon['therapist_list_url']
    salon_name = salon['salon_name'] or ''
    salon_display = salon['salon_display'] or salon_name

    # 一覧ページ fetch
    list_html = fetch_page(list_url)
    if not list_html:
        stats['fetch_failed'] = stats.get('fetch_failed', 0) + 1
        return 0

    # セラピストURL抽出
    entries = extract_therapist_urls_heuristic(list_html, list_url)
    if not entries:
        return 0

    # DB既存URLと比較 → 差分のみ
    existing_urls = _get_existing_source_urls(cur, salon_id)
    new_entries = [e for e in entries if e['url'] not in existing_urls]

    if not new_entries:
        return 0

    salon_inserted = 0
    for entry in new_entries:
        if _shutdown:
            break

        t_url = entry['url']
        html = fetch_page(t_url)
        if not html:
            stats['fetch_failed'] = stats.get('fetch_failed', 0) + 1
            continue

        cache_key = t_url.rstrip('/').split('/')[-1]
        _cache.save("therapist", cache_key, html)

        try:
            data = extract_therapist_info(
                html,
                salon_name=salon_name,
                salon_display=salon_display,
                url=t_url,
            )
        except Exception:
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

        data['source_url'] = t_url

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

    return salon_inserted


def _process_haiku_salon(cur, salon, args, stats, _shutdown_ref):
    """therapist_list_url なしのサロン: 3段階Haikuフローで処理

    scrape_failed_salons.py のロジックを統合:
    Stage 1: TOPページ分析 → page_type判定
    Stage 2: listing URL → 個別URL抽出
    Stage 3: 個別ページ → Haiku情報抽出 → INSERT
    + 3Days CMS直接抽出 / single_page一括抽出
    """
    # scrape_failed_salons.py から遅延import（循環import回避）
    from scrape_failed_salons import (
        fetch_page_smart, detect_3days_cms, parse_3days_data_js,
        haiku_analyze_page, haiku_extract_single_page,
        is_valid_therapist_url, _reanchor_stage1_urls,
        expand_individual_urls, detect_platform, fetch_paginated_listing,
    )

    salon_id = salon['salon_id']
    url = salon['official_url']
    salon_name = salon['salon_name'] or ''
    salon_display = salon['salon_display'] or salon_name

    if not url:
        return 0

    # --- Stage 1: TOPページ分析 ---
    html = fetch_page_smart(url, label=f"Haiku S1: ")
    if not html:
        stats['fetch_failed'] = stats.get('fetch_failed', 0) + 1
        return 0

    _cache.save("salon_top", salon_id, html)

    # 既存source_urls（全パスで使う）
    existing_urls = _get_existing_source_urls(cur, salon_id)

    # --- 3Days CMS 直接抽出（$0）---
    data_js_url = detect_3days_cms(html)
    if data_js_url:
        log.info(f"  3Days CMS detected → {data_js_url}")
        js_text = fetch_page(data_js_url)
        if js_text:
            therapists = parse_3days_data_js(js_text, url, salon_name=salon_display)
            count = 0
            for t_data in therapists:
                if t_data.get('source_url') in existing_urls:
                    continue
                if not args.dry_run:
                    t_id = insert_therapist_new(cur, salon_id, t_data)
                    if t_id:
                        count += 1
                else:
                    count += 1
            stats['inserted'] = stats.get('inserted', 0) + count
            return count

    # --- Haiku Stage 1 分析 ---
    result1 = haiku_analyze_page(html, salon_display, url)
    if not result1:
        stats['extract_failed'] = stats.get('extract_failed', 0) + 1
        return 0

    _reanchor_stage1_urls(result1, url)

    stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + result1.get('input_tokens', 0)
    stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + result1.get('output_tokens', 0)

    page_type = result1['page_type']
    log.info(f"  Stage 1: {page_type} — {result1.get('notes', '')}")

    # エイジゲート → リダイレクト先で再分析
    if page_type == 'age_gate' and result1.get('redirect_url'):
        redirect_url = result1['redirect_url']
        html = fetch_page(redirect_url)
        if html:
            _cache.save("salon_top", f"{salon_id}_redirected", html)
            result1 = haiku_analyze_page(html, salon_display, redirect_url)
            if result1:
                _reanchor_stage1_urls(result1, redirect_url)
                stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + result1.get('input_tokens', 0)
                stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + result1.get('output_tokens', 0)
                page_type = result1['page_type']

    individual_urls = []
    listing_html = None
    listing_url_for_fallback = None

    # single_page でも individual_urls があれば has_individuals に補正
    if page_type == 'single_page' and result1.get('individual_urls'):
        from urllib.parse import urlparse as _urlparse
        salon_domain = _urlparse(url).netloc.lower()
        ext_urls = result1['individual_urls']
        all_external = all(_urlparse(u).netloc.lower() != salon_domain for u in ext_urls)
        if not all_external:
            page_type = 'has_individuals'

    if page_type == 'has_individuals':
        individual_urls = result1.get('individual_urls', [])

        # listing_url もあればマージ
        listing_url_extra = result1.get('listing_url')
        if listing_url_extra:
            list_html = fetch_page_smart(listing_url_extra, label="S2 LIST(補完): ")
            if list_html:
                _cache.save("salon_list", salon_id, list_html)
                listing_html = list_html
                listing_url_for_fallback = listing_url_extra
                # 3Days CMS チェック
                list_data_js_url = detect_3days_cms(list_html)
                if list_data_js_url:
                    js_text = fetch_page(list_data_js_url)
                    if js_text:
                        therapists = parse_3days_data_js(js_text, listing_url_extra, salon_name=salon_display)
                        count = 0
                        for t_data in therapists:
                            if t_data.get('source_url') in existing_urls:
                                continue
                            if not args.dry_run:
                                t_id = insert_therapist_new(cur, salon_id, t_data)
                                if t_id:
                                    count += 1
                            else:
                                count += 1
                        stats['inserted'] = stats.get('inserted', 0) + count
                        return count
                else:
                    result2 = haiku_analyze_page(list_html, salon_display, listing_url_extra)
                    if result2:
                        _reanchor_stage1_urls(result2, listing_url_extra)
                        stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + result2.get('input_tokens', 0)
                        stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + result2.get('output_tokens', 0)
                        existing_set = set(individual_urls)
                        for u in result2.get('individual_urls', []):
                            if u not in existing_set:
                                individual_urls.append(u)
                                existing_set.add(u)

    elif page_type == 'listing':
        listing_url = result1.get('listing_url')
        if listing_url:
            list_html = fetch_page_smart(listing_url, label="S2 LIST: ")
            if list_html:
                _cache.save("salon_list", salon_id, list_html)
                listing_html = list_html
                listing_url_for_fallback = listing_url
                # 3Days CMS チェック
                list_data_js_url = detect_3days_cms(list_html)
                if list_data_js_url:
                    js_text = fetch_page(list_data_js_url)
                    if js_text:
                        therapists = parse_3days_data_js(js_text, listing_url, salon_name=salon_display)
                        count = 0
                        for t_data in therapists:
                            if t_data.get('source_url') in existing_urls:
                                continue
                            if not args.dry_run:
                                t_id = insert_therapist_new(cur, salon_id, t_data)
                                if t_id:
                                    count += 1
                            else:
                                count += 1
                        stats['inserted'] = stats.get('inserted', 0) + count
                        return count

                result2 = haiku_analyze_page(list_html, salon_display, listing_url)
                if result2:
                    _reanchor_stage1_urls(result2, listing_url)
                    stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + result2.get('input_tokens', 0)
                    stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + result2.get('output_tokens', 0)
                    individual_urls = result2.get('individual_urls', [])

                # 個別URLなし → single_page fallback
                if not individual_urls and list_html:
                    therapists = haiku_extract_single_page(list_html, salon_display, listing_url)
                    count = 0
                    for t_data in therapists:
                        t_data['source_url'] = listing_url
                        stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + t_data.pop('input_tokens', 0)
                        stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + t_data.pop('output_tokens', 0)
                        if t_data.get('source_url') in existing_urls:
                            continue
                        if not args.dry_run:
                            t_id = insert_therapist_new(cur, salon_id, t_data)
                            if t_id:
                                count += 1
                        else:
                            count += 1
                    stats['inserted'] = stats.get('inserted', 0) + count
                    return count

    elif page_type == 'single_page':
        # TOPページ自体から一括抽出
        therapists = haiku_extract_single_page(html, salon_display, url)
        count = 0
        for t_data in therapists:
            t_data['source_url'] = url
            stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + t_data.pop('input_tokens', 0)
            stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + t_data.pop('output_tokens', 0)
            if t_data.get('source_url') in existing_urls:
                continue
            if not args.dry_run:
                t_id = insert_therapist_new(cur, salon_id, t_data)
                if t_id:
                    count += 1
            else:
                count += 1
        stats['inserted'] = stats.get('inserted', 0) + count
        return count

    elif page_type == 'no_therapists':
        return 0
    else:
        return 0

    # listing_html fallback: TOP page
    if listing_html is None:
        listing_html = html
        listing_url_for_fallback = url

    # --- URL補完: TOP+一覧の全HTMLから同パターンのURLを追加抽出 ---
    if individual_urls:
        html_sources = [h for h in [html, listing_html] if h]
        individual_urls = expand_individual_urls(html_sources, url, individual_urls)

    # --- ページネーション: 一覧ページにpage 2以降があれば全ページからURL収集 ---
    if individual_urls and listing_html and listing_url_for_fallback:
        individual_urls = fetch_paginated_listing(
            listing_html, listing_url_for_fallback,
            individual_urls, salon_name=salon_display
        )

    # --- プラットフォーム検知 + Wix外部URL除外 ---
    platform = detect_platform(url, html)
    if platform == 'wix' and individual_urls:
        salon_domain = urlparse(url).netloc.lower()
        internal_urls = [u for u in individual_urls
                         if urlparse(u).netloc.lower() == salon_domain
                         or salon_domain in urlparse(u).netloc.lower()]
        if not internal_urls:
            log.info(f"  Wix: 外部URLのみ ({len(individual_urls)}件) → single_page fallbackへ")
            individual_urls = []
        else:
            removed = len(individual_urls) - len(internal_urls)
            if removed > 0:
                log.info(f"  Wix: 外部URL {removed}件除外 → {len(internal_urls)}件")
            individual_urls = internal_urls

    # --- individual_urls の dedup + Stage 3 ---
    if not individual_urls:
        # 個別URLなし → 一覧ページからsingle_page抽出を試みる
        if listing_html:
            therapists = haiku_extract_single_page(listing_html, salon_display, listing_url_for_fallback)
            count = 0
            for t_data in therapists:
                t_data['source_url'] = listing_url_for_fallback
                stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + t_data.pop('input_tokens', 0)
                stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + t_data.pop('output_tokens', 0)
                if t_data.get('source_url') in existing_urls:
                    continue
                if not args.dry_run:
                    t_id = insert_therapist_new(cur, salon_id, t_data)
                    if t_id:
                        count += 1
                else:
                    count += 1
            stats['inserted'] = stats.get('inserted', 0) + count
            return count
        return 0

    # URLバリデーション
    individual_urls = [u for u in individual_urls if is_valid_therapist_url(u)]

    # source_url dedup
    if existing_urls:
        individual_urls = [u for u in individual_urls if u not in existing_urls]

    if not individual_urls:
        return 0

    # アンカーリンク検出 → single_page fallback
    anchor_urls = [u for u in individual_urls if '#' in u]
    if anchor_urls and len(anchor_urls) == len(individual_urls):
        base_url = individual_urls[0].split('#')[0]
        all_same_base = all(u.split('#')[0] == base_url for u in individual_urls)
        if all_same_base:
            anchor_html = fetch_page(base_url)
            if anchor_html:
                _cache.save("salon_list", f"{salon_id}_anchor", anchor_html)
                therapists = haiku_extract_single_page(anchor_html, salon_display, base_url)
                count = 0
                for t_data in therapists:
                    t_data['source_url'] = base_url
                    stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + t_data.pop('input_tokens', 0)
                    stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + t_data.pop('output_tokens', 0)
                    if not args.dry_run:
                        t_id = insert_therapist_new(cur, salon_id, t_data)
                        if t_id:
                            count += 1
                    else:
                        count += 1
                stats['inserted'] = stats.get('inserted', 0) + count
                return count

    # Stage 3: 個別ページ抽出
    salon_inserted = 0
    for t_url in individual_urls:
        if _shutdown:
            break

        t_html = fetch_page_smart(t_url, label="S3: ")
        if not t_html:
            stats['fetch_failed'] = stats.get('fetch_failed', 0) + 1
            continue

        try:
            data = extract_therapist_info(
                t_html,
                salon_name=salon_name,
                salon_display=salon_display,
                url=t_url,
            )
        except Exception:
            stats['extract_failed'] = stats.get('extract_failed', 0) + 1
            continue

        if not data or not data.get('name'):
            stats['skipped_no_name' if data else 'extract_failed'] = \
                stats.get('skipped_no_name' if data else 'extract_failed', 0) + 1
            continue

        stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + data.get('input_tokens', 0)
        stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + data.get('output_tokens', 0)

        data['source_url'] = t_url

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

        time.sleep(0.5)

    # --- Stage 3 全件失敗 → 一覧ページからsingle_page fallback ---
    if salon_inserted == 0 and listing_html:
        log.info("  Stage 3 全件失敗 → 一覧ページからsingle_page抽出")
        therapists = haiku_extract_single_page(listing_html, salon_display, listing_url_for_fallback)
        log.info(f"  single_page fallback: {len(therapists)} 名抽出")
        count = 0
        for t_data in therapists:
            t_data['source_url'] = listing_url_for_fallback
            stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + t_data.pop('input_tokens', 0)
            stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + t_data.pop('output_tokens', 0)
            if t_data.get('source_url') in existing_urls:
                continue
            if not args.dry_run:
                t_id = insert_therapist_new(cur, salon_id, t_data)
                if t_id:
                    count += 1
                    salon_inserted += 1
            else:
                count += 1
                salon_inserted += 1
        stats['inserted'] = stats.get('inserted', 0) + count

    return salon_inserted


def run_new(args):
    """--new モード: 全サロン統一差分スクレイピング

    2パス構成:
    1. therapist_list_url ありのサロン → ヒューリスティックURL抽出 → Haiku個別抽出
    2. therapist_list_url なしのサロン → 3段階Haikuフロー（TOP→一覧→個別）
    """
    cp_path = _checkpoint_path("new", args.start_id, args.end_id)
    checkpoint = load_checkpoint(cp_path) if args.resume else _default_checkpoint()
    done_ids = set(checkpoint['done_ids'])  # done salon_ids
    stats = checkpoint['stats']

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # --- パス1: therapist_list_url ありのサロン ---
    where_parts_h = ["c.therapist_list_url IS NOT NULL", "c.last_therapist_count > 0"]
    params_h = {}
    if args.start_id is not None:
        where_parts_h.append("c.salon_id >= %(start_id)s")
        params_h['start_id'] = args.start_id
    if args.end_id is not None:
        where_parts_h.append("c.salon_id < %(end_id)s")
        params_h['end_id'] = args.end_id

    where_sql_h = " AND ".join(where_parts_h)
    cur.execute(f"""
        SELECT DISTINCT ON (c.salon_id)
               c.salon_id, c.therapist_list_url,
               s.name AS salon_name, s.display_name AS salon_display,
               s.official_url
        FROM salon_scrape_cache c
        JOIN salons s ON s.id = c.salon_id
        WHERE {where_sql_h}
        ORDER BY c.salon_id
    """, params_h)
    heuristic_salons = cur.fetchall()

    # --- パス2: therapist_list_url なしのサロン（3段階Haiku対象）---
    where_parts_f = ["s.official_url IS NOT NULL"]
    params_f = {}
    if args.start_id is not None:
        where_parts_f.append("s.id >= %(start_id)s")
        params_f['start_id'] = args.start_id
    if args.end_id is not None:
        where_parts_f.append("s.id < %(end_id)s")
        params_f['end_id'] = args.end_id

    where_sql_f = " AND ".join(where_parts_f)
    cur.execute(f"""
        SELECT s.id AS salon_id, s.name AS salon_name,
               s.display_name AS salon_display, s.official_url,
               NULL::text AS therapist_list_url
        FROM salons s
        WHERE {where_sql_f}
          AND s.id NOT IN (
              SELECT DISTINCT c2.salon_id
              FROM salon_scrape_cache c2
              WHERE c2.therapist_list_url IS NOT NULL
                AND c2.last_therapist_count > 0
          )
        ORDER BY s.id
    """, params_f)
    haiku_salons = cur.fetchall()

    # 統合 (ヒューリスティック → Haiku の順)
    all_salons = list(heuristic_salons) + list(haiku_salons)

    if args.limit:
        all_salons = all_salons[:args.limit]

    # 処理済みスキップ
    all_salons = [s for s in all_salons if s['salon_id'] not in done_ids]

    total = len(all_salons)
    heuristic_count = sum(1 for s in all_salons if s.get('therapist_list_url'))
    haiku_count = total - heuristic_count
    log.info(f"--new モード: 対象サロン {total} 件 (ヒューリスティック {heuristic_count} / Haiku {haiku_count})")

    if not total:
        log.info("処理対象が0件のため終了")
        conn.close()
        return

    if not stats.get('started_at'):
        stats['started_at'] = datetime.now().isoformat()

    start_time = time.time()
    batch_count = 0

    for idx, salon in enumerate(all_salons):
        if _shutdown:
            log.info("シャットダウン — チェックポイント保存中...")
            break

        salon_id = salon['salon_id']
        salon_display = salon.get('salon_display') or salon.get('salon_name') or ''
        list_url = salon.get('therapist_list_url')

        # パス分岐
        if list_url:
            salon_inserted = _process_heuristic_salon(cur, salon, args, stats, _shutdown)
        else:
            salon_inserted = _process_haiku_salon(cur, salon, args, stats, _shutdown)

        done_ids.add(salon_id)
        stats['processed'] = stats.get('processed', 0) + 1
        batch_count += 1

        if salon_inserted > 0:
            mode = "H" if list_url else "LLM"
            log.info(f"[{idx + 1}/{total}] [{mode}] {salon_display}: +{salon_inserted}名")

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
