#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全821エリア一括サロンスクレイピング → ローカルSupabase投入

実行:
  python database/batch_scrape_shops.py                    # 全エリア
  python database/batch_scrape_shops.py --limit 5          # 最初の5エリアのみ
  python database/batch_scrape_shops.py --start-from 100   # 100番目から再開
  python database/batch_scrape_shops.py --dry-run           # DB投入せず確認のみ

前提:
  - supabase start 済み (127.0.0.1:54322)
  - database/.env に ANTHROPIC_API_KEY 設定済み
  - pip: psycopg2-binary, requests, beautifulsoup4, anthropic, python-dotenv
"""

import os
import re
import sys
import csv
import json
import time
import argparse
import logging
from datetime import datetime, timedelta

import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from anthropic import Anthropic

from extract_kana_from_title import fetch_title, extract_kana_from_title, extract_kana_with_llm

# .env読み込み
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# --- 設定 ---
DB_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
BASE_URL = "https://www.esthe-ranking.jp"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
LLM_MODEL = "claude-haiku-4-5-20251001"

# CSVパス
AREA_CSV = os.path.join(os.path.dirname(__file__), 'esthe-ranking', 'area_resolved_filtered.csv')

# チェックポイントファイル
CHECKPOINT_FILE = os.path.join(os.path.dirname(__file__), 'batch_scrape_checkpoint.json')

# レート制限
REQUEST_DELAY = 0.5      # リクエスト間隔（秒）
DETAIL_DELAY = 0.3        # 詳細ページ間隔
LLM_DELAY = 0.1           # LLM呼び出し間隔
MAX_RETRIES = 3            # リトライ回数

# ログ設定
LOG_FILE = os.path.join(os.path.dirname(__file__), 'batch_scrape.log')
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
# 店名正規化（test_scrape_to_supabase.py から流用）
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
    """生の店名 → display_name"""
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


# =============================================================================
# スクレイピング関数（test_scrape_to_supabase.py から流用）
# =============================================================================

def parse_salon_name(raw_name):
    """店名とカタカナ読みを分離"""
    match = re.search(r'（([ァ-ヶー・]+)）', raw_name)
    if match:
        return raw_name.strip(), match.group(1).strip()
    match = re.search(r'\(([ァ-ヶー・]+)\)', raw_name)
    if match:
        return raw_name.strip(), match.group(1).strip()
    return raw_name.strip(), None


def parse_price_duration(text):
    """料金と時間をパース"""
    if not text:
        return None, None
    duration_match = re.search(r'(\d+)分', text)
    duration = int(duration_match.group(1)) if duration_match else None
    price_match = re.search(r'([\d,]+)円', text)
    price = int(price_match.group(1).replace(',', '')) if price_match else None
    return price, duration


def fetch_with_retry(url, max_retries=MAX_RETRIES, delay=REQUEST_DELAY):
    """リトライ付きHTTP GET"""
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            if attempt < max_retries - 1:
                wait = delay * (2 ** attempt)  # exponential backoff
                log.warning(f"  リトライ {attempt+1}/{max_retries}: {url} ({e}) → {wait:.1f}秒待機")
                time.sleep(wait)
            else:
                log.error(f"  取得失敗（{max_retries}回）: {url} ({e})")
                return None


def scrape_area_page(data_source_url):
    """esthe-ranking エリアページからサロン一覧を取得"""
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
# display_name確定
# =============================================================================

def resolve_display_names(salons, llm_client):
    """全サロンのdisplay_nameを確定"""
    stats = {'bracket': 0, 'title_regex': 0, 'title_llm': 0, 'rule': 0}

    for salon in salons:
        raw_name = salon.get('name', '')
        kana = salon.get('kana_from_brackets')

        # 1. 括弧カナ
        if kana:
            salon['display_name'] = kana
            stats['bracket'] += 1
            continue

        # 2. 公式サイトの<title>から正規表現抽出
        official_url = salon.get('official_url')
        title = None
        if official_url:
            title = fetch_title(official_url)

        if title and not title.startswith('[ERROR]'):
            title_kana, pattern = extract_kana_from_title(title)
            if title_kana:
                salon['display_name'] = title_kana
                stats['title_regex'] += 1
                continue

            # 3. LLMフォールバック
            try:
                time.sleep(LLM_DELAY)
                llm_kana = extract_kana_with_llm(title, raw_name, llm_client)
                if llm_kana and llm_kana not in ('???', '該当なし'):
                    salon['display_name'] = llm_kana
                    stats['title_llm'] += 1
                    continue
            except Exception as e:
                log.warning(f"  LLMエラー: {raw_name}: {e}")

        # 4. ルールベースフォールバック
        display_name = normalize_display_name(raw_name)

        # 英語が残っていたらLLMで変換
        if re.search(r'[A-Za-z]', display_name):
            try:
                time.sleep(LLM_DELAY)
                llm_kana = extract_kana_with_llm(
                    title or raw_name, raw_name, llm_client)
                if llm_kana and llm_kana not in ('???', '該当なし'):
                    salon['display_name'] = llm_kana
                    stats['title_llm'] += 1
                    continue
            except Exception as e:
                log.warning(f"  rule→LLMエラー: {raw_name}: {e}")

        salon['display_name'] = display_name
        stats['rule'] += 1

    return stats


# =============================================================================
# チェックポイント管理
# =============================================================================

def load_checkpoint():
    """チェックポイント読み込み"""
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, 'r') as f:
            return json.load(f)
    return {'completed_areas': [], 'stats': {
        'total_areas': 0, 'total_shops': 0, 'errors': [],
        'started_at': None, 'last_updated': None
    }}


def save_checkpoint(checkpoint):
    """チェックポイント保存"""
    checkpoint['stats']['last_updated'] = datetime.now().isoformat()
    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump(checkpoint, f, ensure_ascii=False, indent=2)


# =============================================================================
# DB投入
# =============================================================================

def insert_salons(cur, salons, area_id):
    """サロンをDB投入して件数を返す"""
    inserted = 0
    skipped = 0

    for salon in salons:
        source_id = salon.get('source_id')
        if not source_id:
            continue

        # 既存チェック
        cur.execute("SELECT id FROM shops WHERE source_id = %s::uuid", (source_id,))
        existing = cur.fetchone()
        if existing:
            # shop_areasだけ追加（別エリアからの重複サロン対応）
            cur.execute("""
                INSERT INTO shop_areas (shop_id, area_id, is_primary, display_order)
                VALUES (%s, %s, false, %s)
                ON CONFLICT DO NOTHING
            """, (existing['id'], area_id, salon.get('display_order', 0)))
            skipped += 1
            continue

        # INSERT
        cur.execute("""
            INSERT INTO shops (
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
            'source_id': source_id,
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
        shop_id = cur.fetchone()['id']

        # slug = 数字ID
        cur.execute("UPDATE shops SET slug = %s WHERE id = %s", (str(shop_id), shop_id))

        # shop_areas
        cur.execute("""
            INSERT INTO shop_areas (shop_id, area_id, is_primary, display_order)
            VALUES (%s, %s, true, %s)
            ON CONFLICT DO NOTHING
        """, (shop_id, area_id, salon.get('display_order', 0)))

        inserted += 1

    return inserted, skipped


# =============================================================================
# エリアCSV読み込み
# =============================================================================

def load_areas_from_csv():
    """area_resolved_filtered.csvを読み込み"""
    areas = []
    with open(AREA_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            areas.append({
                'prefecture_id': int(row['prefecture_id']),
                'prefecture': row['prefecture'],
                'seo_keyword': row['seo_keyword'],
                'our_slug': row['our_slug'],
                'data_source_url': row['data_source_url'],
                'source_type': row['source_type'],
                'salon_count': int(row['salon_count']) if row['salon_count'] else 0,
            })
    return areas


def resolve_area_id(cur, slug, prefecture_id):
    """スラッグからarea_idを解決"""
    # まずスラッグ完全一致を試す
    cur.execute("SELECT id FROM areas WHERE slug = %s", (slug,))
    row = cur.fetchone()
    if row:
        return row['id']

    # prefecture付きスラッグを試す（重複スラッグ対策）
    cur.execute("""
        SELECT a.id FROM areas a
        JOIN prefectures p ON p.id = a.prefecture_id
        WHERE a.slug = %s AND a.prefecture_id = %s
    """, (slug, prefecture_id))
    row = cur.fetchone()
    if row:
        return row['id']

    # prefecture_slug-area_slug パターンを試す
    cur.execute("""
        SELECT a.id FROM areas a
        JOIN prefectures p ON p.id = a.prefecture_id
        WHERE a.slug LIKE %s AND a.prefecture_id = %s
    """, (f'%{slug}', prefecture_id))
    row = cur.fetchone()
    if row:
        return row['id']

    return None


# =============================================================================
# メイン処理
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description='全エリア一括サロンスクレイピング')
    parser.add_argument('--limit', type=int, default=0, help='処理エリア数制限（0=全件）')
    parser.add_argument('--start-from', type=int, default=0, help='開始インデックス（0始まり）')
    parser.add_argument('--dry-run', action='store_true', help='DB投入せずスクレイピングのみ')
    parser.add_argument('--resume', action='store_true', help='チェックポイントから再開')
    parser.add_argument('--skip-display-name', action='store_true',
                       help='display_name確定をスキップ（公式URL取得・LLM呼び出しなし、高速モード）')
    args = parser.parse_args()

    log.info("=" * 60)
    log.info(" 全エリア一括サロンスクレイピング")
    log.info("=" * 60)

    # --- エリアCSV読み込み ---
    all_areas = load_areas_from_csv()
    log.info(f"CSVからエリア読み込み: {len(all_areas)}件")

    # --- チェックポイント ---
    checkpoint = load_checkpoint()
    completed_slugs = set(checkpoint['completed_areas'])

    if args.resume and completed_slugs:
        log.info(f"チェックポイントから再開: {len(completed_slugs)}エリア完了済み")

    # --- 処理対象の決定 ---
    target_areas = all_areas[args.start_from:]
    if args.limit > 0:
        target_areas = target_areas[:args.limit]

    if args.resume:
        target_areas = [a for a in target_areas if a['our_slug'] not in completed_slugs]

    log.info(f"処理対象: {len(target_areas)}エリア")

    if not target_areas:
        log.info("処理対象が0件のため終了")
        return

    # --- DB接続 ---
    if not args.dry_run:
        try:
            conn = psycopg2.connect(DB_DSN)
            conn.autocommit = False
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            log.info("ローカルSupabase接続成功")
        except Exception as e:
            log.error(f"DB接続失敗: {e}")
            log.error("→ supabase start を実行してください")
            sys.exit(1)
    else:
        conn = None
        cur = None
        log.info("[DRY RUN] DB投入なし")

    # --- LLMクライアント ---
    llm_client = None
    if not args.skip_display_name:
        llm_client = Anthropic()
        log.info("Claude APIクライアント初期化完了")
    else:
        log.info("[高速モード] display_name確定スキップ（公式URL・LLMなし）")

    # --- 統計 ---
    start_time = time.time()
    total_inserted = 0
    total_skipped = 0
    errors = []

    if not checkpoint['stats'].get('started_at'):
        checkpoint['stats']['started_at'] = datetime.now().isoformat()

    # --- メインループ ---
    for idx, area in enumerate(target_areas):
        area_num = args.start_from + idx + 1
        elapsed = timedelta(seconds=int(time.time() - start_time))
        slug = area['our_slug']

        log.info(f"\n[{area_num}/{len(all_areas)}] {area['seo_keyword']} "
                 f"(slug={slug}, 予想{area['salon_count']}件) "
                 f"[経過: {elapsed}]")

        try:
            # Step 1: サロン一覧取得
            time.sleep(REQUEST_DELAY)
            salons = scrape_area_page(area['data_source_url'])
            log.info(f"  → {len(salons)}件のサロンを検出")

            if not salons:
                log.info(f"  → スキップ（0件）")
                completed_slugs.add(slug)
                checkpoint['completed_areas'] = list(completed_slugs)
                save_checkpoint(checkpoint)
                continue

            # Step 2: 公式URL取得 + display_name確定
            if not args.skip_display_name:
                log.info(f"  公式URL取得中...")
                for salon in salons:
                    source_id = salon.get('source_id')
                    if source_id:
                        time.sleep(DETAIL_DELAY)
                        official_url, domain = scrape_salon_detail(
                            source_id, area['data_source_url'])
                        salon['official_url'] = official_url
                        salon['domain'] = domain
                    else:
                        salon['official_url'] = None
                        salon['domain'] = None

                log.info(f"  display_name確定中...")
                dn_stats = resolve_display_names(salons, llm_client)
                log.info(f"  → 括弧:{dn_stats['bracket']} title:{dn_stats['title_regex']} "
                         f"LLM:{dn_stats['title_llm']} ルール:{dn_stats['rule']}")
            else:
                # 高速モード: display_name = ルールベースのみ
                for salon in salons:
                    salon['official_url'] = None
                    salon['domain'] = None
                    salon['display_name'] = normalize_display_name(
                        salon.get('name', ''),
                        salon.get('kana_from_brackets')
                    )

            # Step 3: DB投入
            if not args.dry_run and cur:
                area_id = resolve_area_id(cur, slug, area['prefecture_id'])
                if not area_id:
                    log.error(f"  area_id解決失敗: slug={slug}, pref={area['prefecture_id']}")
                    errors.append({'slug': slug, 'error': 'area_id not found'})
                    continue

                inserted, skipped = insert_salons(cur, salons, area_id)
                conn.commit()
                total_inserted += inserted
                total_skipped += skipped
                log.info(f"  → DB投入: {inserted}件 新規, {skipped}件 スキップ")
            else:
                log.info(f"  [DRY RUN] {len(salons)}件（DB投入なし）")

            # チェックポイント更新
            completed_slugs.add(slug)
            checkpoint['completed_areas'] = list(completed_slugs)
            checkpoint['stats']['total_areas'] = len(completed_slugs)
            checkpoint['stats']['total_shops'] = total_inserted + total_skipped
            save_checkpoint(checkpoint)

        except KeyboardInterrupt:
            log.info("\n中断されました。チェックポイント保存中...")
            if conn and not args.dry_run:
                conn.commit()
            save_checkpoint(checkpoint)
            log.info(f"チェックポイント保存完了: {len(completed_slugs)}エリア完了")
            log.info(f"再開: python batch_scrape_shops.py --resume")
            sys.exit(0)

        except Exception as e:
            log.error(f"  エラー: {e}")
            errors.append({'slug': slug, 'error': str(e)})
            if conn and not args.dry_run:
                conn.rollback()
            continue

    # --- 完了 ---
    elapsed = timedelta(seconds=int(time.time() - start_time))
    log.info(f"\n{'=' * 60}")
    log.info(f" 完了! (所要時間: {elapsed})")
    log.info(f"{'=' * 60}")
    log.info(f"  処理エリア: {len(target_areas)}件")
    log.info(f"  新規サロン: {total_inserted}件")
    log.info(f"  スキップ:   {total_skipped}件（既存）")
    log.info(f"  エラー:     {len(errors)}件")

    if errors:
        log.info(f"\n  エラー詳細:")
        for err in errors:
            log.info(f"    - {err['slug']}: {err['error']}")

    # DB結果サマリー
    if not args.dry_run and cur:
        cur.execute("SELECT count(*) AS cnt FROM shops")
        log.info(f"\n  DB shops合計: {cur.fetchone()['cnt']}件")
        cur.execute("SELECT count(*) AS cnt FROM shop_areas")
        log.info(f"  DB shop_areas合計: {cur.fetchone()['cnt']}件")
        conn.close()

    log.info(f"\nログ: {LOG_FILE}")
    log.info(f"チェックポイント: {CHECKPOINT_FILE}")


if __name__ == '__main__':
    main()
