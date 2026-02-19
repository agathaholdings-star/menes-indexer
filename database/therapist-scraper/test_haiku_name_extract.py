#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Haiku名前抽出テスト: サンプルでBefore/After比較 + コスト計測

DBからセラピストを選び、HTMLキャッシュ or live fetchでページ取得、
name_extractor.extract_name() の結果を現在のDB名と比較。

Usage:
  python test_haiku_name_extract.py --count 20
  python test_haiku_name_extract.py --count 20 --problematic    # 名前が怪しいもの優先
  python test_haiku_name_extract.py --count 100 --compare-db    # DB名との突合

前提:
  - supabase start 済み (127.0.0.1:54322)
  - database/.env に ANTHROPIC_API_KEY
"""

import argparse
import logging
import os
import sys
import time

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# .env読み込み
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

sys.path.insert(0, os.path.dirname(__file__))
from name_extractor import extract_name, get_candidates
from fetch_utils import fetch_page
from html_cache_utils import HtmlCache

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

DB_DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

_cache = HtmlCache()


def get_sample_therapists(cur, count=20, problematic=False):
    """テスト用サンプルを取得"""
    if problematic:
        # 名前が怪しい（サロン名混入、PROFILE等）を優先
        cur.execute("""
            SELECT t.id, t.name, t.source_url, t.salon_id,
                   s.name AS salon_name, s.display_name AS salon_display
            FROM therapists t
            JOIN salons s ON s.id = t.salon_id
            WHERE t.source_url IS NOT NULL AND t.source_url != ''
              AND (
                  t.name = s.name OR t.name = s.display_name
                  OR t.name ~* 'プロフィール|PROFILE|profile|twitter|ツイッター'
                  OR t.name IN ('SNSSNS', 'SCHEDULE', '店長コメント', '名前')
                  OR (length(s.display_name) >= 3 AND t.name LIKE '%%' || s.display_name || '%%')
                  OR (length(s.name) >= 3 AND t.name LIKE '%%' || s.name || '%%')
              )
            ORDER BY random()
            LIMIT %s
        """, (count,))
    else:
        # ランダムサンプル（名前が正常なものも含む）
        cur.execute("""
            SELECT t.id, t.name, t.source_url, t.salon_id,
                   s.name AS salon_name, s.display_name AS salon_display
            FROM therapists t
            JOIN salons s ON s.id = t.salon_id
            WHERE t.source_url IS NOT NULL AND t.source_url != ''
            ORDER BY random()
            LIMIT %s
        """, (count,))
    return cur.fetchall()


def run_test(count=20, problematic=False, compare_db=False):
    """テスト実行"""
    conn = psycopg2.connect(DB_DSN)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    rows = get_sample_therapists(cur, count, problematic)
    log.info(f"サンプル: {len(rows)}件 ({'problematic' if problematic else 'random'})")

    results = []
    total_input_tokens = 0
    total_output_tokens = 0
    llm_calls = 0
    heuristic_success = 0
    llm_success = 0
    failed = 0
    fetch_errors = 0
    start_time = time.time()

    for i, row in enumerate(rows):
        tid = row["id"]
        current_name = row["name"]
        source_url = row["source_url"]
        salon_name = row["salon_name"] or ""
        salon_display = row["salon_display"] or ""

        # HTMLキャッシュ or live fetch
        html = _cache.load("therapist", tid)
        if html is None:
            html = fetch_page(source_url)
            if html:
                _cache.save("therapist", tid, html)
            else:
                fetch_errors += 1
                results.append({
                    "id": tid,
                    "salon_name": salon_name,
                    "current_name": current_name,
                    "extracted": None,
                    "source": None,
                    "method": None,
                    "status": "FETCH_ERR",
                })
                log.warning(f"[{i+1}/{len(rows)}] ID={tid} fetch失敗: {source_url}")
                continue
            time.sleep(0.3)

        # 名前抽出
        result = extract_name(
            html,
            salon_name=salon_name,
            salon_display=salon_display,
            url=source_url,
            use_llm=True,
        )

        if result:
            extracted_name = result["name"]
            source = result["source"]
            method = result["method"]

            if method == "haiku":
                llm_calls += 1
                llm_success += 1
                total_input_tokens += result.get("input_tokens", 0)
                total_output_tokens += result.get("output_tokens", 0)
            else:
                heuristic_success += 1

            # 現在のDB名と比較
            if current_name == extracted_name:
                status = "OK"
            elif current_name in ("PROFILE", "profile", salon_name, salon_display):
                status = "FIXED"
            else:
                status = "CHANGED"

            results.append({
                "id": tid,
                "salon_name": salon_name[:15],
                "current_name": current_name[:20],
                "extracted": extracted_name[:20],
                "source": source[:25],
                "method": method,
                "status": status,
            })
            log.info(f"[{i+1}/{len(rows)}] ID={tid} 「{current_name}」→「{extracted_name}」({source}) [{status}]")
        else:
            failed += 1
            results.append({
                "id": tid,
                "salon_name": salon_name[:15],
                "current_name": current_name[:20],
                "extracted": None,
                "source": None,
                "method": None,
                "status": "FAILED",
            })
            log.warning(f"[{i+1}/{len(rows)}] ID={tid} 「{current_name}」→ 抽出失敗")

    elapsed = time.time() - start_time

    # 結果テーブル表示
    print(f"\n{'='*100}")
    print(f" テスト結果 ({len(results)}件, {elapsed:.1f}秒)")
    print(f"{'='*100}")
    print(f"{'ID':>8} | {'サロン名':<15} | {'現在のDB名':<20} | {'抽出結果':<20} | {'source':<25} | {'status'}")
    print(f"{'-'*8}-+-{'-'*15}-+-{'-'*20}-+-{'-'*20}-+-{'-'*25}-+-{'-'*8}")
    for r in results:
        print(f"{r['id']:>8} | {(r['salon_name'] or '-'):<15} | "
              f"{(r['current_name'] or '-'):<20} | "
              f"{(r['extracted'] or '-'):<20} | "
              f"{(r['source'] or '-'):<25} | {r['status']}")

    # コスト計算
    # Haiku 4.5: $0.80/1M input, $4.00/1M output
    input_cost = total_input_tokens * 0.80 / 1_000_000
    output_cost = total_output_tokens * 4.00 / 1_000_000
    total_cost = input_cost + output_cost

    # 92,587件に適用した場合の推定
    if llm_calls > 0:
        avg_input = total_input_tokens / llm_calls
        avg_output = total_output_tokens / llm_calls
    else:
        avg_input = 0
        avg_output = 0

    # ヒューリスティックで取れない割合を推定
    total_processed = heuristic_success + llm_success + failed
    llm_ratio = llm_calls / total_processed if total_processed > 0 else 0
    estimated_llm_calls = int(92587 * llm_ratio)
    estimated_cost = estimated_llm_calls * (avg_input * 0.80 + avg_output * 4.00) / 1_000_000

    print(f"\n{'='*60}")
    print(f" サマリー")
    print(f"{'='*60}")
    print(f"  処理件数:             {len(results)}件")
    print(f"  ヒューリスティック成功: {heuristic_success}件")
    print(f"  LLM成功:              {llm_success}件")
    print(f"  抽出失敗:             {failed}件")
    print(f"  fetch失敗:            {fetch_errors}件")

    ok_count = sum(1 for r in results if r["status"] == "OK")
    fixed_count = sum(1 for r in results if r["status"] == "FIXED")
    changed_count = sum(1 for r in results if r["status"] == "CHANGED")
    print(f"\n  名前一致(OK):         {ok_count}件")
    print(f"  修正(FIXED):          {fixed_count}件")
    print(f"  変更(CHANGED):        {changed_count}件")

    print(f"\n{'='*60}")
    print(f" コスト")
    print(f"{'='*60}")
    print(f"  LLM呼び出し回数:     {llm_calls}件")
    print(f"  入力トークン合計:     {total_input_tokens:,}")
    print(f"  出力トークン合計:     {total_output_tokens:,}")
    print(f"  1件あたり平均:        入力{avg_input:.0f} / 出力{avg_output:.0f} tokens")
    print(f"  テスト費用:           ${total_cost:.4f}")
    print(f"\n  --- 全92,587件に適用した場合の推定 ---")
    print(f"  ヒューリスティック率:  {(1-llm_ratio)*100:.1f}%")
    print(f"  推定LLM呼び出し:     {estimated_llm_calls:,}件")
    print(f"  推定費用:             ${estimated_cost:.2f}")
    print(f"{'='*60}")

    conn.close()


def main():
    parser = argparse.ArgumentParser(description="Haiku名前抽出テスト")
    parser.add_argument("--count", type=int, default=20, help="サンプル件数（デフォルト20）")
    parser.add_argument("--problematic", action="store_true",
                        help="名前が怪しいもの優先で選ぶ")
    parser.add_argument("--compare-db", action="store_true",
                        help="DB名との突合結果を詳細表示")
    args = parser.parse_args()

    run_test(count=args.count, problematic=args.problematic, compare_db=args.compare_db)


if __name__ == "__main__":
    main()
