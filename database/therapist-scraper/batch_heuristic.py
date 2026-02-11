#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Phase 1: ヒューリスティックのみで全店舗スキャン
LLM不使用。HTTPリクエストのみ。
結果はshop_scrape_cache + scrape_logに記録。

実行:
  python database/therapist-scraper/batch_heuristic.py                 # 全サロン
  python database/therapist-scraper/batch_heuristic.py --limit 10      # 最初の10サロン
  python database/therapist-scraper/batch_heuristic.py --resume        # チェックポイントから再開
  python database/therapist-scraper/batch_heuristic.py --dry-run       # DB投入せず確認のみ

前提:
  - supabase start 済み (127.0.0.1:54322)
  - shops テーブルにデータが入っている
"""

import hashlib
import json
import logging
import os
import re
import sys
import time
import argparse
from datetime import datetime, timedelta

import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv

# .env読み込み
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# --- 設定 ---
DB_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
REQUEST_DELAY = 0.3  # ヒューリスティックはLLMなしなので短めに

CHECKPOINT_FILE = os.path.join(os.path.dirname(__file__), 'batch_heuristic_checkpoint.json')

# ログ設定
LOG_FILE = os.path.join(os.path.dirname(__file__), 'batch_heuristic.log')
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
# HTTP
# =============================================================================

def fetch_page(url, timeout=15):
    """ページを取得"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding
        return resp.text, resp.status_code
    except requests.exceptions.HTTPError as e:
        return None, getattr(e.response, 'status_code', 0)
    except requests.exceptions.Timeout:
        return None, -1  # timeout
    except requests.exceptions.ConnectionError:
        return None, -2  # DNS/connection error
    except Exception:
        return None, -3  # other


# =============================================================================
# ヒューリスティック関数（smart_scraper.pyと同一ロジック、スタンドアロン版）
# =============================================================================

def find_list_url_heuristic(html, base_url):
    """
    LLM不要のヒューリスティックでセラピスト一覧URLを特定

    Returns:
        (url, detail_reason) or (None, reason)
    """
    soup = BeautifulSoup(html, 'html.parser')
    domain = urlparse(base_url).netloc

    # パターン1: リンクテキストにキーワード含む
    text_keywords = ['セラピスト', 'キャスト', 'スタッフ', '在籍', 'ガール',
                     'セラピスト一覧', 'キャスト一覧', 'スタッフ紹介',
                     'THERAPIST', 'CAST', 'STAFF']
    for a in soup.find_all('a', href=True):
        text = a.get_text(strip=True)
        href = a['href']
        if href.startswith('#'):
            continue
        if any(kw.lower() in text.lower() for kw in text_keywords):
            url = urljoin(base_url, href)
            if urlparse(url).netloc == domain:
                return url, f'text_keyword: {text[:30]}'

    # パターン2: URL自体にキーワード含む
    url_keywords = ['/cast', '/staff', '/therapist', '/girl',
                    'staff.html', 'cast.html', 'therapist.html',
                    '/item_list', '/member']
    for a in soup.find_all('a', href=True):
        href = a['href']
        if href.startswith('#'):
            continue
        href_lower = href.lower()
        for kw in url_keywords:
            if kw in href_lower:
                url = urljoin(base_url, href)
                if urlparse(url).netloc == domain:
                    return url, f'url_keyword: {kw}'

    # パターン3: よくあるパスをHTTPプローブ
    common_paths = ['/cast/', '/staff/', '/therapist/', '/girl/',
                    '/cast', '/staff', '/therapist']
    for path in common_paths:
        url = urljoin(base_url, path)
        try:
            resp = requests.head(url, headers=HEADERS, timeout=5, allow_redirects=True)
            if resp.status_code == 200:
                final_domain = urlparse(resp.url).netloc
                if final_domain == domain:
                    return resp.url, f'http_probe: {path}'
        except Exception:
            pass

    # パターン4: アンカーリンク (#staff等)
    anchor_keywords = ['staff', 'cast', 'therapist', 'girl', 'member']
    for a in soup.find_all('a', href=True):
        href = a['href']
        if not href.startswith('#'):
            continue
        anchor_id = href[1:]
        if any(kw in anchor_id.lower() for kw in anchor_keywords):
            target = soup.find(id=anchor_id) or soup.find(attrs={'name': anchor_id})
            if target:
                return base_url, f'anchor: #{anchor_id}'

    return None, 'no_match'


def extract_therapist_urls_heuristic(html, list_url):
    """
    URLパターンでセラピスト個別URLを抽出（LLM不要）

    Returns:
        [{"name": "...", "url": "...", "list_image_url": None}, ...]
    """
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

    # フォールバック: 一覧URLの直下サブパスリンクを収集
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
# DB操作
# =============================================================================

def get_target_shops(cur, limit=0):
    """official_urlを持つサロン一覧を取得"""
    query = """
        SELECT s.id, s.name, s.display_name, s.official_url
        FROM shops s
        WHERE s.official_url IS NOT NULL
          AND s.is_active = true
        ORDER BY s.id
    """
    if limit > 0:
        query += f" LIMIT {limit}"
    cur.execute(query)
    return cur.fetchall()


def get_processed_shop_ids(cur):
    """scrape_logに既存のshop_idを取得（Phase 1でheuristic処理済み）"""
    cur.execute("""
        SELECT DISTINCT shop_id FROM scrape_log
        WHERE method = 'heuristic' AND step = 'find_list_url'
    """)
    return {row['shop_id'] for row in cur.fetchall()}


def log_scrape(cur, shop_id, step, method, success, detail=None, html=None):
    """scrape_logにログ書き込み"""
    html_hash = hashlib.sha256(html.encode()).hexdigest()[:16] if html else None
    cur.execute("""
        INSERT INTO scrape_log (shop_id, step, method, success, html_hash, detail)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (shop_id, step, method, success, html_hash, detail))


def update_cache(cur, shop_id, list_url, therapist_count, success):
    """shop_scrape_cacheを更新"""
    if success:
        cur.execute("""
            INSERT INTO shop_scrape_cache
                (shop_id, therapist_list_url, extraction_method,
                 last_therapist_count, fail_streak, last_scraped_at)
            VALUES (%s, %s, 'heuristic', %s, 0, now())
            ON CONFLICT (shop_id) DO UPDATE SET
                therapist_list_url = EXCLUDED.therapist_list_url,
                extraction_method = EXCLUDED.extraction_method,
                last_therapist_count = EXCLUDED.last_therapist_count,
                fail_streak = 0,
                last_scraped_at = now()
        """, (shop_id, list_url, therapist_count))
    else:
        cur.execute("""
            INSERT INTO shop_scrape_cache
                (shop_id, therapist_list_url, extraction_method,
                 last_therapist_count, fail_streak, last_scraped_at)
            VALUES (%s, %s, 'heuristic', 0, 1, now())
            ON CONFLICT (shop_id) DO UPDATE SET
                fail_streak = shop_scrape_cache.fail_streak + 1,
                last_scraped_at = now()
        """, (shop_id, list_url))


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
            'total': 0,
            'step2_success': 0,
            'step3_success': 0,
            'step2_fail': 0,
            'fetch_fail': 0,
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

def process_shop(cur, shop, dry_run=False):
    """
    1店舗のヒューリスティック処理

    Returns:
        (step2_ok, step3_count, detail)
    """
    shop_id = shop['id']
    salon_url = shop['official_url']
    salon_name = shop['display_name'] or shop['name']

    # Step 1: トップページ取得
    html, status_code = fetch_page(salon_url)
    if not html:
        reason = f'fetch_fail: status={status_code}'
        if not dry_run:
            log_scrape(cur, shop_id, 'fetch_top', 'heuristic', False, detail=reason)
        return False, 0, reason

    # Step 2: 一覧URL特定
    list_url, detail = find_list_url_heuristic(html, salon_url)
    if not list_url:
        if not dry_run:
            log_scrape(cur, shop_id, 'find_list_url', 'heuristic', False,
                       html=html, detail=detail)
            update_cache(cur, shop_id, None, 0, False)
        return False, 0, f'step2_fail: {detail}'

    if not dry_run:
        log_scrape(cur, shop_id, 'find_list_url', 'heuristic', True,
                   html=html, detail=detail)

    # 一覧ページ取得（トップページと同一URLの場合はスキップ）
    if list_url.rstrip('/') != salon_url.rstrip('/'):
        time.sleep(REQUEST_DELAY)
        list_html, list_status = fetch_page(list_url)
        if not list_html:
            reason = f'fetch_list_fail: status={list_status}'
            if not dry_run:
                log_scrape(cur, shop_id, 'fetch_list', 'heuristic', False,
                           detail=reason)
                update_cache(cur, shop_id, list_url, 0, False)
            return False, 0, reason
    else:
        list_html = html

    # Step 3: セラピストURL抽出
    entries = extract_therapist_urls_heuristic(list_html, list_url)

    if not dry_run:
        log_scrape(cur, shop_id, 'extract_urls', 'heuristic', bool(entries),
                   detail=f'{len(entries)} urls')
        update_cache(cur, shop_id, list_url, len(entries), bool(entries))

    if entries:
        return True, len(entries), f'ok: {len(entries)} therapists at {list_url}'
    else:
        return True, 0, f'step3_fail: list_url={list_url} but 0 urls extracted'


def main():
    parser = argparse.ArgumentParser(
        description='Phase 1: ヒューリスティックのみで全店舗スキャン')
    parser.add_argument('--limit', type=int, default=0,
                        help='処理サロン数制限（0=全件）')
    parser.add_argument('--resume', action='store_true',
                        help='チェックポイントから再開')
    parser.add_argument('--dry-run', action='store_true',
                        help='DB投入せず確認のみ')
    args = parser.parse_args()

    log.info("=" * 60)
    log.info(" Phase 1: ヒューリスティック全店舗スキャン")
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

    # 対象サロン取得
    all_shops = get_target_shops(cur, limit=args.limit)
    log.info(f"公式URLありのサロン: {len(all_shops)}件")

    # チェックポイント or DB上の既処理をスキップ
    checkpoint = load_checkpoint()
    completed_ids = set(checkpoint['completed_shop_ids'])

    if args.resume:
        if completed_ids:
            log.info(f"チェックポイントから再開: {len(completed_ids)}サロン完了済み")
        else:
            # DBから既処理分を取得
            db_processed = get_processed_shop_ids(cur)
            if db_processed:
                completed_ids = db_processed
                log.info(f"DB上の既処理: {len(completed_ids)}サロンをスキップ")

        all_shops = [s for s in all_shops if s['id'] not in completed_ids]
        log.info(f"残り: {len(all_shops)}サロン")

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
    commit_interval = 100  # 100件ごとにcommit

    # メインループ
    for idx, shop in enumerate(all_shops):
        shop_num = len(completed_ids) + idx + 1
        elapsed = timedelta(seconds=int(time.time() - start_time))

        salon_name = shop['display_name'] or shop['name']
        log.info(f"[{shop_num}/{total_target}] {salon_name} "
                 f"(id={shop['id']}) [経過: {elapsed}]")

        try:
            step2_ok, therapist_count, detail = process_shop(
                cur, shop, dry_run=args.dry_run)

            if step2_ok:
                stats['step2_success'] = stats.get('step2_success', 0) + 1
                if therapist_count > 0:
                    stats['step3_success'] = stats.get('step3_success', 0) + 1
                    log.info(f"  -> {therapist_count}名検出 ({detail})")
                else:
                    log.info(f"  -> 一覧URL発見、セラピスト0名 ({detail})")
            elif 'fetch_fail' in detail:
                stats['fetch_fail'] = stats.get('fetch_fail', 0) + 1
                log.info(f"  -> {detail}")
            else:
                stats['step2_fail'] = stats.get('step2_fail', 0) + 1
                log.info(f"  -> {detail}")

            stats['total'] = stats.get('total', 0) + 1

            # チェックポイント更新
            completed_ids.add(shop['id'])
            checkpoint['completed_shop_ids'] = list(completed_ids)
            checkpoint['stats'] = stats

            # 定期commit
            if not args.dry_run and (idx + 1) % commit_interval == 0:
                conn.commit()
                save_checkpoint(checkpoint)
                log.info(f"  [checkpoint] {len(completed_ids)}件完了")

            time.sleep(REQUEST_DELAY)

        except KeyboardInterrupt:
            log.info("\n中断されました。チェックポイント保存中...")
            if not args.dry_run:
                conn.commit()
            save_checkpoint(checkpoint)
            log.info(f"再開: python batch_heuristic.py --resume")
            sys.exit(0)

        except Exception as e:
            log.error(f"  エラー: {e}")
            if not args.dry_run:
                conn.rollback()
            continue

    # 最終commit
    if not args.dry_run:
        conn.commit()
    save_checkpoint(checkpoint)

    # 完了サマリー
    elapsed = timedelta(seconds=int(time.time() - start_time))
    log.info(f"\n{'=' * 60}")
    log.info(f" Phase 1 完了! (所要時間: {elapsed})")
    log.info(f"{'=' * 60}")
    log.info(f"  処理サロン:           {stats.get('total', 0)}件")
    log.info(f"  Step2成功（一覧URL発見）: {stats.get('step2_success', 0)}件")
    log.info(f"  Step3成功（URL抽出）:    {stats.get('step3_success', 0)}件")
    log.info(f"  Step2失敗:              {stats.get('step2_fail', 0)}件")
    log.info(f"  fetch失敗:              {stats.get('fetch_fail', 0)}件")

    total = stats.get('total', 0)
    if total > 0:
        s2_rate = stats.get('step2_success', 0) / total * 100
        s3_rate = stats.get('step3_success', 0) / total * 100
        log.info(f"  Step2成功率: {s2_rate:.1f}%")
        log.info(f"  Step3成功率: {s3_rate:.1f}%")

    # Phase 2向けサマリー（LLMが必要な店舗数）
    if not args.dry_run:
        cur.execute("""
            SELECT count(*) AS cnt FROM shops s
            WHERE s.official_url IS NOT NULL AND s.is_active = true
              AND NOT EXISTS (
                  SELECT 1 FROM shop_scrape_cache c
                  WHERE c.shop_id = s.id
                    AND c.extraction_method = 'heuristic'
                    AND c.last_therapist_count > 0
              )
        """)
        phase2_count = cur.fetchone()['cnt']
        log.info(f"\n  Phase 2 対象（LLM必要）: {phase2_count}件")

    conn.close()
    log.info(f"\nログ: {LOG_FILE}")
    log.info(f"チェックポイント: {CHECKPOINT_FILE}")


if __name__ == '__main__':
    main()
