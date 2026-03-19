"""
Step 2: Claude API バッチ生成
SERPデータ + エンティティ固有データを組み合わせてSEOコンテンツを生成
"""
import os, json, time, anthropic, psycopg2, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

client = anthropic.Anthropic()
MODEL = 'claude-sonnet-4-20250514'
DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
SERP_DIR = os.path.join(os.path.dirname(__file__), 'serp_data')

SYSTEM = """あなたは口コミメディア「メンエスSKR」の編集部です。
メンエスSKRは、メンズエステの利用を検討している男性に向けて、
サロン選びに必要な情報を整理して届けるメディアです。

【編集方針】
- 客観的な情報を、わかりやすく整理して伝える
- 一人称（僕、私、個人的には等）は使わない。メディアとしての三人称視点で書く
- 主観的な感想や体験談は入れない。事実と一般的な傾向をベースにする
- 読者が知りたい情報に最短でたどり着けるよう、構成を工夫する

【文体】
- 「です・ます」調で統一
- 1文は60文字以内を目安。短い文でテンポよく
- 1段落は2〜4文

【絶対に守ること】
- 具体的な店舗数・セラピスト数・在籍数など変動する数値は書かない
- 風俗的な表現や性的なサービスへの言及は一切しない
- 出力はプレーンテキストのみ（HTMLタグ・マークダウン記法は使わない）
- 見出しは【】で囲む
- 改行で段落を分ける
- 都道府県名は正式名称（「東京都」「山口県」等）
- 「・」（中黒）は使わない"""


def generate(prompt, max_tokens=4000):
    r = client.messages.create(
        model=MODEL, max_tokens=max_tokens, system=SYSTEM,
        messages=[{'role': 'user', 'content': prompt}]
    )
    return r.content[0].text


def load_serp(entity_type, entity_id):
    """SERPデータをロード"""
    path = os.path.join(SERP_DIR, f"{entity_type}_{entity_id}.json")
    if os.path.exists(path):
        with open(path) as f:
            data = json.load(f)
            return data.get('results', [])
    return []


def format_serp_context(results):
    """SERPデータをプロンプト用テキストに変換"""
    if not results:
        return "（SERP参考データなし）"
    lines = ["【Google検索上位サイトの傾向（参考用）】"]
    for r in results[:5]:
        lines.append(f"- {r.get('title', '')} ({r.get('domain', '')})")
        if r.get('description'):
            lines.append(f"  {r['description'][:100]}")
    return "\n".join(lines)


# === プロンプトテンプレート ===

def prompt_prefecture_guide(name, serp_context):
    return f"""{name}のメンズエステについて、初めて利用する人向けのガイド記事を書いてください。

{serp_context}

【記事の構成】
1. {name}のメンズエステ事情（概要3〜4文）
2. エリア別の特徴（主要エリアごとに3〜4文）
3. 料金相場の目安
4. 初めての方へのアドバイス（エリア選び→サロン選び→予約の流れ）
5. 利用時のマナー

【ターゲットKW】「{name}」「メンズエステ」を見出しや本文に自然に含めてください。
【文字数】2000〜3000文字"""


def prompt_prefecture_highlights(name, serp_context):
    return f"""{name}で注目のメンズエステエリアを紹介する記事を書いてください。

{serp_context}

口コミやサロン数の多い主要エリアを3つ選んで、各エリアの特徴を6〜8文で紹介してください。
各エリアの見出しは【エリア名】の形式で。

【ターゲットKW】「{name}」「メンズエステ」を見出しや本文に自然に含めてください。
【文字数】1500〜2000文字"""


def prompt_area_guide(name, serp_context):
    return f"""{name}エリアでメンズエステを探している人に向けた、エリアガイドを書いてください。

{serp_context}

【記事の構成】
1. {name}エリアの概要（立地、雰囲気、アクセス）
2. このエリアのメンズエステの特徴（サロンの傾向、価格帯、営業時間）
3. こんな人におすすめ
4. 近隣エリアとの違い

【ターゲットKW】「{name}」「メンズエステ」「おすすめ」を見出しや本文に自然に含めてください。
【文字数】1500〜2500文字"""


def prompt_area_info(name, serp_context):
    return f"""{name}のメンズエステ事情について解説する記事を書いてください。

{serp_context}

{name}エリアの地理的特徴、メンズエステの傾向、近隣エリアとの比較を含めてください。
主観的な表現は使わず、客観的な情報として記述。

【ターゲットKW】「{name}」「おすすめ」「メンズエステ」を見出しや本文に自然に含めてください。
【文字数】800〜1200文字"""


def prompt_salon_overview(name, base_price, base_duration, business_hours, access, business_type, serp_context):
    return f"""メンズエステサロン「{name}」について、初めて利用を検討している人に向けた紹介記事を書いてください。

{serp_context}

【記事の構成】
1. リード文（このサロンが気になっている読者への導入）
2. {name}の立地と第一印象
3. 施術の特徴
4. 料金とコスパ
5. どんな人におすすめか
6. メンエスSKRの口コミも参考にしてほしい旨

【参考データ】
- 料金: {base_duration or 60}分{base_price or '要確認'}円〜
- 営業時間: {business_hours or '要確認'}
- アクセス: {access or '要確認'}
- 業態: {business_type or '店舗型'}

【ターゲットKW】「{name}」「口コミ」「体験談」を見出しや本文に自然に含めてください。
【文字数】1500〜2000文字"""


def prompt_salon_summary(name, base_price, base_duration, business_hours, access):
    return f"""メンズエステサロン「{name}」の簡潔な紹介文を書いてください。
セラピスト個別ページに掲載する概要説明です。

- {name}がどんなサロンか（立地、雰囲気）
- 施術の特徴
- 料金帯

【参考データ】
- 料金: {base_duration or 60}分{base_price or '要確認'}円〜
- 営業時間: {business_hours or '要確認'}
- アクセス: {access or '要確認'}

【注意】見出し（【】）は不要。本文のみを出力。
【文字数】400〜600文字"""


# === H2タイトルテンプレート ===

TITLES = {
    'prefecture': {
        'guide': '{name}のメンズエステガイド',
        'highlights': '{name}のメンズエステ 注目エリア',
    },
    'area': {
        'guide': '{name}のメンズエステの選び方',
        'area_info': '{name}のおすすめメンズエステ情報',
    },
    'salon': {
        'salon_overview': '{name}の口コミ体験談から分かる特徴',
        'salon_summary': None,  # タイトルなし
    },
}


def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # 既存のpage_contentsをチェック（スキップ用）
    cur.execute("SELECT page_type, entity_id, content_key FROM page_contents")
    done = set((r[0], r[1], r[2]) for r in cur.fetchall())

    # エンティティ取得
    cur.execute("SELECT id, name FROM prefectures ORDER BY id")
    prefectures = cur.fetchall()

    cur.execute("SELECT id, name, seo_keyword FROM areas WHERE salon_count > 0 ORDER BY id")
    areas = cur.fetchall()

    cur.execute("""SELECT id, COALESCE(display_name, name), base_price, base_duration,
                   business_hours, access, business_type
                   FROM salons WHERE is_active = true ORDER BY id""")
    salons = cur.fetchall()

    # 生成タスクを構築
    tasks = []

    for pid, pname in prefectures:
        serp = format_serp_context(load_serp('prefecture', pid))
        if ('prefecture', pid, 'guide') not in done:
            tasks.append(('prefecture', pid, 'guide', TITLES['prefecture']['guide'].format(name=pname),
                         prompt_prefecture_guide(pname, serp)))
        if ('prefecture', pid, 'highlights') not in done:
            tasks.append(('prefecture', pid, 'highlights', TITLES['prefecture']['highlights'].format(name=pname),
                         prompt_prefecture_highlights(pname, serp)))

    for aid, aname, seo_kw in areas:
        serp = format_serp_context(load_serp('area', aid))
        if ('area', aid, 'guide') not in done:
            tasks.append(('area', aid, 'guide', TITLES['area']['guide'].format(name=aname),
                         prompt_area_guide(aname, serp)))
        if ('area', aid, 'area_info') not in done:
            tasks.append(('area', aid, 'area_info', TITLES['area']['area_info'].format(name=aname),
                         prompt_area_info(aname, serp)))

    for sid, sname, bprice, bdur, bhours, saccess, btype in salons:
        serp = format_serp_context(load_serp('salon', sid))
        if ('salon', sid, 'salon_overview') not in done:
            tasks.append(('salon', sid, 'salon_overview', TITLES['salon']['salon_overview'].format(name=sname),
                         prompt_salon_overview(sname, bprice, bdur, bhours, saccess, btype, serp)))
        if ('salon', sid, 'salon_summary') not in done:
            tasks.append(('salon', sid, 'salon_summary', None,
                         prompt_salon_summary(sname, bprice, bdur, bhours, saccess)))

    total = len(tasks)
    MAX_WORKERS = 5
    print(f"=== Claude API バッチ生成（{MAX_WORKERS}並列） ===")
    print(f"生成タスク: {total}件（既存スキップ: {len(done)}件）")
    print()

    errors = []
    ok_count = 0
    db_lock = threading.Lock()

    def process_task(task):
        ptype, eid, ckey, title, prompt = task
        body = generate(prompt)
        return ptype, eid, ckey, title, body

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process_task, t): t for t in tasks}
        for future in as_completed(futures):
            task = futures[future]
            ptype, eid, ckey, title, prompt = task
            try:
                ptype, eid, ckey, title, body = future.result()
                with db_lock:
                    cur.execute("""
                        INSERT INTO page_contents (page_type, entity_id, content_key, title, body, generated_by, prompt_version)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (page_type, entity_id, content_key) DO UPDATE SET
                            title = EXCLUDED.title, body = EXCLUDED.body,
                            generated_by = EXCLUDED.generated_by, prompt_version = EXCLUDED.prompt_version,
                            updated_at = now()
                    """, (ptype, eid, ckey, title, body, MODEL, 'v5-batch'))
                    conn.commit()
                    ok_count += 1
                    if ok_count % 50 == 0:
                        print(f"  [{ok_count}/{total}] {ptype}/{eid}/{ckey}: {len(body)}文字")
            except Exception as e:
                errors.append({'task': f'{ptype}/{eid}/{ckey}', 'error': str(e)})
                if len(errors) % 10 == 0:
                    print(f"  ERROR {ptype}/{eid}/{ckey}: {str(e)[:80]}")
                with db_lock:
                    conn.rollback()

    conn.close()

    print(f"\n=== 完了 ===")
    print(f"生成: {ok_count}/{total}")
    if errors:
        print(f"エラー: {len(errors)}件")
        errpath = os.path.join(os.path.dirname(__file__), 'batch_errors.json')
        with open(errpath, 'w') as f:
            json.dump(errors, f, ensure_ascii=False, indent=2)
        print(f"エラー詳細: {errpath}")


if __name__ == '__main__':
    main()
