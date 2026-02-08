#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
エリア別サロン数カウンター

area_master_final.csvの各source_urlにアクセスし、サロン数を取得。
結果をarea_master_with_counts.csvに出力。
3件未満のエリアを除外したarea_master_filtered.csvも出力。

進捗は salon_counts_cache.json に保存（中断再開可能）。
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
REQUEST_DELAY = 1.0  # seconds between requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(BASE_DIR, 'salon_counts_cache.json')
INPUT_PATH = os.path.join(BASE_DIR, 'area_master_final.csv')
OUTPUT_PATH = os.path.join(BASE_DIR, 'area_master_with_counts.csv')
FILTERED_PATH = os.path.join(BASE_DIR, 'area_master_filtered.csv')

MIN_SALONS = 3


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

        # サロンカードを数える（POCスクレイパーと同じセレクタ）
        cards = soup.select('.shop-ranking.blog-thumb-v2')
        return len(cards)
    except Exception as e:
        print(f"  ERROR: {url} -> {e}")
        return -1


def main():
    # 入力読み込み
    with open(INPUT_PATH, 'r', encoding='utf-8') as f:
        areas = list(csv.DictReader(f))

    # ユニークURL一覧
    unique_urls = sorted(set(r['source_url'] for r in areas))
    print(f"総エリア数: {len(areas)}")
    print(f"ユニークURL数: {len(unique_urls)}")

    # キャッシュ読み込み
    cache = load_cache()
    cached = sum(1 for u in unique_urls if u in cache)
    print(f"キャッシュ済み: {cached}/{len(unique_urls)}")
    remaining = len(unique_urls) - cached
    if remaining > 0:
        print(f"残り: {remaining}件 (推定{remaining * REQUEST_DELAY / 60:.1f}分)")

    # 各URLのサロン数を取得
    for i, url in enumerate(unique_urls):
        if url in cache:
            continue

        print(f"[{i+1}/{len(unique_urls)}] {url} ...", end=" ", flush=True)
        count = count_salons(url)
        cache[url] = count
        print(f"{count}件")

        # 10件ごとにキャッシュ保存
        if (i + 1) % 10 == 0:
            save_cache(cache)

        time.sleep(REQUEST_DELAY)

    # 最終キャッシュ保存
    save_cache(cache)

    # 結果をエリアマスタに結合
    for area in areas:
        area['salon_count'] = cache.get(area['source_url'], -1)

    # area_master_with_counts.csv 出力
    fieldnames = ['area_name', 'prefecture', 'slug', 'source_url', 'type',
                  'parent_area', 'in_me', 'in_mg', 'ahrefs_volume', 'reasons',
                  'salon_count']

    with open(OUTPUT_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for area in areas:
            writer.writerow(area)

    # フィルタリング: salon_count >= MIN_SALONS
    filtered = [a for a in areas if a['salon_count'] >= MIN_SALONS]

    with open(FILTERED_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for area in filtered:
            writer.writerow(area)

    # サマリー
    print(f"\n{'='*50}")
    print(f"=== サロン数カウント結果 ===")
    print(f"{'='*50}")
    print(f"スクレイピング対象URL: {len(unique_urls)}")
    print(f"エラー: {sum(1 for v in cache.values() if v == -1)}件")
    print(f"\n全465エリアのサロン数分布:")

    # 分布
    brackets = [(0, 0), (1, 2), (3, 5), (6, 10), (11, 20), (21, 50), (51, 100), (101, 9999)]
    for low, high in brackets:
        count = sum(1 for a in areas if low <= a['salon_count'] <= high)
        label = f"{low}" if low == high else f"{low}-{high}" if high < 9999 else f"{low}+"
        bar = "█" * count
        print(f"  {label:>6}件: {count:>3} {bar}")

    print(f"\n全エリア: {len(areas)}")
    print(f"採用（{MIN_SALONS}件以上）: {len(filtered)}")
    print(f"除外（{MIN_SALONS}件未満）: {len(areas) - len(filtered)}")

    # 除外されるエリア一覧
    excluded = [a for a in areas if a['salon_count'] < MIN_SALONS]
    if excluded:
        print(f"\n除外エリア（サロン{MIN_SALONS}件未満）:")
        for a in sorted(excluded, key=lambda x: x['salon_count']):
            print(f"  {a['area_name']}({a['prefecture']}): {a['salon_count']}件 [{a['source_url']}]")

    # 都道府県カバレッジ（フィルタ後）
    prefs_before = set(a['prefecture'] for a in areas if a['prefecture'])
    prefs_after = set(a['prefecture'] for a in filtered if a['prefecture'])
    lost_prefs = prefs_before - prefs_after
    print(f"\n都道府県カバレッジ: {len(prefs_after)}/47")
    if lost_prefs:
        print(f"  ⚠ フィルタで失われる都道府県: {', '.join(sorted(lost_prefs))}")

    print(f"\n✅ 出力:")
    print(f"  {OUTPUT_PATH}")
    print(f"  {FILTERED_PATH}")


if __name__ == '__main__':
    main()
