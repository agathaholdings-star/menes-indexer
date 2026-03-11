-- ============================================================
-- notifications の CHECK制約を修正
-- BBS/DM削除済みだが制約に残っていた型を除去
-- 現在使用中の通知型 + 将来型を追加
-- ============================================================

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notification_type;
ALTER TABLE notifications ADD CONSTRAINT chk_notification_type
  CHECK (type IN (
    'favorite',           -- お気に入り登録
    'system',             -- システム通知
    'helpful',            -- 参考になった
    'follow_review',      -- フォローユーザーの口コミ承認
    'review_approved',    -- 自分の口コミ承認
    'review_rejected'     -- 自分の口コミ却下
  ));
