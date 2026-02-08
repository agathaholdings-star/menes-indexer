#!/usr/bin/env python3
"""official_url が NULL のサロンだけ詳細ページから取得"""
import sqlite3
import requests
from bs4 import BeautifulSoup
import re
import time

BASE_URL = "https://www.esthe-ranking.jp"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

def get_official_url(source_id, area_slug):
    url = f"{BASE_URL}/{area_slug}/shop-detail/{source_id}/"
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
        print(f"  Error: {e}")
    return None, None

def main():
    conn = sqlite3.connect('/Users/agatha/Desktop/project/menethe-indexer/database/poc.db')
    c = conn.cursor()

    # official_url が NULL のサロンを取得
    c.execute('SELECT salon_id, source_id, salon_name FROM salon WHERE official_url IS NULL')
    salons = c.fetchall()
    print(f"更新対象: {len(salons)}件")

    for salon_id, source_id, salon_name in salons:
        print(f"[{salon_id}] {salon_name}")
        official_url, domain = get_official_url(source_id, 'ebisu')

        if official_url:
            c.execute('UPDATE salon SET official_url = ?, domain = ? WHERE salon_id = ?',
                     (official_url, domain, salon_id))
            print(f"  -> {domain}")
        else:
            print(f"  -> 見つからず")

        time.sleep(0.5)

    conn.commit()
    conn.close()

    # 結果確認
    conn = sqlite3.connect('/Users/agatha/Desktop/project/menethe-indexer/database/poc.db')
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM salon WHERE official_url IS NOT NULL')
    print(f"\n完了。official_url あり: {c.fetchone()[0]}件")
    conn.close()

if __name__ == '__main__':
    main()
