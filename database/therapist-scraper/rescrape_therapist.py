#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
セラピストデータ品質改善ツール

データ欠損セラピストを特定し、所属サロンを再スクレイピングして修復。
batch_extract_therapist_info.py の _process_haiku_salon() を upsert モードで呼び出す。

Usage:
  # 特定サロンを再スクレイピング
  python rescrape_therapist.py --salon-ids 29,1234

  # 画像欠損セラピストの所属サロンを再スクレイピング
  python rescrape_therapist.py --missing-images --limit 50

  # プロフィール欠損セラピストの所属サロンを再スクレイピング
  python rescrape_therapist.py --missing-profile --limit 50

  # 一覧URLのままのセラピストの所属サロンを再スクレイピング
  python rescrape_therapist.py --fix-listing-urls --limit 50

  # ドライラン（DB書き込みなし）
  python rescrape_therapist.py --missing-images --limit 5 --dry-run
"""

import argparse
import logging
import os
import signal
import sys
import time
from datetime import timedelta

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

sys.path.insert(0, os.path.dirname(__file__))
from batch_extract_therapist_info import (
    _process_haiku_salon, DB_DSN, save_checkpoint, _default_checkpoint,
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(
            os.path.join(os.path.dirname(__file__), 'rescrape_therapist.log'),
            encoding='utf-8'),
        logging.StreamHandler(),
    ]
)
log = logging.getLogger(__name__)

_shutdown = False


def _handle_sigint(signum, frame):
    global _shutdown
    _shutdown = True
    log.info("\nSIGINT受信 — 現バッチ完了後に終了します...")


signal.signal(signal.SIGINT, _handle_sigint)

# 一覧ページを示すパスパターン
_LISTING_PATH_KEYWORDS = (
    '/cast', '/staff', '/therapist', '/girl', '/member',
    '/schedule', '/list', '/escort',
)


def _get_target_salon_ids(cur, args):
    """修復対象のsalon_idリストを取得"""
    if args.salon_ids:
        return [int(x.strip()) for x in args.salon_ids.split(',')]

    if args.missing_images:
        cur.execute("""
            SELECT DISTINCT t.salon_id
            FROM therapists t
            JOIN salons s ON s.id = t.salon_id
            WHERE s.official_url IS NOT NULL
              AND t.status = 'active'
              AND (t.image_urls IS NULL OR t.image_urls = '[]'::jsonb)
            ORDER BY t.salon_id
        """)
    elif args.missing_profile:
        cur.execute("""
            SELECT DISTINCT t.salon_id
            FROM therapists t
            JOIN salons s ON s.id = t.salon_id
            WHERE s.official_url IS NOT NULL
              AND t.status = 'active'
              AND t.profile_text IS NULL
            ORDER BY t.salon_id
        """)
    elif args.fix_listing_urls:
        # source_urlが一覧ページのパスを含むセラピストの所属サロン
        like_clauses = " OR ".join(
            f"t.source_url LIKE '%{kw}%'" for kw in _LISTING_PATH_KEYWORDS
        )
        cur.execute(f"""
            SELECT DISTINCT t.salon_id
            FROM therapists t
            JOIN salons s ON s.id = t.salon_id
            WHERE s.official_url IS NOT NULL
              AND t.status = 'active'
              AND t.source_url IS NOT NULL
              AND ({like_clauses})
            ORDER BY t.salon_id
        """)
    else:
        log.error("対象指定が必要です: --salon-ids, --missing-images, --missing-profile, --fix-listing-urls")
        return []

    rows = cur.fetchall()
    ids = [r['salon_id'] for r in rows]
    return ids


def main():
    parser = argparse.ArgumentParser(description='セラピストデータ品質改善ツール')

    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument('--salon-ids', type=str,
                        help='カンマ区切りサロンID（例: 29,1234）')
    target.add_argument('--missing-images', action='store_true',
                        help='画像欠損セラピストの所属サロンを再スクレイピング')
    target.add_argument('--missing-profile', action='store_true',
                        help='プロフィール欠損セラピストの所属サロンを再スクレイピング')
    target.add_argument('--fix-listing-urls', action='store_true',
                        help='一覧URLのままのセラピストの所属サロンを再スクレイピング')

    parser.add_argument('--limit', type=int, default=0,
                        help='対象サロン数制限')
    parser.add_argument('--dry-run', action='store_true',
                        help='DB書き込みスキップ')
    parser.add_argument('--batch-size', type=int, default=20,
                        help='コミット間隔（default: 20）')

    args = parser.parse_args()

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    salon_ids = _get_target_salon_ids(cur, args)
    if not salon_ids:
        log.info("対象サロンが0件のため終了")
        conn.close()
        return

    if args.limit:
        salon_ids = salon_ids[:args.limit]

    log.info("=" * 60)
    log.info(" セラピストデータ品質改善ツール")
    log.info(f" 対象サロン: {len(salon_ids)} 件 (mode=upsert)")
    log.info(f" dry_run={args.dry_run}")
    log.info("=" * 60)

    # サロン情報を取得
    cur.execute("""
        SELECT s.id AS salon_id, s.name AS salon_name,
               s.display_name AS salon_display, s.official_url
        FROM salons s
        WHERE s.id IN %s AND s.official_url IS NOT NULL
        ORDER BY s.id
    """, (tuple(salon_ids),))
    salons = cur.fetchall()

    stats = _default_checkpoint()['stats']
    start_time = time.time()
    batch_count = 0

    for idx, salon in enumerate(salons):
        if _shutdown:
            break

        salon_id = salon['salon_id']
        salon_display = salon.get('salon_display') or salon.get('salon_name') or ''

        salon_inserted = _process_haiku_salon(cur, salon, args, stats, _shutdown, mode='upsert')

        stats['processed'] = stats.get('processed', 0) + 1
        batch_count += 1

        if salon_inserted > 0:
            log.info(f"[{idx + 1}/{len(salons)}] {salon_display}: +{salon_inserted}名")

        if batch_count >= args.batch_size:
            if not args.dry_run:
                conn.commit()
            batch_count = 0

    if not args.dry_run:
        conn.commit()

    elapsed = timedelta(seconds=int(time.time() - start_time))
    log.info(f"\n{'=' * 60}")
    log.info(f" 品質改善完了 ({elapsed})")
    log.info(f"{'=' * 60}")
    log.info(f"  サロン処理:    {stats.get('processed', 0)} 件")
    log.info(f"  INSERT成功:    {stats.get('inserted', 0)} 件")
    log.info(f"  UPDATE成功:    {stats.get('updated', 0)} 件")
    log.info(f"  退職検知:      {stats.get('retired', 0)} 件")
    log.info(f"  fetch失敗:     {stats.get('fetch_failed', 0)} 件")
    log.info(f"  extract失敗:   {stats.get('extract_failed', 0)} 件")
    log.info(f"  入力トークン:  {stats.get('total_input_tokens', 0):,}")
    log.info(f"  出力トークン:  {stats.get('total_output_tokens', 0):,}")

    conn.close()


if __name__ == '__main__':
    main()
