-- ============================================================
-- コミュニティ機能テーブル
-- favorites, bbs_threads, bbs_posts, conversations,
-- messages, notifications
-- ============================================================

-- ============================================================
-- 1. favorites（お気に入り）
-- ============================================================
CREATE TABLE favorites (
    user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    therapist_id    int8 NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
    created_at      timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, therapist_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_therapist ON favorites(therapist_id);

-- ============================================================
-- 2. bbs_threads（掲示板スレッド）
-- ============================================================
CREATE TABLE bbs_threads (
    id              int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title           text NOT NULL,
    body            text NOT NULL,
    category        text NOT NULL DEFAULT 'other',
    is_pinned       bool DEFAULT false,
    is_locked       bool DEFAULT false,
    view_count      int DEFAULT 0,
    reply_count     int DEFAULT 0,
    last_reply_at   timestamptz,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),

    CONSTRAINT chk_bbs_category CHECK (category IN ('question','info','review','other'))
);

CREATE INDEX idx_bbs_threads_user ON bbs_threads(user_id);
CREATE INDEX idx_bbs_threads_category ON bbs_threads(category);
CREATE INDEX idx_bbs_threads_created ON bbs_threads(created_at DESC);

CREATE TRIGGER trg_bbs_threads_updated_at
    BEFORE UPDATE ON bbs_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. bbs_posts（掲示板レス）
-- ============================================================
CREATE TABLE bbs_posts (
    id              int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    thread_id       int8 NOT NULL REFERENCES bbs_threads(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body            text NOT NULL,
    likes           int DEFAULT 0,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_bbs_posts_thread ON bbs_posts(thread_id);
CREATE INDEX idx_bbs_posts_user ON bbs_posts(user_id);

-- ============================================================
-- 4. conversations（DM会話）
-- ============================================================
CREATE TABLE conversations (
    id              int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user1_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user2_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    last_message_at timestamptz,
    created_at      timestamptz DEFAULT now(),

    CONSTRAINT chk_different_users CHECK (user1_id <> user2_id),
    UNIQUE (user1_id, user2_id)
);

CREATE INDEX idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id);

-- ============================================================
-- 5. messages（DMメッセージ）
-- ============================================================
CREATE TABLE messages (
    id              int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    conversation_id int8 NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body            text NOT NULL,
    is_read         bool DEFAULT false,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- ============================================================
-- 6. notifications（通知）
-- ============================================================
CREATE TABLE notifications (
    id              int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type            text NOT NULL,              -- 'bbs_reply', 'dm', 'favorite', 'system'
    title           text NOT NULL,
    body            text,
    link            text,                       -- 遷移先パス e.g. '/bbs/123'
    is_read         bool DEFAULT false,
    created_at      timestamptz DEFAULT now(),

    CONSTRAINT chk_notification_type CHECK (type IN ('bbs_reply','dm','favorite','system'))
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE NOT is_read;

-- ============================================================
-- RLS ポリシー
-- ============================================================

-- favorites: 全員が誰の件数を見れる、自分のだけ追加/削除
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites_read" ON favorites FOR SELECT USING (true);
CREATE POLICY "favorites_insert_own" ON favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorites_delete_own" ON favorites
    FOR DELETE USING (auth.uid() = user_id);

-- bbs_threads: 全員読み取り、認証ユーザーのみ作成
ALTER TABLE bbs_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bbs_threads_read" ON bbs_threads FOR SELECT USING (true);
CREATE POLICY "bbs_threads_insert_auth" ON bbs_threads
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bbs_threads_update_own" ON bbs_threads
    FOR UPDATE USING (auth.uid() = user_id);

-- bbs_posts: 全員読み取り、認証ユーザーのみ投稿
ALTER TABLE bbs_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bbs_posts_read" ON bbs_posts FOR SELECT USING (true);
CREATE POLICY "bbs_posts_insert_auth" ON bbs_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- conversations: 参加者のみ読み書き
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations_read_own" ON conversations
    FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "conversations_insert_own" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- messages: 会話参加者のみ
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_read_own" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id
            AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)
        )
    );
CREATE POLICY "messages_insert_own" ON messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_update_read" ON messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id
            AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)
        )
    );

-- notifications: 本人のみ
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_read_own" ON notifications
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert_system" ON notifications
    FOR INSERT WITH CHECK (true);

-- ============================================================
-- reply_count自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION update_thread_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE bbs_threads
    SET reply_count = reply_count + 1,
        last_reply_at = NEW.created_at
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bbs_post_count
    AFTER INSERT ON bbs_posts
    FOR EACH ROW EXECUTE FUNCTION update_thread_reply_count();
