-- =============================================================
-- 本番デプロイ前セキュリティ修正
-- 4エージェント + Codexレビューで発見された問題を修正
-- =============================================================

-- =============================================================
-- 1. SEO CRITICAL: salons/therapists/salon_areas を匿名読み取り可に
--    Googlebotが未認証でアクセスするため、authenticated限定だとSEO死ぬ
-- =============================================================
DROP POLICY IF EXISTS "salons_read_authenticated" ON salons;
CREATE POLICY "salons_read_public" ON salons
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "therapists_read_authenticated" ON therapists;
CREATE POLICY "therapists_read_public" ON therapists
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "salon_areas_read_authenticated" ON salon_areas;
CREATE POLICY "salon_areas_read_public" ON salon_areas
  FOR SELECT USING (true);

-- =============================================================
-- 2. SECURITY: profiles_service_update が全ユーザーにUPDATE許可
--    → service_roleのみに制限（フロントからはprofiles_update_ownを使う）
-- =============================================================
DROP POLICY IF EXISTS "profiles_service_update" ON profiles;
-- service_roleはRLSをバイパスするのでポリシー不要
-- profiles_update_own (auth.uid() = id) が一般ユーザー用として残る

-- =============================================================
-- 3. SECURITY: notifications_insert_system が全ユーザーにINSERT許可
--    → 削除（service_roleはRLSバイパスするので通知挿入は問題ない）
-- =============================================================
DROP POLICY IF EXISTS "notifications_insert_system" ON notifications;

-- =============================================================
-- 4. missing_therapist_reports: RLS有効だがポリシー0件
--    → 認証ユーザーがINSERT可（user_idカラムなし、管理者はservice_roleでSELECT）
-- =============================================================
DROP POLICY IF EXISTS "missing_therapist_reports_insert_auth" ON missing_therapist_reports;
CREATE POLICY "missing_therapist_reports_insert_auth" ON missing_therapist_reports
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- =============================================================
-- 5. review-verifications バケットにサイズ・MIME制限追加
-- =============================================================
UPDATE storage.buckets
SET file_size_limit = 10485760,  -- 10MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'review-verifications';

-- =============================================================
-- 6. reject_review 1引数版の削除（2引数版のDEFAULTで十分）
-- =============================================================
DROP FUNCTION IF EXISTS reject_review(uuid);

-- =============================================================
-- 7. 重複インデックス削除
-- =============================================================
DROP INDEX IF EXISTS idx_reviews_moderation_status;
DROP INDEX IF EXISTS idx_user_follows_follower;
