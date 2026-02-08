"""
エリアCSVからSupabase areas テーブルへのseed SQLを生成する。
スラッグ重複は prefecture_slug をプレフィックスとして付与して解決。

使い方:
  python database/seed_areas.py > supabase/seed_areas.sql

生成されたSQLを supabase/seed.sql に追記するか、
別ファイルとして supabase db reset 時に読み込む。
"""

import csv
import sys
from collections import Counter

# 都道府県ID → slug マッピング
PREFECTURE_SLUGS = {
    1: 'hokkaido', 2: 'aomori', 3: 'iwate', 4: 'miyagi', 5: 'akita',
    6: 'yamagata', 7: 'fukushima', 8: 'ibaraki', 9: 'tochigi', 10: 'gunma',
    11: 'saitama', 12: 'chiba', 13: 'tokyo', 14: 'kanagawa', 15: 'niigata',
    16: 'toyama', 17: 'ishikawa', 18: 'fukui', 19: 'yamanashi', 20: 'nagano',
    21: 'gifu', 22: 'shizuoka', 23: 'aichi', 24: 'mie', 25: 'shiga',
    26: 'kyoto', 27: 'osaka', 28: 'hyogo', 29: 'nara', 30: 'wakayama',
    31: 'tottori', 32: 'shimane', 33: 'okayama', 34: 'hiroshima', 35: 'yamaguchi',
    36: 'tokushima', 37: 'kagawa', 38: 'ehime', 39: 'kochi', 40: 'fukuoka',
    41: 'saga', 42: 'nagasaki', 43: 'kumamoto', 44: 'oita', 45: 'miyazaki',
    46: 'kagoshima', 47: 'okinawa'
}

CSV_PATH = 'database/esthe-ranking/area_resolved_filtered.csv'


def escape_sql(s: str) -> str:
    """SQLインジェクション防止: シングルクォートをエスケープ"""
    if s is None:
        return 'NULL'
    return "'" + s.replace("'", "''") + "'"


def sql_int(s: str):
    """整数変換、空文字はNULL"""
    if not s or s.strip() == '':
        return 'NULL'
    try:
        return str(int(s))
    except ValueError:
        return 'NULL'


def main():
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # スラッグ重複検出
    slug_counts = Counter(r['our_slug'] for r in rows)
    duplicate_slugs = {s for s, c in slug_counts.items() if c > 1}

    print(f"-- Areas seed: {len(rows)} rows from {CSV_PATH}")
    print(f"-- Duplicate slugs resolved: {len(duplicate_slugs)}")
    print()
    print("INSERT INTO areas (prefecture_id, name, slug, seo_keyword, search_volume, source_type, data_source_url, parent_group, nearby_areas, salon_count) VALUES")

    values = []
    final_slugs = set()

    for row in rows:
        pref_id = int(row['prefecture_id'])
        seo_kw = row['seo_keyword']
        # エリア名: SEOキーワードから「メンズエステ」を除去
        name = seo_kw.replace(' メンズエステ', '').strip() if seo_kw else ''
        slug = row['our_slug']

        # スラッグ重複解決: prefecture_slug をプレフィックスとして付与
        if slug in duplicate_slugs:
            pref_slug = PREFECTURE_SLUGS.get(pref_id, str(pref_id))
            new_slug = f"{pref_slug}-{slug}"
            # それでも重複する場合（同一県内での重複）はsource_typeを付与
            if new_slug in final_slugs:
                source_type = row.get('source_type', 'unknown')
                new_slug = f"{pref_slug}-{slug}-{source_type}"
            slug = new_slug

        if slug in final_slugs:
            print(f"-- WARNING: still duplicate slug: {slug}", file=sys.stderr)
        final_slugs.add(slug)

        values.append(
            f"({pref_id}, {escape_sql(name)}, {escape_sql(slug)}, "
            f"{escape_sql(row['seo_keyword'])}, {sql_int(row['search_volume'])}, "
            f"{escape_sql(row.get('source_type', ''))}, {escape_sql(row.get('data_source_url', ''))}, "
            f"{escape_sql(row.get('parent_group', ''))}, {escape_sql(row.get('nearby_areas', ''))}, "
            f"{sql_int(row.get('salon_count', '0'))})"
        )

    print(',\n'.join(values) + ';')
    print()
    print(f"-- Total: {len(values)} areas inserted")
    print(f"-- Final unique slugs: {len(final_slugs)}")


if __name__ == '__main__':
    main()
