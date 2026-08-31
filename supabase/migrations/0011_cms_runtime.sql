-- 0011_cms_runtime.sql
-- TSUMUGI · production CMS fields, home features and shop special features.
--
-- The original 0005 migration created the public catalogue tables, but the
-- browser was still backed by localStorage and its editor exposed more fields
-- than Postgres could store.  This migration closes that gap without rewriting
-- the already-reviewed migrations 0001–0010.

-- ------------------------------------------------------- catalogue fields --

alter table public.products
  add column if not exists sku               text,
  add column if not exists slug              text,
  add column if not exists year              integer,
  add column if not exists tax_status        text,
  add column if not exists size_notation     text,
  add column if not exists era               text,
  add column if not exists condition_note    text,
  add column if not exists stains            text,
  add column if not exists damage            text,
  add column if not exists repairs           text,
  add column if not exists fading            text,
  add column if not exists missing_parts     text,
  add column if not exists styling           text,
  add column if not exists collection        text,
  add column if not exists meta_title        text,
  add column if not exists meta_description  text,
  add column if not exists publish_date      date;

create unique index if not exists products_sku_unique
  on public.products (sku);
create unique index if not exists products_slug_unique
  on public.products (slug);

alter table public.news
  add column if not exists type                text not null default 'journal',
  add column if not exists author              text,
  add column if not exists thumb               text,
  add column if not exists featured            boolean not null default false,
  add column if not exists related_product_ids bigint[] not null default '{}';

alter table public.news drop constraint if exists news_type_check;
alter table public.news add constraint news_type_check
  check (type in ('news', 'journal'));

-- bigserial sequences are separate objects.  INSERT on the table does not
-- imply permission to call nextval(), so authenticated staff need USAGE.
grant usage, select on sequence public.products_id_seq, public.news_id_seq
  to authenticated;

-- Public visitors may read the new storefront fields, but never commercial
-- cost/supplier data.  Existing table grants are column-scoped, so every new
-- public column is granted explicitly.
grant select (
  sku, slug, year, tax_status, size_notation, era, condition_note, stains,
  damage, repairs, fading, missing_parts, styling, collection, meta_title,
  meta_description, publish_date
) on public.products to anon, authenticated;

grant select (type, author, thumb, featured, related_product_ids)
  on public.news to anon, authenticated;

-- --------------------------------------------------------- home features --

create table if not exists public.hero_features (
  id          text primary key,
  source_type text not null check (source_type in ('page', 'news', 'journal')),
  source_id   bigint references public.news(id) on delete set null,
  route       text,
  enabled     boolean not null default false,
  sort_order  integer not null default 1 check (sort_order > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint hero_feature_source_check check (
    (source_type = 'page' and route in ('shop', 'about', 'journal', 'contact') and source_id is null)
    or
    (source_type in ('news', 'journal') and source_id is not null and coalesce(route, '') = '')
  )
);

alter table public.hero_features
  add constraint hero_features_sort_unique unique (sort_order)
  deferrable initially deferred;

create trigger hero_features_touch before update on public.hero_features
for each row execute function app.touch_updated_at();

-- ------------------------------------------------------ special features --

create table if not exists public.special_features (
  id                    text primary key,
  slug                  text not null unique,
  title_en              text not null default '',
  title_ja              text not null default '',
  description_en        text not null default '',
  description_ja        text not null default '',
  category              text,
  era_label             text,
  enabled               boolean not null default false,
  publish_at            timestamptz,
  unpublish_at          timestamptz,
  candidate_product_ids bigint[] not null default '{}',
  media                 jsonb not null default '[]'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint special_feature_window_check
    check (unpublish_at is null or publish_at is null or unpublish_at > publish_at),
  constraint special_feature_candidates_check
    check (cardinality(candidate_product_ids) <= 8),
  constraint special_feature_media_check
    check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 6)
);

create index if not exists special_features_public_idx
  on public.special_features(enabled, publish_at, unpublish_at);

create trigger special_features_touch before update on public.special_features
for each row execute function app.touch_updated_at();

-- --------------------------------------------------------------- grants --

alter table public.hero_features enable row level security;
alter table public.hero_features force row level security;
alter table public.special_features enable row level security;
alter table public.special_features force row level security;

revoke all on table public.hero_features, public.special_features
  from anon, authenticated;

grant select on public.hero_features to anon, authenticated;
-- The base special_features row contains draft candidate ids.  Only staff may
-- query it; visitors use the deliberately filtered view below.
grant select on public.special_features to authenticated;
grant insert, update, delete on public.hero_features, public.special_features
  to authenticated;

-- Public hero rows are visible only when their source is itself public.  Staff
-- may read every draft.  Anonymous Supabase users assume `authenticated`, so
-- the staff predicate must always be present on the broader policy.
create policy hero_features_select_public
  on public.hero_features for select
  to anon, authenticated
  using (
    enabled and (
      source_type = 'page'
      or exists (
        select 1 from public.news n
        where n.id = source_id
          and (n.status = 'published'
               or (n.status = 'scheduled' and n.publish_date <= current_date))
      )
    )
  );

create policy hero_features_select_staff
  on public.hero_features for select
  to authenticated
  using (app.has_role('viewer'));
create policy hero_features_insert_staff
  on public.hero_features for insert
  to authenticated
  with check (app.has_role('editor'));
create policy hero_features_update_staff
  on public.hero_features for update
  to authenticated
  using (app.has_role('editor')) with check (app.has_role('editor'));
create policy hero_features_delete_staff
  on public.hero_features for delete
  to authenticated
  using (app.has_role('editor'));

-- Reordering is one database statement.  Sending one UPDATE per row through
-- the browser creates transient duplicate positions and can leave a partial
-- order after a network failure.
-- This RPC intentionally lives in `public`, the schema exposed by Supabase's
-- Data API by default.  It remains safe to expose because it is SECURITY
-- INVOKER, performs an explicit live staff-role check, and every UPDATE still
-- crosses the table's RLS policy.
create or replace function public.reorder_hero_features(feature_ids text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected integer;
begin
  if not app.has_role('editor') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select count(*) into expected from public.hero_features;
  if cardinality(feature_ids) <> expected
     or (select count(distinct x) from unnest(feature_ids) x) <> expected
     or exists (
       select 1 from unnest(feature_ids) x
       where not exists (select 1 from public.hero_features h where h.id = x)
     ) then
    raise exception 'invalid_feature_order' using errcode = '22023';
  end if;
  update public.hero_features h
     set sort_order = array_position(feature_ids, h.id)
   where h.id = any(feature_ids);
end;
$$;

revoke all on function public.reorder_hero_features(text[]) from public, anon;
grant execute on function public.reorder_hero_features(text[]) to authenticated;

create policy special_features_select_staff
  on public.special_features for select
  to authenticated
  using (app.has_role('viewer'));
create policy special_features_insert_staff
  on public.special_features for insert
  to authenticated
  with check (app.has_role('editor'));
create policy special_features_update_staff
  on public.special_features for update
  to authenticated
  using (app.has_role('editor')) with check (app.has_role('editor'));
create policy special_features_delete_staff
  on public.special_features for delete
  to authenticated
  using (app.has_role('editor'));

-- Public reads must not disclose ids of draft/sold products placed in a future
-- feature.  The view filters the stored candidate array through the products
-- RLS-visible public catalogue while preserving the curator's order.
create or replace view public.public_special_features
with (security_barrier = true)
as
select
  sf.id, sf.slug, sf.title_en, sf.title_ja, sf.description_en,
  sf.description_ja, sf.category, sf.era_label, sf.enabled,
  sf.publish_at, sf.unpublish_at,
  coalesce((
    select array_agg(candidate.id order by candidate.ord)
    from unnest(sf.candidate_product_ids) with ordinality candidate(id, ord)
    join public.products p on p.id = candidate.id
    where p.status = 'published' and p.stock > 0
  ), '{}'::bigint[]) as candidate_product_ids,
  sf.media, sf.created_at, sf.updated_at
from public.special_features sf
where sf.enabled
  and sf.publish_at is not null
  and sf.publish_at <= now()
  and (sf.unpublish_at is null or now() < sf.unpublish_at);

revoke all on public.public_special_features from public, anon, authenticated;
grant select on public.public_special_features to anon, authenticated;

comment on view public.public_special_features is
  'Definer view exposing only active features, with draft/sold candidate ids removed. Base rows remain staff-only.';
