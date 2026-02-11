-- ============================================================
-- 口コミ予約スクショ認証機能
-- verification_image_path 列追加、Storageバケット、RLS
-- ============================================================

-- 1a. reviews に verification_image_path 追加
ALTER TABLE reviews ADD COLUMN verification_image_path text;
-- is_verified 列は既存（デフォルト false）→ そのまま活用

-- 1b. Supabase Storage バケット作成（非公開）
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-verifications', 'review-verifications', false);

-- 1c. Storage RLS ポリシー

-- 認証済みユーザー: 自分のフォルダにアップロード可
CREATE POLICY "review_verifications_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'review-verifications'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 管理者のみ: 全ファイル閲覧可
CREATE POLICY "review_verifications_select_admin"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'review-verifications'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 投稿者本人も自分のファイルは閲覧可
CREATE POLICY "review_verifications_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'review-verifications'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 1d. reviews の UPDATE ポリシー（管理者が is_verified を更新できるように）
CREATE POLICY "reviews_update_admin"
ON reviews FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
