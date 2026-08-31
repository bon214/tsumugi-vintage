-- Replace the SECURITY DEFINER view with a materialized public projection.
-- Visitors can read this table under ordinary RLS. The staff-only source table
-- remains inaccessible, so draft/sold candidate ids never leak through a
-- direct Data API query.

drop view if exists public.public_special_features;

create table public.public_special_features (
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
  created_at            timestamptz not null,
  updated_at            timestamptz not null
);

alter table public.public_special_features enable row level security;
alter table public.public_special_features force row level security;
revoke all on table public.public_special_features from public, anon, authenticated;
grant select on table public.public_special_features to anon, authenticated;

create policy public_special_features_select_active
  on public.public_special_features for select
  to anon, authenticated
  using (
    enabled
    and publish_at is not null
    and publish_at <= now()
    and (unpublish_at is null or now() < unpublish_at)
  );

create or replace function app.refresh_public_special_features(p_feature_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.public_special_features p
   where p_feature_id is null or p.id = p_feature_id;

  insert into public.public_special_features (
    id, slug, title_en, title_ja, description_en, description_ja,
    category, era_label, enabled, publish_at, unpublish_at,
    candidate_product_ids, media, created_at, updated_at
  )
  select
    sf.id, sf.slug, sf.title_en, sf.title_ja, sf.description_en,
    sf.description_ja, sf.category, sf.era_label, sf.enabled,
    sf.publish_at, sf.unpublish_at,
    coalesce((
      select array_agg(candidate.id order by candidate.ord)
      from unnest(sf.candidate_product_ids) with ordinality candidate(id, ord)
      join public.products product on product.id = candidate.id
      where product.status = 'published' and product.stock > 0
    ), '{}'::bigint[]),
    coalesce((
      select jsonb_agg(item.value order by item.ord)
      from jsonb_array_elements(sf.media) with ordinality item(value, ord)
      where coalesce(item.value ->> 'sourceType', '') <> 'product'
         or (
           coalesce(item.value ->> 'productId', '') ~ '^[0-9]+$'
           and exists (
             select 1 from public.products product
              where product.id = (item.value ->> 'productId')::bigint
                and product.status = 'published'
                and product.stock > 0
           )
         )
    ), '[]'::jsonb),
    sf.created_at, sf.updated_at
  from public.special_features sf
  where p_feature_id is null or sf.id = p_feature_id;
end;
$$;

revoke all on function app.refresh_public_special_features(text)
  from public, anon, authenticated;

create or replace function app.sync_public_special_feature_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.refresh_public_special_features(
    case when tg_op = 'DELETE' then old.id else new.id end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function app.sync_public_special_feature_row()
  from public, anon, authenticated;

create trigger special_features_sync_public
after insert or update or delete on public.special_features
for each row execute function app.sync_public_special_feature_row();

create or replace function app.sync_public_special_features_for_products()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.refresh_public_special_features(null);
  return null;
end;
$$;

revoke all on function app.sync_public_special_features_for_products()
  from public, anon, authenticated;

create trigger products_sync_public_special_features
after update of status, stock on public.products
for each statement execute function app.sync_public_special_features_for_products();

select app.refresh_public_special_features(null);

comment on table public.public_special_features is
  'RLS-protected public projection. Candidate products and product-backed media are filtered to currently published, in-stock products.';
