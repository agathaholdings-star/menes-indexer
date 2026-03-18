-- Fix page_contents: コメント修正 + updated_atトリガー + content_key追加

-- コメント修正: bodyはプレーンテキスト（【】見出し形式）
COMMENT ON COLUMN page_contents.body IS 'コンテンツ本文（プレーンテキスト、【】で見出し）';
COMMENT ON COLUMN page_contents.page_type IS 'ページ種別: prefecture | area | salon';
COMMENT ON COLUMN page_contents.content_key IS 'コンテンツキー: guide | highlights | area_info | salon_overview | salon_summary';

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_page_contents_updated_at
    BEFORE UPDATE ON page_contents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 冗長なインデックスを削除（UNIQUE制約がカバーしてる）
DROP INDEX IF EXISTS idx_page_contents_lookup;
