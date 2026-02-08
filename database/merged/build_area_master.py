#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
エリアマスタ確定スクリプト

626件のデータソース（esthe-ranking.jp）と検索需要（ME, メンマガ, ahrefs）を突合し、
うちのサイトで作るエリアページの最終リストを確定する。

採用基準（いずれかを満たす）:
  1. esthe-rankingのトップレベル163件に含まれる（ベースライン）
  2. ME or メンマガに存在する
  3. ahrefsで検索ボリューム500以上
"""

import csv
import re
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.dirname(BASE_DIR)

# --- データ読み込み ---

def load_csv(path):
    with open(path, 'r', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def normalize_area_name(name):
    """駅名からエリア名を正規化"""
    # 「（xxx）」を除去
    name = re.sub(r'[（(][^）)]*[）)]', '', name).strip()
    # 「・」で分割して最初の部分を取る（「天神駅・天神南駅」→「天神駅」→「天神」）
    if '・' in name:
        name = name.split('・')[0].strip()
    # 「駅」を除去（末尾）
    name = re.sub(r'駅$', '', name)
    # 「駅北口」「駅南口」等を除去
    name = re.sub(r'駅[北南東西]口$', '', name)
    return name


def build_me_name_set(me_areas):
    """MEのエリア名をセットに（・分割）"""
    names = set()
    for a in me_areas:
        area_name = a['area_name'].replace('（', '・').replace('）', '')
        for part in area_name.split('・'):
            part = part.strip()
            if part and len(part) >= 2:
                names.add(part)
    return names


def build_mg_name_set(mg_areas):
    """メンマガのエリア名をセットに（・分割）"""
    names = set()
    for a in mg_areas:
        area_name = a['area_name'].replace('（', '・').replace('）', '')
        for part in area_name.split('・'):
            part = part.strip()
            if part and len(part) >= 2:
                names.add(part)
    return names


def build_ahrefs_map(ahrefs_data):
    """ahrefsデータを辞書に（area_name → volume）"""
    return {a['area_name']: int(a['total_volume']) for a in ahrefs_data}


def build_me_prefecture_map(me_areas):
    """MEのデータからエリア名→都道府県のマッピングを作る"""
    mapping = {}
    for a in me_areas:
        pref = a['prefecture']
        area_name = a['area_name'].replace('（', '・').replace('）', '')
        for part in area_name.split('・'):
            part = part.strip()
            if part and len(part) >= 2:
                mapping[part] = pref
    return mapping


def build_mg_prefecture_map(mg_areas):
    """メンマガのデータからエリア名→都道府県のマッピングを作る"""
    mapping = {}
    for a in mg_areas:
        pref = a['prefecture']
        area_name = a['area_name'].replace('（', '・').replace('）', '')
        for part in area_name.split('・'):
            part = part.strip()
            if part and len(part) >= 2:
                mapping[part] = pref
    return mapping


# esthe-ranking の parent_slug → 都道府県マッピング
# MEの都道府県データと手動マッピングで構築
PARENT_SLUG_TO_PREF = {
    # 東京都
    'ebisu': '東京都', 'gotanda': '東京都', 'shinagawa': '東京都', 'kamata': '東京都',
    'roppongi': '東京都', 'akasaka': '東京都', 'shinbashi': '東京都', 'ginza': '東京都',
    'nihonbashi': '東京都', 'tokyo': '東京都', 'kanda': '東京都', 'akihabara': '東京都',
    'iidabashi': '東京都', 'ueno': '東京都', 'nippori': '東京都', 'kameari': '東京都',
    'kinshicho': '東京都', 'kameido': '東京都', 'kasai': '東京都', 'monnaka': '東京都',
    'shinjuku': '東京都', 'okubo': '東京都', 'ikebukuro': '東京都', 'otsuka': '東京都',
    'akabane': '東京都', 'ooyama': '東京都', 'nerima': '東京都', 'shakujii': '東京都',
    'shibuya': '東京都', 'sangenjaya': '東京都', 'jiyugaoka': '東京都', 'meguro': '東京都',
    'hatsudai': '東京都', 'shimokitazawa': '東京都', 'nakano': '東京都', 'ogikubo': '東京都',
    'kichijoji': '東京都', 'chofu': '東京都', 'tachikawa': '東京都', 'hachioji': '東京都',
    'machida': '東京都', 'kokubunji': '東京都', 'kumegawa': '東京都', 'nishitokyo': '東京都',
    'fuchu': '東京都', 'haijima': '東京都', 'suidobashi': '東京都',
    # 神奈川県
    'yokohama': '神奈川県', 'kawasaki': '神奈川県', 'musashikosugi': '神奈川県',
    'mizonokuchi': '神奈川県', 'noborito': '神奈川県', 'shinyokohama': '神奈川県',
    'ofuna': '神奈川県', 'fujisawa': '神奈川県', 'chigasaki': '神奈川県',
    'atsugi': '神奈川県', 'sagamihara': '神奈川県', 'sagamiono': '神奈川県',
    'saginuma': '神奈川県', 'yamato': '神奈川県', 'odawara': '神奈川県',
    # 埼玉県
    'omiya': '埼玉県', 'urawa': '埼玉県', 'nishikawaguchi': '埼玉県',
    'kawagoe': '埼玉県', 'tokorozawa': '埼玉県', 'koshigaya': '埼玉県',
    'ageo': '埼玉県', 'shiki': '埼玉県', 'souka': '埼玉県', 'kumagaya': '埼玉県',
    # 千葉県
    'chiba': '千葉県', 'funabashi': '千葉県', 'matsudo': '千葉県',
    'kashiwa': '千葉県', 'tsudanuma': '千葉県', 'ichikawa': '千葉県',
    'urayasu': '千葉県', 'narita': '千葉県', 'ichihara': '千葉県', 'yachiyo': '千葉県',
    # 北関東
    'tochigi': '栃木県', 'gunma': '群馬県',
    'ibaraki': '茨城県', 'tsukuba': '茨城県',
    # 北海道・東北
    'sapporo': '北海道', 'sendai': '宮城県', 'akita': '秋田県',
    'aomori': '青森県', 'iwate': '岩手県', 'yamagata': '山形県', 'fukushima': '福島県',
    # 中部
    'nagoya': '愛知県', 'sakae': '愛知県', 'shinsakae': '愛知県', 'kanayama': '愛知県',
    'tsurumai': '愛知県', 'komaki': '愛知県', 'owari': '愛知県', 'toyota': '愛知県',
    'toyohashi': '愛知県', 'horita': '愛知県', 'hoshigaoka': '愛知県',
    'kurokawa': '愛知県', 'moriyama': '愛知県', 'kasadera': '愛知県',
    'otai': '愛知県', 'tokaidori': '愛知県', 'showa': '愛知県', 'chita': '愛知県',
    'shizuoka': '静岡県', 'hamamatsu': '静岡県', 'numazu': '静岡県',
    'gifu': '岐阜県', 'ogaki': '岐阜県', 'mino': '岐阜県',
    'mie': '三重県', 'tsu': '三重県',
    'niigata': '新潟県', 'nagano': '長野県', 'yamanashi': '山梨県',
    'ishikawa': '石川県', 'toyama': '富山県', 'fukui': '福井県',
    # 関西
    'osakakita': '大阪府', 'osakaminami': '大阪府', 'shinsaibashi': '大阪府',
    'honmachi': '大阪府', 'kyobashi': '大阪府', 'nishinakajima': '大阪府',
    'tenma': '大阪府', 'tanikyu': '大阪府', 'juso': '大阪府',
    'esaka': '大阪府', 'higashiosaka': '大阪府', 'sakai': '大阪府',
    'kyoto': '京都府',
    'kobe': '兵庫県', 'himeji': '兵庫県', 'amagasaki': '兵庫県',
    'nara': '奈良県', 'wakayama': '和歌山県', 'shiga': '滋賀県',
    # 中国・四国
    'hiroshima': '広島県', 'okayama': '岡山県', 'yamaguchi': '山口県',
    'shimane': '島根県', 'tottori': '鳥取県',
    'kagawa': '香川県', 'ehime': '愛媛県', 'tokushima': '徳島県', 'kochi': '高知県',
    # 九州・沖縄
    'hakata': '福岡県', 'kitakyushu': '福岡県', 'kurume': '福岡県',
    'saga': '佐賀県', 'nagasaki': '長崎県', 'kumamoto': '熊本県',
    'oita': '大分県', 'miyazaki': '宮崎県', 'kagoshima': '鹿児島県', 'okinawa': '沖縄県',
}


def name_matches(name, name_set):
    """エリア名がセットに含まれるか（部分一致も）"""
    if name in name_set:
        return True
    for n in name_set:
        if name in n or n in name:
            return True
    return False


def main():
    # データ読み込み
    area_final = load_csv(os.path.join(DB_DIR, 'esthe-ranking', 'area_final.csv'))
    area_list = load_csv(os.path.join(DB_DIR, 'esthe-ranking', 'area_list.csv'))
    me_areas = load_csv(os.path.join(DB_DIR, 'me', 'me_area_list.csv'))
    mg_areas = load_csv(os.path.join(DB_DIR, 'mens-mg', 'mg_area_list.csv'))
    ahrefs_data = load_csv(os.path.join(DB_DIR, 'merged', 'area_by_seo.csv'))

    # 名前セット構築
    me_names = build_me_name_set(me_areas)
    mg_names = build_mg_name_set(mg_areas)
    ahrefs_map = build_ahrefs_map(ahrefs_data)

    # 都道府県マッピング
    me_pref = build_me_prefecture_map(me_areas)
    mg_pref = build_mg_prefecture_map(mg_areas)

    # esthe-rankingのトップレベル163のslugセット
    top_level_slugs = {a['slug'] for a in area_list}

    # --- 処理 ---

    results = []
    seen_names = set()  # 重複エリア名チェック

    # まずトップレベル163件を「・」分割で全部ベースラインとして追加
    for a in area_list:
        name = a['name'].replace('（', '・').replace('）', '')
        parts = [p.strip() for p in name.split('・') if p.strip() and len(p.strip()) >= 2]
        slug = a['slug']
        pref = PARENT_SLUG_TO_PREF.get(slug, '')

        for part in parts:
            if part in seen_names:
                continue
            seen_names.add(part)

            in_me = name_matches(part, me_names)
            in_mg = name_matches(part, mg_names)
            ahrefs_vol = ahrefs_map.get(part, 0)

            reasons = ['top_level_base']
            if in_me:
                reasons.append('in_ME')
            if in_mg:
                reasons.append('in_MG')
            if ahrefs_vol >= 500:
                reasons.append(f'ahrefs_{ahrefs_vol}')

            # このエリア名に対応するデータソースURLを決定
            # 駅別サブページがあればそれを使う、なければトップレベルURL
            source_url = f'/{slug}/'
            for entry in area_final:
                normalized = normalize_area_name(entry['area_name'])
                if normalized == part and entry['parent_slug'] == slug:
                    source_url = entry['url']
                    break

            results.append({
                'area_name': part,
                'prefecture': pref or me_pref.get(part) or mg_pref.get(part) or '',
                'slug': slug if len(parts) == 1 else slug + '-' + part,
                'source_url': source_url,
                'type': 'top_level',
                'parent_area': a['name'],
                'in_me': 'o' if in_me else '',
                'in_mg': 'o' if in_mg else '',
                'ahrefs_volume': ahrefs_vol,
                'reasons': ','.join(reasons),
            })

    # 次に駅別サブページから追加（トップレベル分解で拾えなかったもの）
    for entry in area_final:
        raw_name = entry['area_name']
        parent_area = entry['parent_area']
        parent_slug = entry['parent_slug']
        url = entry['url']
        entry_type = entry['type']

        # エリア名の正規化
        area_name = normalize_area_name(raw_name)

        # 空や短すぎる名前はスキップ
        if not area_name or len(area_name) < 2:
            continue

        # 重複チェック（同じエリア名が複数ソースにある場合は最初のものを採用）
        if area_name in seen_names:
            continue

        # トップレベル163件か？
        is_top_level = entry_type == 'area_direct' or parent_slug in top_level_slugs

        # ME・メンマガに存在するか？
        in_me = name_matches(area_name, me_names)
        in_mg = name_matches(area_name, mg_names)

        # ahrefsボリューム
        ahrefs_vol = ahrefs_map.get(area_name, 0)

        # 採用判定
        reasons = []
        if entry_type == 'area_direct':
            reasons.append('top_level')
        if in_me:
            reasons.append('in_ME')
        if in_mg:
            reasons.append('in_MG')
        if ahrefs_vol >= 500:
            reasons.append(f'ahrefs_{ahrefs_vol}')

        # トップレベル163のエリア名分解分もベースラインとして採用
        is_from_top_name = False
        for a in area_list:
            name_parts = a['name'].replace('（', '・').replace('）', '').split('・')
            if area_name in [p.strip() for p in name_parts]:
                is_from_top_name = True
                break
        if is_from_top_name and not reasons:
            reasons.append('top_level_split')

        adopted = len(reasons) > 0

        if not adopted:
            continue

        seen_names.add(area_name)

        # 都道府県の解決（親slugから引くのが最も確実）
        prefecture = (
            PARENT_SLUG_TO_PREF.get(parent_slug) or
            me_pref.get(area_name) or
            mg_pref.get(area_name) or
            ''
        )

        # slug生成（URLの最後のパス部分から）
        slug_parts = url.strip('/').split('/')
        if entry_type == 'station':
            # /hakata/tenjin-station/all/ → tenjin
            for part in slug_parts:
                if '-station' in part:
                    slug = part.replace('-station', '')
                    break
            else:
                slug = slug_parts[-1]
        else:
            slug = slug_parts[0]

        results.append({
            'area_name': area_name,
            'prefecture': prefecture,
            'slug': slug,
            'source_url': url,
            'type': entry_type,
            'parent_area': parent_area,
            'in_me': 'o' if in_me else '',
            'in_mg': 'o' if in_mg else '',
            'ahrefs_volume': ahrefs_vol,
            'reasons': ','.join(reasons),
        })

    # ソート: 都道府県 → エリア名
    results.sort(key=lambda x: (x['prefecture'] or 'zzz', x['area_name']))

    # CSV出力
    output_path = os.path.join(BASE_DIR, 'area_master_final.csv')
    fieldnames = ['area_name', 'prefecture', 'slug', 'source_url', 'type',
                  'parent_area', 'in_me', 'in_mg', 'ahrefs_volume', 'reasons']

    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in results:
            writer.writerow(r)

    # サマリー
    print(f'=== エリアマスタ確定 ===')
    print(f'総エリア数: {len(results)}')
    print(f'  トップレベル由来: {sum(1 for r in results if "top_level" in r["reasons"])}')
    print(f'  トップレベル分解: {sum(1 for r in results if "top_level_split" in r["reasons"])}')
    print(f'  ME存在: {sum(1 for r in results if r["in_me"])}')
    print(f'  メンマガ存在: {sum(1 for r in results if r["in_mg"])}')
    print(f'  ahrefs 500+: {sum(1 for r in results if r["ahrefs_volume"] >= 500)}')

    # 都道府県カバレッジ
    prefs = set(r['prefecture'] for r in results if r['prefecture'])
    no_pref = [r for r in results if not r['prefecture']]
    print(f'\n都道府県カバレッジ: {len(prefs)}')
    if no_pref:
        print(f'都道府県未割当: {len(no_pref)}件')
        for r in no_pref[:20]:
            print(f'  {r["area_name"]} ({r["source_url"]})')

    # 都道府県別エリア数
    from collections import Counter
    pref_counts = Counter(r['prefecture'] for r in results if r['prefecture'])
    print(f'\n都道府県別エリア数 (top 15):')
    for pref, count in pref_counts.most_common(15):
        print(f'  {pref}: {count}')

    print(f'\n✅ 出力: {output_path}')


if __name__ == '__main__':
    main()
