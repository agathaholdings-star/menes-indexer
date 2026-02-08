#!/usr/bin/env python3
"""
DataForSEO API でメンエスポータルサイトを比較調査
エリア名 + メンズエステ で検索し、上位に出るドメインを集計
"""
import os
import json
import requests
from requests.auth import HTTPBasicAuth
from collections import Counter
from dotenv import load_dotenv

load_dotenv()

LOGIN = os.getenv('DATAFORSEO_LOGIN')
PASSWORD = os.getenv('DATAFORSEO_PASSWORD')
AUTH = HTTPBasicAuth(LOGIN, PASSWORD)

# 検索クエリ（エリア × メンズエステ）
QUERIES = [
    "恵比寿 メンズエステ",
    "新宿 メンズエステ",
    "池袋 メンズエステ",
    "福岡 メンズエステ",
    "秋田 メンズエステ",
    "名古屋 メンズエステ",
    "大阪 メンズエステ",
]

def search_google(query, depth=20):
    """DataForSEO Google SERP API"""
    url = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced"

    payload = [{
        "keyword": query,
        "location_code": 2392,  # Japan
        "language_code": "ja",
        "depth": depth,
    }]

    resp = requests.post(url, auth=AUTH, json=payload)
    resp.raise_for_status()
    return resp.json()

def extract_domains(result):
    """検索結果からドメインを抽出"""
    domains = []
    try:
        items = result['tasks'][0]['result'][0]['items']
        for item in items:
            if item.get('type') == 'organic':
                domain = item.get('domain', '')
                url = item.get('url', '')
                title = item.get('title', '')
                rank = item.get('rank_absolute', 0)
                domains.append({
                    'domain': domain,
                    'url': url,
                    'title': title,
                    'rank': rank,
                })
    except (KeyError, IndexError, TypeError):
        pass
    return domains

def main():
    print("=== メンエスポータルサイト調査 ===\n")

    all_domains = Counter()
    domain_details = {}

    for query in QUERIES:
        print(f"検索: {query}")
        result = search_google(query, depth=20)
        domains = extract_domains(result)

        for d in domains:
            domain = d['domain']
            all_domains[domain] += 1

            if domain not in domain_details:
                domain_details[domain] = {
                    'urls': set(),
                    'queries': [],
                    'best_rank': 100,
                }
            domain_details[domain]['urls'].add(d['url'])
            domain_details[domain]['queries'].append(query)
            domain_details[domain]['best_rank'] = min(
                domain_details[domain]['best_rank'],
                d['rank']
            )

        print(f"  → {len(domains)}件取得")

    # 結果をソート（出現回数 × 最高順位で評価）
    print("\n=== ポータルサイト ランキング ===\n")
    print(f"{'ドメイン':<40} 出現 最高順位 エリア")
    print("-" * 80)

    # メンエス系サイトをフィルタ（一般サイトを除外）
    exclude = ['google.', 'youtube.', 'twitter.', 'instagram.', 'facebook.',
               'wikipedia.', 'amazon.', 'rakuten.']

    sorted_domains = sorted(
        all_domains.items(),
        key=lambda x: (-x[1], domain_details[x[0]]['best_rank'])
    )

    for domain, count in sorted_domains[:30]:
        if any(ex in domain for ex in exclude):
            continue

        details = domain_details[domain]
        queries_str = ', '.join(set(details['queries']))[:30]
        print(f"{domain:<40} {count:>3}回  #{details['best_rank']:<3}  {queries_str}")

    # JSON出力
    output = {
        'queries': QUERIES,
        'rankings': [
            {
                'domain': domain,
                'count': count,
                'best_rank': domain_details[domain]['best_rank'],
                'queries': list(set(domain_details[domain]['queries'])),
                'urls': list(domain_details[domain]['urls']),
            }
            for domain, count in sorted_domains[:50]
            if not any(ex in domain for ex in exclude)
        ]
    }

    with open('portal_comparison.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("\n✅ 詳細を portal_comparison.json に保存")

if __name__ == '__main__':
    main()
