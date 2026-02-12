#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
テストスクレイピング: 1エリア → サロン → セラピスト → ローカルSupabase投入

実行:
  python database/test_scrape_to_supabase.py

前提:
  - supabase start 済み (127.0.0.1:54322)
  - database/.env に ANTHROPIC_API_KEY 設定済み
  - pip: psycopg2-binary, requests, beautifulsoup4, anthropic, python-dotenv
"""

import os
import re
import sys
import json
import time
import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv
from anthropic import Anthropic
from extract_kana_from_title import fetch_title, extract_kana_from_title, extract_kana_with_llm

# .env読み込み（ANTHROPIC_API_KEY等）
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# --- 設定 ---
DB_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
BASE_URL = "https://www.esthe-ranking.jp"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
LLM_MODEL = "claude-haiku-4-5-20251001"

# テスト対象: 博多（福岡県）
TARGET_AREA = {
    "area_id": 787,
    "slug": "hakata",
    "prefecture_id": 40,
    "data_source_url": "/hakata/",
}

MAX_THERAPISTS_PER_SALON = 5  # テスト制限
MAX_SALONS_FOR_THERAPIST = 0  # セラピスト取得するサロン数上限（0=スキップ, -1=全件）

# =============================================================================
# 店名の正規化 → display_name
# =============================================================================

# エリア名・付帯語の除去パターン
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
    re.compile(r'[（(][ァ-ヶー・a-zA-Z\s]+[）)]'),  # （カタカナ）or (English)
    re.compile(r'～[^～]+～'),                         # ～サブタイトル～
    re.compile(r'〜[^〜]+〜'),                         # 〜サブタイトル〜
    re.compile(r'【[^】]+】'),                         # 【補足】
]


def normalize_display_name(raw_name, kana_from_brackets=None):
    """
    生の店名 → display_name（タイトル・検索用の正規化済み店名）

    優先順位:
      1. 括弧内カナがあればそれを使う（esthe-ranking由来）
      2. ルールベースでエリア名等を除去して残った部分
      3. それでもダメならLLMで生成
    """
    # Step 1: 括弧カナがあればそのまま使う
    if kana_from_brackets:
        return kana_from_brackets

    # Step 2: ルールベースで正規化
    name = raw_name.strip()

    # ノイズ除去（括弧内、～サブタイトル～等）
    for pat in NOISE_PATTERNS:
        name = pat.sub('', name)

    # エリア名・ルーム等の除去
    name = AREA_SUFFIXES.sub('', name)

    # 末尾の記号・スペース除去
    name = re.sub(r'[・/／\s　♡☆★\-]+$', '', name)
    name = re.sub(r'^[・/／\s　\-]+', '', name)

    name = name.strip()

    if name:
        return name

    # ルールベースで空になった場合は元の名前を返す（LLMフォールバックは後で）
    return raw_name.strip()


def normalize_display_name_llm(client, raw_name):
    """LLMで店名を正規化（ルールベースで処理できなかった場合のフォールバック）"""
    resp = client.messages.create(
        model=LLM_MODEL,
        max_tokens=100,
        messages=[{"role": "user", "content": f"""メンズエステサロンの正式名称から、検索・タイトル用の短い店名を抽出してください。

ルール:
- エリア名（恵比寿、中目黒等）を除去
- 「ルーム」「店」「支店」を除去
- 括弧内の読み仮名があればそちらを優先
- なるべく短く、検索されやすい形に

入力: {raw_name}
出力（店名のみ）:"""}]
    )
    return resp.content[0].text.strip().strip('"\'')


# =============================================================================
# poc_scraper.py からの流用関数
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
    """料金と時間をパース: '70分⁄ 16,000円～'"""
    if not text:
        return None, None
    duration_match = re.search(r'(\d+)分', text)
    duration = int(duration_match.group(1)) if duration_match else None
    price_match = re.search(r'([\d,]+)円', text)
    price = int(price_match.group(1).replace(',', '')) if price_match else None
    return price, duration


def scrape_area_page(data_source_url):
    """esthe-ranking エリアページからサロン一覧を取得"""
    url = BASE_URL + data_source_url
    print(f"  Fetching: {url}")

    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, 'html.parser')

    salons = []
    rank = 0

    for card in soup.select('.shop-ranking.blog-thumb-v2'):
        rank += 1
        salon = {}

        # source_id (UUID)
        keep_btn = card.select_one('button.therakeep')
        if keep_btn:
            salon['source_id'] = keep_btn.get('data-keep-id')

        # 店名
        name_elem = card.select_one('h3 a b')
        if name_elem:
            raw_name = name_elem.get_text(strip=True)
            salon['name'], salon['kana_from_brackets'] = parse_salon_name(raw_name)

        # 店舗タイプ（メンエス/アジアン、店舗/派遣）
        badges = card.select('.rd-badges .badge')
        salon['business_type'] = None
        for badge in badges:
            text = badge.get_text(strip=True)
            if text in ['店舗', '派遣']:
                salon['business_type'] = text

        # 基本情報
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
                if hours_match:
                    salon['business_hours'] = hours_match.group(1).strip()
                else:
                    salon['business_hours'] = text
            elif 'fa-jpy' in icon_class:
                salon['base_price'], salon['base_duration'] = parse_price_duration(text)

        # 電話番号
        phone_elem = card.select_one('a.phone')
        if phone_elem:
            href = phone_elem.get('href', '')
            if href.startswith('tel:'):
                salon['phone'] = href.replace('tel:', '')

        # サービスタグ
        tags = card.select('.ranking_c1badge .badge')
        salon['service_tags'] = [t.get_text(strip=True) for t in tags]

        # 画像URL
        img_elem = card.select_one('.rd-image img')
        if img_elem:
            salon['image_url'] = img_elem.get('data-src') or img_elem.get('src')

        # ランキング順位
        salon['display_order'] = rank

        salons.append(salon)

    return salons


def scrape_salon_detail(source_id, data_source_url):
    """サロン詳細ページから公式URLを取得"""
    parts = [p for p in data_source_url.split('/') if p]
    parent_slug = parts[0] if parts else ''
    url = f"{BASE_URL}/{parent_slug}/shop-detail/{source_id}/"
    print(f"    Detail: {url}")

    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
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
        print(f"    Error fetching detail: {e}")

    return None, None


# =============================================================================
# therapist_scraper.py からの流用
# =============================================================================

def fetch_page(url, timeout=15):
    """ページを取得"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding
        return resp.text
    except Exception as e:
        print(f"    ⚠ fetch失敗: {url} ({e})")
        return None


# TherapistScraperクラスを直接importして使う
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'therapist-scraper'))
from therapist_scraper import TherapistScraper


# =============================================================================
# メイン処理
# =============================================================================

def main():
    print("=" * 60)
    print(f" テストスクレイピング: {TARGET_AREA['slug']} → ローカルSupabase")
    print("=" * 60)

    # --- DB接続 ---
    print("\n[0] DB接続...")
    try:
        conn = psycopg2.connect(DB_DSN)
        conn.autocommit = False
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        print("  ✓ ローカルSupabase接続成功")
    except Exception as e:
        print(f"  ✗ DB接続失敗: {e}")
        print("  → supabase start を実行してください")
        sys.exit(1)

    # LLMクライアント（display_name生成用）
    llm_client = Anthropic()

    # エリア確認
    cur.execute("SELECT id, name, slug FROM areas WHERE id = %s", (TARGET_AREA['area_id'],))
    area = cur.fetchone()
    if not area:
        print(f"  ✗ area_id={TARGET_AREA['area_id']} が見つかりません")
        sys.exit(1)
    print(f"  ✓ 対象エリア: {area['name']} (id={area['id']}, slug={area['slug']})")

    # --- Step 1: サロン一覧スクレイピング ---
    print(f"\n[1] esthe-ranking サロン一覧取得...")
    salons = scrape_area_page(TARGET_AREA['data_source_url'])
    print(f"  ✓ {len(salons)}件のサロンを検出")

    if not salons:
        print("  サロンが0件のため終了")
        conn.close()
        return

    # --- Step 1.5: 各サロンの公式URL取得 ---
    print(f"\n[1.5] サロン詳細ページから公式URL取得...")
    for salon in salons:
        source_id = salon.get('source_id')
        if source_id:
            time.sleep(0.5)
            official_url, domain = scrape_salon_detail(source_id, TARGET_AREA['data_source_url'])
            salon['official_url'] = official_url
            salon['domain'] = domain
            print(f"    {salon.get('name', '?')}: {official_url or '(なし)'}")
        else:
            salon['official_url'] = None
            salon['domain'] = None

    # --- Step 1.7: display_name 確定 ---
    # 優先順位:
    #   1. esthe-ranking括弧カナ（エルテラス等）
    #   2. 公式サイト<title>タグからの正規表現抽出（スイートミスト等）
    #   3. LLMフォールバック（titleを入力として渡す）
    #   4. ルールベース正規化（エリア名除去等）
    print(f"\n[1.7] display_name 確定...")
    stats = {'bracket': 0, 'title_regex': 0, 'title_llm': 0, 'rule': 0}
    for salon in salons:
        raw_name = salon.get('name', '')
        kana = salon.get('kana_from_brackets')

        # 1. 括弧カナがあればそのまま使う
        if kana:
            salon['display_name'] = kana
            stats['bracket'] += 1
            print(f"    [括弧] {raw_name} → {kana}")
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
                print(f"    [title:{pattern}] {raw_name} → {title_kana}")
                continue

            # 3. LLMフォールバック（titleを入力として渡す）
            try:
                llm_kana = extract_kana_with_llm(title, raw_name, llm_client)
                if llm_kana and llm_kana not in ('???', '該当なし'):
                    salon['display_name'] = llm_kana
                    stats['title_llm'] += 1
                    print(f"    [LLM] {raw_name} → {llm_kana}  (title: {title[:60]})")
                    continue
            except Exception as e:
                print(f"    [LLM error] {raw_name}: {e}")

        # 4. ルールベースフォールバック（エリア名除去等）
        display_name = normalize_display_name(raw_name)

        # ルールベース後にまだ英語が残ってたらLLMで変換
        if re.search(r'[A-Za-z]', display_name):
            try:
                llm_kana = extract_kana_with_llm(
                    title or raw_name, raw_name, llm_client)
                if llm_kana and llm_kana not in ('???', '該当なし'):
                    salon['display_name'] = llm_kana
                    stats['title_llm'] += 1
                    print(f"    [rule→LLM] {raw_name} → {llm_kana}")
                    continue
            except Exception as e:
                print(f"    [rule→LLM error] {raw_name}: {e}")

        salon['display_name'] = display_name
        stats['rule'] += 1
        print(f"    [rule] {raw_name} → {display_name}")

    print(f"  ✓ 括弧カナ: {stats['bracket']}件, title正規表現: {stats['title_regex']}件, "
          f"LLM: {stats['title_llm']}件, ルール: {stats['rule']}件")

    # --- Step 2: shops + shop_areas INSERT ---
    print(f"\n[2] shops + shop_areas にINSERT...")
    shop_ids = {}  # source_id -> shop_id

    for salon in salons:
        # 既存チェック（source_idで）
        source_id = salon.get('source_id')
        if source_id:
            cur.execute("SELECT id FROM salons WHERE source_id = %s::uuid", (source_id,))
            existing = cur.fetchone()
            if existing:
                shop_ids[source_id] = existing['id']
                print(f"    [SKIP] {salon.get('display_name')} (既存 shop_id={existing['id']})")
                continue

        # INSERT（slugはid確定後にセット）
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
        salon_id = cur.fetchone()['id']

        # slug = 数字ID
        cur.execute("UPDATE salons SET slug = %s WHERE id = %s", (str(salon_id), salon_id))

        if source_id:
            shop_ids[source_id] = salon_id

        # salon_areas
        cur.execute("""
            INSERT INTO salon_areas (salon_id, area_id, is_primary, display_order)
            VALUES (%s, %s, true, %s)
            ON CONFLICT DO NOTHING
        """, (salon_id, TARGET_AREA['area_id'], salon.get('display_order', 0)))

        print(f"    [NEW] {salon.get('display_name')} → salon_id={salon_id}")

    conn.commit()
    print(f"  ✓ {len(shop_ids)}件のサロンをINSERT")

    # --- Step 3 & 4: セラピスト取得 + INSERT ---
    print(f"\n[3] セラピスト取得 (各サロン最大{MAX_THERAPISTS_PER_SALON}名)...")

    # 公式URLがあるサロンだけ対象
    salons_with_url = [s for s in salons if s.get('official_url')]
    if not salons_with_url:
        print("  公式URLのあるサロンが0件のためセラピスト取得スキップ")
        _print_summary_from_db(conn)
        conn.close()
        return

    if MAX_SALONS_FOR_THERAPIST == 0:
        print("  MAX_SALONS_FOR_THERAPIST=0 のためセラピスト取得スキップ")
        _print_summary_from_db(conn)
        conn.close()
        return
    elif MAX_SALONS_FOR_THERAPIST > 0:
        salons_for_therapist = salons_with_url[:MAX_SALONS_FOR_THERAPIST]
    else:
        salons_for_therapist = salons_with_url
    print(f"  公式URLあり: {len(salons_with_url)}/{len(salons)}件 → セラピスト取得: {len(salons_for_therapist)}件")

    scraper = TherapistScraper()
    total_therapists = 0

    for salon in salons_for_therapist:
        source_id = salon.get('source_id')
        salon_id = shop_ids.get(source_id)
        if not salon_id:
            print(f"    [SKIP] {salon.get('display_name')} - salon_idなし")
            continue

        therapists = scraper.scrape_salon(
            salon['official_url'],
            salon.get('name', ''),
            max_therapists=MAX_THERAPISTS_PER_SALON
        )

        if not therapists:
            print(f"    → セラピスト取得なし")
            continue

        # therapists INSERT
        print(f"\n[4] therapists INSERT (salon_id={salon_id})...")
        for t in therapists:
            t_name = t.get('name')
            if not t_name:
                continue

            # bustをtext化（スキーマがtext型のため）
            bust_val = t.get('bust')
            if bust_val is not None:
                bust_val = str(bust_val)

            # image_urlsをJSONB用に整形
            image_urls = t.get('image_urls') or []
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
                    RETURNING id
                """, {
                    'salon_id': salon_id,
                    'name': t_name,
                    'age': t.get('age'),
                    'height': t.get('height'),
                    'bust': bust_val,
                    'waist': t.get('waist'),
                    'hip': t.get('hip'),
                    'image_urls': json.dumps(image_urls, ensure_ascii=False),
                    'profile_text': t.get('profile_text'),
                    'source_url': t.get('source_url'),
                })
                t_id = cur.fetchone()['id']
                # slug = 数字ID
                cur.execute("UPDATE therapists SET slug = %s WHERE id = %s",
                            (str(t_id), t_id))
                total_therapists += 1
                print(f"      ✓ {t_name} → therapist_id={t_id}")
            except Exception as e:
                print(f"      ✗ {t_name}: {e}")
                conn.rollback()

        conn.commit()

    # --- 結果表示 ---
    print(f"\n{'=' * 60}")
    print(f" 完了!")
    print(f"{'=' * 60}")
    _print_summary_from_db(conn)
    conn.close()


def _print_summary_from_db(conn):
    """投入結果をクエリして表示"""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("SELECT count(*) AS cnt FROM salons")
    print(f"\n  salons: {cur.fetchone()['cnt']}件")

    cur.execute("""
        SELECT s.name, s.display_name, s.official_url, a.name AS area_name
        FROM salons s
        JOIN salon_areas sa ON sa.salon_id = s.id
        JOIN areas a ON a.id = sa.area_id
        WHERE sa.area_id = %s
        ORDER BY sa.display_order
    """, (TARGET_AREA['area_id'],))
    rows = cur.fetchall()
    print(f"\n  {TARGET_AREA['slug']}エリアのサロン ({len(rows)}件):")
    for r in rows:
        print(f"    - {r['display_name']} ← {r['name']}")

    cur.execute("""
        SELECT t.name, t.age, t.height, t.bust, t.waist, t.hip, s.display_name AS shop_name
        FROM therapists t
        JOIN salons s ON s.id = t.salon_id
        JOIN salon_areas sa ON sa.salon_id = s.id
        WHERE sa.area_id = %s
        ORDER BY s.display_name, t.name
    """, (TARGET_AREA['area_id'],))
    rows = cur.fetchall()
    print(f"\n  セラピスト ({len(rows)}名):")
    for r in rows:
        age = f"{r['age']}歳" if r['age'] else '?歳'
        height = f"{r['height']}cm" if r['height'] else '?cm'
        sizes = f"B{r['bust'] or '?'}/W{r['waist'] or '?'}/H{r['hip'] or '?'}"
        print(f"    - {r['name']} ({age}, {height}, {sizes}) @ {r['shop_name']}")


if __name__ == '__main__':
    main()
