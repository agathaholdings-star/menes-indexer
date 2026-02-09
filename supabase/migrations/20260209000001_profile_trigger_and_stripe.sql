-- ============================================================
-- プロフィール自動作成トリガー
-- auth.users INSERT時にpublic.profilesへ行を作成
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nickname', '名無し'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- profiles: service_role（Webhook等）からの更新を許可
-- ============================================================
CREATE POLICY "profiles_service_update" ON profiles
    FOR UPDATE USING (true)
    WITH CHECK (true);
-- ↑ service_roleキーはRLSバイパスするため実質不要だが、
--   将来的なadmin API用に残しておく
