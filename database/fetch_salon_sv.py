#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
poc_kana_comparison.csv の final_kana カラムに対して
DataForSEO で検索ボリュームを取得し、search_volume カラムを追加して上書き保存。
"""

import os
import csv
import json
import requests
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

CSV_PATH = '/Users/agatha/Desktop/project/menethe-indexer/database/poc_kana_comparison.csv'

def fetch_search_volumes(keywords, auth):
    """DataForSEO APIでキーワードの月間検索ボリュームを一括取得"""
    sv_map = {}
    batch_size = 20
    import time

    for i in range(0, len(keywords), batch_size):
        batch = keywords[i:i+batch_size]
        # 特殊文字を含むキーワードをクリーニング
        clean_batch = [kw.replace('♡', '').replace('!', '').replace('！', '').strip() for kw in batch]
        clean_batch = [kw for kw in clean_batch if kw]  # 空文字除去
        # クリーニング前→後のマッピング
        kw_mapping = dict(zip(clean_batch, batch))

        payload = [{
            "keywords": clean_batch,
            "location_code": 2392,  # Japan
            "language_code": "ja",
        }]

        # リトライ付きで送信
        for attempt in range(3):
            try:
                url = "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live"
                resp = requests.post(url, auth=auth, json=payload, timeout=60)
                resp.raise_for_status()
                data = resp.json()

                count = 0
                for task in data.get('tasks', []):
                    for item in (task.get('result') or []):
                        kw = item.get('keyword', '')
                        sv = item.get('search_volume')
                        # クリーニング前のキーワードにもマッピング
                        original_kw = kw_mapping.get(kw, kw)
                        sv_map[original_kw] = sv if sv is not None else 0
                        sv_map[kw] = sv if sv is not None else 0
                        count += 1

                print(f"  バッチ {i//batch_size + 1}: {len(clean_batch)}件送信 → {count}件取得")
                if count > 0:
                    break  # 成功
                elif attempt < 2:
                    print(f"    → 0件、リトライ ({attempt+2}/3)...")
                    time.sleep(3)
            except Exception as e:
                print(f"  バッチ {i//batch_size + 1} エラー: {e}")
                if attempt < 2:
                    time.sleep(3)

        time.sleep(1)  # バッチ間ディレイ

    return sv_map


def main():
    login = os.getenv('DATAFORSEO_LOGIN')
    password = os.getenv('DATAFORSEO_PASSWORD')
    if not login or not password:
        print("DATAFORSEO credentials not found in .env")
        return

    auth = HTTPBasicAuth(login, password)

    # CSV読み込み
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # final_kanaを収集（重複除去・None除去）
    keywords = list(set(
        row['final_kana'] for row in rows
        if row.get('final_kana') and row['final_kana'].strip()
    ))

    print(f"対象キーワード: {len(keywords)}件")
    print(f"CSV: {CSV_PATH}")
    print()

    # 検索ボリューム取得
    sv_map = fetch_search_volumes(keywords, auth)

    # 結果をマージしてCSV上書き
    fieldnames = list(rows[0].keys())
    # search_volumeカラムが無ければ追加
    if 'search_volume' not in fieldnames:
        # final_kanaの後に挿入
        idx = fieldnames.index('final_kana') + 1
        fieldnames.insert(idx, 'search_volume')

    for row in rows:
        fk = row.get('final_kana', '')
        row['search_volume'] = sv_map.get(fk, '')

    with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    # サマリー
    has_sv = sum(1 for row in rows if row.get('search_volume') and int(row['search_volume']) > 0)
    print(f"\n検索ボリュームあり: {has_sv}/{len(rows)}件")
    print(f"CSV更新完了: {CSV_PATH}")

    # TOP20表示
    ranked = sorted(
        [(row['final_kana'], int(row['search_volume'])) for row in rows if row.get('search_volume') and int(row['search_volume']) > 0],
        key=lambda x: -x[1]
    )
    if ranked:
        print(f"\n【検索ボリューム TOP20】")
        for kw, sv in ranked[:20]:
            print(f"  {sv:>6}  {kw}")


if __name__ == '__main__':
    main()
