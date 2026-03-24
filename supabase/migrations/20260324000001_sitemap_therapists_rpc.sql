-- therapists.salon_id 単独インデックス（JOINの高速化）
create index if not exists idx_therapists_salon_id on therapists (salon_id);

-- サイトマップ用: 公開サロンに紐づくセラピストのID・updated_at・口コミ有無を一括取得
-- PostgREST 1000行制限を回避するためRPC化
create or replace function get_sitemap_therapists()
returns table (
  id bigint,
  updated_at timestamptz,
  has_reviews boolean
)
language sql
stable
as $$
  select
    t.id,
    t.updated_at,
    coalesce(t.review_count, 0) > 0 as has_reviews
  from therapists t
  inner join salons s on s.id = t.salon_id
  where s.published_at is not null
  order by
    (coalesce(t.review_count, 0) > 0) desc,
    t.id
$$;

-- サイトマップindex用: 公開セラピストの件数だけ返す軽量版
create or replace function get_sitemap_therapist_count()
returns bigint
language sql
stable
as $$
  select count(*)
  from therapists t
  inner join salons s on s.id = t.salon_id
  where s.published_at is not null
$$;
