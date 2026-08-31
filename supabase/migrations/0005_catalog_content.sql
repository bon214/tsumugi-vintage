-- 0005_catalog_content.sql
-- TSUMUGI · products, articles, features, wishlists, contact + newsletter.
--
-- The public surface. Read access is the point; write access is staff-only and
-- is gated on the same app.has_role() ladder as everything else.
--
-- Note what anon may read: published rows, and only the columns a shop window
-- needs. cost_price and supplier are not granted to anyone but staff — a public
-- API that returns a margin is a business leak, not a security one, but it is
-- still a leak.

create type public.product_status as enum ('draft', 'published', 'soldout', 'archived');
create type public.content_status as enum ('draft', 'scheduled', 'published', 'archived');

create table public.products (
  id           bigserial primary key,
  name         text not null,
  brand        text,
  year_label   text,
  price        integer not null check (price >= 0),
  cost_price   integer check (cost_price >= 0),
  supplier     text,
  category     text,
  subcategory  text,
  size         text,
  colour       text,
  material     text,
  condition    text,
  country      text,
  curator_note text,
  story        text,
  measurements jsonb not null default '{}'::jsonb,
  images       jsonb not null default '[]'::jsonb,
  stock        integer not null default 1 check (stock >= 0),
  status       public.product_status not null default 'draft',
  featured     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index products_public_idx on public.products (status) where status in ('published', 'soldout');

create trigger products_touch before update on public.products
for each row execute function app.touch_updated_at();

create table public.news (
  id            bigserial primary key,
  title         text not null,
  slug          text not null unique,
  category      text,
  summary       text,
  -- Rich text. Sanitized in the browser before storage AND before render
  -- (tsumugi-sanitize.js), and sanitized again by the contact/content Edge
  -- Function when one is used. Postgres stores whatever it is given: it is not
  -- an HTML sanitizer, so the allowlist has to run on both sides of the wire.
  body          text,
  image         text,
  alt           text,
  tags          text[] not null default '{}',
  status        public.content_status not null default 'draft',
  publish_date  date,
  seo_title     text,
  seo_description text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint news_body_len check (body is null or char_length(body) <= 200000)
);

create trigger news_touch before update on public.news
for each row execute function app.touch_updated_at();

create table public.wishlists (
  user_id    uuid not null references auth.users (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.products  enable row level security;
alter table public.products  force  row level security;
alter table public.news      enable row level security;
alter table public.news      force  row level security;
alter table public.wishlists enable row level security;
alter table public.wishlists force  row level security;

-- ------------------------------------------------------------------ grants --

revoke all on table public.products, public.news, public.wishlists from anon, authenticated;

-- Shop window columns. cost_price and supplier are absent for both public roles.
grant select (id, name, brand, year_label, price, category, subcategory, size,
              colour, material, condition, country, curator_note, story,
              measurements, images, stock, status, featured, created_at, updated_at)
  on public.products to anon, authenticated;

grant select (id, title, slug, category, summary, body, image, alt, tags,
              status, publish_date, seo_title, seo_description, created_at, updated_at)
  on public.news to anon, authenticated;

-- Staff write columns, including the commercial ones.
grant insert, update, delete on public.products to authenticated;
grant insert, update, delete on public.news to authenticated;
grant select, insert, delete on public.wishlists to authenticated;

-- ---------------------------------------------------------- policies: read --

-- Subject 1 (anon) and every signed-in subject may read published rows. The
-- anonymous demo guest is included here deliberately: a published product is
-- already world-readable, so there is nothing to protect.
create policy products_select_public
  on public.products for select
  to anon, authenticated
  using (status in ('published', 'soldout'));

create policy news_select_public
  on public.news for select
  to anon, authenticated
  using (
    status = 'published'
    or (status = 'scheduled' and publish_date is not null and publish_date <= current_date)
  );

-- Staff see drafts and archives as well.
create policy products_select_staff
  on public.products for select
  to authenticated
  using (app.has_role('viewer'));

create policy news_select_staff
  on public.news for select
  to authenticated
  using (app.has_role('viewer'));

-- --------------------------------------------------------- policies: write --

create policy products_write_staff
  on public.products for insert
  to authenticated
  with check (app.has_role('editor'));

create policy products_update_staff
  on public.products for update
  to authenticated
  using (app.has_role('editor'))
  with check (app.has_role('editor'));

create policy products_delete_staff
  on public.products for delete
  to authenticated
  using (app.has_role('manager'));

create policy news_write_staff
  on public.news for insert
  to authenticated
  with check (app.has_role('editor'));

create policy news_update_staff
  on public.news for update
  to authenticated
  using (app.has_role('editor'))
  with check (app.has_role('editor'));

create policy news_delete_staff
  on public.news for delete
  to authenticated
  using (app.has_role('editor'));

-- No insert, update or delete policy names anon, and none omits a role test,
-- so subject 1 and subject 4 cannot write to the catalogue at all.

-- ---------------------------------------------------- policies: wishlists --

-- Subject 2 only. An anonymous session has no wishlist server-side: the
-- storefront keeps a local list and merges it after real sign-in.
create policy wishlists_select_own
  on public.wishlists for select
  to authenticated
  using (app.is_account() and user_id = auth.uid());

create policy wishlists_insert_own
  on public.wishlists for insert
  to authenticated
  with check (app.is_account() and user_id = auth.uid());

create policy wishlists_delete_own
  on public.wishlists for delete
  to authenticated
  using (app.is_account() and user_id = auth.uid());

-- ------------------------------------------- contact + newsletter intake --

-- Both are write-only from the public side: a visitor may add a row and may
-- never read the table back. Rate limiting lives in the Edge Function
-- (supabase/functions/contact); these constraints are the second line.

create table public.contact_messages (
  id         bigserial primary key,
  name       text not null,
  email      extensions.citext not null,
  subject    text,
  message    text not null,
  -- Set by the Edge Function from request headers, not by the browser.
  source_ip_hash text,
  user_agent text,
  handled    boolean not null default false,
  created_at timestamptz not null default now(),
  constraint contact_name_len    check (char_length(name) between 1 and 120),
  constraint contact_email_len   check (char_length(email::text) <= 254),
  constraint contact_subject_len check (subject is null or char_length(subject) <= 200),
  constraint contact_message_len check (char_length(message) between 1 and 4000)
);

create table public.newsletter_subscribers (
  email        extensions.citext primary key,
  confirmed_at timestamptz,
  -- Double opt-in: a row here is not a subscription until confirmed_at is set
  -- by the confirmation link. Nothing is sent to an unconfirmed address.
  token_hash   text,
  created_at   timestamptz not null default now(),
  constraint newsletter_email_len check (char_length(email::text) <= 254)
);

alter table public.contact_messages       enable row level security;
alter table public.contact_messages       force  row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_subscribers force  row level security;

revoke all on table public.contact_messages, public.newsletter_subscribers
  from anon, authenticated;

-- No grants at all: both tables are written only by the Edge Function with
-- service_role, and read only by staff through the console's own queries.
grant select on public.contact_messages to authenticated;
grant select on public.newsletter_subscribers to authenticated;

create policy contact_select_staff
  on public.contact_messages for select
  to authenticated
  using (app.has_role('support'));

create policy newsletter_select_staff
  on public.newsletter_subscribers for select
  to authenticated
  using (app.has_role('manager'));

grant update (handled) on public.contact_messages to authenticated;

create policy contact_update_staff
  on public.contact_messages for update
  to authenticated
  using (app.has_role('support'))
  with check (app.has_role('support'));
