#!/usr/bin/env python3
"""
bot_activity.py - 内部テスト用botユーザー3体を作成し、
口コミ・BBS・DMなどの活動データを投入する。

使い方:
  python database/bot_activity.py          # 全部実行
  python database/bot_activity.py --clean  # botデータ全削除
"""

import sys
import time
import random
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta

# ── Supabase Local設定 ──
SUPABASE_URL = "http://127.0.0.1:54321"
SERVICE_ROLE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
DB_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}

# ── Bot定義 ──
BOTS = [
    {"email": "bot-yuki@test.local",    "password": "BotPass123!", "nickname": "ゆき",     "membership": "vip"},
    {"email": "bot-takeshi@test.local",  "password": "BotPass123!", "nickname": "たけし",   "membership": "standard"},
    {"email": "bot-mika@test.local",     "password": "BotPass123!", "nickname": "みか",     "membership": "standard"},
]

# ── レビューテンプレ ──
REVIEW_TEMPLATES = [
    {
        "looks_type": "idol", "body_type": "slender", "service_level": "skr",
        "param_conversation": 5, "param_distance": 4, "param_technique": 5, "param_personality": 5,
        "score": 92,
        "comment_first_impression": "写真通りの可愛さで安心しました。笑顔がとても素敵で緊張がほぐれました。",
        "comment_service": "施術が丁寧で、力加減もちょうど良かったです。会話も楽しくてあっという間の90分でした。また指名したいと思います。",
        "comment_advice": "人気なので早めの予約がおすすめです。土日は特に埋まりやすいです。",
        "comment_service_detail": "密着度が高くてドキドキしました。距離感の詰め方が絶妙です。",
    },
    {
        "looks_type": "seiso", "body_type": "normal", "service_level": "kenzen",
        "param_conversation": 4, "param_distance": 3, "param_technique": 4, "param_personality": 4,
        "score": 78,
        "comment_first_impression": "清楚系で落ち着いた雰囲気。部屋に入った瞬間にいい香りがしました。",
        "comment_service": "オイルマッサージがとても上手でコリがしっかりほぐれました。リラクゼーション目的なら大満足です。会話も程よい距離感で心地よかったです。",
        "comment_advice": "60分だと少し短いので90分コースがおすすめです。",
        "comment_service_detail": None,
    },
    {
        "looks_type": "oneesan", "body_type": "glamour", "service_level": "skr",
        "param_conversation": 5, "param_distance": 5, "param_technique": 4, "param_personality": 5,
        "score": 88,
        "comment_first_impression": "大人っぽい雰囲気で色気がすごいです。スタイル抜群で見とれました。",
        "comment_service": "リードが上手くて初めてでも安心できました。トーク力もあり退屈する時間が一切なかったです。技術面もしっかりしていて疲れが取れました。",
        "comment_advice": "初回は90分以上がおすすめ。指名料かかるけど価値あり。",
        "comment_service_detail": "際どいところまで攻めてくれて大満足。SKR感度高めです。",
    },
    {
        "looks_type": "gal", "body_type": "slender", "service_level": "hr",
        "param_conversation": 3, "param_distance": 5, "param_technique": 5, "param_personality": 4,
        "score": 95,
        "comment_first_impression": "ギャル系で明るくてノリがいい。テンション上がりました。",
        "comment_service": "とにかくサービス精神がすごい。こちらが恐縮するくらい積極的で大満足でした。技術もハイレベルで身体の芯からほぐれた感じがします。",
        "comment_advice": "指名必須。フリーだと当たらないかも。",
        "comment_service_detail": "HR全開で神対応。リピート確定です。",
    },
    {
        "looks_type": "amateur", "body_type": "normal", "service_level": "kenzen",
        "param_conversation": 4, "param_distance": 2, "param_technique": 3, "param_personality": 5,
        "score": 70,
        "comment_first_impression": "素人感があってそこが逆に良かった。自然体で話しやすいです。",
        "comment_service": "マッサージの技術はまだ発展途上かなという印象。でも一生懸命さが伝わってきて好感が持てました。会話は盛り上がって楽しい時間でした。",
        "comment_advice": "まだ新人っぽいので今のうちに行くと丁寧に対応してもらえます。",
        "comment_service_detail": None,
    },
    {
        "looks_type": "model", "body_type": "slender", "service_level": "skr",
        "param_conversation": 4, "param_distance": 4, "param_technique": 5, "param_personality": 4,
        "score": 85,
        "comment_first_impression": "モデル級のスタイルで写真以上でした。背が高くて脚が長い。",
        "comment_service": "手つきがプロで全身しっかりほぐしてくれました。密着時のスタイルの良さを実感。会話もインテリな感じで知的な時間を過ごせました。",
        "comment_advice": "平日夕方が狙い目。週末はなかなか取れません。",
        "comment_service_detail": "密着施術のクオリティが高い。SKRの攻め方も上品。",
    },
]

# ── BBSテンプレ ──
BBS_THREADS = [
    {
        "title": "恵比寿エリアのおすすめ教えてください",
        "body": "最近メンエスにハマり始めました。恵比寿エリアで初心者でも入りやすいお店があれば教えてほしいです。予算は90分15,000円くらいまでで考えています。",
        "category": "question",
    },
    {
        "title": "新宿の新店情報まとめ",
        "body": "2026年に入ってから新宿エリアに新しくオープンしたお店の情報をまとめていきましょう。知っている方は情報お願いします。",
        "category": "info",
    },
    {
        "title": "施術中の会話ってどうしてる？",
        "body": "施術中に何を話していいかわからなくて毎回気まずいです。皆さんどんな話題で会話してますか？無言でもOKなんですかね？",
        "category": "other",
    },
]

BBS_REPLIES = [
    # thread 0 replies
    [
        "恵比寿ならAroma Spa Tokyoが初心者にはおすすめです。スタッフの対応が丁寧で安心感あります。",
        "自分もAroma Spa Tokyo行きました。アリスさん指名がおすすめ。技術もトークも◎",
    ],
    # thread 1 replies
    [
        "先月Premium Salon新宿がリニューアルしたみたいです。内装がかなり綺麗になってました。",
    ],
    # thread 2 replies
    [
        "最初は趣味の話から入ると盛り上がりやすいですよ。あと相手のネイルとか褒めると喜ばれます。",
        "無言でも全然大丈夫ですよ。「リラックスしたいので静かにお願いします」って言えばOK。",
        "自分は毎回グルメの話してます。おすすめのご飯屋さん聞くと結構教えてくれる。",
    ],
]

# ── DMテンプレ ──
DM_CONVERSATIONS = [
    # (bot_idx_1, bot_idx_2, messages)
    (0, 1, [
        (0, "たけしさん、この前おすすめしてくれた新宿のお店行ってきたよ！"),
        (1, "お、どうだった？ハナさん指名した？"),
        (0, "うん！すごく良かった。90分コースにして正解だった。"),
        (1, "でしょ！次は池袋のお店も試してみて。また感想教えて。"),
        (0, "了解！来週あたり行ってみるね。ありがとう！"),
    ]),
    (1, 2, [
        (1, "みかさんって女性でメンエス行く人？珍しいね"),
        (2, "うん、最近増えてるよ。施術自体は男女関係なく気持ちいいし。"),
        (1, "なるほど。女性目線のレビューは参考になりそう。"),
        (2, "ありがとう。女性向けの情報ももっと増えるといいなと思ってる。"),
    ]),
    (0, 2, [
        (0, "みかさんの口コミいつも参考にしてます！"),
        (2, "ありがとう！ゆきさんの口コミも詳しくて助かってるよ。"),
        (0, "お互い様だね。今度おすすめセラピスト教え合おうよ。"),
        (2, "いいね！恵比寿と新宿ならだいたいわかるよ。"),
        (0, "じゃあ今度恵比寿の情報交換しよう！"),
        (2, "了解！楽しみにしてる。"),
    ]),
]


def get_db():
    return psycopg2.connect(DB_DSN, cursor_factory=RealDictCursor)


def create_bot_users(conn):
    """auth.usersにbot作成 → profilesはトリガーで自動生成"""
    bot_ids = []
    cur = conn.cursor()

    for bot in BOTS:
        # 既存チェック
        cur.execute("SELECT id FROM auth.users WHERE email = %s", (bot["email"],))
        row = cur.fetchone()
        if row:
            bot_id = str(row["id"])
            print(f"  既存: {bot['nickname']} ({bot_id[:8]}...)")
            # profileのmembership更新
            cur.execute(
                "UPDATE profiles SET nickname = %s, membership_type = %s WHERE id = %s",
                (bot["nickname"], bot["membership"], bot_id),
            )
            bot_ids.append(bot_id)
            continue

        # Supabase Auth Admin APIで作成
        resp = requests.post(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers=HEADERS,
            json={
                "email": bot["email"],
                "password": bot["password"],
                "email_confirm": True,
                "user_metadata": {"nickname": bot["nickname"]},
            },
        )
        if resp.status_code not in (200, 201):
            print(f"  ERROR creating {bot['email']}: {resp.status_code} {resp.text}")
            sys.exit(1)

        bot_id = resp.json()["id"]
        print(f"  作成: {bot['nickname']} ({bot_id[:8]}...)")

        # トリガーが走るまで少し待つ
        time.sleep(0.5)

        # membership更新
        cur.execute(
            "UPDATE profiles SET membership_type = %s WHERE id = %s",
            (bot["membership"], bot_id),
        )
        bot_ids.append(bot_id)

    conn.commit()
    return bot_ids


def get_therapist_shop_pairs(conn, n=10):
    """レビュー対象のセラピスト+店舗ペアを取得"""
    cur = conn.cursor()
    cur.execute(
        "SELECT id AS therapist_id, shop_id FROM therapists WHERE status = 'active' LIMIT %s",
        (n,),
    )
    return cur.fetchall()


def insert_reviews(conn, bot_ids, pairs):
    """各botがランダムにレビュー投稿"""
    cur = conn.cursor()

    # 既存bot reviewsを確認
    cur.execute(
        "SELECT COUNT(*) as cnt FROM reviews WHERE user_id = ANY(%s::uuid[])",
        (bot_ids,),
    )
    existing = cur.fetchone()["cnt"]
    if existing > 0:
        print(f"  既存レビュー {existing}件あり、スキップ")
        return

    count = 0
    for i, bot_id in enumerate(bot_ids):
        # 各botが2-3件ずつ投稿
        n_reviews = random.randint(2, 3)
        used_therapists = set()

        for _ in range(n_reviews):
            pair = random.choice(pairs)
            if pair["therapist_id"] in used_therapists:
                continue
            used_therapists.add(pair["therapist_id"])

            tmpl = random.choice(REVIEW_TEMPLATES)
            created = datetime.now() - timedelta(
                days=random.randint(1, 14),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
            )

            cur.execute("""
                INSERT INTO reviews (
                    user_id, therapist_id, shop_id,
                    looks_type, body_type, service_level,
                    param_conversation, param_distance, param_technique, param_personality,
                    score,
                    comment_first_impression, comment_service, comment_advice, comment_service_detail,
                    created_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                bot_id, pair["therapist_id"], pair["shop_id"],
                tmpl["looks_type"], tmpl["body_type"], tmpl["service_level"],
                tmpl["param_conversation"], tmpl["param_distance"],
                tmpl["param_technique"], tmpl["param_personality"],
                tmpl["score"],
                tmpl["comment_first_impression"], tmpl["comment_service"],
                tmpl["comment_advice"], tmpl["comment_service_detail"],
                created,
            ))
            count += 1

    # monthly_review_count / total_review_count 更新
    for bot_id in bot_ids:
        cur.execute("""
            UPDATE profiles SET
                monthly_review_count = (SELECT COUNT(*) FROM reviews WHERE user_id = %s),
                total_review_count = (SELECT COUNT(*) FROM reviews WHERE user_id = %s)
            WHERE id = %s
        """, (bot_id, bot_id, bot_id))

    conn.commit()
    print(f"  レビュー {count}件投稿")


def insert_bbs(conn, bot_ids):
    """BBSスレッド作成+レス投稿"""
    cur = conn.cursor()

    cur.execute(
        "SELECT COUNT(*) as cnt FROM bbs_threads WHERE user_id = ANY(%s::uuid[])",
        (bot_ids,),
    )
    if cur.fetchone()["cnt"] > 0:
        print("  既存BBSデータあり、スキップ")
        return

    thread_ids = []
    for i, thread in enumerate(BBS_THREADS):
        author = bot_ids[i % len(bot_ids)]
        created = datetime.now() - timedelta(days=random.randint(3, 10))

        cur.execute("""
            INSERT INTO bbs_threads (user_id, title, body, category, created_at)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (author, thread["title"], thread["body"], thread["category"], created))
        tid = cur.fetchone()["id"]
        thread_ids.append(tid)

    # レス投稿
    reply_count = 0
    for t_idx, replies in enumerate(BBS_REPLIES):
        for r_idx, reply_text in enumerate(replies):
            # スレ主以外のbotからレス
            replier = bot_ids[(t_idx + r_idx + 1) % len(bot_ids)]
            created = datetime.now() - timedelta(
                days=random.randint(0, 2),
                hours=random.randint(0, 23),
            )
            cur.execute("""
                INSERT INTO bbs_posts (thread_id, user_id, body, created_at)
                VALUES (%s, %s, %s, %s)
            """, (thread_ids[t_idx], replier, reply_text, created))
            reply_count += 1

    conn.commit()
    print(f"  BBSスレッド {len(thread_ids)}件 + レス {reply_count}件投稿")


def insert_dms(conn, bot_ids):
    """DM会話作成"""
    cur = conn.cursor()

    cur.execute(
        "SELECT COUNT(*) as cnt FROM conversations WHERE user1_id = ANY(%s::uuid[]) OR user2_id = ANY(%s::uuid[])",
        (bot_ids, bot_ids),
    )
    if cur.fetchone()["cnt"] > 0:
        print("  既存DMデータあり、スキップ")
        return

    msg_count = 0
    for bot_a_idx, bot_b_idx, messages in DM_CONVERSATIONS:
        user1 = bot_ids[bot_a_idx]
        user2 = bot_ids[bot_b_idx]

        cur.execute("""
            INSERT INTO conversations (user1_id, user2_id, created_at)
            VALUES (%s, %s, %s)
            RETURNING id
        """, (user1, user2, datetime.now() - timedelta(days=random.randint(3, 7))))
        conv_id = cur.fetchone()["id"]

        base_time = datetime.now() - timedelta(days=random.randint(1, 3))
        for m_idx, (sender_idx, body) in enumerate(messages):
            msg_time = base_time + timedelta(minutes=m_idx * random.randint(5, 30))
            sender = bot_ids[sender_idx]

            cur.execute("""
                INSERT INTO messages (conversation_id, sender_id, body, is_read, created_at)
                VALUES (%s, %s, %s, %s, %s)
            """, (conv_id, sender, body, True, msg_time))
            msg_count += 1

        # last_message_at更新
        cur.execute("""
            UPDATE conversations SET last_message_at = (
                SELECT MAX(created_at) FROM messages WHERE conversation_id = %s
            ) WHERE id = %s
        """, (conv_id, conv_id))

    conn.commit()
    print(f"  DM会話 {len(DM_CONVERSATIONS)}件 + メッセージ {msg_count}件作成")


def insert_favorites(conn, bot_ids, pairs):
    """お気に入り登録"""
    cur = conn.cursor()

    cur.execute(
        "SELECT COUNT(*) as cnt FROM favorites WHERE user_id = ANY(%s::uuid[])",
        (bot_ids,),
    )
    if cur.fetchone()["cnt"] > 0:
        print("  既存お気に入りデータあり、スキップ")
        return

    count = 0
    for bot_id in bot_ids:
        n_favs = random.randint(2, 4)
        fav_therapists = random.sample(pairs, min(n_favs, len(pairs)))
        for p in fav_therapists:
            cur.execute("""
                INSERT INTO favorites (user_id, therapist_id, created_at)
                VALUES (%s, %s, %s)
                ON CONFLICT DO NOTHING
            """, (bot_id, p["therapist_id"], datetime.now() - timedelta(days=random.randint(1, 7))))
            count += 1

    conn.commit()
    print(f"  お気に入り {count}件登録")


def insert_notifications(conn, bot_ids):
    """通知データ作成"""
    cur = conn.cursor()

    cur.execute(
        "SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ANY(%s::uuid[])",
        (bot_ids,),
    )
    if cur.fetchone()["cnt"] > 0:
        print("  既存通知データあり、スキップ")
        return

    notifs = [
        {"type": "system", "title": "ようこそ！", "body": "メンエスインデクサへようこそ。まずは口コミを投稿してみましょう。", "link": "/review"},
        {"type": "bbs_reply", "title": "スレッドに返信がありました", "body": "あなたのスレッドに新しい返信があります。", "link": "/bbs"},
        {"type": "dm", "title": "新しいメッセージ", "body": "新しいDMが届きました。", "link": "/messages"},
    ]

    count = 0
    for bot_id in bot_ids:
        for n in notifs:
            cur.execute("""
                INSERT INTO notifications (user_id, type, title, body, link, is_read, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                bot_id, n["type"], n["title"], n["body"], n["link"],
                random.choice([True, False]),
                datetime.now() - timedelta(days=random.randint(0, 5)),
            ))
            count += 1

    conn.commit()
    print(f"  通知 {count}件作成")


def clean_bots(conn):
    """botデータ全削除（CASCADE）"""
    cur = conn.cursor()
    emails = [b["email"] for b in BOTS]

    cur.execute("SELECT id FROM auth.users WHERE email = ANY(%s)", (emails,))
    ids = [str(r["id"]) for r in cur.fetchall()]

    if not ids:
        print("削除対象のbotなし")
        return

    # profiles削除 → CASCADE で reviews, favorites, bbs, messages, notifications 全部消える
    for uid in ids:
        cur.execute("DELETE FROM profiles WHERE id = %s", (uid,))
        # auth.usersも削除
        resp = requests.delete(
            f"{SUPABASE_URL}/auth/v1/admin/users/{uid}",
            headers=HEADERS,
        )
        if resp.status_code in (200, 204):
            print(f"  削除: {uid[:8]}...")
        else:
            print(f"  auth削除エラー: {resp.status_code} {resp.text}")

    conn.commit()
    print(f"bot {len(ids)}体 + 関連データ全削除完了")


def main():
    if "--clean" in sys.argv:
        print("=== botデータ削除 ===")
        with get_db() as conn:
            clean_bots(conn)
        return

    print("=== botユーザー活動データ投入 ===\n")

    conn = get_db()

    print("[1/6] botユーザー作成")
    bot_ids = create_bot_users(conn)
    print(f"  bot IDs: {[bid[:8] + '...' for bid in bot_ids]}\n")

    print("[2/6] セラピスト/店舗ペア取得")
    pairs = get_therapist_shop_pairs(conn)
    print(f"  {len(pairs)}ペア取得\n")

    print("[3/6] レビュー投稿")
    insert_reviews(conn, bot_ids, pairs)
    print()

    print("[4/6] BBS投稿")
    insert_bbs(conn, bot_ids)
    print()

    print("[5/6] DM作成")
    insert_dms(conn, bot_ids)
    print()

    print("[6/6] お気に入り+通知")
    insert_favorites(conn, bot_ids, pairs)
    insert_notifications(conn, bot_ids)
    print()

    conn.close()

    # 結果サマリー
    conn2 = get_db()
    cur = conn2.cursor()
    tables = ["profiles", "reviews", "bbs_threads", "bbs_posts", "conversations", "messages", "favorites", "notifications"]
    print("=== 結果サマリー ===")
    for t in tables:
        cur.execute(f"SELECT COUNT(*) as cnt FROM {t}")
        print(f"  {t}: {cur.fetchone()['cnt']}件")
    conn2.close()

    print("\n完了！ http://127.0.0.1:3000 で確認してください。")
    print("botアカウントでログインするには:")
    for bot in BOTS:
        print(f"  {bot['nickname']}: {bot['email']} / {bot['password']}")


if __name__ == "__main__":
    main()
