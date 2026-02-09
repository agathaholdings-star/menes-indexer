-- 認証ユーザーが他ユーザーのnickname等を検索できるようにする（DM相手検索用）
-- 既存の profiles_read_own は auth.uid() = id で自分のみ読めるポリシー

-- 既存ポリシーを削除して、認証ユーザー全員が読めるように置き換え
DROP POLICY IF EXISTS "profiles_read_own" ON profiles;

CREATE POLICY "profiles_read_authenticated" ON profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');
