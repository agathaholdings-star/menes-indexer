#!/usr/bin/env python3
"""全フィールド抽出テスト（extract_therapist_info）— 5件で動作確認"""

import os, sys, json, logging
import psycopg2, psycopg2.extras
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
sys.path.insert(0, os.path.dirname(__file__))

from html_cache_utils import HtmlCache
from fetch_utils import fetch_page
from name_extractor import extract_therapist_info

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

DB_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
_cache = HtmlCache()

# v3テストで成功した5件を使用
TARGET_IDS = [17747, 29806, 45110, 5172, 30648]


def main():
    conn = psycopg2.connect(DB_DSN)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    ids_str = ",".join(str(i) for i in TARGET_IDS)
    cur.execute(f"""
        SELECT t.id, t.name, t.age, t.height, t.cup, t.bust, t.waist, t.hip,
               t.profile_text, t.source_url, t.salon_id,
               s.name AS salon_name, s.display_name AS salon_display
        FROM therapists t
        JOIN salons s ON s.id = t.salon_id
        WHERE t.id IN ({ids_str})
        ORDER BY ARRAY_POSITION(ARRAY[{ids_str}], t.id::int)
    """)
    rows = cur.fetchall()

    total_input = 0
    total_output = 0

    for i, row in enumerate(rows):
        tid = row["id"]
        url = row["source_url"]
        sn = row["salon_name"] or ""
        sd = row["salon_display"] or ""

        html = _cache.load("therapist", tid)
        if not html:
            html = fetch_page(url)
            if html:
                _cache.save("therapist", tid, html)
            else:
                log.warning(f"[{i+1}/{len(TARGET_IDS)}] ID={tid} fetch失敗")
                continue

        result = extract_therapist_info(html, salon_name=sn, salon_display=sd, url=url)
        if not result:
            log.warning(f"[{i+1}/{len(TARGET_IDS)}] ID={tid} 抽出失敗")
            continue

        total_input += result.get("input_tokens", 0)
        total_output += result.get("output_tokens", 0)

        print(f"\n{'='*60}")
        print(f"[{i+1}/{len(TARGET_IDS)}] ID={tid} / {sn}")
        print(f"{'='*60}")
        print(f"  {'':15s} {'DB現在値':20s} {'Haiku抽出':20s}")
        print(f"  {'name':15s} {str(row['name'])[:20]:20s} {str(result.get('name'))[:20]:20s}")
        print(f"  {'age':15s} {str(row['age']):20s} {str(result.get('age')):20s}")
        print(f"  {'height':15s} {str(row['height']):20s} {str(result.get('height')):20s}")
        print(f"  {'cup':15s} {str(row['cup']):20s} {str(result.get('cup')):20s}")
        print(f"  {'bust':15s} {str(row['bust']):20s} {str(result.get('bust')):20s}")
        print(f"  {'waist':15s} {str(row['waist']):20s} {str(result.get('waist')):20s}")
        print(f"  {'hip':15s} {str(row['hip']):20s} {str(result.get('hip')):20s}")
        pt_db = (row['profile_text'] or "")[:60]
        pt_new = (result.get('profile_text') or "")[:60]
        print(f"  {'profile_text':15s} {pt_db}")
        print(f"  {'':15s} → {pt_new}")
        print(f"  tokens: in={result.get('input_tokens',0)}, out={result.get('output_tokens',0)}")

    cost = total_input * 0.80 / 1e6 + total_output * 4.00 / 1e6
    n = len(rows)
    print(f"\n{'='*60}")
    print(f"  テスト費用: ${cost:.4f} ({n}件)")
    print(f"  全92,587件推定: ${cost / n * 92587:.2f}")
    print(f"{'='*60}")

    conn.close()


if __name__ == "__main__":
    main()
