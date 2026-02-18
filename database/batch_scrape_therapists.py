#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全サロン一括セラピストスクレイピング → ローカルSupabase投入

実行:
  python database/batch_scrape_therapists.py                    # 全サロン（Smart Scraper）
  python database/batch_scrape_therapists.py --limit 5          # 最初の5サロン
  python database/batch_scrape_therapists.py --resume            # チェックポイントから再開
  python database/batch_scrape_therapists.py --dry-run           # DB投入せず確認のみ
  python database/batch_scrape_therapists.py --max-per-salon 10  # サロンあたり最大10名
  python database/batch_scrape_therapists.py --llm-only          # LLMのみ（従来動作）

前提:
  - supabase start 済み (127.0.0.1:54322)
  - database/.env に ANTHROPIC_API_KEY 設定済み
  - shops テーブルにデータが入っている（batch_scrape_shops.py 実行済み）
  - pip: psycopg2-binary, requests, beautifulsoup4, anthropic, python-dotenv
"""

import os
import sys
import json
import time
import argparse
import logging
from datetime import datetime, timedelta

import psycopg2
import psycopg2.extras

from dotenv import load_dotenv

# .env読み込み
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# スクレイパーをimport
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'therapist-scraper'))
from therapist_scraper import TherapistScraper
from smart_scraper import SmartScraper

# --- 設定 ---
DB_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# チェックポイントファイル
CHECKPOINT_FILE = os.path.join(os.path.dirname(__file__), 'batch_therapist_checkpoint.json')

# ログ設定
LOG_FILE = os.path.join(os.path.dirname(__file__), 'batch_therapist.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)


# =============================================================================
# チェックポイント管理
# =============================================================================

def load_checkpoint():
    """チェックポイント読み込み"""
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, 'r') as f:
            return json.load(f)
    return {'completed_shop_ids': [], 'stats': {
        'total_shops': 0, 'total_therapists': 0, 'errors': [],
        'started_at': None, 'last_updated': None
    }}


def save_checkpoint(checkpoint):
    """チェックポイント保存"""
    checkpoint['stats']['last_updated'] = datetime.now().isoformat()
    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump(checkpoint, f, ensure_ascii=False, indent=2)


# =============================================================================
# DB操作
# =============================================================================

def get_target_shops(cur, limit=0, failed_only=False, start_id=0, end_id=0):
    """official_urlを持つサロン一覧を取得"""
    if failed_only:
        # Phase③: セラピスト未取得の店舗のみ
        query = """
            SELECT s.id, s.name, s.display_name, s.official_url, s.domain
            FROM salons s
            WHERE s.official_url IS NOT NULL
              AND s.is_active = true
              AND s.id NOT IN (
                SELECT DISTINCT salon_id FROM therapists
              )
        """
    else:
        query = """
            SELECT s.id, s.name, s.display_name, s.official_url, s.domain
            FROM salons s
            WHERE s.official_url IS NOT NULL
              AND s.is_active = true
        """
    if start_id > 0:
        query += f" AND s.id >= {start_id}"
    if end_id > 0:
        query += f" AND s.id < {end_id}"
    query += " ORDER BY s.id"
    if limit > 0:
        query += f" LIMIT {limit}"
    cur.execute(query)
    return cur.fetchall()


def insert_therapist(cur, salon_id, t_data):
    """セラピスト1名をDB投入"""
    t_name = t_data.get('name')
    if not t_name:
        return None

    # bustをtext化
    bust_val = t_data.get('bust')
    if bust_val is not None:
        bust_val = str(bust_val)

    # image_urlsをJSONB用に整形
    image_urls = t_data.get('image_urls') or []
    if isinstance(image_urls, str):
        try:
            image_urls = json.loads(image_urls)
        except json.JSONDecodeError:
            image_urls = [image_urls]

    try:
        cur.execute("""
            INSERT INTO therapists (
                salon_id, name, age, height,
                bust, waist, hip, image_urls,
                profile_text, source_url, status, last_scraped_at
            ) VALUES (
                %(salon_id)s, %(name)s, %(age)s, %(height)s,
                %(bust)s, %(waist)s, %(hip)s, %(image_urls)s::jsonb,
                %(profile_text)s, %(source_url)s, 'active', now()
            )
            ON CONFLICT (salon_id, slug) DO NOTHING
            RETURNING id
        """, {
            'salon_id': salon_id,
            'name': t_name,
            'age': t_data.get('age'),
            'height': t_data.get('height'),
            'bust': bust_val,
            'waist': t_data.get('waist'),
            'hip': t_data.get('hip'),
            'image_urls': json.dumps(image_urls, ensure_ascii=False),
            'profile_text': t_data.get('profile_text'),
            'source_url': t_data.get('source_url'),
        })
        row = cur.fetchone()
        if row:
            t_id = row['id']
            # slug = 数字ID
            cur.execute("UPDATE therapists SET slug = %s WHERE id = %s", (str(t_id), t_id))
            return t_id
        return None
    except Exception as e:
        log.warning(f"    DB投入エラー: {t_name}: {e}")
        return None


# =============================================================================
# メイン処理
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description='全サロン一括セラピストスクレイピング')
    parser.add_argument('--limit', type=int, default=0, help='処理サロン数制限（0=全件）')
    parser.add_argument('--max-per-salon', type=int, default=0,
                       help='サロンあたり最大取得人数（0=無制限）')
    parser.add_argument('--dry-run', action='store_true', help='DB投入せず確認のみ')
    parser.add_argument('--resume', action='store_true', help='チェックポイントから再開')
    parser.add_argument('--llm-only', action='store_true',
                       help='LLMのみ使用（従来のTherapistScraper動作）')
    parser.add_argument('--failed-only', action='store_true',
                       help='Phase③: セラピスト未取得分のみ対象')
    parser.add_argument('--start-id', type=int, default=0,
                       help='処理対象の開始salon ID（含む）')
    parser.add_argument('--end-id', type=int, default=0,
                       help='処理対象の終了salon ID（含まない）')
    args = parser.parse_args()

    log.info("=" * 60)
    log.info(" 全サロン一括セラピストスクレイピング")
    log.info("=" * 60)

    # --- DB接続 ---
    try:
        conn = psycopg2.connect(DB_DSN)
        conn.autocommit = False
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        log.info("ローカルSupabase接続成功")
    except Exception as e:
        log.error(f"DB接続失敗: {e}")
        sys.exit(1)

    # --- 対象サロン取得 ---
    all_shops = get_target_shops(cur, limit=args.limit, failed_only=args.failed_only,
                                 start_id=args.start_id, end_id=args.end_id)
    if args.failed_only:
        log.info(f"Phase③対象（ヒューリスティック失敗分）: {len(all_shops)}件")
    else:
        log.info(f"公式URLありのサロン: {len(all_shops)}件")

    # --- チェックポイント ---
    checkpoint = load_checkpoint()
    completed_ids = set(checkpoint['completed_shop_ids'])

    if args.resume and completed_ids:
        log.info(f"チェックポイントから再開: {len(completed_ids)}サロン完了済み")
        all_shops = [s for s in all_shops if s['id'] not in completed_ids]
        log.info(f"残り: {len(all_shops)}サロン")

    if not all_shops:
        log.info("処理対象が0件のため終了")
        conn.close()
        return

    # --- スクレイパー初期化 ---
    if args.llm_only:
        scraper = TherapistScraper()
        log.info("モード: LLMのみ（従来動作）")
    else:
        scraper = SmartScraper(db_conn=conn)
        log.info("モード: Smart Scraper（自動学習）")

    # --- 統計 ---
    start_time = time.time()
    total_therapists = 0
    errors = []

    if not checkpoint['stats'].get('started_at'):
        checkpoint['stats']['started_at'] = datetime.now().isoformat()

    # --- メインループ ---
    total_target = len(all_shops) + len(completed_ids)
    for idx, shop in enumerate(all_shops):
        shop_num = len(completed_ids) + idx + 1
        elapsed = timedelta(seconds=int(time.time() - start_time))

        log.info(f"\n[{shop_num}/{total_target}] {shop['display_name'] or shop['name']} "
                 f"(id={shop['id']}) [経過: {elapsed}]")
        log.info(f"  URL: {shop['official_url']}")

        try:
            if args.llm_only:
                therapists = scraper.scrape_salon(
                    shop['official_url'],
                    shop['display_name'] or shop['name'],
                    max_therapists=args.max_per_salon
                )
            else:
                therapists = scraper.scrape_salon(
                    shop['id'],
                    shop['official_url'],
                    shop['display_name'] or shop['name'],
                    max_therapists=args.max_per_salon
                )

            if not therapists:
                log.info(f"  → セラピスト0名")
                completed_ids.add(shop['id'])
                checkpoint['completed_shop_ids'] = list(completed_ids)
                save_checkpoint(checkpoint)
                continue

            # DB投入
            inserted = 0
            if not args.dry_run:
                for t in therapists:
                    t_id = insert_therapist(cur, shop['id'], t)
                    if t_id:
                        inserted += 1
                conn.commit()
                log.info(f"  → {inserted}/{len(therapists)}名をDB投入")
            else:
                log.info(f"  [DRY RUN] {len(therapists)}名（DB投入なし）")
                inserted = len(therapists)

            total_therapists += inserted

            # チェックポイント更新
            completed_ids.add(shop['id'])
            checkpoint['completed_shop_ids'] = list(completed_ids)
            checkpoint['stats']['total_shops'] = len(completed_ids)
            checkpoint['stats']['total_therapists'] = total_therapists
            save_checkpoint(checkpoint)

        except KeyboardInterrupt:
            log.info("\n中断されました。チェックポイント保存中...")
            if not args.dry_run:
                conn.commit()
            save_checkpoint(checkpoint)
            log.info(f"再開: python batch_scrape_therapists.py --resume")
            sys.exit(0)

        except Exception as e:
            log.error(f"  エラー: {e}")
            errors.append({'shop_id': shop['id'], 'name': shop['name'], 'error': str(e)})
            if not args.dry_run:
                conn.rollback()
            continue

    # --- 完了 ---
    elapsed = timedelta(seconds=int(time.time() - start_time))
    log.info(f"\n{'=' * 60}")
    log.info(f" 完了! (所要時間: {elapsed})")
    log.info(f"{'=' * 60}")
    log.info(f"  処理サロン:       {len(all_shops)}件")
    log.info(f"  取得セラピスト:   {total_therapists}名")
    log.info(f"  エラー:           {len(errors)}件")

    if errors:
        log.info(f"\n  エラー詳細:")
        for err in errors[:20]:
            log.info(f"    - [{err['shop_id']}] {err['name']}: {err['error']}")

    # Smart Scraper統計
    if not args.llm_only and hasattr(scraper, 'print_stats'):
        scraper.print_stats()

    # DB結果サマリー
    if not args.dry_run:
        cur.execute("SELECT count(*) AS cnt FROM therapists")
        log.info(f"\n  DB therapists合計: {cur.fetchone()['cnt']}名")

    conn.close()
    log.info(f"\nログ: {LOG_FILE}")
    log.info(f"チェックポイント: {CHECKPOINT_FILE}")


if __name__ == '__main__':
    main()
