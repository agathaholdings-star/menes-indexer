"""
Step 1: DataForSEO SERP一括取得（並列版）
全エンティティのターゲットKWでGoogle SERP上位10件を取得してJSONに保存
"""
import os, json, time, requests, psycopg2
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

DATAFORSEO_LOGIN = os.environ['DATAFORSEO_LOGIN']
DATAFORSEO_PASSWORD = os.environ['DATAFORSEO_PASSWORD']
DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'serp_data')
os.makedirs(OUTPUT_DIR, exist_ok=True)
MAX_WORKERS = 10


def fetch_serp(keyword, location='Japan', language='ja', depth=10):
    url = 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced'
    payload = [{'keyword': keyword, 'location_name': location, 'language_code': language, 'depth': depth}]
    r = requests.post(url, json=payload, auth=(DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD))
    r.raise_for_status()
    data = r.json()
    if data.get('tasks') and data['tasks'][0].get('result'):
        items = data['tasks'][0]['result'][0].get('items', [])
        return [
            {'position': it.get('rank_group'), 'title': it.get('title'),
             'url': it.get('url'), 'description': it.get('description'), 'domain': it.get('domain')}
            for it in items if it.get('type') == 'organic'
        ][:10]
    return []


def process_entity(entity):
    key = f"{entity['type']}_{entity['id']}"
    outpath = os.path.join(OUTPUT_DIR, f"{key}.json")

    # 既にファイルがあればスキップ
    if os.path.exists(outpath):
        return key, 'skip', 0

    try:
        results = fetch_serp(entity['keyword'])
        with open(outpath, 'w') as f:
            json.dump({
                'entity_type': entity['type'], 'entity_id': entity['id'],
                'entity_name': entity['name'], 'keyword': entity['keyword'],
                'results': results,
            }, f, ensure_ascii=False, indent=2)
        return key, 'ok', len(results)
    except Exception as e:
        return key, 'error', str(e)


def get_entities():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute("SELECT id, name FROM prefectures ORDER BY id")
    prefectures = [{'id': r[0], 'name': r[1], 'keyword': f'{r[1]} メンズエステ', 'type': 'prefecture'} for r in cur.fetchall()]

    cur.execute("SELECT id, name, seo_keyword FROM areas WHERE salon_count > 0 ORDER BY id")
    areas = [{'id': r[0], 'name': r[1], 'keyword': r[2] or f'{r[1]} メンズエステ', 'type': 'area'} for r in cur.fetchall()]

    cur.execute("SELECT id, COALESCE(display_name, name) FROM salons WHERE is_active = true ORDER BY id")
    salons = [{'id': r[0], 'name': r[1], 'keyword': f'{r[1]} 口コミ', 'type': 'salon'} for r in cur.fetchall()]

    conn.close()
    return prefectures, areas, salons


def main():
    prefectures, areas, salons = get_entities()
    all_entities = prefectures + areas + salons
    total = len(all_entities)

    print(f"=== DataForSEO SERP一括取得（{MAX_WORKERS}並列） ===")
    print(f"都道府県: {len(prefectures)}, エリア: {len(areas)}, サロン: {len(salons)}")
    print(f"合計: {total}件")
    print()

    ok_count = 0
    skip_count = 0
    error_count = 0
    errors = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process_entity, e): e for e in all_entities}
        for i, future in enumerate(as_completed(futures)):
            key, status, detail = future.result()
            if status == 'ok':
                ok_count += 1
            elif status == 'skip':
                skip_count += 1
            else:
                error_count += 1
                errors.append({'key': key, 'error': detail})

            done = ok_count + skip_count + error_count
            if done % 200 == 0 or done == total:
                print(f"  [{done}/{total}] 取得: {ok_count}, スキップ: {skip_count}, エラー: {error_count}")

    print(f"\n=== 完了 ===")
    print(f"新規取得: {ok_count}, スキップ: {skip_count}, エラー: {error_count}")
    if errors:
        print(f"エラー詳細:")
        for e in errors[:10]:
            print(f"  {e['key']}: {e['error']}")


if __name__ == '__main__':
    main()
