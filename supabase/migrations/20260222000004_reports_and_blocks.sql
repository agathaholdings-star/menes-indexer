-- ============================================================
-- 通報・ブロック機能
-- ============================================================

-- 1. 通報テーブル
CREATE TABLE reports (
  id          int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id   text NOT NULL,
  reason      text NOT NULL,
  detail      text,
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT chk_report_target_type CHECK (target_type IN ('bbs_post', 'bbs_thread', 'message', 'user')),
  CONSTRAINT chk_report_reason CHECK (reason IN ('spam', 'harassment', 'illegal', 'personal_info', 'other')),
  CONSTRAINT chk_report_status CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed'))
);

CREATE INDEX idx_reports_status ON reports (status) WHERE status = 'pending';
CREATE INDEX idx_reports_reporter ON reports (reporter_id);

-- 2. ブロックテーブル
CREATE TABLE blocks (
  blocker_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT chk_no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX idx_blocks_blocked ON blocks (blocked_id);

-- 3. RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- reports: 認証ユーザーのみINSERT（読み取りはservice_role経由のadminのみ）
CREATE POLICY "reports_insert" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- reports: 自分の通報のみ読み取り可
CREATE POLICY "reports_select_own" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- blocks: 本人のみCRUD
CREATE POLICY "blocks_select" ON blocks
  FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "blocks_insert" ON blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "blocks_delete" ON blocks
  FOR DELETE USING (auth.uid() = blocker_id);
