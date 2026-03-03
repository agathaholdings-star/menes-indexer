-- reports テーブルの target_type 制約に 'missing_therapist' を追加
ALTER TABLE reports DROP CONSTRAINT chk_report_target_type;
ALTER TABLE reports ADD CONSTRAINT chk_report_target_type
  CHECK (target_type = ANY (ARRAY['review', 'user', 'missing_therapist']));
