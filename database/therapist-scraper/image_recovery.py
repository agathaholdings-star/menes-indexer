#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
画像リカバリースクリプト

画像なし/外部URLのセラピストに対して、source_urlを再訪問→画像抽出→Storage保存→DB更新。
/site-audit スキルから呼ばれることを想定。単体でも使用可能。

Usage:
  # 単体リカバリー（IDと画像URLを直接指定）
  python image_recovery.py --id 12345 --urls "https://example.com/img1.jpg,https://example.com/img2.jpg"

  # DBスキャン→自動リカバリー
  python image_recovery.py --scan --limit 100 --dry-run
  python image_recovery.py --scan --workers 5 --resume

  # バッチリカバリー（CSVから）
  python image_recovery.py --csv recovery_targets.csv

  # DB画像状態レポート
  python image_recovery.py --audit

  # 対象絞り込み
  python image_recovery.py --scan --target empty     # 画像なしのみ
  python image_recovery.py --scan --target external  # 外部URLのみ

前提:
  - database/.env に DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  - therapist-images バケットが作成済み
"""

import argparse
import csv
import json
import logging
import os
import signal
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from urllib.parse import urljoin

import psycopg2
import psycopg2.extras
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# .env読み込み
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
sys.path.insert(0, os.path.dirname(__file__))

# 既存モジュール再利用
from batch_download_images import (
    download_image, optimize_image, upload_to_storage, get_public_url,
    STORAGE_BUCKET, SUPABASE_URL, SUPABASE_SERVICE_KEY
)
from fetch_utils import fetch_page
from html_cache_utils import HtmlCache
from test_image_extract import collect_image_candidates

# --- 設定 ---
DB_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
SCRIPT_DIR = os.path.dirname(__file__)

# ログ
LOG_FILE = os.path.join(SCRIPT_DIR, 'image_recovery.log')
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

# HTMLキャッシュ
_cache = HtmlCache()

# 画像抽出用キーワード
_IMAGE_KEYWORDS = ['cast', 'therapist', 'girl', 'staff', 'item', 'profile', 'member', 'photo']
_EXCLUDE_KEYWORDS = ['logo', 'icon', 'banner', 'noimage', 'spacer', 'loading', 'coming',
                      'arrow', 'button', 'sns', 'twitter', 'line', 'instagram']


# =============================================================================
# チェックポイント
# =============================================================================

def _checkpoint_path(mode, start_id=None, end_id=None):
    suffix = f"_{start_id}_{end_id}" if start_id is not None else ""
    return os.path.join(SCRIPT_DIR, f"image_recovery_{mode}_checkpoint{suffix}.json")


def _default_stats():
    return {
        'processed': 0,
        'recovered': 0,
        'no_source_url': 0,
        'fetch_failed': 0,
        'no_images_found': 0,
        'dl_failed': 0,
        'total_images_uploaded': 0,
        'total_bytes': 0,
        'started_at': None,
        'last_updated': None,
    }


def load_checkpoint(path):
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {'done_ids': [], 'stats': _default_stats()}


def save_checkpoint(checkpoint, path):
    checkpoint['stats']['last_updated'] = datetime.now().isoformat()
    with open(path, 'w') as f:
        json.dump(checkpoint, f, ensure_ascii=False, indent=2)


# =============================================================================
# 画像抽出ロジック
# =============================================================================

def extract_images_from_html(html: str, base_url: str, therapist_name: str = "") -> list[str]:
    """
    HTMLからセラピスト画像URLを抽出する。

    Strategy:
    1. キーワードマッチ（cast, therapist, girl等がURLに含まれる）
    2. alt属性にセラピスト名が含まれる
    3. スコアリング方式（上記で0件の場合、collect_image_candidates + スコア付け）

    Returns: 画像URLリスト（最大5件）
    """
    soup = BeautifulSoup(html, 'html.parser')

    # === Step 1: キーワードマッチ ===
    image_urls = []
    for img in soup.find_all('img'):
        src = img.get('src') or img.get('data-src') or img.get('data-lazy-src') or ''
        if not src or src.startswith('data:'):
            continue
        src_full = urljoin(base_url, src)
        src_lower = src_full.lower()

        if any(kw in src_lower for kw in _IMAGE_KEYWORDS):
            image_urls.append(src_full)
        elif therapist_name and therapist_name in (img.get('alt') or ''):
            image_urls.append(src_full)

    # 除外フィルタ + 最大5枚
    image_urls = [u for u in image_urls
                  if not any(ex in u.lower() for ex in _EXCLUDE_KEYWORDS)][:5]

    if image_urls:
        return image_urls

    # === Step 2: スコアリング方式（キーワードマッチで0件の場合）===
    candidates = collect_image_candidates(html, base_url)
    if not candidates:
        return []

    scored = []
    for c in candidates:
        url_lower = c['url'].lower()
        score = 0

        # URLパスにプロフィール系キーワード
        if any(kw in url_lower for kw in _IMAGE_KEYWORDS):
            score += 3

        # 除外キーワード
        if any(ex in url_lower for ex in _EXCLUDE_KEYWORDS):
            score -= 5

        # 親要素のclass/idにプロフィール系
        context = (c.get('parent', '') + c.get('grandparent', '')).lower()
        if any(kw in context for kw in ['profile', 'cast', 'detail', 'main', 'content', 'photo']):
            score += 2

        # alt属性にセラピスト名
        if therapist_name and therapist_name in c.get('alt', ''):
            score += 2

        # サイズヒント（小さすぎるものを除外）
        w = c.get('width', '')
        if w and w.isdigit() and int(w) < 50:
            score -= 3

        scored.append((score, c['url']))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [url for score, url in scored if score >= 2][:5]


def extract_images_from_list_page(list_html: str, list_url: str,
                                  therapist_name: str,
                                  therapist_source_url: str = "") -> list[str]:
    """
    サロンのキャスト一覧ページからセラピストのサムネイル画像を抽出する。
    source_urlまたはセラピスト名でマッチング。

    Returns: [image_url] or []
    """
    soup = BeautifulSoup(list_html, 'html.parser')

    for a_tag in soup.find_all('a', href=True):
        href = urljoin(list_url, a_tag['href'])

        # source_urlでマッチ
        matched = False
        if therapist_source_url and therapist_source_url in href:
            matched = True
        # 名前でマッチ（aタグ内テキスト）
        elif therapist_name and therapist_name in a_tag.get_text():
            matched = True

        if not matched:
            continue

        # このリンク内の画像を取得
        img = a_tag.find('img')
        if img:
            src = img.get('src') or img.get('data-src') or img.get('data-lazy-src') or ''
            if src and not src.startswith('data:'):
                full_url = urljoin(list_url, src)
                if not any(ex in full_url.lower() for ex in _EXCLUDE_KEYWORDS):
                    return [full_url]

    return []


# =============================================================================
# リカバリー処理
# =============================================================================

def recover_one_therapist(t: dict) -> dict:
    """
    1セラピストの画像リカバリーを試みる。

    Returns:
        {
            'therapist_id': int,
            'status': 'recovered' | 'no_source_url' | 'fetch_failed' |
                      'no_images_found' | 'dl_failed' | 'error',
            'new_urls': [...],
            'images_found': int,
            'images_uploaded': int,
            'source': 'cache' | 'profile' | 'list_page' | None,
            'error': str | None,
        }
    """
    tid = t['id']
    salon_id = t['salon_id']
    source_url = t.get('source_url') or ''
    name = t.get('name', '')
    list_url = t.get('therapist_list_url') or ''

    result = {
        'therapist_id': tid,
        'status': 'error',
        'new_urls': [],
        'images_found': 0,
        'images_uploaded': 0,
        'source': None,
        'error': None,
    }

    try:
        # === Step 1: HTMLを取得（キャッシュ優先） ===
        html = None
        source = None

        # キャッシュ確認
        cached = _cache.load('therapist', tid)
        if cached:
            html = cached
            source = 'cache'

        # source_urlからfetch
        if not html and source_url:
            html = fetch_page(source_url)
            if html:
                _cache.save('therapist', tid, html)
                source = 'profile'

        if not html and not source_url:
            result['status'] = 'no_source_url'
            return result

        # === Step 2: 画像URL抽出 ===
        image_urls = []
        if html:
            image_urls = extract_images_from_html(html, source_url or '', name)

        # === Step 3: 一覧ページフォールバック ===
        if not image_urls and list_url:
            list_html = _cache.load('salon_list', salon_id)
            if not list_html:
                list_html = fetch_page(list_url)
                if list_html:
                    _cache.save('salon_list', salon_id, list_html)
            if list_html:
                image_urls = extract_images_from_list_page(
                    list_html, list_url, name, source_url)
                if image_urls:
                    source = 'list_page'

        if not html and not image_urls:
            result['status'] = 'fetch_failed'
            return result

        if not image_urls:
            result['status'] = 'no_images_found'
            return result

        result['images_found'] = len(image_urls)
        result['source'] = source

        # === Step 4: 画像DL→Storage保存 ===
        new_urls = []
        total_bytes = 0
        for idx, url in enumerate(image_urls[:5]):
            data, ct = download_image(url)
            if data is None:
                continue

            storage_path = f"{salon_id}/{tid}/{idx + 1:03d}.webp"
            if upload_to_storage(data, storage_path, ct):
                new_urls.append(get_public_url(storage_path))
                total_bytes += len(data)

        result['images_uploaded'] = len(new_urls)
        result['new_urls'] = new_urls

        if new_urls:
            result['status'] = 'recovered'
            result['total_bytes'] = total_bytes
        else:
            result['status'] = 'dl_failed'

    except Exception as e:
        result['status'] = 'error'
        result['error'] = str(e)
        log.debug(f"  error processing therapist {tid}: {e}")

    return result


def _update_db(updates: list[tuple[list[str], int]]):
    """DB一括更新: [(new_urls, therapist_id), ...]"""
    if not updates:
        return
    try:
        conn = psycopg2.connect(DB_DSN)
        conn.autocommit = True
        with conn.cursor() as cur:
            for new_urls, tid in updates:
                cur.execute(
                    "UPDATE therapists SET image_urls = %s::jsonb, updated_at = now() WHERE id = %s",
                    (json.dumps(new_urls, ensure_ascii=False), tid)
                )
        conn.close()
    except Exception as e:
        log.error(f"DB更新エラー: {e}")
        # 1件ずつリトライ
        for new_urls, tid in updates:
            try:
                conn = psycopg2.connect(DB_DSN)
                conn.autocommit = True
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE therapists SET image_urls = %s::jsonb, updated_at = now() WHERE id = %s",
                        (json.dumps(new_urls, ensure_ascii=False), tid)
                    )
                conn.close()
            except Exception as e2:
                log.error(f"  DB更新失敗 (id={tid}): {e2}")


# =============================================================================
# 各モード
# =============================================================================

def cmd_audit(args):
    """DB画像状態レポート"""
    conn = psycopg2.connect(DB_DSN)
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT
              CASE
                WHEN image_urls IS NULL OR image_urls = 'null'::jsonb THEN 'null'
                WHEN image_urls = '[]'::jsonb THEN 'empty'
                WHEN image_urls::text LIKE '%%therapist-images%%' THEN 'storage_ok'
                ELSE 'external_only'
              END AS image_status,
              COUNT(*) AS cnt
            FROM therapists
            WHERE status = 'active'
            GROUP BY 1
            ORDER BY 2 DESC
        """)
        rows = cur.fetchall()

    conn.close()

    print("\n=== 画像状態レポート ===")
    total = 0
    for r in rows:
        print(f"  {r['image_status']:15s}: {r['cnt']:,}")
        total += r['cnt']
    print(f"  {'total':15s}: {total:,}")
    print()


def cmd_single(args):
    """単体リカバリー: --id + --urls"""
    tid = args.id
    urls = [u.strip() for u in args.urls.split(',') if u.strip()]

    if not urls:
        print("エラー: --urls に画像URLを指定してください")
        return

    # salon_idを取得
    conn = psycopg2.connect(DB_DSN)
    with conn.cursor() as cur:
        cur.execute("SELECT salon_id FROM therapists WHERE id = %s", (tid,))
        row = cur.fetchone()
    conn.close()

    if not row:
        print(f"エラー: therapist id={tid} が見つかりません")
        return

    salon_id = row[0]
    new_urls = []

    for idx, url in enumerate(urls[:5]):
        log.info(f"DL: {url}")
        data, ct = download_image(url)
        if data is None:
            log.warning(f"  DL失敗: {url}")
            continue

        storage_path = f"{salon_id}/{tid}/{idx + 1:03d}.webp"
        if upload_to_storage(data, storage_path, ct):
            pub_url = get_public_url(storage_path)
            new_urls.append(pub_url)
            log.info(f"  → {pub_url}")
        else:
            log.warning(f"  Upload失敗: {storage_path}")

    if not new_urls:
        print("画像を1件も保存できませんでした")
        return

    if args.dry_run:
        print(f"[dry-run] DB更新スキップ: id={tid}, urls={new_urls}")
    else:
        _update_db([(new_urls, tid)])
        print(f"DB更新完了: id={tid}, {len(new_urls)}件")


def cmd_scan(args):
    """DBスキャン→自動リカバリー"""
    # チェックポイント
    cp_path = _checkpoint_path('scan', args.start_id, args.end_id)
    checkpoint = load_checkpoint(cp_path) if args.resume else {'done_ids': [], 'stats': _default_stats()}
    done_set = set(checkpoint['done_ids'])
    stats = checkpoint['stats']

    if not stats['started_at']:
        stats['started_at'] = datetime.now().isoformat()

    # --- 対象セラピスト取得 ---
    conn = psycopg2.connect(DB_DSN)
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        where_parts = ["t.status = 'active'"]

        if args.target == 'empty':
            where_parts.append("(t.image_urls IS NULL OR t.image_urls = '[]'::jsonb OR t.image_urls = 'null'::jsonb)")
        elif args.target == 'external':
            where_parts.append("""
                t.image_urls IS NOT NULL
                AND t.image_urls != '[]'::jsonb
                AND t.image_urls != 'null'::jsonb
                AND NOT (t.image_urls::text LIKE '%%therapist-images%%')
            """)
        else:  # all
            where_parts.append("""
                (t.image_urls IS NULL
                 OR t.image_urls = '[]'::jsonb
                 OR t.image_urls = 'null'::jsonb
                 OR NOT (t.image_urls::text LIKE '%%therapist-images%%'))
            """)

        if args.start_id is not None:
            where_parts.append(f"t.id >= {args.start_id}")
        if args.end_id is not None:
            where_parts.append(f"t.id < {args.end_id}")

        where_clause = " AND ".join(where_parts)
        limit_clause = f"LIMIT {args.limit}" if args.limit else ""

        cur.execute(f"""
            SELECT t.id, t.name, t.salon_id, t.source_url, t.image_urls,
                   s.name AS salon_name, s.official_url,
                   sc.therapist_list_url
            FROM therapists t
            JOIN salons s ON s.id = t.salon_id
            LEFT JOIN salon_scrape_cache sc ON sc.salon_id = t.salon_id
            WHERE {where_clause}
            ORDER BY t.id
            {limit_clause}
        """)
        therapists = cur.fetchall()
    conn.close()

    # done_idsを除外
    therapists = [t for t in therapists if t['id'] not in done_set]
    total = len(therapists)
    log.info(f"対象セラピスト: {total:,}名 (target={args.target})")

    if total == 0:
        print("対象なし")
        return

    # --- CSV出力準備 ---
    csv_path = os.path.join(SCRIPT_DIR, args.output)
    csv_file = open(csv_path, 'w', newline='', encoding='utf-8')
    writer = csv.DictWriter(csv_file, fieldnames=[
        'id', 'name', 'salon_id', 'source_url', 'status',
        'images_found', 'images_uploaded', 'source', 'error'
    ])
    writer.writeheader()

    # --- バッチ処理 ---
    batch_size = args.batch_size
    workers = args.workers

    for batch_start in range(0, total, batch_size):
        if _shutdown:
            break

        batch = therapists[batch_start:batch_start + batch_size]
        results = []

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {executor.submit(recover_one_therapist, t): t for t in batch}
            for future in as_completed(futures):
                if _shutdown:
                    break
                try:
                    result = future.result(timeout=120)
                    results.append(result)
                except Exception as e:
                    t = futures[future]
                    results.append({
                        'therapist_id': t['id'],
                        'status': 'error',
                        'new_urls': [],
                        'images_found': 0,
                        'images_uploaded': 0,
                        'source': None,
                        'error': str(e),
                    })

        # --- DB更新 + 統計 ---
        db_updates = []
        for r in results:
            stats['processed'] += 1
            stats[r['status']] = stats.get(r['status'], 0) + 1
            stats['total_images_uploaded'] += r['images_uploaded']
            stats['total_bytes'] += r.get('total_bytes', 0)
            checkpoint['done_ids'].append(r['therapist_id'])

            if r['new_urls'] and not args.dry_run:
                db_updates.append((r['new_urls'], r['therapist_id']))

            # CSV書き込み
            writer.writerow({
                'id': r['therapist_id'],
                'name': '',  # privacy
                'salon_id': '',
                'source_url': '',
                'status': r['status'],
                'images_found': r['images_found'],
                'images_uploaded': r['images_uploaded'],
                'source': r['source'] or '',
                'error': r['error'] or '',
            })

        if db_updates:
            _update_db(db_updates)

        # チェックポイント保存
        save_checkpoint(checkpoint, cp_path)

        # 進捗ログ
        done = batch_start + len(batch)
        pct = done / total * 100 if total else 0
        log.info(
            f"進捗: {done:,}/{total:,} ({pct:.1f}%) | "
            f"recovered={stats.get('recovered', 0)} "
            f"no_images={stats.get('no_images_found', 0)} "
            f"dl_failed={stats.get('dl_failed', 0)} "
            f"fetch_failed={stats.get('fetch_failed', 0)}"
        )

    csv_file.close()

    # --- サマリー ---
    print(f"\n=== リカバリー結果 ===")
    for key, val in stats.items():
        if key in ('started_at', 'last_updated'):
            continue
        print(f"  {key}: {val:,}" if isinstance(val, int) else f"  {key}: {val}")
    print(f"\nCSVレポート: {csv_path}")
    print(f"チェックポイント: {cp_path}")


def cmd_csv(args):
    """CSVからバッチリカバリー"""
    csv_path = args.csv
    if not os.path.exists(csv_path):
        print(f"エラー: {csv_path} が見つかりません")
        return

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    log.info(f"CSV読み込み: {len(rows)}件")

    # salon_idを一括取得
    ids = [int(r['id']) for r in rows if r.get('id')]
    conn = psycopg2.connect(DB_DSN)
    with conn.cursor() as cur:
        cur.execute("SELECT id, salon_id FROM therapists WHERE id = ANY(%s)", (ids,))
        id_to_salon = dict(cur.fetchall())
    conn.close()

    success = 0
    for row in rows:
        tid = int(row['id'])
        salon_id = id_to_salon.get(tid)
        if not salon_id:
            log.warning(f"therapist {tid} not found in DB")
            continue

        # URLカラム: url1, url2, ... or urls (comma-separated)
        urls = []
        if 'urls' in row:
            urls = [u.strip() for u in row['urls'].split(',') if u.strip()]
        else:
            for key in sorted(row.keys()):
                if key.startswith('url') and key != 'id' and row[key]:
                    urls.append(row[key].strip())

        if not urls:
            continue

        new_urls = []
        for idx, url in enumerate(urls[:5]):
            data, ct = download_image(url)
            if data is None:
                continue
            storage_path = f"{salon_id}/{tid}/{idx + 1:03d}.webp"
            if upload_to_storage(data, storage_path, ct):
                new_urls.append(get_public_url(storage_path))

        if new_urls and not args.dry_run:
            _update_db([(new_urls, tid)])
            success += 1
            log.info(f"  id={tid}: {len(new_urls)}件保存")

    print(f"\n完了: {success}/{len(rows)}件リカバリー成功")


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='画像リカバリースクリプト',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest='mode')

    # audit
    p_audit = sub.add_parser('audit', help='DB画像状態レポート')

    # single
    p_single = sub.add_parser('single', help='単体リカバリー')
    p_single.add_argument('--id', type=int, required=True, help='therapist ID')
    p_single.add_argument('--urls', type=str, required=True, help='画像URL（カンマ区切り）')
    p_single.add_argument('--dry-run', action='store_true')

    # scan
    p_scan = sub.add_parser('scan', help='DBスキャン→自動リカバリー')
    p_scan.add_argument('--workers', type=int, default=5)
    p_scan.add_argument('--batch-size', type=int, default=100)
    p_scan.add_argument('--start-id', type=int, default=None)
    p_scan.add_argument('--end-id', type=int, default=None)
    p_scan.add_argument('--resume', action='store_true')
    p_scan.add_argument('--dry-run', action='store_true')
    p_scan.add_argument('--limit', type=int, default=0)
    p_scan.add_argument('--target', choices=['all', 'external', 'empty'], default='all')
    p_scan.add_argument('--output', default='image_recovery_report.csv')

    # csv
    p_csv = sub.add_parser('csv', help='CSVからバッチリカバリー')
    p_csv.add_argument('--csv', type=str, required=True, help='入力CSVパス')
    p_csv.add_argument('--dry-run', action='store_true')

    # -- 後方互換: サブコマンドなしでも動くように --
    # --audit / --id / --scan / --csv で直接呼べるようにする
    parser.add_argument('--audit', action='store_true', help='DB画像状態レポート')
    parser.add_argument('--id', type=int, help='therapist ID（単体リカバリー）')
    parser.add_argument('--urls', type=str, help='画像URL（単体リカバリー、カンマ区切り）')
    parser.add_argument('--scan', action='store_true', help='DBスキャン→自動リカバリー')
    parser.add_argument('--csv', type=str, help='CSVからバッチリカバリー')
    parser.add_argument('--workers', type=int, default=5)
    parser.add_argument('--batch-size', type=int, default=100)
    parser.add_argument('--start-id', type=int, default=None)
    parser.add_argument('--end-id', type=int, default=None)
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--target', choices=['all', 'external', 'empty'], default='all')
    parser.add_argument('--output', default='image_recovery_report.csv')

    args = parser.parse_args()

    # サブコマンド or フラグ
    if args.mode == 'audit' or args.audit:
        cmd_audit(args)
    elif args.mode == 'single' or (args.id and args.urls):
        cmd_single(args)
    elif args.mode == 'scan' or args.scan:
        cmd_scan(args)
    elif args.mode == 'csv' or (hasattr(args, 'csv') and args.csv):
        cmd_csv(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
