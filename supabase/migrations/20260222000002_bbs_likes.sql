-- ============================================================
-- BBSいいね機能
-- bbs_post_likes テーブル + カウント自動同期トリガー
-- ============================================================

-- 1. いいねテーブル（user_id + post_id で冪等性保証）
CREATE TABLE bbs_post_likes (
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id   int8 NOT NULL REFERENCES bbs_posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_bbs_post_likes_post_id ON bbs_post_likes (post_id);

-- 2. INSERT トリガー: likes カウント +1
CREATE OR REPLACE FUNCTION bbs_post_like_increment()
RETURNS trigger AS $$
BEGIN
  UPDATE bbs_posts SET likes = likes + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_bbs_post_like_increment
  AFTER INSERT ON bbs_post_likes
  FOR EACH ROW
  EXECUTE FUNCTION bbs_post_like_increment();

-- 3. DELETE トリガー: likes カウント -1
CREATE OR REPLACE FUNCTION bbs_post_like_decrement()
RETURNS trigger AS $$
BEGIN
  UPDATE bbs_posts SET likes = GREATEST(likes - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_bbs_post_like_decrement
  AFTER DELETE ON bbs_post_likes
  FOR EACH ROW
  EXECUTE FUNCTION bbs_post_like_decrement();

-- 4. RLS
ALTER TABLE bbs_post_likes ENABLE ROW LEVEL SECURITY;

-- 全員読み取り可
CREATE POLICY "bbs_post_likes_select" ON bbs_post_likes
  FOR SELECT USING (true);

-- 認証ユーザーのみ自分のいいねを追加
CREATE POLICY "bbs_post_likes_insert" ON bbs_post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 自分のいいねのみ削除可
CREATE POLICY "bbs_post_likes_delete" ON bbs_post_likes
  FOR DELETE USING (auth.uid() = user_id);
