#!/usr/bin/env python3
"""
サロン紹介文バッチ生成（SERP検索+スクレイピング版）

Phase 1: DataForSEO SERP検索 + 公式サイト/検索結果ページのスクレイピング
Phase 2: Sonnet Batch APIで紹介文生成
Phase 3: 結果取得 & DB書き込み

Usage:
  # サンプルN件テスト（SERP検索付き、通常API）
  python database/generate_salon_descriptions.py --sample 5

  # 全件データ収集（SERP検索 + スクレイピング）
  python database/generate_salon_descriptions.py collect
  python database/generate_salon_descriptions.py collect --resume

  # Batch API投入
  python database/generate_salon_descriptions.py submit

  # バッチ状態確認
  python database/generate_salon_descriptions.py status

  # 結果取得 & DB書き込み
  python database/generate_salon_descriptions.py download
"""

import argparse
import base64
import json
import os
import sys
import time
from datetime import datetime, timezone

import anthropic
import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# パス設定
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(SCRIPT_DIR, ".env")
DATA_DIR = os.path.join(SCRIPT_DIR, "salon_descriptions_data")
RESEARCH_PATH = os.path.join(DATA_DIR, "research_data.jsonl")
PROGRESS_PATH = os.path.join(DATA_DIR, "progress.json")
FAILED_PATH = os.path.join(DATA_DIR, "failed_salons.json")
BATCH_STATE_PATH = os.path.join(DATA_DIR, "batch_state.json")

load_dotenv(ENV_PATH)
INDEXER_DSN = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
MAX_BATCH_SIZE = 10_000
DEFAULT_MODEL = "claude-sonnet-4-20250514"

# ---------------------------------------------------------------------------
# ユーティリティ
# ---------------------------------------------------------------------------

def get_api_key() -> str:
    load_dotenv(ENV_PATH)
    return os.environ["ANTHROPIC_API_KEY"]


def get_dataforseo_auth() -> str:
    """DataForSEO Basic認証ヘッダ値を返す"""
    load_dotenv(ENV_PATH)
    login = os.environ["DATAFORSEO_LOGIN"]
    password = os.environ["DATAFORSEO_PASSWORD"]
    return base64.b64encode(f"{login}:{password}".encode()).decode()


def connect_db():
    return psycopg2.connect(INDEXER_DSN)


def scrape_page(url: str, max_chars: int = 2500) -> str:
    """URLからメインコンテンツのテキストを抽出"""
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            timeout=10,
        )
        resp.encoding = resp.apparent_encoding
        soup = BeautifulSoup(resp.text, "html.parser")

        # 不要タグ除去
        for tag in soup(["script", "style", "nav", "header", "footer", "aside", "noscript", "iframe"]):
            tag.decompose()

        # メインコンテンツ優先
        main = soup.select_one("main") or soup.select_one("article") or soup
        text = main.get_text(separator=" ", strip=True)
        return text[:max_chars]
    except Exception:
        return ""


def search_dataforseo(query: str, auth_string: str) -> tuple[list[dict] | None, str | None]:
    """DataForSEOでGoogle検索し、上位5件のorganic結果を返す"""
    try:
        response = requests.post(
            "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
            headers={"Authorization": f"Basic {auth_string}", "Content-Type": "application/json"},
            json=[{"keyword": query, "location_code": 2392, "language_code": "ja", "depth": 10}],
            timeout=60,
        )
        data = response.json()

        status_code = data.get("status_code")
        if status_code == 40200:
            raise Exception("DataForSEO残高不足！処理を停止します。")
        if status_code == 40100:
            raise Exception("DataForSEO認証エラー！APIキーを確認してください。")
        if status_code != 20000:
            return None, f"API error: {status_code} - {data.get('status_message')}"

        tasks = data.get("tasks", [])
        if not tasks or not tasks[0].get("result"):
            return None, "No result"

        task = tasks[0]
        if task.get("status_code") != 20000:
            return None, f"Task error: {task.get('status_code')}"

        items = task["result"][0].get("items", [])
        organic = [
            {"title": item.get("title", ""), "url": item.get("url", "")}
            for item in items
            if item.get("type") == "organic"
        ][:5]

        return organic, None

    except requests.exceptions.Timeout:
        return None, "Timeout"
    except Exception as e:
        if "残高不足" in str(e) or "認証エラー" in str(e):
            raise
        return None, str(e)


def collect_research_for_salon(salon: dict, auth_string: str) -> tuple[str | None, str | None]:
    """1サロンについてSERP検索+スクレイピングし、research_textを返す。

    Returns:
        (research_text, error) — 成功時はresearch_text, 失敗時はerror
    """
    display_name = salon["display_name"]
    official_url = salon.get("official_url")

    research_parts = []

    # 1. 公式サイトスクレイピング
    if official_url:
        content = scrape_page(official_url)
        if content and len(content) > 50:
            research_parts.append(f"【公式サイト】\n{content}")

    # 2. DataForSEO SERP検索
    query = f"{display_name} メンエス 口コミ"

    results, error = search_dataforseo(query, auth_string)
    if error:
        # SERP失敗でも公式サイトが取れていれば続行
        if not research_parts:
            return None, error

    # 3. 検索結果ページのスクレイピング
    if results:
        for r in results:
            content = scrape_page(r["url"])
            if content and len(content) > 50:
                research_parts.append(f"【{r['title']}】\n{content}")

    if not research_parts:
        return None, "スクレイピング結果なし"

    return "\n\n".join(research_parts), None


# ---------------------------------------------------------------------------
# プロンプト
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = "あなたはメンズエステ情報サイト「メンエスインデクサ」の編集部です。"


def build_user_prompt(salon: dict) -> str:
    """サロン情報+research_textからユーザープロンプトを組み立て"""
    display_name = salon["display_name"]
    research_text = salon.get("research_text", "")

    lines = [
        f'以下は「{display_name}」について検索した情報です。',
        "",
        "【参考情報】",
        research_text,
        "",
        "---",
        "",
        f'上記を参考に、「{display_name}ってどんなサロン？」という疑問に答える紹介文を書いてください。',
        "",
        "250〜350文字の紹介文を1つ、JSON形式で出力してください。",
        "",
        "【含める内容】",
        "- サロンの特徴・雰囲気・コンセプト",
        "- セラピスト全体の傾向",
        "- 口コミで評価されているポイント",
        "- こんな人に向いている",
        "",
        "【絶対禁止】",
        "- 最寄り駅・アクセス情報（UIに表示済み）",
        "- 料金・コース時間の具体的な数字（UIに表示済み）",
        "- 営業時間（UIに表示済み）",
        "- 口コミの件数・平均点・スコアなど定量的な評価",
        "- 「おすすめ」「人気」「話題」等の主観語",
        "- 特定のセラピスト個人名",
        "",
        "【文体ルール】",
        "- です・ます調で、堅くなりすぎないように",
        "- 具体的な数字は「約」「程度」を使い断定しない",
        "- 検索情報にないことは書かない",
        "",
        '【出力形式】JSONのみ',
        '{"description": "..."}',
    ]
    return "\n".join(lines)


def parse_json_response(text: str) -> dict | None:
    """LLMレスポンスからJSONを抽出"""
    text = text.strip()
    # ```json ... ``` で囲まれている場合
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
        if "description" in result:
            return result
    except json.JSONDecodeError:
        pass
    return None


# ---------------------------------------------------------------------------
# DB クエリ
# ---------------------------------------------------------------------------

# collect/submit用: 全サロン
SALON_QUERY_ALL = """
SELECT id, display_name, official_url
FROM salons
WHERE is_active = true
  AND display_name IS NOT NULL
ORDER BY id
"""

# --sample用: N件
SALON_QUERY_TOP_N = """
SELECT id, display_name, official_url
FROM salons
WHERE is_active = true
  AND display_name IS NOT NULL
ORDER BY id
LIMIT %s
"""


# ---------------------------------------------------------------------------
# progress.json 管理
# ---------------------------------------------------------------------------
def load_progress() -> dict:
    if os.path.exists(PROGRESS_PATH):
        with open(PROGRESS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"processed_ids": []}


def save_progress(progress: dict):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(PROGRESS_PATH, "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False)


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
# --sample: SERP検索付き通常APIでN件テスト
# ---------------------------------------------------------------------------
def cmd_sample(args):
    n = args.sample
    print("=" * 60)
    print(f"サンプルテスト: {n}件（SERP検索付き、通常API）")
    print(f"モデル: {args.model}")
    print("=" * 60)

    conn = connect_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute(SALON_QUERY_TOP_N, (n,))
    salons = [dict(row) for row in cur.fetchall()]
    cur.close()
    conn.close()

    if not salons:
        print("対象サロンが見つかりません。")
        return

    print(f"\n対象: {len(salons)}件")

    auth_string = get_dataforseo_auth()
    api_key = get_api_key()
    client = anthropic.Anthropic(api_key=api_key)

    for i, salon in enumerate(salons):
        print(f"\n{'─' * 50}")
        print(f"[{i+1}/{len(salons)}] {salon['display_name']} (ID={salon['id']})")
        print(f"  エリア: {salon.get('area_name', 'なし')}")
        print(f"  公式URL: {salon.get('official_url', 'なし')}")

        # SERP検索 + スクレイピング
        print("  SERP検索中...", end="", flush=True)
        research_text, error = collect_research_for_salon(salon, auth_string)
        if error:
            print(f" 失敗: {error}")
            continue
        print(f" OK ({len(research_text)}字)")

        salon["research_text"] = research_text
        user_prompt = build_user_prompt(salon)

        try:
            response = client.messages.create(
                model=args.model,
                max_tokens=1000,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )
            text = response.content[0].text
            result = parse_json_response(text)

            if result:
                desc = result["description"]
                print(f"\n  ▼ description ({len(desc)}字):")
                print(f"    {desc}")
                print(f"\n  入力トークン: {response.usage.input_tokens}, 出力トークン: {response.usage.output_tokens}")
            else:
                print(f"  ✗ JSONパース失敗")
                print(f"    生テキスト: {text[:200]}")

        except Exception as e:
            print(f"  ✗ APIエラー: {e}")

        # DataForSEOレート制限
        time.sleep(1)

    print(f"\n{'=' * 60}")
    print("サンプルテスト完了")
    print("品質OKなら collect → submit → download で全件実行")


# ---------------------------------------------------------------------------
# collect: SERP検索 + スクレイピング → research_data.jsonl
# ---------------------------------------------------------------------------
def cmd_collect(args):
    print("=" * 60)
    print("Phase 1: SERP検索 + スクレイピング")
    print("=" * 60)

    conn = connect_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute(SALON_QUERY_ALL)
    salons = [dict(row) for row in cur.fetchall()]
    cur.close()
    conn.close()

    print(f"  対象サロン: {len(salons)}件")

    if not salons:
        print("対象サロンがありません。")
        return

    os.makedirs(DATA_DIR, exist_ok=True)

    # レジューム: 既に処理済みのIDをスキップ
    progress = load_progress()
    processed_ids = set(progress.get("processed_ids", []))

    # 失敗リスト
    failed_salons = []
    if os.path.exists(FAILED_PATH):
        with open(FAILED_PATH, "r", encoding="utf-8") as f:
            failed_salons = json.load(f)

    auth_string = get_dataforseo_auth()

    start_time = datetime.now()
    success_count = 0
    skip_count = 0
    fail_count = 0
    total = len(salons)

    print(f"  処理済み(スキップ): {len(processed_ids)}件")
    print(f"  処理開始: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)

    # append mode（レジュームで追記可能）
    with open(RESEARCH_PATH, "a", encoding="utf-8") as f:
        for i, salon in enumerate(salons):
            sid = salon["id"]

            if sid in processed_ids:
                skip_count += 1
                continue

            # 進捗表示
            processed_so_far = success_count + fail_count
            if processed_so_far > 0 and processed_so_far % 10 == 0:
                elapsed = (datetime.now() - start_time).total_seconds()
                rate = processed_so_far / elapsed if elapsed > 0 else 0
                remaining = total - i
                eta = remaining / rate / 60 if rate > 0 else 0
                print(
                    f"  [{i+1}/{total}] {salon['display_name'][:20]}... "
                    f"成功:{success_count} 失敗:{fail_count} スキップ:{skip_count} "
                    f"ETA:{eta:.0f}分"
                )

            try:
                research_text, error = collect_research_for_salon(salon, auth_string)

                if error:
                    fail_count += 1
                    failed_salons.append({
                        "salon_id": sid,
                        "display_name": salon["display_name"],
                        "error": error,
                    })
                else:
                    record = {
                        "salon_id": sid,
                        "display_name": salon["display_name"],
                        "research_text": research_text,
                    }
                    f.write(json.dumps(record, ensure_ascii=False) + "\n")
                    f.flush()
                    success_count += 1

                # 進捗保存
                processed_ids.add(sid)
                progress["processed_ids"] = list(processed_ids)
                save_progress(progress)

                # DataForSEOレート制限
                time.sleep(1)

            except Exception as e:
                print(f"\n  致命的エラー: {e}")
                print("  処理を停止します。--resume で再開できます。")
                break

    # 失敗リスト保存
    with open(FAILED_PATH, "w", encoding="utf-8") as f:
        json.dump(failed_salons, f, ensure_ascii=False, indent=2)

    duration = (datetime.now() - start_time).total_seconds() / 60
    print(f"\n{'=' * 60}")
    print("Phase 1 完了")
    print("=" * 60)
    print(f"  処理時間: {duration:.1f}分")
    print(f"  成功: {success_count}件")
    print(f"  失敗: {fail_count}件")
    print(f"  スキップ(処理済み): {skip_count}件")
    print(f"\n  出力: {RESEARCH_PATH}")
    print(f"  失敗リスト: {FAILED_PATH}")
    print(f"\n次: python {__file__} submit")


# ---------------------------------------------------------------------------
# submit: Batch API投入
# ---------------------------------------------------------------------------
def cmd_submit(args):
    print("=" * 60)
    print("Phase 2: Batch API投入")
    print(f"  モデル: {args.model}")
    print("=" * 60)

    if not os.path.exists(RESEARCH_PATH):
        print(f"エラー: {RESEARCH_PATH} が見つかりません。先に collect を実行してください。")
        sys.exit(1)

    # JSONL読み込み
    salons = []
    with open(RESEARCH_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                salons.append(json.loads(line))

    if args.sample:
        salons = salons[: args.sample]

    print(f"  対象: {len(salons)}件")

    # リクエスト組み立て
    batch_requests = []
    mapping = {}
    for salon in salons:
        sid = salon["salon_id"]
        custom_id = f"s_{sid}"
        user_prompt = build_user_prompt(salon)

        batch_requests.append({
            "custom_id": custom_id,
            "params": {
                "model": args.model,
                "max_tokens": 1000,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": user_prompt}],
            },
        })
        mapping[custom_id] = {"salon_id": sid, "display_name": salon["display_name"]}

    # バッチ分割
    chunks = [
        batch_requests[i : i + MAX_BATCH_SIZE]
        for i in range(0, len(batch_requests), MAX_BATCH_SIZE)
    ]
    print(f"  バッチ数: {len(chunks)} ({' + '.join(str(len(c)) for c in chunks)}件)")

    # API投入
    api_key = get_api_key()
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
        "total_requests": len(batch_requests),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "mapping": mapping,
    }
    save_batch_state(state)

    print(f"\n投入完了: {len(batch_requests)}件 → {len(batch_ids)}バッチ")
    print(f"状態ファイル: {BATCH_STATE_PATH}")
    print(f"\n結果確認:  python {__file__} status")
    print(f"結果取得:  python {__file__} download")


# ---------------------------------------------------------------------------
# status: バッチ状態確認
# ---------------------------------------------------------------------------
def cmd_status(args):
    state = load_batch_state()
    if not state.get("batch_ids"):
        print("バッチが見つかりません。先に submit を実行してください。")
        sys.exit(1)

    print("=" * 60)
    print("バッチ状態確認")
    print(f"  モデル: {state.get('model', '?')}")
    print(f"  投入日時: {state.get('submitted_at', '?')}")
    print(f"  総リクエスト: {state.get('total_requests', '?')}件")
    print("=" * 60)

    api_key = get_api_key()
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
# download: 結果取得 & DB書き込み
# ---------------------------------------------------------------------------
def cmd_download(args):
    state = load_batch_state()
    if not state.get("batch_ids"):
        print("バッチが見つかりません。先に submit を実行してください。")
        sys.exit(1)

    mapping = state.get("mapping", {})

    print("=" * 60)
    print("Phase 3: 結果取得 & DB書き込み")
    print("=" * 60)

    api_key = get_api_key()
    client = anthropic.Anthropic(api_key=api_key)

    results = []
    errors = 0
    parse_failures = 0

    for batch_id in state["batch_ids"]:
        batch = client.messages.batches.retrieve(batch_id)
        if batch.processing_status != "ended":
            print(f"  [{batch_id}] まだ処理中 (status={batch.processing_status})。完了後に再実行してください。")
            sys.exit(1)

        print(f"\n  [{batch_id}] 結果取得中...")
        for entry in client.messages.batches.results(batch_id):
            custom_id = entry.custom_id
            meta = mapping.get(custom_id, {})
            salon_id = meta.get("salon_id")

            if entry.result.type != "succeeded":
                errors += 1
                print(f"    {custom_id}: {entry.result.type}")
                continue

            text = entry.result.message.content[0].text.strip()
            result = parse_json_response(text)

            if result is None:
                parse_failures += 1
                print(f"    {custom_id} ({meta.get('display_name', '?')}): JSONパース失敗")
                continue

            result["salon_id"] = salon_id
            results.append(result)

    print(f"\n取得完了: 成功{len(results)}件, エラー{errors}件, パース失敗{parse_failures}件")

    if not results:
        print("書き込み対象がありません。")
        return

    if args.dry_run:
        print("\n[dry-run] DB書き込みスキップ")
        for r in results[:5]:
            print(f"  ID={r['salon_id']}: desc={len(r['description'])}字, overview={len(r['salon_overview'])}字")
        return

    # DB書き込み
    print(f"\nDB書き込み中...")
    conn = connect_db()
    cur = conn.cursor()

    updated = 0
    for r in results:
        desc = r["description"]
        cur.execute(
            "UPDATE salons SET description = %s, salon_overview = %s WHERE id = %s",
            (desc, desc, r["salon_id"]),
        )
        updated += cur.rowcount

    conn.commit()
    cur.close()
    conn.close()

    print(f"\n{'=' * 60}")
    print("完了")
    print("=" * 60)
    print(f"  DB更新: {updated}件")
    print(f"  エラー: {errors}件")
    print(f"  JSONパース失敗: {parse_failures}件")

    # 文字数統計
    desc_lens = [len(r["description"]) for r in results]
    print(f"\n  description文字数: 平均{sum(desc_lens)/len(desc_lens):.0f}字 (min={min(desc_lens)}, max={max(desc_lens)})")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="サロン紹介文バッチ生成（SERP検索+スクレイピング版）")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"使用モデル (default: {DEFAULT_MODEL})")

    sub = parser.add_subparsers(dest="command")

    # --sample（サブコマンドなし）
    parser.add_argument("--sample", type=int, default=None, help="通常APIでN件サンプルテスト（SERP検索付き）")

    # collect
    p_collect = sub.add_parser("collect", help="Phase 1: SERP検索 + スクレイピング")
    p_collect.add_argument("--resume", action="store_true", help="中断再開（処理済みIDスキップ）")

    # submit
    p_submit = sub.add_parser("submit", help="Phase 2: Batch API投入")
    p_submit.add_argument("--sample", type=int, default=None, dest="batch_sample", help="サンプル件数")

    # status
    sub.add_parser("status", help="バッチ状態確認")

    # download
    p_download = sub.add_parser("download", help="Phase 3: 結果取得 & DB書き込み")
    p_download.add_argument("--dry-run", action="store_true", help="DB書き込みスキップ")

    args = parser.parse_args()

    if args.command == "collect":
        # --resume なしの場合、前回のresearch_data.jsonlとprogress.jsonをリセット
        if not args.resume:
            for path in [RESEARCH_PATH, PROGRESS_PATH, FAILED_PATH]:
                if os.path.exists(path):
                    os.remove(path)
        cmd_collect(args)
    elif args.command == "submit":
        args.sample = args.batch_sample
        cmd_submit(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "download":
        cmd_download(args)
    elif args.sample:
        cmd_sample(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
