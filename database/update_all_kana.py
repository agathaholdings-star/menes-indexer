#!/usr/bin/env python3
"""
全サロンの salon_name_kana を更新（コア店名 + 英語→カタカナ）
"""
import sqlite3
from extract_core_name import extract_and_convert
from anthropic import Anthropic
import time

def main():
    db_path = '/Users/agatha/Desktop/project/menethe-indexer/database/poc.db'
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # 全サロン取得
    c.execute('SELECT salon_id, salon_name, salon_name_kana FROM salon')
    salons = c.fetchall()

    print(f"全サロン: {len(salons)}件\n")

    client = Anthropic()
    updated = 0

    for salon_id, salon_name, old_kana in salons:
        new_kana = extract_and_convert(salon_name, client)

        # 変更があれば更新
        if new_kana != old_kana:
            c.execute('UPDATE salon SET salon_name_kana = ? WHERE salon_id = ?',
                      (new_kana, salon_id))
            print(f"[{salon_id}] {salon_name}")
            print(f"  旧: {old_kana}")
            print(f"  新: {new_kana}")
            print()
            updated += 1

        time.sleep(0.1)  # レート制限

    conn.commit()
    conn.close()
    print(f"✅ 完了: {updated}件更新")

if __name__ == '__main__':
    main()
