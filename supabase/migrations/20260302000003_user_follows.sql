-- ============================================================
-- user_follows: ユーザーフォロー機能 + フォロワー数同期 + 通知トリガー
-- ============================================================

-- 1. user_follows テーブル
CREATE TABLE IF NOT EXISTS user_follows (
  follower_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id != followed_id)  -- 自分自身はフォロー不可
);

CREATE INDEX idx_user_follows_followed ON user_follows(followed_id);
CREATE INDEX idx_user_follows_follower ON user_follows(follower_id);

-- 2. RLS
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- 誰でも読める（フォロワー数表示用）
CREATE POLICY "user_follows_select" ON user_follows FOR SELECT USING (true);
-- 本人のみフォロー追加
CREATE POLICY "user_follows_insert" ON user_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
-- 本人のみフォロー解除
CREATE POLICY "user_follows_delete" ON user_follows FOR DELETE USING (auth.uid() = follower_id);

-- 3. profiles にフォロワー数カラム追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS follower_count int DEFAULT 0;

-- 4. フォロー時: follower_count +1
CREATE OR REPLACE FUNCTION sync_follow_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET follower_count = follower_count + 1
  WHERE id = NEW.followed_id;
  RETURN NEW;
END;
$$;

-- 5. アンフォロー時: follower_count -1
CREATE OR REPLACE FUNCTION sync_follow_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET follower_count = GREATEST(follower_count - 1, 0)
  WHERE id = OLD.followed_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_user_follow_insert
  AFTER INSERT ON user_follows
  FOR EACH ROW EXECUTE FUNCTION sync_follow_insert();

CREATE TRIGGER trg_user_follow_delete
  AFTER DELETE ON user_follows
  FOR EACH ROW EXECUTE FUNCTION sync_follow_delete();

-- 6. notifications の type 制約を更新（helpful, follow_review を追加）
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notification_type;
ALTER TABLE notifications ADD CONSTRAINT chk_notification_type
  CHECK (type IN ('bbs_reply','dm','favorite','system','helpful','follow_review'));

-- 7. 口コミ承認時にフォロワーへ通知するトリガー
CREATE OR REPLACE FUNCTION notify_followers_on_review_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_nickname text;
  v_therapist_name text;
BEGIN
  -- 承認ステータスに変更された場合のみ
  IF NEW.moderation_status = 'approved'
     AND (OLD.moderation_status IS NULL OR OLD.moderation_status != 'approved')
     AND NEW.user_id IS NOT NULL THEN

    -- 投稿者のニックネームを取得
    SELECT nickname INTO v_nickname FROM profiles WHERE id = NEW.user_id;
    -- セラピスト名を取得
    SELECT name INTO v_therapist_name FROM therapists WHERE id = NEW.therapist_id;

    -- フォロワー全員に通知
    INSERT INTO notifications (user_id, type, title, body, link)
    SELECT
      uf.follower_id,
      'follow_review',
      COALESCE(v_nickname, '匿名') || 'さんが新しい口コミを投稿',
      COALESCE(v_therapist_name, 'セラピスト') || 'の口コミ',
      '/therapist/' || NEW.therapist_id
    FROM user_follows uf
    WHERE uf.followed_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_followers_review
  AFTER UPDATE OF moderation_status ON reviews
  FOR EACH ROW EXECUTE FUNCTION notify_followers_on_review_approved();
