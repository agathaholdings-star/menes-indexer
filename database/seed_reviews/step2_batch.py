#!/usr/bin/env python3
"""
Step 2 (Batch API版): LLMリライト＆構造化

Anthropic Message Batches APIで一括投入。50%コスト削減、PC起動不要。

Usage:
  python database/seed_reviews/step2_batch.py submit                  # 全件投入
  python database/seed_reviews/step2_batch.py submit --sample 100     # 100件テスト
  python database/seed_reviews/step2_batch.py status                  # 状態確認
  python database/seed_reviews/step2_batch.py download                # 結果取得→rewritten_reviews.json
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

import anthropic

sys.path.insert(0, os.path.dirname(__file__))
from common import DATA_DIR, fallback_body_type_id, fallback_cup_type_id, get_anthropic_api_key
from step2_llm_rewrite import SYSTEM_PROMPT, build_user_prompt, pick_persona

# ---------------------------------------------------------------------------
# 定数
# ---------------------------------------------------------------------------
RAW_PATH = os.path.join(DATA_DIR, "raw_matched_therapists.json")
OUTPUT_PATH = os.path.join(DATA_DIR, "rewritten_reviews.json")
BATCH_STATE_PATH = os.path.join(DATA_DIR, "batch_state.json")

MAX_BATCH_SIZE = 10_000  # Batches APIの1バッチ上限
DEFAULT_MODEL = "claude-sonnet-4-5-20250929"


# ---------------------------------------------------------------------------
# batch_state.json 管理
# ---------------------------------------------------------------------------
def load_batch_state() -> dict:
    if os.path.exists(BATCH_STATE_PATH):
        with open(BATCH_STATE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_batch_state(state: dict):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(BATCH_STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# submit
# ---------------------------------------------------------------------------
def cmd_submit(args):
    print("=" * 60)
    print("Step 2 Batch: submit")
    print(f"  モデル: {args.model}")
    print("=" * 60)

    # 入力読み込み
    if not os.path.exists(RAW_PATH):
        print(f"エラー: {RAW_PATH} が見つかりません。Step 1を先に実行してください。")
        sys.exit(1)

    with open(RAW_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)

    matches = raw["matches"]
    if args.sample:
        matches = matches[: args.sample]

    print(f"  対象: {len(matches)}名")

    # リクエスト組み立て + マッピング（重複therapist_idスキップ）
    requests = []
    mapping = {}
    seen_tids = set()

    for match in matches:
        tid = match["indexer_therapist_id"]
        if tid in seen_tids:
            continue
        seen_tids.add(tid)
        custom_id = f"t_{tid}"
        persona = pick_persona()
        user_prompt = build_user_prompt(match, persona)

        requests.append({
            "custom_id": custom_id,
            "params": {
                "model": args.model,
                "max_tokens": 2000,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": user_prompt}],
            },
        })

        mapping[custom_id] = {
            "indexer_therapist_id": tid,
            "indexer_salon_id": match["indexer_salon_id"],
            "persona": persona["name"],
            "indexer_waist": match.get("indexer_waist"),
            "indexer_cup": match.get("indexer_cup"),
        }

    # バッチ分割（10,000件上限）
    chunks = [
        requests[i : i + MAX_BATCH_SIZE]
        for i in range(0, len(requests), MAX_BATCH_SIZE)
    ]
    print(f"  バッチ数: {len(chunks)} ({' + '.join(str(len(c)) for c in chunks)}件)")

    # API投入
    api_key = get_anthropic_api_key()
    client = anthropic.Anthropic(api_key=api_key)

    batch_ids = []
    for idx, chunk in enumerate(chunks):
        print(f"\n  バッチ {idx + 1}/{len(chunks)} 投入中 ({len(chunk)}件)...", end="", flush=True)
        batch = client.messages.batches.create(requests=chunk)
        batch_ids.append(batch.id)
        print(f" OK → {batch.id}")

    # state保存
    state = {
        "batch_ids": batch_ids,
        "model": args.model,
        "total_requests": len(requests),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "mapping": mapping,
    }
    save_batch_state(state)

    print(f"\n投入完了: {len(requests)}件 → {len(batch_ids)}バッチ")
    print(f"状態ファイル: {BATCH_STATE_PATH}")
    print(f"\n結果確認:  python {__file__} status")
    print(f"結果取得:  python {__file__} download")


# ---------------------------------------------------------------------------
# status
# ---------------------------------------------------------------------------
def cmd_status(args):
    state = load_batch_state()
    if not state.get("batch_ids"):
        print("バッチが見つかりません。先に submit を実行してください。")
        sys.exit(1)

    print("=" * 60)
    print("Step 2 Batch: status")
    print(f"  モデル: {state.get('model', '?')}")
    print(f"  投入日時: {state.get('submitted_at', '?')}")
    print(f"  総リクエスト: {state.get('total_requests', '?')}件")
    print("=" * 60)

    api_key = get_anthropic_api_key()
    client = anthropic.Anthropic(api_key=api_key)

    all_ended = True
    for batch_id in state["batch_ids"]:
        batch = client.messages.batches.retrieve(batch_id)
        counts = batch.request_counts
        total = counts.processing + counts.succeeded + counts.errored + counts.expired + counts.canceled
        print(f"\n  [{batch_id}]")
        print(f"    status: {batch.processing_status}")
        print(f"    succeeded: {counts.succeeded} / {total}")
        print(f"    errored:   {counts.errored}")
        print(f"    expired:   {counts.expired}")
        print(f"    canceled:  {counts.canceled}")
        print(f"    processing: {counts.processing}")
        if batch.processing_status != "ended":
            all_ended = False

    if all_ended:
        print("\n全バッチ完了。download で結果を取得できます。")
    else:
        print("\nまだ処理中のバッチがあります。")


# ---------------------------------------------------------------------------
# download
# ---------------------------------------------------------------------------
def cmd_download(args):
    state = load_batch_state()
    if not state.get("batch_ids"):
        print("バッチが見つかりません。先に submit を実行してください。")
        sys.exit(1)

    mapping = state.get("mapping", {})

    print("=" * 60)
    print("Step 2 Batch: download")
    print("=" * 60)

    api_key = get_anthropic_api_key()
    client = anthropic.Anthropic(api_key=api_key)

    results = []
    errors = 0
    parse_failures = 0

    for batch_id in state["batch_ids"]:
        # まず状態確認
        batch = client.messages.batches.retrieve(batch_id)
        if batch.processing_status != "ended":
            print(f"  [{batch_id}] まだ処理中 (status={batch.processing_status})。完了後に再実行してください。")
            sys.exit(1)

        print(f"\n  [{batch_id}] 結果取得中...")
        for entry in client.messages.batches.results(batch_id):
            custom_id = entry.custom_id
            meta = mapping.get(custom_id, {})
            tid = meta.get("indexer_therapist_id")

            if entry.result.type != "succeeded":
                errors += 1
                print(f"    {custom_id}: {entry.result.type}")
                continue

            # レスポンスからテキスト抽出
            message = entry.result.message
            text = message.content[0].text.strip()

            # JSON抽出（```json ... ``` で囲まれている場合に対応）
            if text.startswith("```"):
                lines = text.split("\n")
                json_lines = []
                in_block = False
                for line in lines:
                    if line.startswith("```") and not in_block:
                        in_block = True
                        continue
                    if line.startswith("```") and in_block:
                        break
                    if in_block:
                        json_lines.append(line)
                text = "\n".join(json_lines)

            try:
                result = json.loads(text)
            except json.JSONDecodeError:
                parse_failures += 1
                print(f"    {custom_id}: JSONパース失敗")
                continue

            # フォールバック
            if result.get("body_type_id") is None:
                result["body_type_id"] = fallback_body_type_id(meta.get("indexer_waist"))

            if result.get("cup_type_id") is None:
                result["cup_type_id"] = fallback_cup_type_id(meta.get("indexer_cup"))

            # メタ付与
            result["_persona"] = meta.get("persona", "不明")
            result["indexer_therapist_id"] = tid
            result["indexer_salon_id"] = meta.get("indexer_salon_id")

            results.append(result)

    # 出力保存（step2と同じ形式）
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {
                "metadata": {
                    "model": state.get("model", "?"),
                    "total_processed": len(results),
                    "total_input": state.get("total_requests", 0),
                    "batch_ids": state["batch_ids"],
                },
                "reviews": results,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    # サマリー
    print("\n" + "=" * 60)
    print("完了")
    print("=" * 60)
    print(f"  成功: {len(results):,}件")
    print(f"  エラー: {errors}件")
    print(f"  JSONパース失敗: {parse_failures}件")

    if results:
        avg_score = sum(r.get("score", 0) for r in results) / len(results)
        print(f"  平均スコア: {avg_score:.1f}")

        # ペルソナ分布
        persona_counts = {}
        for r in results:
            p = r.get("_persona", "不明")
            persona_counts[p] = persona_counts.get(p, 0) + 1
        print("  ペルソナ分布:")
        for name, count in sorted(persona_counts.items(), key=lambda x: -x[1]):
            pct = count / len(results) * 100
            print(f"    {name}: {count}件 ({pct:.0f}%)")

    print(f"\n出力: {OUTPUT_PATH}")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Step 2 Batch: Message Batches APIでリライト")
    sub = parser.add_subparsers(dest="command")

    # submit
    p_submit = sub.add_parser("submit", help="バッチ投入")
    p_submit.add_argument("--model", default=DEFAULT_MODEL, help=f"使用モデル (default: {DEFAULT_MODEL})")
    p_submit.add_argument("--sample", type=int, default=None, help="サンプル件数（テスト用）")

    # status
    sub.add_parser("status", help="バッチ状態確認")

    # download
    sub.add_parser("download", help="結果取得→rewritten_reviews.json")

    args = parser.parse_args()

    if args.command == "submit":
        cmd_submit(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "download":
        cmd_download(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
