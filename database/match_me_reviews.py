#!/usr/bin/env python3
"""
ME口コミ → Indexer マッチング件数アセスメント

MEのreviews_data付きセラピストとIndexerのセラピストを突合し、
何件マッチするかを集計する（データ変更なし・読み取りのみ）。

マッチング方法（3段階）:
  1. URL直接一致: ME therapist_url = Indexer source_url（正規化後）
  2. ドメイン+名前一致: 同ドメインサロン内で名前一致
  3. サロン名+名前一致: サロン名の部分一致 + 名前一致

Usage:
  python database/match_me_reviews.py              # 全件
  python database/match_me_reviews.py --limit 100  # テスト（100件）
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from urllib.parse import urlparse

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from supabase import create_client

# ---------------------------------------------------------------------------
# 接続設定
# ---------------------------------------------------------------------------
ME_ENV_PATH = os.path.expanduser("~/Desktop/menesthe-db/.env")
INDEXER_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"


def connect_me():
    """ME Supabaseクライアントを返す"""
    load_dotenv(ME_ENV_PATH)
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def connect_indexer():
    """IndexerローカルPG接続を返す"""
    conn = psycopg2.connect(INDEXER_DSN)
    return conn


# ---------------------------------------------------------------------------
# URL正規化
# ---------------------------------------------------------------------------
def normalize_url(url: str | None) -> str | None:
    if not url or not url.strip():
        return None
    url = url.strip().lower()
    url = re.sub(r"^http://", "https://", url)
    parsed = urlparse(url)
    host = parsed.hostname or ""
    host = re.sub(r"^www\.", "", host)
    path = parsed.path.rstrip("/") or ""
    normalized = f"https://{host}{path}"
    if parsed.query:
        normalized += f"?{parsed.query}"
    return normalized


def extract_domain(url: str | None) -> str | None:
    if not url or not url.strip():
        return None
    parsed = urlparse(url.strip().lower())
    host = parsed.hostname or ""
    return re.sub(r"^www\.", "", host) or None


# ---------------------------------------------------------------------------
# 名前正規化
# ---------------------------------------------------------------------------
def normalize_name(name: str | None) -> str | None:
    if not name:
        return None
    name = name.strip()
    # 全角→半角スペース、連続スペース除去
    name = re.sub(r"[\s　]+", " ", name)
    # 括弧内を除去
    name = re.sub(r"[（\(].+?[）\)]", "", name)
    name = name.strip()
    return name if name else None


# ---------------------------------------------------------------------------
# MEデータ取得（ページネーション）
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
    """Indexer therapists全件取得"""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, name, source_url, salon_id FROM therapists")
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
# マッチング
# ---------------------------------------------------------------------------
def run_matching(me_therapists, me_salons, idx_therapists, idx_salons):
    # --- 前処理 ---

    # ME salon_id → salon info
    me_salon_map = {}
    for s in me_salons:
        me_salon_map[s["salon_id"]] = s

    # Indexer: source_url → therapist (正規化URL)
    idx_by_url = {}
    idx_url_count = 0
    for t in idx_therapists:
        nurl = normalize_url(t["source_url"])
        if nurl:
            idx_by_url[nurl] = t
            idx_url_count += 1

    # Indexer: salon_id → salon info
    idx_salon_map = {}
    for s in idx_salons:
        idx_salon_map[s["id"]] = s

    # Indexer: domain → [(salon, therapists)]
    idx_by_domain = defaultdict(list)
    idx_therapists_by_salon = defaultdict(list)
    for t in idx_therapists:
        idx_therapists_by_salon[t["salon_id"]].append(t)

    for s in idx_salons:
        domain = s.get("domain") or extract_domain(s.get("official_url"))
        if domain:
            idx_by_domain[domain].append(s)

    # Indexer: normalized salon display_name → salons
    idx_by_salon_name = defaultdict(list)
    for s in idx_salons:
        dn = s.get("display_name") or s.get("name")
        if dn:
            idx_by_salon_name[dn.strip()].append(s)

    # --- マッチング実行 ---
    matched_url = {}       # me_therapist_id → idx therapist
    matched_domain = {}
    matched_name = {}
    unmatched = []

    me_with_url = 0

    for mt in me_therapists:
        me_tid = mt["therapist_id"]

        # Step 1: URL直接一致
        me_turl = normalize_url(mt.get("therapist_url"))
        if me_turl:
            me_with_url += 1
            if me_turl in idx_by_url:
                matched_url[me_tid] = idx_by_url[me_turl]
                continue

        # Step 2: ドメイン+名前一致
        me_salon = me_salon_map.get(mt.get("salon_id"))
        me_name = normalize_name(mt.get("therapist_name"))
        found = False

        if me_salon and me_name:
            me_domain = extract_domain(me_salon.get("salon_url"))
            if me_domain and me_domain in idx_by_domain:
                for idx_salon in idx_by_domain[me_domain]:
                    for idx_t in idx_therapists_by_salon.get(idx_salon["id"], []):
                        idx_name = normalize_name(idx_t.get("name"))
                        if idx_name and idx_name == me_name:
                            matched_domain[me_tid] = idx_t
                            found = True
                            break
                    if found:
                        break

        if found:
            continue

        # Step 3: サロン名+名前一致
        if me_salon and me_name:
            me_salon_name = me_salon.get("salon_name", "").strip()
            if me_salon_name:
                # display_nameの完全一致を試す
                candidates = idx_by_salon_name.get(me_salon_name, [])
                # なければ部分一致
                if not candidates:
                    for dn, salons in idx_by_salon_name.items():
                        if me_salon_name in dn or dn in me_salon_name:
                            candidates.extend(salons)

                for idx_salon in candidates:
                    for idx_t in idx_therapists_by_salon.get(idx_salon["id"], []):
                        idx_name = normalize_name(idx_t.get("name"))
                        if idx_name and idx_name == me_name:
                            matched_name[me_tid] = idx_t
                            found = True
                            break
                    if found:
                        break

        if not found:
            unmatched.append(mt)

    # --- 集計 ---
    total_me = len(me_therapists)
    total_matched = len(matched_url) + len(matched_domain) + len(matched_name)

    # 口コミ件数集計
    def count_reviews(therapist_ids, me_map):
        total = 0
        for tid in therapist_ids:
            t = me_map.get(tid)
            if t and t.get("review_count"):
                total += t["review_count"]
        return total

    me_map = {t["therapist_id"]: t for t in me_therapists}
    reviews_url = count_reviews(matched_url.keys(), me_map)
    reviews_domain = count_reviews(matched_domain.keys(), me_map)
    reviews_name = count_reviews(matched_name.keys(), me_map)

    results = {
        "me_therapists_with_reviews": total_me,
        "me_with_therapist_url": me_with_url,
        "indexer_therapists": len(idx_therapists),
        "indexer_with_source_url": idx_url_count,
        "match_url": len(matched_url),
        "match_domain_name": len(matched_domain),
        "match_salon_name": len(matched_name),
        "total_matched": total_matched,
        "match_rate": round(total_matched / total_me * 100, 1) if total_me else 0,
        "unmatched": len(unmatched),
        "reviews_from_url_match": reviews_url,
        "reviews_from_domain_match": reviews_domain,
        "reviews_from_name_match": reviews_name,
        "reviews_total_matched": reviews_url + reviews_domain + reviews_name,
    }

    return results


# ---------------------------------------------------------------------------
# メイン
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="ME→Indexer マッチング件数アセスメント")
    parser.add_argument("--limit", type=int, default=None, help="MEセラピスト取得件数制限（テスト用）")
    args = parser.parse_args()

    print("=" * 60)
    print("ME口コミ → Indexer マッチング件数アセスメント")
    print("=" * 60)

    # 1. データ取得
    print("\n[1/2] データ取得中...")
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
    print("\n[2/2] マッチング実行中...")
    results = run_matching(me_therapists, me_salons, idx_therapists, idx_salons)

    # 3. 結果出力
    print("\n" + "=" * 60)
    print("結果")
    print("=" * 60)
    print(f"\nME reviews_dataあり: {results['me_therapists_with_reviews']:,}件")
    print(f"  うちtherapist_urlあり: {results['me_with_therapist_url']:,}件")
    print(f"Indexer therapists: {results['indexer_therapists']:,}件")
    print(f"  うちsource_urlあり: {results['indexer_with_source_url']:,}件")
    print(f"\nマッチ結果（セラピスト数）:")
    print(f"  URL一致:         {results['match_url']:>7,}件")
    print(f"  ドメイン+名前:    {results['match_domain_name']:>7,}件")
    print(f"  サロン名+名前:    {results['match_salon_name']:>7,}件")
    print(f"  合計:            {results['total_matched']:>7,}件 ({results['match_rate']}%)")
    print(f"  未マッチ:        {results['unmatched']:>7,}件")
    print(f"\nマッチした口コミ件数:")
    print(f"  URL一致分:       {results['reviews_from_url_match']:>7,}件")
    print(f"  ドメイン+名前分:  {results['reviews_from_domain_match']:>7,}件")
    print(f"  サロン名+名前分:  {results['reviews_from_name_match']:>7,}件")
    print(f"  口コミ合計:      {results['reviews_total_matched']:>7,}件")

    # 4. JSON保存
    out_path = os.path.join(os.path.dirname(__file__), "match_me_reviews_result.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n結果JSON: {out_path}")


if __name__ == "__main__":
    main()
