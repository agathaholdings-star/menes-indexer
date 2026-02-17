#!/usr/bin/env python3
"""
Step 1: ME生データ抽出

ME Supabase から口コミ付きセラピストを取得し、
Indexerのセラピストと3段階マッチングで突合。
マッチした15,690名分の生データをJSONに出力する。

Usage:
  python database/seed_reviews/step1_extract_me_data.py              # 全件
  python database/seed_reviews/step1_extract_me_data.py --limit 100  # テスト
"""

import argparse
import json
import os
import sys
from collections import defaultdict

import psycopg2.extras

sys.path.insert(0, os.path.dirname(__file__))
from common import (
    DATA_DIR,
    connect_indexer,
    connect_me,
    extract_domain,
    normalize_name,
    normalize_url,
)


# ---------------------------------------------------------------------------
# MEデータ取得
# ---------------------------------------------------------------------------
def fetch_me_therapists(supabase, limit=None):
    """reviews_dataが非空のセラピストを全件取得"""
    cols = "therapist_id,therapist_name,therapist_url,salon_id,reviews_data,review_count"
    all_rows = []
    page_size = 1000
    offset = 0

    while True:
        query = (
            supabase.table("therapist_db")
            .select(cols)
            .neq("reviews_data", "")
            .not_.is_("reviews_data", "null")
            .order("therapist_id")
            .range(offset, offset + page_size - 1)
        )
        result = query.execute()
        rows = result.data
        if not rows:
            break
        all_rows.extend(rows)
        if limit and len(all_rows) >= limit:
            all_rows = all_rows[:limit]
            break
        if len(rows) < page_size:
            break
        offset += page_size
        print(f"  ME therapists fetched: {len(all_rows)}...", end="\r")

    print(f"  ME therapists with reviews: {len(all_rows)}")
    return all_rows


def fetch_me_salons(supabase):
    """ME salon_db全件取得"""
    all_rows = []
    page_size = 1000
    offset = 0

    while True:
        result = (
            supabase.table("salon_db")
            .select("salon_id,salon_name,salon_url")
            .order("salon_id")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = result.data
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size

    print(f"  ME salons: {len(all_rows)}")
    return all_rows


# ---------------------------------------------------------------------------
# Indexerデータ取得
# ---------------------------------------------------------------------------
def fetch_indexer_therapists(conn):
    """Indexer therapists全件取得（cup, waist, height含む）"""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "SELECT id, name, source_url, salon_id, cup, waist, height, age FROM therapists"
    )
    rows = cur.fetchall()
    print(f"  Indexer therapists: {len(rows)}")
    return rows


def fetch_indexer_salons(conn):
    """Indexer salons全件取得"""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, display_name, name, official_url, domain FROM salons")
    rows = cur.fetchall()
    print(f"  Indexer salons: {len(rows)}")
    return rows


# ---------------------------------------------------------------------------
# 口コミパース
# ---------------------------------------------------------------------------
def parse_reviews_data(reviews_data_str: str) -> list[dict]:
    """
    ME reviews_data文字列をパースしてリストで返す。
    形式: "日付,点数,レビュー内容\n日付,点数,レビュー内容\n..."
    """
    if not reviews_data_str or not reviews_data_str.strip():
        return []

    reviews = []
    for line in reviews_data_str.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        # 形式: "2024/11/10,95,レビューテキスト..."
        parts = line.split(",", 2)
        if len(parts) < 3:
            continue
        date_str = parts[0].strip()
        try:
            score = int(parts[1].strip())
        except ValueError:
            score = None
        text = parts[2].strip()
        if text:
            reviews.append({"date": date_str, "score": score, "text": text})

    return reviews


# ---------------------------------------------------------------------------
# マッチング
# ---------------------------------------------------------------------------
def run_matching(me_therapists, me_salons, idx_therapists, idx_salons):
    """3段階マッチングを実行し、マッチ結果リストを返す"""

    # ME salon_id → salon info
    me_salon_map = {s["salon_id"]: s for s in me_salons}

    # Indexer: source_url → therapist
    idx_by_url = {}
    for t in idx_therapists:
        nurl = normalize_url(t["source_url"])
        if nurl:
            idx_by_url[nurl] = t

    # Indexer: salon_id → salon info
    idx_salon_map = {s["id"]: s for s in idx_salons}

    # Indexer: domain → salons
    idx_by_domain = defaultdict(list)
    idx_therapists_by_salon = defaultdict(list)
    for t in idx_therapists:
        idx_therapists_by_salon[t["salon_id"]].append(t)

    for s in idx_salons:
        domain = s.get("domain") or extract_domain(s.get("official_url"))
        if domain:
            idx_by_domain[domain].append(s)

    # Indexer: display_name → salons
    idx_by_salon_name = defaultdict(list)
    for s in idx_salons:
        dn = s.get("display_name") or s.get("name")
        if dn:
            idx_by_salon_name[dn.strip()].append(s)

    # マッチング実行
    matches = []
    stats = {"url": 0, "domain_name": 0, "salon_name": 0}

    for mt in me_therapists:
        me_tid = mt["therapist_id"]
        me_salon = me_salon_map.get(mt.get("salon_id"))
        me_name = normalize_name(mt.get("therapist_name"))
        match_method = None
        idx_t = None

        # Step 1: URL直接一致
        me_turl = normalize_url(mt.get("therapist_url"))
        if me_turl and me_turl in idx_by_url:
            idx_t = idx_by_url[me_turl]
            match_method = "url"

        # Step 2: ドメイン+名前一致
        if not idx_t and me_salon and me_name:
            me_domain = extract_domain(me_salon.get("salon_url"))
            if me_domain and me_domain in idx_by_domain:
                for idx_salon in idx_by_domain[me_domain]:
                    for candidate in idx_therapists_by_salon.get(idx_salon["id"], []):
                        if normalize_name(candidate.get("name")) == me_name:
                            idx_t = candidate
                            match_method = "domain_name"
                            break
                    if idx_t:
                        break

        # Step 3: サロン名+名前一致
        if not idx_t and me_salon and me_name:
            me_salon_name = me_salon.get("salon_name", "").strip()
            if me_salon_name:
                candidates = idx_by_salon_name.get(me_salon_name, [])
                if not candidates:
                    for dn, salons in idx_by_salon_name.items():
                        if me_salon_name in dn or dn in me_salon_name:
                            candidates.extend(salons)

                for idx_salon in candidates:
                    for candidate in idx_therapists_by_salon.get(idx_salon["id"], []):
                        if normalize_name(candidate.get("name")) == me_name:
                            idx_t = candidate
                            match_method = "salon_name"
                            break
                    if idx_t:
                        break

        if not idx_t:
            continue

        stats[match_method] += 1

        # 口コミパース
        reviews_raw = parse_reviews_data(mt.get("reviews_data", ""))
        if not reviews_raw:
            continue

        idx_salon_info = idx_salon_map.get(idx_t["salon_id"], {})

        matches.append(
            {
                "indexer_therapist_id": idx_t["id"],
                "indexer_salon_id": idx_t["salon_id"],
                "indexer_salon_name": idx_salon_info.get("display_name")
                or idx_salon_info.get("name"),
                "indexer_cup": idx_t.get("cup"),
                "indexer_waist": idx_t.get("waist"),
                "indexer_height": idx_t.get("height"),
                "indexer_age": idx_t.get("age"),
                "me_therapist_name": mt.get("therapist_name"),
                "me_salon_name": me_salon.get("salon_name") if me_salon else None,
                "match_method": match_method,
                "reviews_raw": reviews_raw,
            }
        )

    return matches, stats


# ---------------------------------------------------------------------------
# メイン
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Step 1: ME生データ抽出")
    parser.add_argument(
        "--limit", type=int, default=None, help="MEセラピスト取得件数制限（テスト用）"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Step 1: ME生データ抽出 → raw_matched_therapists.json")
    print("=" * 60)

    # 1. データ取得
    print("\n[1/3] データ取得中...")
    me = connect_me()
    conn = connect_indexer()

    me_therapists = fetch_me_therapists(me, limit=args.limit)
    me_salons = fetch_me_salons(me)
    idx_therapists = fetch_indexer_therapists(conn)
    idx_salons = fetch_indexer_salons(conn)
    conn.close()

    if not me_therapists:
        print("ME therapists with reviews: 0件。終了。")
        sys.exit(0)

    # 2. マッチング
    print("\n[2/3] マッチング実行中...")
    matches, stats = run_matching(me_therapists, me_salons, idx_therapists, idx_salons)

    # 3. JSON出力
    print("\n[3/3] JSON出力中...")
    os.makedirs(DATA_DIR, exist_ok=True)
    out_path = os.path.join(DATA_DIR, "raw_matched_therapists.json")

    total_reviews = sum(len(m["reviews_raw"]) for m in matches)

    output = {
        "metadata": {
            "total_matched": len(matches),
            "total_reviews": total_reviews,
            "match_url": stats["url"],
            "match_domain_name": stats["domain_name"],
            "match_salon_name": stats["salon_name"],
            "me_therapists_scanned": len(me_therapists),
        },
        "matches": matches,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # 結果表示
    print("\n" + "=" * 60)
    print("結果")
    print("=" * 60)
    print(f"  マッチ合計: {len(matches):,}名")
    print(f"    URL一致:        {stats['url']:>7,}名")
    print(f"    ドメイン+名前:   {stats['domain_name']:>7,}名")
    print(f"    サロン名+名前:   {stats['salon_name']:>7,}名")
    print(f"  口コミ合計: {total_reviews:,}件")
    print(f"\n出力: {out_path}")


if __name__ == "__main__":
    main()
