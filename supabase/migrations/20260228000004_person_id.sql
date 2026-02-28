-- person_id: 同一人物を束ねるID（移籍検知用）
-- 同じ person_id を持つ therapist レコードは同一人物の別サロン在籍を表す

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS person_id int8;

-- インデックス: person_id で同一人物を素早く検索
CREATE INDEX IF NOT EXISTS idx_therapists_person_id ON therapists (person_id) WHERE person_id IS NOT NULL;

-- コメント
COMMENT ON COLUMN therapists.person_id IS '同一人物を束ねるID。移籍検知バッチで付与。NULLは未判定。';
