#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CMSパターンシードデータ投入スクリプト

使い方:
    python database/therapist-scraper/seed_cms_patterns.py
    python database/therapist-scraper/seed_cms_patterns.py --dsn "postgresql://..."
"""

import os
import sys
import json
import argparse

import psycopg2

DEFAULT_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SEED_FILE = os.path.join(os.path.dirname(__file__), 'cms_patterns_seed.json')


def main():
    parser = argparse.ArgumentParser(description='CMSパターンシードデータ投入')
    parser.add_argument('--dsn', default=DEFAULT_DSN, help='DB接続文字列')
    args = parser.parse_args()

    with open(SEED_FILE, 'r', encoding='utf-8') as f:
        patterns = json.load(f)

    conn = psycopg2.connect(args.dsn)
    cur = conn.cursor()

    for p in patterns:
        cur.execute("""
            INSERT INTO cms_patterns (
                cms_name, fingerprint, list_url_rules,
                therapist_list_rules, therapist_data_rules,
                confidence, success_count, fail_count
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (cms_name) DO UPDATE SET
                fingerprint = EXCLUDED.fingerprint,
                list_url_rules = EXCLUDED.list_url_rules,
                therapist_list_rules = EXCLUDED.therapist_list_rules,
                therapist_data_rules = EXCLUDED.therapist_data_rules,
                version = cms_patterns.version + 1
        """, (
            p['cms_name'],
            json.dumps(p['fingerprint'], ensure_ascii=False),
            json.dumps(p['list_url_rules'], ensure_ascii=False),
            json.dumps(p['therapist_list_rules'], ensure_ascii=False),
            json.dumps(p['therapist_data_rules'], ensure_ascii=False),
            p.get('confidence', 0.5),
            p.get('success_count', 0),
            p.get('fail_count', 0),
        ))
        print(f"  {p['cms_name']}: 投入/更新完了")

    conn.commit()

    cur.execute("SELECT id, cms_name, confidence FROM cms_patterns ORDER BY id")
    rows = cur.fetchall()
    print(f"\ncms_patterns: {len(rows)}件")
    for row in rows:
        print(f"  id={row[0]} {row[1]} (confidence={row[2]})")

    conn.close()


if __name__ == '__main__':
    main()
