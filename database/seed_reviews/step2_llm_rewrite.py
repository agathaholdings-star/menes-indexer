#!/usr/bin/env python3
"""
Step 2: LLMリライト＆構造化

raw_matched_therapists.json を読み込み、セラピストごとに
Claude APIで口コミリライト + 構造化データ推定を実行。

Usage:
  # サンプルテスト
  python database/seed_reviews/step2_llm_rewrite.py --sample 10 --model claude-haiku-4-5-20251001

  # 本番実行（レジューム対応）
  python database/seed_reviews/step2_llm_rewrite.py --model claude-sonnet-4-5-20250514 --workers 3 --resume
"""

import argparse
import json
import os
import signal
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import anthropic

sys.path.insert(0, os.path.dirname(__file__))
from common import DATA_DIR, fallback_body_type_id, fallback_cup_type_id, get_anthropic_api_key

# ---------------------------------------------------------------------------
# 定数
# ---------------------------------------------------------------------------
RAW_PATH = os.path.join(DATA_DIR, "raw_matched_therapists.json")
OUTPUT_PATH = os.path.join(DATA_DIR, "rewritten_reviews.json")
CHECKPOINT_PATH = os.path.join(DATA_DIR, "rewrite_checkpoint.json")

CHECKPOINT_INTERVAL = 10  # 何件ごとにチェックポイント保存

# ---------------------------------------------------------------------------
# プロンプト
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """\
あなたはメンズエステの口コミサイト「メンエスインデクサ」の口コミリライトAIです。
提供された口コミデータを元に、新しい口コミを生成してください。

## ルール

1. **一人称視点、カジュアル口語体**で書く
   - 「めっちゃ」「マジで」「正直」「〜って感じ」「ぶっちゃけ」など自然な話し言葉
   - 「です・ます」調ではなく「だ・である」調

2. **固有名詞（芸能人名等）は全面禁止** → 一般表現に言い換え
   - ❌「櫻坂にいそう」→ ✅「アイドルっぽい雰囲気」
   - ❌「石原さとみ似」→ ✅「清楚系美人」

3. **元口コミのセリフ・特徴的表現はコピー禁止** → 意味を保持して別表現で書き直す

4. **推測禁止**: 元口コミに明記されている情報のみ使用。身長・胸サイズ・年齢等の断定は入力データに記載がある場合のみ

5. **業界用語はそのまま使用可**: HR, NS, DL, MB, KS, KNN, GHR, DKS, SKR, HJ, TKK, TMN, 4TB, カエル足, スパイダー, 添い寝, 洗体, キワキワ, 鼠径部 等

6. **金額は元口コミに記載がある場合のみ**使用。推測禁止。

7. **フィールドの生成方針**（全フィールド必須、nullは返さないこと）
   - `comment_first_impression`, `comment_style`, `comment_service`, `comment_service_detail`: 口コミ元データの内容を元にリライトする
   - `comment_reason`, `comment_revisit`, `comment_advice`: 口コミ投稿者の立場で自然な主観を自由に書いてよい
   - `comment_cost`: 口コミ元データに金額情報がある場合はそれを使う。金額情報がない場合は「覚えてない」「確か○万くらいだった」「忘れちゃったけどコスパは良かった」等の曖昧な主観を生成する。具体的な架空金額（例: "15,000円でした"）の捏造は禁止
   - `cost_total`: 口コミ元データに明確な金額がある場合のみ数値を入れる。不明な場合はnull（これは非表示の内部数値フィールドなのでバレない）

## 出力形式

**必ず以下のJSON形式のみを出力してください。**他の文字やマークダウンは不要です。

```json
{
  "score": 80,
  "looks_type_id": 1,
  "body_type_id": 2,
  "cup_type_id": 3,
  "service_level_id": 2,
  "param_conversation": 4,
  "param_distance": 3,
  "param_technique": 4,
  "param_personality": 4,
  "cost_total": 20000,
  "comment_reason": "Q0: きっかけ（50-300字）",
  "comment_first_impression": "Q1: 顔の印象（50-300字）",
  "comment_style": "Q2: スタイル（50-300字）",
  "comment_service": "Q3: 施術の流れ（100-300字）",
  "comment_service_detail": "Q4: どこまでいけた（50-300字）",
  "comment_cost": "Q5: 金額（20-300字）",
  "comment_revisit": "Q6: 再訪するか（50-300字）",
  "comment_advice": "Q7: アドバイス（50-300字）"
}
```

## フィールド詳細

### 数値フィールド
- `score`: 0-100。口コミ内容から主観的に判定。90+: 絶賛, 80-89: 満足, 70-79: 普通〜やや良い, 60-69: 微妙, <60: ハズレ
- `looks_type_id`: **最も当てはまる1つだけ**選ぶ。1=清楚系, 2=素人系, 3=ギャル系, 4=モデル系, 5=ロリ系, 6=女優系, 7=夜職系, 8=熟女系
- `body_type_id`: 1=華奢, 2=スレンダー, 3=バランス, 4=グラマー, 5=ぽっちゃり。判定不能ならnull
- `cup_type_id`: 1=なし, 2=控えめ, 3=標準, 4=大きめ, 5=巨乳。判定不能ならnull
- `service_level_id`: 1=健全, 2=SKR, 3=HR
- `param_conversation`: 会話力 1-5
- `param_distance`: 距離感・密着度 1-5
- `param_technique`: 技術力 1-5
- `param_personality`: 人柄 1-5
- `cost_total`: トータル金額（円）。不明ならnull

### テキストフィールド
- `comment_reason`: きっかけ。なぜこのセラピストを選んだか（50-300字）
- `comment_first_impression`: 顔の印象（50-300字）
- `comment_style`: スタイル・体型（50-300字）
- `comment_service`: 施術の流れ（100-300字）
- `comment_service_detail`: どこまでいけたか。寛容度の詳細（50-300字）
- `comment_cost`: 金額やコスパ（20-300字）。元口コミに金額情報がなければ曖昧な主観（「覚えてないけどコスパは良かった」等）を書く。nullや空文字は禁止
- `comment_revisit`: 再訪意欲（50-300字）
- `comment_advice`: 後から行く人へのアドバイス（50-300字）"""


def build_user_prompt(match: dict) -> str:
    """セラピスト1人分のユーザープロンプトを組み立てる"""
    name = match.get("me_therapist_name", "不明")
    salon = match.get("me_salon_name") or match.get("indexer_salon_name") or "不明"
    age = match.get("indexer_age") or "不明"
    height = match.get("indexer_height") or "不明"
    cup = match.get("indexer_cup") or "不明"
    waist = match.get("indexer_waist") or "不明"

    reviews_text = ""
    for r in match.get("reviews_raw", []):
        score_str = f"{r['score']}点" if r.get("score") is not None else "点数なし"
        reviews_text += f"---\n[{r['date']}] {score_str}\n{r['text']}\n"

    count = len(match.get("reviews_raw", []))

    return f"""セラピスト名: {name}
サロン名: {salon}
年齢: {age}
身長: {height}cm
カップ: {cup}
ウエスト: {waist}cm

口コミ（{count}件）:
{reviews_text}---

上記の口コミ全てを読み込み、1件の新しい口コミとしてリライトしてください。JSON形式のみ出力してください。"""


# ---------------------------------------------------------------------------
# API呼び出し
# ---------------------------------------------------------------------------
def call_claude(client, model: str, match: dict, max_retries: int = 3) -> dict | None:
    """1セラピスト分のAPIコールを実行。リトライ付き。"""
    user_prompt = build_user_prompt(match)

    for attempt in range(max_retries):
        try:
            response = client.messages.create(
                model=model,
                max_tokens=2000,
                messages=[{"role": "user", "content": user_prompt}],
                system=SYSTEM_PROMPT,
            )

            text = response.content[0].text.strip()

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

            result = json.loads(text)

            # フォールバック: body_type_id
            if result.get("body_type_id") is None:
                result["body_type_id"] = fallback_body_type_id(
                    match.get("indexer_waist")
                )

            # フォールバック: cup_type_id
            if result.get("cup_type_id") is None:
                result["cup_type_id"] = fallback_cup_type_id(
                    match.get("indexer_cup")
                )

            return result

        except json.JSONDecodeError:
            if attempt < max_retries - 1:
                print(f"    JSON解析失敗、リトライ {attempt + 2}/{max_retries}")
                time.sleep(2)
            else:
                print(f"    JSON解析失敗（{max_retries}回）、スキップ")
                return None

        except anthropic.RateLimitError:
            wait = 2 ** (attempt + 1)
            print(f"    Rate limit、{wait}秒待機...")
            time.sleep(wait)

        except anthropic.APIError as e:
            if attempt < max_retries - 1:
                wait = 2 ** (attempt + 1)
                print(f"    APIエラー: {e}、{wait}秒後にリトライ")
                time.sleep(wait)
            else:
                print(f"    APIエラー（{max_retries}回）: {e}、スキップ")
                return None

    return None


# ---------------------------------------------------------------------------
# チェックポイント
# ---------------------------------------------------------------------------
def load_checkpoint() -> dict:
    """チェックポイントを読み込む"""
    if os.path.exists(CHECKPOINT_PATH):
        with open(CHECKPOINT_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"completed_ids": [], "results": []}


def save_checkpoint(checkpoint: dict):
    """チェックポイントを保存"""
    with open(CHECKPOINT_PATH, "w", encoding="utf-8") as f:
        json.dump(checkpoint, f, ensure_ascii=False)


# ---------------------------------------------------------------------------
# メイン処理
# ---------------------------------------------------------------------------
def process_sequential(client, model, matches, checkpoint, start_idx):
    """逐次処理（workers=1）"""
    results = checkpoint["results"]
    completed_ids = set(checkpoint["completed_ids"])
    total = len(matches)

    for i, match in enumerate(matches[start_idx:], start=start_idx):
        tid = match["indexer_therapist_id"]
        if tid in completed_ids:
            continue

        name = match.get("me_therapist_name", "?")
        print(
            f"  [{i + 1}/{total}] {name} (therapist_id={tid}, "
            f"{len(match.get('reviews_raw', []))}件の口コミ)...",
            end="",
        )

        result = call_claude(client, model, match)
        if result:
            result["indexer_therapist_id"] = tid
            result["indexer_salon_id"] = match["indexer_salon_id"]
            results.append(result)
            completed_ids.add(tid)
            print(" OK")
        else:
            print(" SKIP")

        # チェックポイント
        if (i + 1) % CHECKPOINT_INTERVAL == 0:
            checkpoint["completed_ids"] = list(completed_ids)
            checkpoint["results"] = results
            save_checkpoint(checkpoint)
            print(f"    [checkpoint saved: {len(results)}件完了]")

    return results, completed_ids


def process_parallel(client, model, matches, checkpoint, start_idx, workers):
    """並列処理（workers>=2）"""
    results = checkpoint["results"]
    completed_ids = set(checkpoint["completed_ids"])
    total = len(matches)
    pending = [
        (i, m)
        for i, m in enumerate(matches)
        if i >= start_idx and m["indexer_therapist_id"] not in completed_ids
    ]

    processed = 0

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {}
        for i, match in pending:
            future = executor.submit(call_claude, client, model, match)
            futures[future] = (i, match)

        for future in as_completed(futures):
            i, match = futures[future]
            tid = match["indexer_therapist_id"]
            name = match.get("me_therapist_name", "?")

            result = future.result()
            processed += 1

            if result:
                result["indexer_therapist_id"] = tid
                result["indexer_salon_id"] = match["indexer_salon_id"]
                results.append(result)
                completed_ids.add(tid)
                print(
                    f"  [{len(completed_ids)}/{total}] {name} OK"
                )
            else:
                print(
                    f"  [{processed}/{total}] {name} SKIP"
                )

            if processed % CHECKPOINT_INTERVAL == 0:
                checkpoint["completed_ids"] = list(completed_ids)
                checkpoint["results"] = results
                save_checkpoint(checkpoint)
                print(f"    [checkpoint saved: {len(results)}件完了]")

    return results, completed_ids


def main():
    parser = argparse.ArgumentParser(description="Step 2: LLMリライト＆構造化")
    parser.add_argument(
        "--model",
        default="claude-haiku-4-5-20251001",
        help="使用モデル（default: claude-haiku-4-5-20251001）",
    )
    parser.add_argument(
        "--sample",
        type=int,
        default=None,
        help="サンプル件数（テスト用）",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="並列ワーカー数（default: 1）",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="チェックポイントから再開",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Step 2: LLMリライト＆構造化")
    print(f"  モデル: {args.model}")
    print(f"  ワーカー: {args.workers}")
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

    print(f"\n対象: {len(matches)}名")

    # チェックポイント
    if args.resume:
        checkpoint = load_checkpoint()
        completed = set(checkpoint["completed_ids"])
        remaining = [
            m
            for m in matches
            if m["indexer_therapist_id"] not in completed
        ]
        print(f"  既完了: {len(checkpoint['results'])}件、残り: {len(remaining)}件")
        start_idx = 0
    else:
        checkpoint = {"completed_ids": [], "results": []}
        start_idx = 0

    # Ctrl+C ハンドラ
    interrupted = False

    def signal_handler(sig, frame):
        nonlocal interrupted
        interrupted = True
        print("\n\n中断検出。チェックポイントを保存中...")
        save_checkpoint(checkpoint)
        print(f"保存完了: {len(checkpoint['results'])}件")
        print(f"\n再開コマンド:")
        print(f"  python {__file__} --model {args.model} --workers {args.workers} --resume")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

    # API client
    api_key = get_anthropic_api_key()
    client = anthropic.Anthropic(api_key=api_key)

    # 処理実行
    print("\n処理開始...")
    t0 = time.time()

    if args.workers <= 1:
        results, completed_ids = process_sequential(
            client, args.model, matches, checkpoint, start_idx
        )
    else:
        results, completed_ids = process_parallel(
            client, args.model, matches, checkpoint, start_idx, args.workers
        )

    elapsed = time.time() - t0

    # 最終保存
    checkpoint["completed_ids"] = list(completed_ids)
    checkpoint["results"] = results
    save_checkpoint(checkpoint)

    # 出力ファイル保存
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {
                "metadata": {
                    "model": args.model,
                    "total_processed": len(results),
                    "total_input": len(matches),
                    "elapsed_seconds": round(elapsed, 1),
                },
                "reviews": results,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    # 結果表示
    print("\n" + "=" * 60)
    print("完了")
    print("=" * 60)
    print(f"  成功: {len(results):,}件 / {len(matches):,}件")
    print(f"  所要時間: {elapsed:.0f}秒 ({elapsed / 60:.1f}分)")
    if results:
        avg_score = sum(r.get("score", 0) for r in results) / len(results)
        print(f"  平均スコア: {avg_score:.1f}")
    print(f"\n出力: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
