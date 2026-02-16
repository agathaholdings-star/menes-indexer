-- ============================================================
-- デバイス制限用セッションテーブル（全プラン2台まで）
-- ============================================================

CREATE TABLE user_sessions (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    device_fingerprint text NOT NULL,
    device_label       text,
    ip_address         inet,
    last_active_at     timestamptz DEFAULT now(),
    created_at         timestamptz DEFAULT now(),
    is_active          boolean DEFAULT true
);

CREATE INDEX idx_user_sessions_user_active
  ON user_sessions(user_id) WHERE is_active = true;

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- 自分のセッションのみ閲覧・削除可能
CREATE POLICY "sessions_read_own" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sessions_delete_own" ON user_sessions
    FOR DELETE USING (auth.uid() = user_id);
