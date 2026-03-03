#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
salon_areas欠損データ補完スクリプト

216エリアの salon_areas が欠損している。
原因: batch_scrape_shops.py 実行時の slug不一致 + esthe-ranking 500エラー。

このスクリプトは:
1. 欠損エリアの data_source_url を DB から取得
2. esthe-ranking からサロン一覧をスクレイプ（source_id + 基本情報）
3. source_id で salons テーブルとマッチ
4. 未マッチのサロンは salons テーブルに INSERT
5. 全サロンの salon_areas を直接DB投入

実行:
  python3 database/backfill_salon_areas.py                   # 全欠損エリア → 直接DB投入
  python3 database/backfill_salon_areas.py --limit 5         # 最初の5エリアのみ
  python3 database/backfill_salon_areas.py --sql-only        # SQLファイル生成のみ（DB投入なし）

前提:
  - supabase start 済み (127.0.0.1:54322)
  - pip: psycopg2-binary, requests, beautifulsoup4
"""

import os
import re
import sys
import time
import json
import argparse
import logging
from datetime import datetime
from collections import defaultdict

import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup

# --- 設定 ---
DB_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
BASE_URL = "https://www.esthe-ranking.jp"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
REQUEST_DELAY = 0.5
DETAIL_DELAY = 0.3
MAX_RETRIES = 3

# 出力先
MIGRATION_FILE = os.path.join(
    os.path.dirname(__file__), '..', 'supabase', 'migrations',
    '20260303200000_backfill_salon_areas.sql'
)

# チェックポイント
CHECKPOINT_FILE = os.path.join(os.path.dirname(__file__), 'backfill_checkpoint.json')

# ログ設定
LOG_FILE = os.path.join(os.path.dirname(__file__), 'backfill_salon_areas.log')
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
# 店名正規化（batch_scrape_shops.py から流用）
# =============================================================================

AREA_SUFFIXES = re.compile(
    r'[\s　]*(恵比寿|中目黒|代官山|広尾|目黒|渋谷|新宿|池袋|銀座|六本木|'
    r'赤坂|麻布|五反田|品川|大崎|大井町|蒲田|上野|秋葉原|神田|'
    r'横浜|川崎|大宮|船橋|千葉|札幌|仙台|名古屋|京都|大阪|'
    r'梅田|難波|なんば|心斎橋|天王寺|神戸|三宮|広島|福岡|博多|天神|'
    r'白河|郡山|福島|会津若松|いわき|秋田|'
    r'東京|関東|関西)'
    r'[・/／]*'
    r'(ルーム|Room|ROOM|店|支店)?'
)

NOISE_PATTERNS = [
    re.compile(r'[（(][ァ-ヶー・a-zA-Z\s]+[）)]'),
    re.compile(r'～[^～]+～'),
    re.compile(r'〜[^〜]+〜'),
    re.compile(r'【[^】]+】'),
]


def normalize_display_name(raw_name, kana_from_brackets=None):
    if kana_from_brackets:
        return kana_from_brackets
    name = raw_name.strip()
    for pat in NOISE_PATTERNS:
        name = pat.sub('', name)
    name = AREA_SUFFIXES.sub('', name)
    name = re.sub(r'[・/／\s　♡☆★\-]+$', '', name)
    name = re.sub(r'^[・/／\s　\-]+', '', name)
    name = name.strip()
    return name if name else raw_name.strip()


def parse_salon_name(raw_name):
    match = re.search(r'（([ァ-ヶー・]+)）', raw_name)
    if match:
        return raw_name.strip(), match.group(1).strip()
    match = re.search(r'\(([ァ-ヶー・]+)\)', raw_name)
    if match:
        return raw_name.strip(), match.group(1).strip()
    return raw_name.strip(), None


def parse_price_duration(text):
    if not text:
        return None, None
    duration_match = re.search(r'(\d+)分', text)
    duration = int(duration_match.group(1)) if duration_match else None
    price_match = re.search(r'([\d,]+)円', text)
    price = int(price_match.group(1).replace(',', '')) if price_match else None
    return price, duration


# =============================================================================
# スクレイピング
# =============================================================================

def fetch_with_retry(url, max_retries=MAX_RETRIES, delay=REQUEST_DELAY):
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            if attempt < max_retries - 1:
                wait = delay * (2 ** attempt)
                log.warning(f"  リトライ {attempt+1}/{max_retries}: {url} → {wait:.1f}秒待機")
                time.sleep(wait)
            else:
                log.error(f"  取得失敗（{max_retries}回）: {url} ({e})")
                return None


def scrape_area_page(data_source_url):
    """esthe-ranking エリアページからサロン一覧を取得（source_id + 基本情報）"""
    url = BASE_URL + data_source_url
    resp = fetch_with_retry(url)
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, 'html.parser')
    salons = []
    rank = 0

    for card in soup.select('.shop-ranking.blog-thumb-v2'):
        rank += 1
        salon = {}

        keep_btn = card.select_one('button.therakeep')
        if keep_btn:
            salon['source_id'] = keep_btn.get('data-keep-id')

        if not salon.get('source_id'):
            continue

        name_elem = card.select_one('h3 a b')
        if name_elem:
            raw_name = name_elem.get_text(strip=True)
            salon['name'], salon['kana_from_brackets'] = parse_salon_name(raw_name)

        badges = card.select('.rd-badges .badge')
        salon['business_type'] = None
        for badge in badges:
            text = badge.get_text(strip=True)
            if text in ['店舗', '派遣']:
                salon['business_type'] = text

        for li in card.select('.blog-thumb-info li'):
            text = li.get_text(strip=True)
            icon = li.select_one('i')
            if not icon:
                continue
            icon_class = icon.get('class', [])
            if 'fa-train' in icon_class:
                salon['access'] = text
            elif 'fa-clock-o' in icon_class:
                hours_match = re.match(r'^([^(（]+)(?:[(（]受付[：:]([^)）]+)[)）])?', text)
                salon['business_hours'] = hours_match.group(1).strip() if hours_match else text
            elif 'fa-jpy' in icon_class:
                salon['base_price'], salon['base_duration'] = parse_price_duration(text)

        phone_elem = card.select_one('a.phone')
        if phone_elem:
            href = phone_elem.get('href', '')
            if href.startswith('tel:'):
                salon['phone'] = href.replace('tel:', '')

        tags = card.select('.ranking_c1badge .badge')
        salon['service_tags'] = [t.get_text(strip=True) for t in tags]

        img_elem = card.select_one('.rd-image img')
        if img_elem:
            img_src = img_elem.get('data-src') or img_elem.get('src')
            if img_src and img_src.startswith('/'):
                img_src = BASE_URL + img_src
            salon['image_url'] = img_src

        salon['display_name'] = normalize_display_name(
            salon.get('name', ''), salon.get('kana_from_brackets'))
        salon['display_order'] = rank

        salons.append(salon)

    return salons


def scrape_salon_detail(source_id, data_source_url):
    """サロン詳細ページから公式URLを取得"""
    parts = [p for p in data_source_url.split('/') if p]
    parent_slug = parts[0] if parts else ''
    url = f"{BASE_URL}/{parent_slug}/shop-detail/{source_id}/"

    try:
        resp = fetch_with_retry(url, delay=DETAIL_DELAY)
        if not resp:
            return None, None
        soup = BeautifulSoup(resp.text, 'html.parser')

        for link in soup.select('a[rel*="nofollow"]'):
            link_text = link.get_text(strip=True)
            if 'オフィシャル' in link_text or 'HP' in link_text:
                href = link.get('href', '')
                if href.startswith('http'):
                    domain_match = re.search(r'https?://(?:www\.)?([^/]+)', href)
                    domain = domain_match.group(1) if domain_match else None
                    return href, domain
    except Exception as e:
        log.warning(f"  詳細ページエラー: {url} ({e})")

    return None, None


# =============================================================================
# チェックポイント
# =============================================================================

def load_checkpoint():
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, 'r') as f:
            return json.load(f)
    return {'completed_areas': [], 'inserted_salons': 0, 'inserted_salon_areas': 0}


def save_checkpoint(checkpoint):
    checkpoint['last_updated'] = datetime.now().isoformat()
    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump(checkpoint, f, ensure_ascii=False, indent=2)


# =============================================================================
# DB操作
# =============================================================================

def get_missing_areas(cur):
    cur.execute("""
        SELECT a.id, a.name, a.slug, a.data_source_url, a.salon_count, a.prefecture_id
        FROM areas a
        LEFT JOIN (
            SELECT area_id, count(*) as sa_cnt
            FROM salon_areas
            GROUP BY area_id
        ) sa ON sa.area_id = a.id
        WHERE a.salon_count > 0 AND COALESCE(sa_cnt, 0) = 0
        ORDER BY a.id
    """)
    return cur.fetchall()


def insert_salon(cur, salon):
    """新規サロンをDBに投入し、salon_idを返す"""
    cur.execute("""
        INSERT INTO salons (
            source_id, name, display_name, business_type,
            access, business_hours, base_price, base_duration,
            phone, official_url, domain, service_tags, image_url,
            source, last_scraped_at
        ) VALUES (
            %(source_id)s::uuid, %(name)s, %(display_name)s, %(business_type)s,
            %(access)s, %(business_hours)s, %(base_price)s, %(base_duration)s,
            %(phone)s, %(official_url)s, %(domain)s, %(service_tags)s, %(image_url)s,
            'esthe-ranking', now()
        )
        RETURNING id
    """, {
        'source_id': salon.get('source_id'),
        'name': salon.get('name'),
        'display_name': salon.get('display_name'),
        'business_type': salon.get('business_type'),
        'access': salon.get('access'),
        'business_hours': salon.get('business_hours'),
        'base_price': salon.get('base_price'),
        'base_duration': salon.get('base_duration'),
        'phone': salon.get('phone'),
        'official_url': salon.get('official_url'),
        'domain': salon.get('domain'),
        'service_tags': salon.get('service_tags') or [],
        'image_url': salon.get('image_url'),
    })
    salon_id = cur.fetchone()['id']

    # slug = 数字ID
    cur.execute("UPDATE salons SET slug = %s WHERE id = %s", (str(salon_id), salon_id))

    return salon_id


def insert_salon_area(cur, salon_id, area_id, is_primary, display_order):
    cur.execute("""
        INSERT INTO salon_areas (salon_id, area_id, is_primary, display_order)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT DO NOTHING
    """, (salon_id, area_id, is_primary, display_order))


# =============================================================================
# メイン
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description='salon_areas 欠損データ補完')
    parser.add_argument('--limit', type=int, default=0, help='処理エリア数制限')
    parser.add_argument('--sql-only', action='store_true',
                        help='SQLファイル生成のみ（DB投入なし）')
    parser.add_argument('--resume', action='store_true',
                        help='チェックポイントから再開')
    parser.add_argument('--skip-detail', action='store_true',
                        help='詳細ページスクレイプをスキップ（公式URLなし、高速モード）')
    args = parser.parse_args()

    log.info("=" * 60)
    log.info(" salon_areas 欠損データ補完")
    log.info("=" * 60)

    # DB接続
    try:
        conn = psycopg2.connect(DB_DSN)
        conn.autocommit = False
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        log.info("DB接続成功")
    except Exception as e:
        log.error(f"DB接続失敗: {e}")
        sys.exit(1)

    # source_id → salon.id のマッピングを事前ロード
    cur.execute("SELECT id, source_id FROM salons WHERE source_id IS NOT NULL")
    source_to_salon = {str(row['source_id']): row['id'] for row in cur.fetchall()}
    log.info(f"salons テーブル: {len(source_to_salon)} 件（source_id あり）")

    # 既存 official_url セット（重複防止用）
    cur.execute("SELECT official_url FROM salons WHERE official_url IS NOT NULL")
    existing_urls = {row['official_url'] for row in cur.fetchall()}
    log.info(f"既存 official_url: {len(existing_urls)} 件")

    # 欠損エリア取得
    missing_areas = get_missing_areas(cur)
    log.info(f"欠損エリア: {len(missing_areas)} 件")

    # チェックポイント
    checkpoint = load_checkpoint()
    completed_slugs = set(checkpoint['completed_areas'])
    if args.resume and completed_slugs:
        missing_areas = [a for a in missing_areas if a['slug'] not in completed_slugs]
        log.info(f"チェックポイントから再開: {len(completed_slugs)} エリア完了済み, 残り {len(missing_areas)} エリア")

    if args.limit > 0:
        missing_areas = missing_areas[:args.limit]
        log.info(f"制限: 最初の {args.limit} エリアのみ処理")

    # 統計
    stats = {
        'total_areas': len(missing_areas),
        'scraped': 0,
        'scrape_failed': 0,
        'salons_matched': 0,
        'salons_inserted': 0,
        'salon_areas_created': 0,
        'areas_with_results': 0,
    }

    start_time = time.time()

    for idx, area in enumerate(missing_areas):
        area_id = area['id']
        area_name = area['name']
        data_source_url = area['data_source_url']
        expected = area['salon_count']

        log.info(f"\n[{idx+1}/{len(missing_areas)}] {area_name} "
                 f"(id={area_id}, slug={area['slug']}, 予想{expected}件)")

        if not data_source_url:
            log.warning(f"  data_source_url なし → スキップ")
            stats['scrape_failed'] += 1
            continue

        # Step 1: esthe-ranking エリアページからサロン一覧取得
        time.sleep(REQUEST_DELAY)
        salons = scrape_area_page(data_source_url)

        if not salons:
            log.warning(f"  スクレイプ結果 0 件")
            stats['scrape_failed'] += 1
            completed_slugs.add(area['slug'])
            checkpoint['completed_areas'] = list(completed_slugs)
            save_checkpoint(checkpoint)
            continue

        stats['scraped'] += 1
        area_matched = 0
        area_inserted = 0
        area_salon_areas = 0

        try:
            for salon in salons:
                sid = salon.get('source_id')
                if not sid:
                    continue

                salon_id = source_to_salon.get(sid)

                if salon_id:
                    # 既存サロン → salon_areas だけ追加
                    insert_salon_area(cur, salon_id, area_id, False, salon['display_order'])
                    area_matched += 1
                    area_salon_areas += 1
                else:
                    # 新規サロン → 詳細ページから公式URL取得 → salons INSERT → salon_areas INSERT
                    if not args.skip_detail:
                        time.sleep(DETAIL_DELAY)
                        official_url, domain = scrape_salon_detail(sid, data_source_url)
                        salon['official_url'] = official_url
                        salon['domain'] = domain

                        # official_url重複チェック
                        if official_url and official_url in existing_urls:
                            # 既存サロンをofficial_urlで検索
                            cur.execute("SELECT id FROM salons WHERE official_url = %s", (official_url,))
                            existing = cur.fetchone()
                            if existing:
                                salon_id = existing['id']
                                source_to_salon[sid] = salon_id
                                insert_salon_area(cur, salon_id, area_id, False, salon['display_order'])
                                area_matched += 1
                                area_salon_areas += 1
                                continue
                    else:
                        salon['official_url'] = None
                        salon['domain'] = None

                    # 新規INSERT
                    salon_id = insert_salon(cur, salon)
                    source_to_salon[sid] = salon_id
                    if salon.get('official_url'):
                        existing_urls.add(salon['official_url'])

                    # salon_areas (is_primary=true for first area)
                    insert_salon_area(cur, salon_id, area_id, True, salon['display_order'])
                    area_inserted += 1
                    area_salon_areas += 1

            conn.commit()

            stats['salons_matched'] += area_matched
            stats['salons_inserted'] += area_inserted
            stats['salon_areas_created'] += area_salon_areas
            if area_salon_areas > 0:
                stats['areas_with_results'] += 1

            log.info(f"  → スクレイプ: {len(salons)} 件, "
                     f"既存マッチ: {area_matched}, 新規INSERT: {area_inserted}, "
                     f"salon_areas: {area_salon_areas}")

        except KeyboardInterrupt:
            log.info("\n中断。チェックポイント保存中...")
            conn.commit()
            save_checkpoint(checkpoint)
            sys.exit(0)

        except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
            log.error(f"  DB接続エラー: {e}")
            try:
                conn = psycopg2.connect(DB_DSN)
                conn.autocommit = False
                cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                log.info("  DB再接続成功")
            except Exception as re_err:
                log.error(f"  DB再接続失敗: {re_err}")
                save_checkpoint(checkpoint)
                sys.exit(1)
            continue

        except Exception as e:
            log.error(f"  エラー: {e}")
            try:
                conn.rollback()
            except Exception:
                pass
            continue

        # チェックポイント更新
        completed_slugs.add(area['slug'])
        checkpoint['completed_areas'] = list(completed_slugs)
        checkpoint['inserted_salons'] = stats['salons_inserted']
        checkpoint['inserted_salon_areas'] = stats['salon_areas_created']
        save_checkpoint(checkpoint)

    # --- 完了 ---
    elapsed = time.time() - start_time
    log.info(f"\n{'='*60}")
    log.info(f" 完了! (所要時間: {elapsed:.0f}秒)")
    log.info(f"{'='*60}")
    log.info(f"  処理エリア: {stats['total_areas']}")
    log.info(f"  スクレイプ成功: {stats['scraped']}")
    log.info(f"  スクレイプ失敗: {stats['scrape_failed']}")
    log.info(f"  結果ありエリア: {stats['areas_with_results']}")
    log.info(f"  既存サロンマッチ: {stats['salons_matched']}")
    log.info(f"  新規サロンINSERT: {stats['salons_inserted']}")
    log.info(f"  salon_areas作成: {stats['salon_areas_created']}")

    # DB結果サマリー
    cur.execute("SELECT count(*) AS cnt FROM salons")
    log.info(f"\n  DB salons合計: {cur.fetchone()['cnt']}件")
    cur.execute("SELECT count(*) AS cnt FROM salon_areas")
    log.info(f"  DB salon_areas合計: {cur.fetchone()['cnt']}件")

    # 残存欠損チェック
    cur.execute("""
        SELECT count(*) as cnt FROM areas a
        LEFT JOIN (SELECT area_id, count(*) as c FROM salon_areas GROUP BY area_id) sa
            ON sa.area_id = a.id
        WHERE a.salon_count > 0 AND COALESCE(sa.c, 0) = 0
    """)
    remaining = cur.fetchone()['cnt']
    log.info(f"  残存欠損エリア: {remaining}")

    conn.close()
    log.info(f"\nログ: {LOG_FILE}")


if __name__ == '__main__':
    main()
