-- ============================================================
-- 通知自動生成トリガー
-- BBS返信とDM受信時にnotificationsテーブルにレコードを自動挿入
-- ============================================================

-- 1. BBS返信通知: bbs_posts INSERT後 → スレ主に通知（自己返信は除外）
CREATE OR REPLACE FUNCTION notify_bbs_reply()
RETURNS trigger AS $$
DECLARE
  thread_owner_id uuid;
  thread_title text;
BEGIN
  -- スレッドのオーナーとタイトルを取得
  SELECT user_id, title INTO thread_owner_id, thread_title
  FROM bbs_threads
  WHERE id = NEW.thread_id;

  -- 自己返信は通知しない
  IF thread_owner_id IS NOT NULL AND thread_owner_id <> NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      thread_owner_id,
      'bbs_reply',
      'スレッドに返信がありました',
      left(NEW.body, 100),
      '/bbs/' || NEW.thread_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_bbs_reply ON bbs_posts;
CREATE TRIGGER trg_notify_bbs_reply
  AFTER INSERT ON bbs_posts
  FOR EACH ROW
  EXECUTE FUNCTION notify_bbs_reply();

-- 2. DM通知: messages INSERT後 → 受信者に通知
CREATE OR REPLACE FUNCTION notify_dm()
RETURNS trigger AS $$
DECLARE
  receiver_id uuid;
  sender_nickname text;
BEGIN
  -- 会話の相手を特定
  SELECT
    CASE
      WHEN c.user1_id = NEW.sender_id THEN c.user2_id
      ELSE c.user1_id
    END INTO receiver_id
  FROM conversations c
  WHERE c.id = NEW.conversation_id;

  -- 送信者のニックネームを取得
  SELECT COALESCE(nickname, '名無しさん') INTO sender_nickname
  FROM profiles
  WHERE id = NEW.sender_id;

  IF receiver_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      receiver_id,
      'dm',
      sender_nickname || 'さんからメッセージ',
      left(NEW.body, 100),
      '/messages'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_dm ON messages;
CREATE TRIGGER trg_notify_dm
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_dm();
