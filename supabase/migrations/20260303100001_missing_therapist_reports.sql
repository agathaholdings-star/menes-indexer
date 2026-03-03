-- ============================================================
-- セラピスト不在報告テーブル
-- 口コミ投稿時に「この人がいない」報告を保存
-- ============================================================

CREATE TABLE missing_therapist_reports (
  id              int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  therapist_name  text NOT NULL,
  salon_id        int8 REFERENCES salons(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'pending',
  created_at      timestamptz DEFAULT now(),
  reviewed_at     timestamptz,
  CONSTRAINT chk_mtr_status CHECK (status IN ('pending', 'reviewed', 'added', 'dismissed'))
);

CREATE INDEX idx_mtr_status ON missing_therapist_reports (status) WHERE status = 'pending';

-- RLS: サービスロール経由のみ操作可能（APIはsupabaseAdminを使用）
ALTER TABLE missing_therapist_reports ENABLE ROW LEVEL SECURITY;
