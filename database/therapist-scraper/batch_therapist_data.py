#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Phase ②: セラピストデータ取得
Phase ①（batch_heuristic.py）でセラピストURLが判明した店舗に対して、
各セラピストの個別ページからデータを抽出し、therapistsテーブルに投入する。

実行:
  python database/therapist-scraper/batch_therapist_data.py                  # 全対象
  python database/therapist-scraper/batch_therapist_data.py --limit 5        # 5店舗だけ
  python database/therapist-scraper/batch_therapist_data.py --resume         # 再開
  python database/therapist-scraper/batch_therapist_data.py --dry-run        # DB投入せず
  python database/therapist-scraper/batch_therapist_data.py --workers 5      # 並列数指定

前提:
  - supabase start 済み (127.0.0.1:54322)
  - batch_heuristic.py 実行済み（shop_scrape_cache にデータあり）
  - database/.env に ANTHROPIC_API_KEY（LLMフォールバック用）
"""

import json
import logging
import os
import re
import sys
import time
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv

# .env読み込み
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# スクレイパーをimport（LLMフォールバック用）
sys.path.insert(0, os.path.dirname(__file__))
from therapist_scraper import TherapistScraper
from fetch_utils import fetch_page, HEADERS
from name_extractor import extract_name as extract_name_smart
from pattern_validator import PatternValidator
from html_cache_utils import HtmlCache
_cache = HtmlCache()

# --- 設定 ---
DB_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
REQUEST_DELAY = 0.3

CHECKPOINT_FILE = os.path.join(os.path.dirname(__file__),
                               'batch_therapist_data_checkpoint.json')

# ログ設定
LOG_FILE = os.path.join(os.path.dirname(__file__), 'batch_therapist_data.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

validator = PatternValidator()


# =============================================================================
# セラピストURL再抽出（Phase①と同じロジック）
# =============================================================================

def extract_therapist_urls_heuristic(html, list_url):
    """一覧ページからセラピスト個別URLを抽出（ヒューリスティック）"""
    soup = BeautifulSoup(html, 'html.parser')
    domain = urlparse(list_url).netloc
    list_path = urlparse(list_url).path.rstrip('/')

    profile_patterns = [
        r'/cast/[^/]+/?$',
        r'/staff/[^/]+/?$',
        r'/therapist/[^/]+/?$',
        r'/girl/[^/]+/?$',
        r'/profile[/?]',
        r'/item_\d+',
        r'/item/\d+',
        r'/member/[^/]+/?$',
        r'/detail/[^/]+/?$',
    ]

    candidates = []
    seen = set()

    for a in soup.find_all('a', href=True):
        url = urljoin(list_url, a['href'])
        parsed = urlparse(url)
        if parsed.netloc != domain or url in seen:
            continue
        seen.add(url)
        path = parsed.path.rstrip('/')
        if path == list_path:
            continue
        if re.search(r'[?&]page=\d+|/page/\d+|[?&]p=\d+', url):
            continue

        if any(re.search(p, path) for p in profile_patterns):
            name = a.get_text(strip=True) or ''
            img = a.find('img')
            img_url = None
            if img:
                src = (img.get('src') or img.get('data-src')
                       or img.get('data-lazy-src') or '')
                if src:
                    img_url = urljoin(list_url, src)
            candidates.append({
                'name': name,
                'url': url,
                'list_image_url': img_url,
            })

    # フォールバック: 一覧URL直下のサブパス
    if not candidates and list_path:
        for a in soup.find_all('a', href=True):
            url = urljoin(list_url, a['href'])
            parsed = urlparse(url)
            if parsed.netloc != domain or url in seen:
                continue
            seen.add(url)
            path = parsed.path.rstrip('/')
            if path == list_path:
                continue
            if path.startswith(list_path + '/') and path.count('/') == list_path.count('/') + 1:
                exclude = ['/blog', '/news', '/schedule', '/access',
                           '/price', '/menu', '/contact', '/reserve']
                if any(excl in path.lower() for excl in exclude):
                    continue
                name = a.get_text(strip=True) or ''
                candidates.append({
                    'name': name,
                    'url': url,
                    'list_image_url': None,
                })

    return candidates


# =============================================================================
# セラピストデータ抽出（ヒューリスティック）
# =============================================================================

def extract_therapist_data_heuristic(html, url, salon_name="", salon_display="",
                                      learned_selector=None):
    """
    個別ページHTMLからセラピストデータを正規表現で抽出（LLM不要）

    名前抽出は name_extractor モジュールを使用（CSSセレクタ/H1/H2/og:title/title）。

    Returns:
        dict or None
    """
    soup = BeautifulSoup(html, 'html.parser')

    # 名前抽出: name_extractor を使用（ヒューリスティックのみ、LLMなし）
    name_result = extract_name_smart(
        html, salon_name=salon_name, salon_display=salon_display,
        url=url, learned_selector=learned_selector, use_llm=False)
    name = name_result["name"] if name_result else None

    if not name:
        return None

    body_text = soup.get_text(' ', strip=True)
    data = {
        'name': name,
        'source_url': url,
    }

    # 年齢
    age_m = re.search(r'(\d{2})\s*歳|AGE\s*[:\s]*(\d{2})', body_text, re.IGNORECASE)
    if age_m:
        data['age'] = int(age_m.group(1) or age_m.group(2))

    # 身長
    height_m = re.search(r'T\s*(\d{3})|(\d{3})\s*cm|身長\s*[:\s]*(\d{3})', body_text)
    if height_m:
        data['height'] = int(height_m.group(1) or height_m.group(2) or height_m.group(3))

    # BWH
    bwh_m = re.search(r'B\s*[:\s]*(\d{2,3})[^\d]*W\s*[:\s]*(\d{2,3})[^\d]*H\s*[:\s]*(\d{2,3})',
                       body_text)
    if bwh_m:
        data['bust'] = int(bwh_m.group(1))
        data['waist'] = int(bwh_m.group(2))
        data['hip'] = int(bwh_m.group(3))

    # 画像
    image_urls = []
    for img in soup.find_all('img'):
        src = img.get('src') or img.get('data-src') or img.get('data-lazy-src') or ''
        if not src:
            continue
        src_full = urljoin(url, src)
        src_lower = src_full.lower()
        # セラピスト写真っぽいもの
        if any(kw in src_lower for kw in ['cast', 'therapist', 'girl', 'staff',
                                           'item', 'profile', 'member', 'photo']):
            image_urls.append(src_full)
        elif img.get('alt') and name and name in (img.get('alt') or ''):
            image_urls.append(src_full)
    # ロゴ/アイコン除外して最大5枚
    image_urls = [u for u in image_urls
                  if 'logo' not in u.lower() and 'icon' not in u.lower()][:5]
    if image_urls:
        data['image_urls'] = image_urls

    return data


def fetch_and_extract(entry):
    """
    セラピスト1名分: ページfetch + データ抽出（スレッドセーフ）

    entry に salon_name, salon_display キーがあればname_extractorに渡す。

    Returns:
        (entry, data_dict_or_None, html_or_None)
    """
    try:
        html = fetch_page(entry['url'])
        if not html:
            return entry, None, None

        _cache.save("therapist", entry['url'].rstrip('/').split('/')[-1], html)
        data = extract_therapist_data_heuristic(
            html, entry['url'],
            salon_name=entry.get('salon_name', ''),
            salon_display=entry.get('salon_display', ''))

        # ヒューリスティックで取れたらリスト画像をフォールバック
        if data:
            if not data.get('image_urls') and entry.get('list_image_url'):
                data['image_urls'] = [entry['list_image_url']]
            # 名前がURL抽出時のものと一致しなくても、ヒューリスティック側を優先
            # ただし空なら一覧の名前を使う
            if not data.get('name') and entry.get('name'):
                data['name'] = entry['name']

        return entry, data, html

    except Exception as e:
        return entry, None, None


# =============================================================================
# DB操作
# =============================================================================

def get_target_shops(cur, limit=0):
    """Phase①成功店（セラピストURL取得済み）を取得"""
    query = """
        SELECT DISTINCT ON (s.official_url)
               c.salon_id, c.therapist_list_url, c.last_therapist_count,
               s.name, s.display_name, s.official_url
        FROM salon_scrape_cache c
        JOIN salons s ON s.id = c.salon_id
        WHERE c.last_therapist_count > 0
        ORDER BY s.official_url, c.salon_id
    """
    if limit > 0:
        query += f" LIMIT {limit}"
    cur.execute(query)
    return cur.fetchall()


def get_shops_with_therapists(cur):
    """既にtherapistsが入っている salon_id の集合"""
    cur.execute("SELECT DISTINCT salon_id FROM therapists")
    return {row['salon_id'] for row in cur.fetchall()}


def _safe_int(val):
    """整数に変換できない値（"D"等）はNoneにする"""
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def insert_therapist(cur, salon_id, data):
    """セラピスト1名をDB投入。SAVEPOINTで他レコードに影響しない。Returns id or None."""
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
        log.warning(f"  DB投入エラー: {t_name}: {e}")
        return None


# =============================================================================
# チェックポイント
# =============================================================================

def load_checkpoint():
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, 'r') as f:
            return json.load(f)
    return {
        'completed_shop_ids': [],
        'stats': {
            'shops_processed': 0,
            'therapists_inserted': 0,
            'therapists_failed': 0,
            'shops_no_urls': 0,
            'started_at': None,
        }
    }


def save_checkpoint(checkpoint):
    checkpoint['stats']['last_updated'] = datetime.now().isoformat()
    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump(checkpoint, f, ensure_ascii=False, indent=2)


# =============================================================================
# メイン処理
# =============================================================================

def process_shop(shop, cur, llm_scraper, workers, dry_run=False):
    """
    1店舗分のセラピストデータ取得

    Returns:
        (inserted_count, failed_count, total_urls)
    """
    salon_id = shop['salon_id']
    list_url = shop['therapist_list_url']
    salon_name = shop['display_name'] or shop['name']
    salon_raw_name = shop['name'] or ''

    # 一覧ページを再取得してセラピストURLを抽出
    list_html = fetch_page(list_url)
    if not list_html:
        return 0, 0, 0

    entries = extract_therapist_urls_heuristic(list_html, list_url)
    if not entries:
        return 0, 0, 0

    # name_extractor 用にサロン名情報をentry に付与
    for e in entries:
        e['salon_name'] = salon_raw_name
        e['salon_display'] = salon_name

    total_urls = len(entries)
    inserted = 0
    failed = 0
    llm_used = 0

    # セラピストページを並列fetch + データ抽出
    results = []
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(fetch_and_extract, e): e for e in entries}
        for future in as_completed(futures):
            results.append(future.result())

    # DB書き込み（メインスレッド）
    for entry, data, html in results:
        if data and validator.validate_therapist(data):
            if not dry_run:
                t_id = insert_therapist(cur, salon_id, data)
                if t_id:
                    inserted += 1
                else:
                    failed += 1
            else:
                inserted += 1
        elif html and llm_scraper:
            # ヒューリスティック失敗 → LLMフォールバック
            try:
                data = llm_scraper.extract_therapist_data(entry['url'], html)
                if data and validator.validate_therapist(data):
                    if not data.get('image_urls') and entry.get('list_image_url'):
                        data['image_urls'] = [entry['list_image_url']]
                    if not dry_run:
                        t_id = insert_therapist(cur, salon_id, data)
                        if t_id:
                            inserted += 1
                            llm_used += 1
                        else:
                            failed += 1
                    else:
                        inserted += 1
                        llm_used += 1
                else:
                    failed += 1
            except Exception:
                failed += 1
        else:
            failed += 1

    if llm_used > 0:
        log.debug(f"  LLMフォールバック: {llm_used}名")

    return inserted, failed, total_urls


def main():
    parser = argparse.ArgumentParser(
        description='Phase ②: セラピストデータ取得（成功店のみ）')
    parser.add_argument('--limit', type=int, default=0,
                        help='処理店舗数制限（0=全件）')
    parser.add_argument('--workers', type=int, default=5,
                        help='店舗内並列fetch数（デフォルト5）')
    parser.add_argument('--resume', action='store_true',
                        help='チェックポイントから再開')
    parser.add_argument('--dry-run', action='store_true',
                        help='DB投入せず確認のみ')
    parser.add_argument('--no-llm', action='store_true',
                        help='LLMフォールバックなし（ヒューリスティックのみ）')
    args = parser.parse_args()

    log.info("=" * 60)
    log.info(" Phase ②: セラピストデータ取得")
    log.info(f" 並列fetch: {args.workers}  LLM: {'OFF' if args.no_llm else 'フォールバック'}")
    log.info("=" * 60)

    # DB接続
    try:
        conn = psycopg2.connect(DB_DSN)
        conn.autocommit = False
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        log.info("ローカルSupabase接続成功")
    except Exception as e:
        log.error(f"DB接続失敗: {e}")
        sys.exit(1)

    # LLMスクレイパー（フォールバック用）
    llm_scraper = None
    if not args.no_llm:
        try:
            llm_scraper = TherapistScraper()
            log.info("LLMフォールバック: 有効")
        except Exception as e:
            log.warning(f"LLM初期化失敗（ヒューリスティックのみで続行）: {e}")

    # 対象店舗取得
    all_shops = get_target_shops(cur, limit=args.limit)
    log.info(f"Phase①成功店: {len(all_shops)}件")

    # 既処理スキップ
    checkpoint = load_checkpoint()
    completed_ids = set(checkpoint['completed_shop_ids'])

    if args.resume:
        # DBに既にtherapistsがある店もスキップ
        db_done = get_shops_with_therapists(cur)
        completed_ids = completed_ids | db_done
        if completed_ids:
            log.info(f"処理済みスキップ: {len(completed_ids)}件")
        all_shops = [s for s in all_shops if s['salon_id'] not in completed_ids]
        log.info(f"残り: {len(all_shops)}件")

    if not all_shops:
        log.info("処理対象が0件のため終了")
        conn.close()
        return

    # 統計
    stats = checkpoint['stats']
    if not stats.get('started_at'):
        stats['started_at'] = datetime.now().isoformat()
    start_time = time.time()

    total_target = len(all_shops) + len(completed_ids)
    total_inserted = stats.get('therapists_inserted', 0)
    total_failed = stats.get('therapists_failed', 0)

    # メインループ（店舗単位は順次、店舗内のfetchは並列）
    for idx, shop in enumerate(all_shops):
        salon_id = shop['salon_id']
        salon_name = shop['display_name'] or shop['name']
        elapsed = timedelta(seconds=int(time.time() - start_time))
        shop_num = len(completed_ids) + idx + 1

        try:
            inserted, failed, total_urls = process_shop(
                shop, cur, llm_scraper, args.workers, dry_run=args.dry_run)

            total_inserted += inserted
            total_failed += failed

            if inserted > 0:
                log.info(f"[{shop_num}/{total_target}] {salon_name} "
                         f"-> {inserted}/{total_urls}名取得 [{elapsed}]")
            elif total_urls > 0:
                log.info(f"[{shop_num}/{total_target}] {salon_name} "
                         f"-> 0/{total_urls}名（抽出失敗）[{elapsed}]")
            else:
                log.info(f"[{shop_num}/{total_target}] {salon_name} "
                         f"-> URL再取得失敗 [{elapsed}]")

            # DB commit
            if not args.dry_run:
                conn.commit()

            # チェックポイント更新
            completed_ids.add(salon_id)
            checkpoint['completed_shop_ids'] = list(completed_ids)
            stats['shops_processed'] = len(completed_ids)
            stats['therapists_inserted'] = total_inserted
            stats['therapists_failed'] = total_failed
            checkpoint['stats'] = stats

            if (idx + 1) % 50 == 0:
                save_checkpoint(checkpoint)

            time.sleep(REQUEST_DELAY)

        except KeyboardInterrupt:
            log.info("\n中断されました。チェックポイント保存中...")
            if not args.dry_run:
                conn.commit()
            save_checkpoint(checkpoint)
            log.info(f"再開: python batch_therapist_data.py --resume")
            sys.exit(0)

        except Exception as e:
            log.error(f"  [{salon_name}] エラー: {e}")
            if not args.dry_run:
                conn.rollback()
            continue

    # 最終commit
    if not args.dry_run:
        conn.commit()
    save_checkpoint(checkpoint)

    # サマリー
    elapsed = timedelta(seconds=int(time.time() - start_time))
    log.info(f"\n{'=' * 60}")
    log.info(f" Phase ② 完了! (所要時間: {elapsed})")
    log.info(f"{'=' * 60}")
    log.info(f"  処理店舗:          {len(all_shops)}件")
    log.info(f"  セラピスト取得:    {total_inserted}名")
    log.info(f"  抽出失敗:          {total_failed}名")

    if total_inserted + total_failed > 0:
        rate = total_inserted / (total_inserted + total_failed) * 100
        log.info(f"  取得成功率:        {rate:.1f}%")

    if not args.dry_run:
        cur.execute("SELECT count(*) AS cnt FROM therapists")
        log.info(f"\n  DB therapists合計: {cur.fetchone()['cnt']}名")

    conn.close()
    log.info(f"\nログ: {LOG_FILE}")
    log.info(f"チェックポイント: {CHECKPOINT_FILE}")


if __name__ == '__main__':
    main()
