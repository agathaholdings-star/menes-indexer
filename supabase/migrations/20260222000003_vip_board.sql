-- ============================================================
-- VIP掲示板: bbs_threads に is_vip_only カラム追加
-- ============================================================

ALTER TABLE bbs_threads ADD COLUMN is_vip_only bool NOT NULL DEFAULT false;

-- VIPスレッドを効率的にフィルタするためのインデックス
CREATE INDEX idx_bbs_threads_vip ON bbs_threads (is_vip_only) WHERE is_vip_only = true;
