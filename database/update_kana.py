#!/usr/bin/env python3
"""
salon_name_kana が NULL かつ英語を含む店名をClaude APIで変換して更新
"""
import sqlite3
from convert_kana import has_english, convert_english_to_kana
from anthropic import Anthropic

def main():
    db_path = '/Users/agatha/Desktop/project/menethe-indexer/database/poc.db'
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # salon_name_kana が NULL のサロンを取得
    c.execute('SELECT salon_id, salon_name FROM salon WHERE salon_name_kana IS NULL')
    salons = c.fetchall()

    print(f"salon_name_kana が NULL: {len(salons)}件")

    # 英語を含むものだけフィルタ
    english_salons = [(sid, name) for sid, name in salons if has_english(name)]
    print(f"うち英語を含む: {len(english_salons)}件")

    if not english_salons:
        print("変換対象なし")
        return

    # Claude APIで変換
    client = Anthropic()
    updated = 0

    for salon_id, salon_name in english_salons:
        converted, _ = convert_english_to_kana(salon_name, client)
        c.execute('UPDATE salon SET salon_name_kana = ? WHERE salon_id = ?',
                  (converted, salon_id))
        print(f"[{salon_id}] {salon_name}")
        print(f"     -> {converted}")
        updated += 1

    conn.commit()
    conn.close()
    print(f"\n✅ 完了: {updated}件更新")

if __name__ == '__main__':
    main()
