#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
定期再スクレイピングスクリプト

last_scraped_at が古いサロンを自動的に再スクレイピングし、
セラピストデータの更新・退職検知を行う。

Usage:
  # 7日以上未更新のサロンを再スクレイピング
  python periodic_rescrape.py --stale-days 7 --limit 200

  # 14日以上未更新（デフォルト）
  python periodic_rescrape.py

  # last_scraped_at が NULL のサロン（一度もスクレイプされていない）
  python periodic_rescrape.py --never-scraped --limit 100

  # ドライラン
  python periodic_rescrape.py --stale-days 7 --limit 5 --dry-run
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
    _process_haiku_salon, DB_DSN, _default_checkpoint,
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(
            os.path.join(os.path.dirname(__file__), 'periodic_rescrape.log'),
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


def main():
    parser = argparse.ArgumentParser(description='定期再スクレイピング')

    parser.add_argument('--stale-days', type=int, default=14,
                        help='この日数以上未更新のサロンを対象 (default: 14)')
    parser.add_argument('--never-scraped', action='store_true',
                        help='last_scraped_at が NULL のサロンのみ対象')
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

    if args.never_scraped:
        cur.execute("""
            SELECT s.id AS salon_id, s.name AS salon_name,
                   s.display_name AS salon_display, s.official_url
            FROM salons s
            WHERE s.official_url IS NOT NULL
              AND s.last_scraped_at IS NULL
            ORDER BY s.id
        """)
        label = "未スクレイプ"
    else:
        cur.execute("""
            SELECT s.id AS salon_id, s.name AS salon_name,
                   s.display_name AS salon_display, s.official_url
            FROM salons s
            WHERE s.official_url IS NOT NULL
              AND (s.last_scraped_at IS NULL
                   OR s.last_scraped_at < now() - interval '%s days')
            ORDER BY s.last_scraped_at NULLS FIRST, s.id
        """, (args.stale_days,))
        label = f"{args.stale_days}日以上未更新"

    salons = cur.fetchall()

    if args.limit:
        salons = salons[:args.limit]

    if not salons:
        log.info(f"{label}のサロンが0件のため終了")
        conn.close()
        return

    log.info("=" * 60)
    log.info(" 定期再スクレイピング")
    log.info(f" 対象: {label} — {len(salons)} 件 (mode=upsert)")
    log.info(f" dry_run={args.dry_run}")
    log.info("=" * 60)

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
    log.info(f" 定期再スクレイピング完了 ({elapsed})")
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
