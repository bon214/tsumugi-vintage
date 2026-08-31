-- 0002_staff_roles.sql
-- TSUMUGI · the single source of truth for staff authority.
--
-- WHAT WAS WRONG
-- The previous design read profiles.role as the authoritative console role,
-- while its own RLS example allowed `update on profiles using (id = auth.uid())`
-- across the whole row. A customer could therefore run
--     update profiles set role = 'owner' where id = auth.uid();
-- and the console believed it. Role and customer_id were customer-writable
-- columns on a customer-writable row.
--
-- WHAT REPLACES IT
-- staff_roles: a table no end user can write, read or discover. Membership is
-- granted out of band (SQL console, or a service_role-only admin function).
-- Postgres RLS reads it through app.staff_role(); the browser reads the same
-- value from the JWT's app_metadata, which a trigger mirrors from this table.
-- One source, two readers — they cannot disagree.

create type public.staff_role as enum ('owner', 'manager', 'editor', 'support', 'viewer');

create table public.staff_roles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        public.staff_role not null,
  granted_by  uuid references auth.users (id) on delete set null,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  note        text
);

comment on table public.staff_roles is
  'Console authority. No grants to anon or authenticated: readable only via app.staff_role() (security definer) and by service_role.';

alter table public.staff_roles enable row level security;
alter table public.staff_roles force row level security;

-- No policies at all. RLS with zero policies denies every subject, including
-- the table owner's ordinary API roles. service_role bypasses RLS by design and
-- is the only way in — from an Edge Function or the SQL editor, never a browser.
revoke all on table public.staff_roles from anon, authenticated;

-- ------------------------------------------------------------- role lookup --

-- security definer so it can read staff_roles while the caller cannot. An
-- anonymous session is never staff, whatever else it might carry.
create or replace function app.staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select sr.role::text
  from public.staff_roles sr
  where sr.user_id = auth.uid()
    and sr.revoked_at is null
    and not app.is_anonymous()
  limit 1;
$$;

create or replace function app.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select app.staff_role() is not null;
$$;

-- Ordered authority test: app.has_role('editor') is true for editor and above.
create or replace function app.has_role(minimum public.staff_role)
returns boolean
language sql
stable
set search_path = ''
as $$
  with rank(role, level) as (
    values ('viewer'::public.staff_role, 1), ('support', 2), ('editor', 3), ('manager', 4), ('owner', 5)
  )
  select coalesce(
    (select mine.level from rank mine where mine.role::text = app.staff_role())
      >= (select need.level from rank need where need.role = minimum),
    false
  );
$$;

grant execute on function app.is_anonymous(), app.is_account(),
                          app.staff_role(), app.is_staff(), app.has_role(public.staff_role)
  to anon, authenticated;

-- ------------------------------------------- mirror into JWT app_metadata --

-- The browser cannot query staff_roles, so the role is copied into
-- app_metadata, which is server-owned: it appears in the JWT on the user's next
-- token refresh and is never writable from a client SDK call. tsumugi-auth.js
-- reads app_metadata.role and nothing else.
create or replace function app.sync_staff_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.user_id, old.user_id);
  claim  text;
begin
  select sr.role::text into claim
  from public.staff_roles sr
  where sr.user_id = target and sr.revoked_at is null
  limit 1;

  update auth.users u
     set raw_app_meta_data =
           case
             when claim is null then (coalesce(u.raw_app_meta_data, '{}'::jsonb) - 'role')
             else coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', claim)
           end
   where u.id = target;

  return null;
end;
$$;

create trigger staff_roles_sync_claim
after insert or update or delete on public.staff_roles
for each row execute function app.sync_staff_claim();

-- ------------------------------------------------------------- granting it --

-- Run as service_role / in the SQL editor. There is deliberately no browser
-- path to this: staff cannot create staff.
--
--   insert into public.staff_roles (user_id, role, note)
--   select id, 'owner', 'initial operator'
--   from auth.users where email = 'owner@example.com'
--   on conflict (user_id) do update
--     set role = excluded.role, revoked_at = null, granted_at = now();
--
-- Revoking (keeps the audit row, drops the claim on next refresh):
--
--   update public.staff_roles set revoked_at = now() where user_id = '…';
--
-- A revoked user keeps a stale claim until their access token refreshes (one
-- hour by default). For immediate removal, also revoke their refresh tokens:
--
--   select auth.uid();  -- then, as service_role, delete the user's sessions
--   delete from auth.sessions where user_id = '…';
