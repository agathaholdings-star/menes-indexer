#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
esthe-ranking.jp サイト構造マッピング
全エリアURLと階層構造を取得して site_structure.csv に出力する。
サロン情報は一切取らない。
"""

import csv
import re
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import xml.etree.ElementTree as ET

BASE_URL = "https://www.esthe-ranking.jp"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}
OUTPUT_PATH = "/Users/agatha/Desktop/project/menethe-indexer/database/site_structure.csv"


def try_sitemap():
    """サイトマップからURL一覧を取得（あれば一発）"""
    sitemap_urls = [
        f"{BASE_URL}/sitemap.xml",
        f"{BASE_URL}/sitemap_index.xml",
    ]
    for url in sitemap_urls:
        print(f"Trying sitemap: {url}")
        try:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200 and '<?xml' in resp.text[:100]:
                print(f"  Found sitemap at {url}")
                return parse_sitemap(resp.text, url)
        except Exception as e:
            print(f"  Failed: {e}")
    return None


def parse_sitemap(xml_text, sitemap_url):
    """サイトマップXMLをパースしてURL一覧を返す"""
    root = ET.fromstring(xml_text)
    ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}

    urls = []

    # sitemap index の場合 → 子サイトマップを再帰的に取得
    sitemaps = root.findall('.//sm:sitemap/sm:loc', ns)
    if sitemaps:
        print(f"  Sitemap index with {len(sitemaps)} child sitemaps")
        for loc in sitemaps:
            child_url = loc.text.strip()
            print(f"  Fetching child sitemap: {child_url}")
            try:
                resp = requests.get(child_url, headers=HEADERS, timeout=10)
                if resp.status_code == 200:
                    child_urls = parse_sitemap(resp.text, child_url)
                    if child_urls:
                        urls.extend(child_urls)
                    time.sleep(0.3)
            except Exception as e:
                print(f"    Failed: {e}")
        return urls

    # 通常のサイトマップ → URL一覧
    locs = root.findall('.//sm:url/sm:loc', ns)
    for loc in locs:
        urls.append(loc.text.strip())

    print(f"  Found {len(urls)} URLs in {sitemap_url}")
    return urls


def crawl_top_page():
    """トップページからエリアリンクを辿って構造を把握"""
    print(f"\nCrawling top page: {BASE_URL}")
    resp = requests.get(BASE_URL + "/", headers=HEADERS, timeout=10)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, 'html.parser')

    # エリアリンクを収集（トップページから辿れるすべての内部リンク）
    area_links = {}

    for a in soup.select('a[href]'):
        href = a.get('href', '')
        text = a.get_text(strip=True)

        # 内部リンクのみ
        if href.startswith('/'):
            full_url = BASE_URL + href
        elif href.startswith(BASE_URL):
            full_url = href
        else:
            continue

        # パスを正規化
        parsed = urlparse(full_url)
        path = parsed.path.rstrip('/') + '/' if parsed.path != '/' else '/'

        # 除外パターン
        skip_patterns = [
            '/login', '/register', '/contact', '/privacy', '/terms',
            '/about', '/faq', '/sitemap', '/feed', '/wp-',
            '/shop-detail/', '/therapist/', '/blog/',
            '.jpg', '.png', '.css', '.js',
        ]
        if any(pat in path.lower() for pat in skip_patterns):
            continue

        # トップページ自体はスキップ
        if path == '/':
            continue

        if path not in area_links:
            area_links[path] = text

    print(f"  Found {len(area_links)} internal links from top page")
    return area_links


def crawl_area_page(path, name):
    """エリアページからサブエリアリンクを取得"""
    url = BASE_URL + path
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')

        # ページタイトル取得
        title = soup.title.get_text(strip=True) if soup.title else name

        sub_areas = {}
        for a in soup.select('a[href]'):
            href = a.get('href', '')
            text = a.get_text(strip=True)

            if href.startswith('/'):
                full_path = href.rstrip('/') + '/' if href != '/' else '/'
            elif href.startswith(BASE_URL):
                full_path = urlparse(href).path.rstrip('/') + '/'
            else:
                continue

            # 現在のパスの下位にあるリンクのみ
            if full_path.startswith(path) and full_path != path and text:
                skip_patterns = ['/shop-detail/', '/therapist/', '/blog/']
                if not any(pat in full_path for pat in skip_patterns):
                    sub_areas[full_path] = text

        return title, sub_areas

    except Exception as e:
        print(f"    Error crawling {url}: {e}")
        return name, {}


def classify_urls_from_sitemap(urls):
    """サイトマップURLからエリア構造を推定"""
    area_entries = []
    seen_paths = set()

    for url in urls:
        parsed = urlparse(url)
        path = parsed.path

        # エリアページっぽいものだけ抽出
        # 除外: shop-detail, therapist, blog, etc.
        skip_patterns = [
            '/shop-detail/', '/therapist/', '/blog/', '/login',
            '/register', '/contact', '/privacy', '/terms',
            '/about', '/faq', '/feed/', '/wp-',
        ]
        if any(pat in path for pat in skip_patterns):
            continue

        # トップページスキップ
        if path in ('/', ''):
            continue

        # 正規化
        path = path.rstrip('/') + '/'
        if path in seen_paths:
            continue
        seen_paths.add(path)

        # パスの深さでレベル判定
        segments = [s for s in path.strip('/').split('/') if s]
        depth = len(segments)

        slug = segments[-1] if segments else ''
        parent_slug = segments[-2] if depth >= 2 else ''

        area_entries.append({
            'path': path,
            'slug': slug,
            'parent_slug': parent_slug,
            'depth': depth,
        })

    return area_entries


def build_structure_from_crawl(top_links):
    """クロールでサイト構造をビルド"""
    entries = []
    seen = set()

    # 1階層目のリンクを処理
    first_level_paths = []
    for path, name in sorted(top_links.items()):
        segments = [s for s in path.strip('/').split('/') if s]
        if len(segments) == 1:
            first_level_paths.append((path, name))

    print(f"\nFound {len(first_level_paths)} first-level area links")
    print("Crawling each area page for sub-areas...")

    for i, (path, name) in enumerate(first_level_paths):
        slug = path.strip('/')

        print(f"  [{i+1}/{len(first_level_paths)}] {name} ({slug})")

        title, sub_areas = crawl_area_page(path, name)
        has_sub = 'yes' if sub_areas else 'no'

        # エリア名をタイトルから抽出（「恵比寿のメンズエステ」→「恵比寿」）
        area_name = name
        title_match = re.match(r'^(.+?)(?:の|エリア|メンズエステ|ランキング)', title)
        if title_match:
            area_name = title_match.group(1)

        if path not in seen:
            seen.add(path)
            entries.append({
                'url': path,
                'level': 'area',
                'name': area_name,
                'parent_slug': '',
                'has_sub_areas': has_sub,
            })

        # サブエリア
        for sub_path, sub_name in sorted(sub_areas.items()):
            if sub_path not in seen:
                seen.add(sub_path)
                entries.append({
                    'url': sub_path,
                    'level': 'sub_area',
                    'name': sub_name,
                    'parent_slug': slug,
                    'has_sub_areas': 'no',
                })

        time.sleep(0.5)

    return entries


def enrich_sitemap_entries(entries):
    """サイトマップから得たエントリにページ名を付与（サンプリング）"""
    print(f"\nEnriching {len(entries)} entries with page titles...")
    print("(Sampling first 5 to understand naming pattern)")

    # 最初の5件だけタイトルを取得してパターンを確認
    for entry in entries[:5]:
        url = BASE_URL + entry['path']
        try:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, 'html.parser')
                title = soup.title.get_text(strip=True) if soup.title else ''
                name_match = re.match(r'^(.+?)(?:の|エリア|メンズエステ|ランキング)', title)
                entry['name'] = name_match.group(1) if name_match else entry['slug']
                print(f"  {entry['path']} -> {entry['name']} (title: {title[:50]})")

                # サブエリアの有無を確認
                sub_links = []
                for a in soup.select('a[href]'):
                    href = a.get('href', '')
                    if href.startswith(entry['path']) and href != entry['path']:
                        if '/shop-detail/' not in href and '/therapist/' not in href:
                            sub_links.append(href)
                entry['has_sub'] = len(sub_links) > 0
            time.sleep(0.5)
        except Exception as e:
            print(f"  Error: {e}")

    # 残りはslugをそのまま名前として使用
    for entry in entries[5:]:
        if 'name' not in entry:
            entry['name'] = entry['slug']

    return entries


def save_csv(entries, output_path):
    """CSV出力"""
    fieldnames = ['url', 'level', 'name', 'parent_slug', 'has_sub_areas']

    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for entry in entries:
            row = {k: entry.get(k, '') for k in fieldnames}
            writer.writerow(row)

    print(f"\n✅ Saved {len(entries)} entries to {output_path}")


def main():
    print("=" * 60)
    print("esthe-ranking.jp Site Structure Mapper")
    print("=" * 60)

    # Step 1: サイトマップを試す
    sitemap_urls = try_sitemap()

    # サイトマップにエリアURLが含まれているか判定
    use_sitemap = False
    if sitemap_urls:
        entries = classify_urls_from_sitemap(sitemap_urls)
        # /page/ や /girlsranking/ 等の固定ページを除外してエリア候補を数える
        area_candidates = [e for e in entries if e['depth'] == 1
                          and e['slug'] not in ('page', 'girlsranking', 'therakeep')]
        if len(area_candidates) >= 10:
            use_sitemap = True
            print(f"\nSitemap has {len(area_candidates)} area candidates. Using sitemap.")
        else:
            print(f"\nSitemap only has {len(area_candidates)} area candidates. Too few, falling back to crawl.")

    if use_sitemap:
        results = []
        for entry in entries:
            level = 'area' if entry['depth'] == 1 else 'sub_area'
            results.append({
                'url': entry['path'],
                'level': level,
                'name': entry['slug'],
                'parent_slug': entry['parent_slug'],
                'has_sub_areas': 'yes' if any(
                    e['parent_slug'] == entry['slug'] and e['depth'] > entry['depth']
                    for e in entries
                ) else 'no',
            })

        print("\nFetching page titles for all area entries...")
        for i, r in enumerate(results):
            url = BASE_URL + r['url']
            try:
                resp = requests.get(url, headers=HEADERS, timeout=10)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, 'html.parser')
                    title = soup.title.get_text(strip=True) if soup.title else ''
                    name_match = re.match(r'^(.+?)(?:の|エリア|メンズエステ|ランキング)', title)
                    r['name'] = name_match.group(1) if name_match else r['name']
                print(f"  [{i+1}/{len(results)}] {r['url']} -> {r['name']}")
                time.sleep(0.3)
            except Exception as e:
                print(f"  [{i+1}/{len(results)}] {r['url']} -> Error: {e}")

        save_csv(results, OUTPUT_PATH)

    else:
        # トップページからクロール
        print("\nCrawling from top page to discover areas...")
        top_links = crawl_top_page()

        if not top_links:
            print("ERROR: No links found on top page!")
            return

        entries = build_structure_from_crawl(top_links)
        save_csv(entries, OUTPUT_PATH)

    # サマリー表示
    print_summary(OUTPUT_PATH)


def print_summary(csv_path):
    """構造サマリーを表示"""
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    areas = [r for r in rows if r['level'] == 'area']
    sub_areas = [r for r in rows if r['level'] == 'sub_area']
    areas_with_subs = [r for r in areas if r['has_sub_areas'] == 'yes']

    print("\n" + "=" * 60)
    print("SITE STRUCTURE SUMMARY")
    print("=" * 60)
    print(f"Total entries:       {len(rows)}")
    print(f"Top-level areas:     {len(areas)}")
    print(f"Sub-areas:           {len(sub_areas)}")
    print(f"Areas with sub-areas: {len(areas_with_subs)}")

    if areas_with_subs:
        print("\nAreas with sub-areas:")
        for a in areas_with_subs:
            subs = [r for r in sub_areas if r['parent_slug'] == a['url'].strip('/').split('/')[-1]]
            print(f"  {a['name']} ({a['url']}) -> {len(subs)} sub-areas")

    # 親なしのsub_areaがないかチェック
    area_slugs = {a['url'].strip('/').split('/')[-1] for a in areas}
    orphan_subs = [r for r in sub_areas if r['parent_slug'] not in area_slugs]
    if orphan_subs:
        print(f"\nOrphan sub-areas (parent not in areas): {len(orphan_subs)}")
        for o in orphan_subs[:10]:
            print(f"  {o['url']} (parent: {o['parent_slug']})")


if __name__ == '__main__':
    main()
