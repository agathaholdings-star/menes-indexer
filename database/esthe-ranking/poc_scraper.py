#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
esthe-ranking.jp POCスクレイパー
3エリア（恵比寿、博多、秋田）をテストスクレイピング
"""

import re
import sqlite3
import csv
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import time

BASE_URL = "https://www.esthe-ranking.jp"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}

# テスト対象エリア
TEST_AREAS = [
    {"slug": "ebisu", "name": "恵比寿", "prefecture_id": 13, "prefecture_name": "東京都"},
    {"slug": "hakata", "name": "博多", "prefecture_id": 40, "prefecture_name": "福岡県"},
    {"slug": "akita", "name": "秋田", "prefecture_id": 5, "prefecture_name": "秋田県"},
]

def init_db(db_path):
    """DBを初期化"""
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # prefecture
    c.execute('''CREATE TABLE IF NOT EXISTS prefecture (
        prefecture_id INTEGER PRIMARY KEY,
        prefecture_name TEXT NOT NULL,
        prefecture_slug TEXT NOT NULL
    )''')

    # area
    c.execute('''CREATE TABLE IF NOT EXISTS area (
        area_id INTEGER PRIMARY KEY AUTOINCREMENT,
        area_name TEXT NOT NULL,
        area_slug TEXT NOT NULL,
        prefecture_id INTEGER NOT NULL,
        salon_count INTEGER,
        source_url TEXT,
        FOREIGN KEY (prefecture_id) REFERENCES prefecture(prefecture_id)
    )''')

    # salon
    c.execute('''CREATE TABLE IF NOT EXISTS salon (
        salon_id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT,
        salon_name TEXT NOT NULL,
        salon_name_kana TEXT,
        salon_type TEXT,
        business_type TEXT,
        access TEXT,
        business_hours TEXT,
        reception_hours TEXT,
        base_price INTEGER,
        base_duration INTEGER,
        phone TEXT,
        official_url TEXT,
        domain TEXT,
        therapist_count_portal INTEGER,
        therapist_count_official INTEGER,
        description TEXT,
        service_tags TEXT,
        image_url TEXT,
        source TEXT DEFAULT 'esthe-ranking',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')

    # salon_area
    c.execute('''CREATE TABLE IF NOT EXISTS salon_area (
        salon_id INTEGER NOT NULL,
        area_id INTEGER NOT NULL,
        is_primary BOOLEAN DEFAULT 0,
        area_rank INTEGER,
        PRIMARY KEY (salon_id, area_id),
        FOREIGN KEY (salon_id) REFERENCES salon(salon_id),
        FOREIGN KEY (area_id) REFERENCES area(area_id)
    )''')

    conn.commit()
    return conn

def parse_salon_name(raw_name):
    """店名とカタカナ読みを分離"""
    # 括弧内のカタカナを抽出（位置問わず）
    # 全角括弧
    match = re.search(r'（([ァ-ヶー・]+)）', raw_name)
    if match:
        kana = match.group(1).strip()
        return raw_name.strip(), kana

    # 半角括弧
    match = re.search(r'\(([ァ-ヶー・]+)\)', raw_name)
    if match:
        kana = match.group(1).strip()
        return raw_name.strip(), kana

    # 括弧なし or 括弧内がカタカナじゃない
    return raw_name.strip(), None

def parse_price_duration(text):
    """料金と時間をパース: "70分⁄ 16,000円～" """
    if not text:
        return None, None

    # 時間
    duration_match = re.search(r'(\d+)分', text)
    duration = int(duration_match.group(1)) if duration_match else None

    # 料金
    price_match = re.search(r'([\d,]+)円', text)
    price = int(price_match.group(1).replace(',', '')) if price_match else None

    return price, duration

def scrape_area_page(area_slug):
    """エリアページをスクレイピング"""
    url = f"{BASE_URL}/{area_slug}/"
    print(f"  Fetching: {url}")

    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, 'html.parser')

    salons = []
    rank = 0

    # サロンカードを取得
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
            salon['salon_name'], salon['salon_name_kana'] = parse_salon_name(raw_name)

        # 店舗タイプ（メンエス/アジアン、店舗/派遣）
        badges = card.select('.rd-badges .badge')
        salon['salon_type'] = None
        salon['business_type'] = None
        for badge in badges:
            text = badge.get_text(strip=True)
            if text in ['メンエス', 'アジアン']:
                salon['salon_type'] = text
            elif text in ['店舗', '派遣']:
                salon['business_type'] = text

        # 基本情報（駅、時間、料金、電話）
        info_list = card.select('.blog-thumb-info li')
        for li in info_list:
            text = li.get_text(strip=True)
            icon = li.select_one('i')
            if icon:
                icon_class = icon.get('class', [])
                if 'fa-train' in icon_class:
                    salon['access'] = text
                elif 'fa-clock-o' in icon_class:
                    # 営業時間(受付：xx)の形式をパース
                    hours_match = re.match(r'^([^(（]+)(?:[(（]受付[：:]([^)）]+)[)）])?', text)
                    if hours_match:
                        salon['business_hours'] = hours_match.group(1).strip()
                        salon['reception_hours'] = hours_match.group(2).strip() if hours_match.group(2) else None
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

        # セラピスト数
        therapist_elem = card.select_one('.rd-detail_sub a[href*="/therapist/"] span:last-child')
        if therapist_elem:
            count_match = re.search(r'(\d+)', therapist_elem.get_text())
            if count_match:
                salon['therapist_count_portal'] = int(count_match.group(1))

        # サービスタグ
        tags = card.select('.ranking_c1badge .badge')
        salon['service_tags'] = ','.join([t.get_text(strip=True) for t in tags])

        # 画像URL
        img_elem = card.select_one('.rd-image img')
        if img_elem:
            salon['image_url'] = img_elem.get('data-src') or img_elem.get('src')

        # ランキング順位
        salon['area_rank'] = rank

        salons.append(salon)

    return salons

def scrape_salon_detail(source_id, area_slug):
    """サロン詳細ページから公式URLを取得"""
    url = f"{BASE_URL}/{area_slug}/shop-detail/{source_id}/"
    print(f"    Detail: {url}")

    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')

        # 公式URL - 「オフィシャル」を含むリンクを探す
        for link in soup.select('a[rel*="nofollow"]'):
            link_text = link.get_text(strip=True)
            if 'オフィシャル' in link_text or 'HP' in link_text:
                href = link.get('href', '')
                if href.startswith('http'):
                    official_url = href
                    # ドメイン抽出
                    domain_match = re.search(r'https?://(?:www\.)?([^/]+)', official_url)
                    domain = domain_match.group(1) if domain_match else None
                    return official_url, domain
    except Exception as e:
        print(f"    Error fetching detail: {e}")

    return None, None

def main():
    db_path = '/Users/agatha/Desktop/project/menethe-indexer/database/poc.db'

    # 既存DBを削除して新規作成
    import os
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = init_db(db_path)
    c = conn.cursor()

    # prefecture登録
    prefectures = {
        13: ('東京都', 'tokyo'),
        40: ('福岡県', 'fukuoka'),
        5: ('秋田県', 'akita'),
    }
    for pid, (name, slug) in prefectures.items():
        c.execute('INSERT OR IGNORE INTO prefecture VALUES (?, ?, ?)', (pid, name, slug))
    conn.commit()

    # 各エリアをスクレイピング
    all_salons = {}  # source_id -> salon_id のマッピング

    for area_info in TEST_AREAS:
        print(f"\n=== {area_info['name']} ({area_info['slug']}) ===")

        # area登録
        c.execute('''INSERT INTO area (area_name, area_slug, prefecture_id, source_url)
                     VALUES (?, ?, ?, ?)''',
                  (area_info['name'], area_info['slug'], area_info['prefecture_id'],
                   f"{BASE_URL}/{area_info['slug']}/"))
        area_id = c.lastrowid

        # サロン一覧取得
        salons = scrape_area_page(area_info['slug'])
        print(f"  Found {len(salons)} salons")

        # サロン数更新
        c.execute('UPDATE area SET salon_count = ? WHERE area_id = ?', (len(salons), area_id))

        for salon in salons:
            source_id = salon.get('source_id')

            # 重複チェック（source_idで）
            if source_id and source_id in all_salons:
                # 既存サロン → salon_areaのみ追加
                salon_id = all_salons[source_id]
                print(f"  [DUP] {salon['salon_name']} -> area_id={area_id}")
                c.execute('''INSERT OR IGNORE INTO salon_area (salon_id, area_id, is_primary, area_rank)
                             VALUES (?, ?, 0, ?)''', (salon_id, area_id, salon.get('area_rank')))
            else:
                # 新規サロン → 詳細ページから公式URL取得
                official_url, domain = None, None
                if source_id:
                    time.sleep(0.5)  # レート制限
                    official_url, domain = scrape_salon_detail(source_id, area_info['slug'])

                # salon登録
                c.execute('''INSERT INTO salon (
                    source_id, salon_name, salon_name_kana, salon_type, business_type,
                    access, business_hours, reception_hours, base_price, base_duration,
                    phone, official_url, domain, therapist_count_portal, service_tags, image_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
                    source_id,
                    salon.get('salon_name'),
                    salon.get('salon_name_kana'),
                    salon.get('salon_type'),
                    salon.get('business_type'),
                    salon.get('access'),
                    salon.get('business_hours'),
                    salon.get('reception_hours'),
                    salon.get('base_price'),
                    salon.get('base_duration'),
                    salon.get('phone'),
                    official_url,
                    domain,
                    salon.get('therapist_count_portal'),
                    salon.get('service_tags'),
                    salon.get('image_url'),
                ))
                salon_id = c.lastrowid

                if source_id:
                    all_salons[source_id] = salon_id

                # salon_area登録
                c.execute('''INSERT INTO salon_area (salon_id, area_id, is_primary, area_rank)
                             VALUES (?, ?, 1, ?)''', (salon_id, area_id, salon.get('area_rank')))

                print(f"  [NEW] {salon['salon_name']} (kana: {salon.get('salon_name_kana')})")

        conn.commit()
        time.sleep(1)  # エリア間の待機

    conn.close()
    print(f"\n✅ Done! DB saved to: {db_path}")

    # CSV出力
    export_csv(db_path)

def export_csv(db_path):
    """CSV出力"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    base_dir = '/Users/agatha/Desktop/project/menethe-indexer/database'

    # salon
    c.execute('SELECT * FROM salon')
    rows = c.fetchall()
    with open(f'{base_dir}/poc_salon.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(rows[0].keys() if rows else [])
        for row in rows:
            writer.writerow(tuple(row))

    # area
    c.execute('SELECT * FROM area')
    rows = c.fetchall()
    with open(f'{base_dir}/poc_area.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(rows[0].keys() if rows else [])
        for row in rows:
            writer.writerow(tuple(row))

    # salon_area
    c.execute('SELECT * FROM salon_area')
    rows = c.fetchall()
    with open(f'{base_dir}/poc_salon_area.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(rows[0].keys() if rows else [])
        for row in rows:
            writer.writerow(tuple(row))

    conn.close()
    print(f"✅ CSV exported to: {base_dir}/poc_*.csv")

if __name__ == '__main__':
    main()
