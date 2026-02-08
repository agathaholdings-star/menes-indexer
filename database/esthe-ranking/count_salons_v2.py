#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
エリア別サロン数カウンター v2

area_resolved_646.csv（854件）の各data_source_urlにアクセスし、サロン数を取得。
結果をarea_resolved_with_counts.csvに出力。
3件未満のエリアを除外したarea_resolved_filtered.csvも出力。

キャッシュ: ../merged/salon_counts_cache.json を共有（旧版との互換性維持）。
"""

import csv
import json
import os
import time
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.esthe-ranking.jp"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}
REQUEST_DELAY = 1.0

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(BASE_DIR, '..', 'merged', 'salon_counts_cache.json')
INPUT_PATH = os.path.join(BASE_DIR, 'area_resolved_646.csv')
OUTPUT_PATH = os.path.join(BASE_DIR, 'area_resolved_with_counts.csv')
FILTERED_PATH = os.path.join(BASE_DIR, 'area_resolved_filtered.csv')

MIN_SALONS = 3

# area_resolved_646.csv のカラム + salon_count
FIELDNAMES = [
    'prefecture_id', 'prefecture', 'seo_keyword', 'search_volume',
    'our_slug', 'data_source_url', 'source_type', 'resolution',
    'parent_group', 'nearby_areas', 'salon_count'
]


def load_cache():
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_cache(cache):
    with open(CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def count_salons(source_url):
    """source_urlのサロン数をカウント"""
    url = BASE_URL + source_url
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        cards = soup.select('.shop-ranking.blog-thumb-v2')
        return len(cards)
    except Exception as e:
        print(f"  ERROR: {url} -> {e}")
        return -1


def main():
    with open(INPUT_PATH, 'r', encoding='utf-8') as f:
        areas = list(csv.DictReader(f))

    unique_urls = sorted(set(r['data_source_url'] for r in areas))
    print(f"総エリア数: {len(areas)}")
    print(f"ユニークURL数: {len(unique_urls)}")

    cache = load_cache()
    cached = sum(1 for u in unique_urls if u in cache)
    print(f"キャッシュ済み: {cached}/{len(unique_urls)}")

    remaining = len(unique_urls) - cached
    if remaining > 0:
        print(f"残り: {remaining}件 (推定{remaining * REQUEST_DELAY / 60:.1f}分)")
    else:
        print("全URLキャッシュ済み。スクレイピング不要。")

    # スクレイピング
    scraped = 0
    errors = 0
    for i, url in enumerate(unique_urls):
        if url in cache:
            continue

        print(f"[{scraped+1}/{remaining}] {url} ...", end=" ", flush=True)
        count = count_salons(url)
        cache[url] = count
        scraped += 1
        if count == -1:
            errors += 1
            print("ERROR")
        else:
            print(f"{count}件")

        if scraped % 10 == 0:
            save_cache(cache)

        time.sleep(REQUEST_DELAY)

    save_cache(cache)

    if scraped > 0:
        print(f"\nスクレイピング完了: {scraped}件 (エラー: {errors}件)")

    # salon_count を結合
    for area in areas:
        area['salon_count'] = cache.get(area['data_source_url'], -1)

    # area_resolved_with_counts.csv
    with open(OUTPUT_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        for area in areas:
            writer.writerow({k: area.get(k, '') for k in FIELDNAMES})

    # フィルタリング
    filtered = [a for a in areas if int(a['salon_count']) >= MIN_SALONS]

    with open(FILTERED_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        for area in filtered:
            writer.writerow({k: area.get(k, '') for k in FIELDNAMES})

    # サマリー
    print(f"\n{'='*60}")
    print(f"サロン数カウント結果")
    print(f"{'='*60}")

    brackets = [(0, 0), (1, 2), (3, 5), (6, 10), (11, 20), (21, 50), (51, 100), (101, 9999)]
    for low, high in brackets:
        c = sum(1 for a in areas if low <= int(a['salon_count']) <= high)
        label = f"{low}" if low == high else f"{low}-{high}" if high < 9999 else f"{low}+"
        bar = "█" * c
        print(f"  {label:>6}件: {c:>3} {bar}")

    error_count = sum(1 for a in areas if int(a['salon_count']) == -1)
    if error_count:
        print(f"\n  エラー: {error_count}件")

    print(f"\n全エリア: {len(areas)}")
    print(f"採用（{MIN_SALONS}件以上）: {len(filtered)}")
    print(f"除外（{MIN_SALONS}件未満）: {len(areas) - len(filtered)}")

    # 除外エリア一覧
    excluded = [a for a in areas if int(a['salon_count']) < MIN_SALONS]
    if excluded:
        print(f"\n除外エリア（サロン{MIN_SALONS}件未満）:")
        for a in sorted(excluded, key=lambda x: int(x['salon_count'])):
            sv = a['search_volume']
            print(f"  {a['seo_keyword']}（{a['prefecture']}）: {a['salon_count']}件 [SV:{sv}] {a['data_source_url']}")

    # 都道府県カバレッジ
    prefs_before = set(a['prefecture'] for a in areas)
    prefs_after = set(a['prefecture'] for a in filtered)
    lost = prefs_before - prefs_after
    print(f"\n都道府県カバレッジ: {len(prefs_after)}/47")
    if lost:
        print(f"  ⚠ フィルタで失われる都道府県: {', '.join(sorted(lost))}")

    print(f"\n出力:")
    print(f"  {OUTPUT_PATH}")
    print(f"  {FILTERED_PATH}")


if __name__ == '__main__':
    main()
