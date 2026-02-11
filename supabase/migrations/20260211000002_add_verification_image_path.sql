-- reviews テーブルに予約スクショのパスカラムを追加
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS verification_image_path text;
