-- therapist-images バケット作成（public）
-- セラピスト写真をSupabase Storageで管理するため
-- パス: {salon_id}/{therapist_id}/{001|002|003}.{ext}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'therapist-images',
    'therapist-images',
    true,
    5242880,  -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 公開読み取りポリシー
CREATE POLICY "Public read therapist images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'therapist-images');

-- サービスロールのみ書き込み可（バッチスクリプトから使用）
CREATE POLICY "Service role write therapist images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'therapist-images');

CREATE POLICY "Service role update therapist images"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'therapist-images');

CREATE POLICY "Service role delete therapist images"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'therapist-images');
