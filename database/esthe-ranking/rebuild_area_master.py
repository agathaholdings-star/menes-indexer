#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
エリアマスタ再構築スクリプト

問題1: -city/all/ パターン263件の取りこぼし修正
問題2: SEOキーワード抽出バグ修正（県名=都市名のケース）

入力:
  - site_structure.csv（5,384件）
  - site_hierarchy_complete.csv（732件、参考用）
  - prefecture_area_map.csv（163親エリア→都道府県マッピング）
  - me_area_list.csv（ME 161件、突合用）

出力:
  - site_hierarchy_complete.csv（975件に更新）
  - area_resolved_646.csv（上書き、最終マスタ）
"""

import csv
import re
import os
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ME_DIR = os.path.join(os.path.dirname(BASE_DIR), "me") if "esthe-ranking" in BASE_DIR else os.path.join(BASE_DIR, "..", "me")

# ── ファイルパス ──
SITE_STRUCTURE = os.path.join(BASE_DIR, "site_structure.csv")
PREF_MAP = os.path.join(BASE_DIR, "prefecture_area_map.csv")
HIERARCHY_OUT = os.path.join(BASE_DIR, "site_hierarchy_complete.csv")
RESOLVED_OUT = os.path.join(BASE_DIR, "area_resolved_646.csv")
ME_AREA = os.path.join(BASE_DIR, "..", "me", "me_area_list.csv")


def load_prefecture_map():
    """prefecture_area_map.csv → {parent_slug: (prefecture_id, prefecture_name, parent_area_name)}"""
    pref_map = {}
    with open(PREF_MAP, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            slug = row["parent_slug"]
            pref_map[slug] = {
                "prefecture_id": int(row["prefecture_id"]),
                "prefecture": row["prefecture_name"],
                "parent_name": row.get("parent_area_name_on_page", ""),
            }
    return pref_map


def load_site_structure():
    """site_structure.csv → list of dicts"""
    rows = []
    with open(SITE_STRUCTURE, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def extract_city_entries(site_rows):
    """site_structure.csv から -city/all/ パターンを抽出"""
    cities = []
    for row in site_rows:
        url = row["url"]
        if "-city/all/" in url:
            cities.append(row)
    return cities


def extract_station_entries(site_rows):
    """site_structure.csv から -station/all/ パターンを抽出"""
    stations = []
    for row in site_rows:
        url = row["url"]
        if "-station/all/" in url:
            stations.append(row)
    return stations


def extract_parent_entries(site_rows):
    """site_structure.csv から親エリア（level=area）を抽出"""
    parents = []
    exclude_slugs = {"girlsranking", "therakeep", "signup", "page"}
    for row in site_rows:
        if row["level"] == "area":
            slug = row["url"].strip("/").split("/")[0]
            if slug not in exclude_slugs:
                parents.append(row)
    return parents


def strip_city_suffix(name):
    """「市」を除去: 旭川市→旭川, 札幌市（すすきの）→札幌"""
    # まず括弧の前で切る
    name = re.sub(r"[（(].*$", "", name)
    # 「市」を除去
    name = re.sub(r"市$", "", name)
    return name.strip()


def extract_seo_keyword_for_parent(parent_name, prefecture_name, parent_slug, pref_map):
    """
    親エリアのSEOキーワード抽出（バグ修正版）

    ルール:
    1. 手動オーバーライド（クロール時の名前が不適切なケース）
    2. 括弧内にKWがあるパターン（茨城央北（水戸・神栖）→ 水戸）
    3. 先頭が非地名（路線名等）→ 2番目を使う
    4. 先頭が県名と同じ場合:
       - その県に親エリアが1つだけ → 先頭をそのまま使う（奈良→奈良）
       - その県に親エリアが複数ある → 2番目を使う
    5. それ以外 → 先頭をそのまま使う
    """
    # ── 手動オーバーライド（クロールデータの名前が壊れている/不適切なもの）──
    overrides = {
        "mizonokuchi": "溝の口",  # クロール時に「溝」に欠損
    }
    if parent_slug in overrides:
        return overrides[parent_slug]

    # ── 括弧内にKWがあるパターン ──
    # 「茨城央北（水戸・神栖）」→ 括弧の中身「水戸」が本当のKW
    bracket_match = re.search(r"[（(]([^）)]+)[）)]", parent_name)
    bracket_parts = []
    if bracket_match:
        bracket_content = bracket_match.group(1)
        bracket_parts = [p.strip() for p in bracket_content.split("・") if p.strip()]

    # 括弧を除去してから「・」分割
    clean_name = re.sub(r"[（(][^）)]*[）)]", "", parent_name)
    parts = [p.strip() for p in clean_name.split("・") if p.strip()]

    if not parts:
        return parent_slug  # フォールバック

    first = parts[0]

    # ── 先頭が非地名パターン → 2番目を使う ──
    non_area_patterns = [
        r"東武", r"西武", r"京王", r"小田急", r"東急",  # 路線名
        r"JR", r"ＪＲ",
        r"キタ$", r"ミナミ$",  # 方角通称
        r"央北$", r"西南$", r"東部$", r"西部$",  # 地域区分造語
    ]
    first_is_non_area = any(re.search(p, first) for p in non_area_patterns)

    if first_is_non_area:
        # 括弧内にKWがあればそちらを優先
        if bracket_parts:
            return bracket_parts[0]
        # なければ「・」分割の2番目
        if len(parts) >= 2:
            return parts[1]

    # ── 県名の短縮形（都道府県を除去）──
    pref_short = re.sub(r"[都道府県]$", "", prefecture_name)

    # 先頭が県名短縮と一致するかチェック
    if first == pref_short or first == prefecture_name:
        # その県に親エリアが何個あるかカウント
        pref_id = pref_map[parent_slug]["prefecture_id"]
        same_pref_parents = [s for s, info in pref_map.items()
                            if info["prefecture_id"] == pref_id]

        if len(same_pref_parents) == 1:
            # 県に親エリアが1つだけ → 先頭（=県名）をそのまま使う
            return first
        else:
            # 県に親エリアが複数 → 2番目を使う
            if bracket_parts:
                return bracket_parts[0]
            if len(parts) >= 2:
                return parts[1]
            return first
    else:
        return first


def extract_seo_keyword_for_station(station_name):
    """
    駅名からSEOキーワードを抽出

    例:
    - 「恵比寿駅」→「恵比寿」
    - 「千葉駅・栄町」→「千葉」（先頭部分のみ）
    - 「新大久保駅・大久保」→「新大久保」
    - 「原宿駅・表参道駅・青山」→「原宿」
    - 「東京駅（八重洲・丸の内）」→「東京」
    - 「博多駅・祇園駅（住吉）」→「博多」
    """
    # 括弧を除去
    name = re.sub(r"[（(][^）)]*[）)]", "", station_name)
    # 「・」で分割して先頭のみ
    name = name.split("・")[0].strip()
    # 「駅」を除去
    name = re.sub(r"駅$", "", name)
    return name


def extract_seo_keyword_for_city(city_name):
    """市名からSEOキーワードを抽出: 「旭川市」→「旭川」"""
    return strip_city_suffix(city_name)


def build_hierarchy(site_rows, pref_map):
    """
    975件の完全階層を構築

    Returns: list of dicts with columns:
      prefecture_id, prefecture, level, parent_slug, parent_name,
      child_name, url, has_children, seo_keyword
    """
    parents = extract_parent_entries(site_rows)
    stations = extract_station_entries(site_rows)
    cities = extract_city_entries(site_rows)

    hierarchy = []

    # ── 親エリア（163件）──
    # 各parentがstationまたはcityの子を持つかチェック
    parent_slugs_with_stations = set()
    parent_slugs_with_cities = set()
    for s in stations:
        parent_slugs_with_stations.add(s["parent_slug"])
    for c in cities:
        parent_slugs_with_cities.add(c["parent_slug"])

    for p in parents:
        slug = p["url"].strip("/").split("/")[0]
        if slug not in pref_map:
            print(f"  WARN: parent slug '{slug}' not in prefecture_map, skipping")
            continue

        info = pref_map[slug]
        has_children = "yes" if (slug in parent_slugs_with_stations or
                                  slug in parent_slugs_with_cities) else "no"

        kw = extract_seo_keyword_for_parent(
            p["name"], info["prefecture"], slug, pref_map
        )

        hierarchy.append({
            "prefecture_id": info["prefecture_id"],
            "prefecture": info["prefecture"],
            "level": "parent",
            "parent_slug": slug,
            "parent_name": p["name"],
            "child_name": "",
            "url": p["url"],
            "has_children": has_children,
            "seo_keyword": f"{kw} メンズエステ",
        })

    # ── 駅（549件）──
    for s in stations:
        slug = s["parent_slug"]
        if slug not in pref_map:
            print(f"  WARN: station parent slug '{slug}' not in prefecture_map, skipping")
            continue

        info = pref_map[slug]
        parent_name = next((p["name"] for p in parents
                           if p["url"].strip("/").split("/")[0] == slug), "")
        kw = extract_seo_keyword_for_station(s["name"])

        hierarchy.append({
            "prefecture_id": info["prefecture_id"],
            "prefecture": info["prefecture"],
            "level": "station",
            "parent_slug": slug,
            "parent_name": parent_name,
            "child_name": s["name"],
            "url": s["url"],
            "has_children": "",
            "seo_keyword": f"{kw} メンズエステ",
        })

    # ── 市（263件）──
    for c in cities:
        slug = c["parent_slug"]
        if slug not in pref_map:
            print(f"  WARN: city parent slug '{slug}' not in prefecture_map, skipping")
            continue

        info = pref_map[slug]
        parent_name = next((p["name"] for p in parents
                           if p["url"].strip("/").split("/")[0] == slug), "")
        kw = extract_seo_keyword_for_city(c["name"])

        hierarchy.append({
            "prefecture_id": info["prefecture_id"],
            "prefecture": info["prefecture"],
            "level": "city",
            "parent_slug": slug,
            "parent_name": parent_name,
            "child_name": c["name"],
            "url": c["url"],
            "has_children": "",
            "seo_keyword": f"{kw} メンズエステ",
        })

    # ソート: prefecture_id → level(parent first) → url
    level_order = {"parent": 0, "station": 1, "city": 2}
    hierarchy.sort(key=lambda x: (x["prefecture_id"], level_order[x["level"]], x["url"]))

    return hierarchy


def save_hierarchy(hierarchy, path):
    """site_hierarchy_complete.csv を保存"""
    fieldnames = [
        "prefecture_id", "prefecture", "level", "parent_slug", "parent_name",
        "child_name", "url", "has_children", "seo_keyword"
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in hierarchy:
            writer.writerow(row)
    print(f"✅ Saved hierarchy: {len(hierarchy)} entries → {path}")


def resolve_cannibalization(hierarchy):
    """
    カニバリ解消: 1KW = 1ページの原則を適用

    ルール:
    1. 親-駅の重複（同県内）→ 親吸収
    2. 親-市の重複（同県内）→ 親吸収
    3. 駅-市の重複（同県内）→ station優先
    4. 方角付き駅出口（east/west/north/south） → 削除
    5. 別府県同名 → cross_pref として両方残す
    6. 混合（同県内+別県）→ 同県内は吸収、別県はcross_pref
    """
    # 方角パターン（先にフィルタ）
    direction_pattern = re.compile(
        r"-station-(east|west|north|south|higashi|nishi|kita|minami)/all/$"
    )

    # 方角駅を除外した作業リスト
    filtered = [e for e in hierarchy if not direction_pattern.search(e["url"])]
    direction_removed = len(hierarchy) - len(filtered)
    print(f"  方角駅除外: {direction_removed}件")

    # KW → entries のマッピング
    kw_map = defaultdict(list)
    for entry in filtered:
        kw_map[entry["seo_keyword"]].append(entry)

    resolved = []
    level_priority = {"parent": 0, "station": 1, "city": 2}

    for kw, competitors in kw_map.items():
        if len(competitors) == 1:
            # ユニーク
            entry = competitors[0]
            resolved.append({
                **entry,
                "source_type": entry["level"],
                "resolution": "unique",
            })
            continue

        # 県IDでグループ分け
        by_pref = defaultdict(list)
        for c in competitors:
            by_pref[c["prefecture_id"]].append(c)

        if len(by_pref) == 1:
            # 全て同一県内 → 最優先のみ残す（親>駅>市）
            pref_entries = competitors
            best = min(pref_entries, key=lambda c: level_priority[c["level"]])
            absorbed = [c for c in pref_entries if c is not best]
            absorbed_urls = ", ".join(c["url"] for c in absorbed)
            resolved.append({
                **best,
                "source_type": f"{best['level']}_absorbed",
                "resolution": f"absorbed: {absorbed_urls}",
            })
        else:
            # 別県にまたがる
            for pref_id, pref_entries in by_pref.items():
                if len(pref_entries) == 1:
                    # この県には1つだけ → cross_pref
                    entry = pref_entries[0]
                    resolved.append({
                        **entry,
                        "source_type": f"{entry['level']}_cross_pref",
                        "resolution": "cross_prefecture",
                    })
                else:
                    # この県に複数 → 県内で吸収してからcross_pref
                    best = min(pref_entries, key=lambda c: level_priority[c["level"]])
                    absorbed = [c for c in pref_entries if c is not best]
                    absorbed_urls = ", ".join(c["url"] for c in absorbed)
                    resolved.append({
                        **best,
                        "source_type": f"{best['level']}_cross_pref",
                        "resolution": f"cross_prefecture, absorbed: {absorbed_urls}",
                    })

    # ソート: prefecture_id → source_type → url
    resolved.sort(key=lambda x: (x["prefecture_id"], x["url"]))

    return resolved


def build_nearby_areas(resolved):
    """同じparent_groupのエリアから近隣エリアを構築"""
    # parent_slug → エリアリスト
    group_map = defaultdict(list)
    for entry in resolved:
        group_map[entry["parent_slug"]].append(entry)

    for entry in resolved:
        slug = entry["parent_slug"]
        siblings = group_map[slug]
        # 自分以外の同グループエリアのKW（メンズエステ除去）
        kw_bare = entry["seo_keyword"].replace(" メンズエステ", "")
        nearby = [
            s["seo_keyword"].replace(" メンズエステ", "")
            for s in siblings
            if s["url"] != entry["url"]
        ]
        entry["nearby_areas"] = "|".join(nearby[:5])  # 最大5件
        entry["parent_group"] = entry["parent_name"]

    return resolved


def extract_our_slug(url):
    """URLからour_slugを抽出"""
    parts = url.strip("/").split("/")
    if len(parts) >= 2:
        # station/city: /ebisu/ebisu-station/all/ → ebisu-station の部分を使う
        sub = parts[1]
        # -station/all や -city/all を除去
        sub = re.sub(r"-(station|city)(/all)?$", "", sub)
        return sub
    else:
        # parent: /ebisu/ → ebisu
        return parts[0]


def save_resolved(resolved, path):
    """area_resolved CSV を保存"""
    fieldnames = [
        "prefecture_id", "prefecture", "seo_keyword", "our_slug",
        "data_source_url", "source_type", "resolution",
        "parent_group", "nearby_areas"
    ]

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for entry in resolved:
            writer.writerow({
                "prefecture_id": entry["prefecture_id"],
                "prefecture": entry["prefecture"],
                "seo_keyword": entry["seo_keyword"],
                "our_slug": extract_our_slug(entry["url"]),
                "data_source_url": entry["url"],
                "source_type": entry["source_type"],
                "resolution": entry["resolution"],
                "parent_group": entry.get("parent_group", ""),
                "nearby_areas": entry.get("nearby_areas", ""),
            })

    print(f"✅ Saved resolved: {len(resolved)} entries → {path}")


def compare_with_me(resolved):
    """ME 161件との突合"""
    me_areas = []
    with open(ME_AREA, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            me_areas.append(row)

    # ME のエリア名を正規化（「・」分割、括弧除去）
    me_keywords = set()
    me_raw = {}
    for me in me_areas:
        name = me["area_name"]
        # 括弧除去
        name_clean = re.sub(r"[（(][^）)]*[）)]", "", name)
        parts = [p.strip() for p in name_clean.split("・") if p.strip()]
        for part in parts:
            me_keywords.add(part)
            me_raw[part] = me["area_name"]

    # うちのKW（メンズエステ除去）
    our_keywords = set()
    for entry in resolved:
        kw = entry["seo_keyword"].replace(" メンズエステ", "")
        our_keywords.add(kw)

    # 突合
    covered = me_keywords & our_keywords
    gap = me_keywords - our_keywords

    print(f"\n{'='*60}")
    print("ME突合結果")
    print(f"{'='*60}")
    print(f"ME分割キーワード: {len(me_keywords)}件")
    print(f"うちのKW: {len(our_keywords)}件")
    print(f"カバー: {len(covered)}件 ({len(covered)/len(me_keywords)*100:.1f}%)")
    print(f"ギャップ: {len(gap)}件")

    if gap:
        print(f"\n未カバーのMEキーワード:")
        for g in sorted(gap):
            raw = me_raw.get(g, "")
            print(f"  - {g}（ME: {raw}）")

    return covered, gap


def print_summary(hierarchy, resolved):
    """サマリー表示"""
    print(f"\n{'='*60}")
    print("エリアマスタ再構築 サマリー")
    print(f"{'='*60}")

    # 階層統計
    parents = [h for h in hierarchy if h["level"] == "parent"]
    stations = [h for h in hierarchy if h["level"] == "station"]
    cities = [h for h in hierarchy if h["level"] == "city"]

    print(f"\n■ 完全階層 (site_hierarchy_complete.csv)")
    print(f"  親エリア: {len(parents)}")
    print(f"  駅:       {len(stations)}")
    print(f"  市:       {len(cities)}")
    print(f"  合計:     {len(hierarchy)}")

    # 都道府県別
    pref_counts = defaultdict(lambda: {"parent": 0, "station": 0, "city": 0})
    for h in hierarchy:
        pref_counts[h["prefecture"]][h["level"]] += 1

    print(f"\n■ 都道府県別（上位10）")
    sorted_prefs = sorted(pref_counts.items(),
                          key=lambda x: sum(x[1].values()), reverse=True)
    for pref, counts in sorted_prefs[:10]:
        total = sum(counts.values())
        print(f"  {pref}: 親{counts['parent']} 駅{counts['station']} 市{counts['city']} = {total}")

    # 解消統計
    print(f"\n■ カニバリ解消後 (area_resolved)")
    type_counts = defaultdict(int)
    resolution_counts = defaultdict(int)
    for r in resolved:
        type_counts[r["source_type"]] += 1
        res = r["resolution"].split(":")[0].strip()
        resolution_counts[res] += 1

    print(f"  合計: {len(resolved)}")
    for st, cnt in sorted(type_counts.items()):
        print(f"    {st}: {cnt}")

    # KWバグ修正の確認
    print(f"\n■ KWバグ修正確認")
    bug_cases = {
        "nara": ("奈良", "生駒"),
        "hiroshima": ("広島", "福山"),
        "kumamoto": ("熊本", "玉名"),
        "kagoshima": ("鹿児島", "霧島"),
        "yamagata": ("山形", "米沢"),
    }
    for slug, (correct, old_wrong) in bug_cases.items():
        found = [h for h in hierarchy if h["parent_slug"] == slug and h["level"] == "parent"]
        if found:
            actual_kw = found[0]["seo_keyword"].replace(" メンズエステ", "")
            status = "✅" if actual_kw == correct else f"❌ got {actual_kw}"
            print(f"  {slug}: {actual_kw} {status}")

    # KWユニーク性チェック
    print(f"\n■ KWユニーク性チェック")
    kw_counts = defaultdict(list)
    for r in resolved:
        kw_counts[r["seo_keyword"]].append(r)

    dupes = {kw: entries for kw, entries in kw_counts.items() if len(entries) > 1}
    if dupes:
        print(f"  重複KW: {len(dupes)}件")
        for kw, entries in sorted(dupes.items()):
            types = [e["source_type"] for e in entries]
            prefs = [e["prefecture"] for e in entries]
            print(f"    {kw}: {types} ({prefs})")
    else:
        print(f"  全KWユニーク ✅")

    # 47都道府県カバレッジ
    print(f"\n■ 都道府県カバレッジ")
    pref_ids = set(r["prefecture_id"] for r in resolved)
    print(f"  {len(pref_ids)}/47 都道府県カバー {'✅' if len(pref_ids) == 47 else '❌'}")


def main():
    print("=" * 60)
    print("エリアマスタ再構築")
    print("  - -city/all/ 263件追加")
    print("  - SEOキーワード抽出バグ修正")
    print("  - カニバリ再解消")
    print("=" * 60)

    # Step 0: データ読み込み
    print("\n[Step 0] データ読み込み...")
    pref_map = load_prefecture_map()
    site_rows = load_site_structure()
    print(f"  prefecture_map: {len(pref_map)} entries")
    print(f"  site_structure: {len(site_rows)} entries")

    # Step 1: 完全階層構築
    print("\n[Step 1] 完全階層構築（parent + station + city）...")
    hierarchy = build_hierarchy(site_rows, pref_map)
    save_hierarchy(hierarchy, HIERARCHY_OUT)

    # Step 2 & 3: KWバグ修正はbuild_hierarchy内で実施済み。カニバリ解消
    print("\n[Step 2-3] カニバリ解消...")
    resolved = resolve_cannibalization(hierarchy)
    resolved = build_nearby_areas(resolved)
    save_resolved(resolved, RESOLVED_OUT)

    # Step 4: ME突合
    print("\n[Step 4] ME突合...")
    compare_with_me(resolved)

    # サマリー
    print_summary(hierarchy, resolved)


if __name__ == "__main__":
    main()
