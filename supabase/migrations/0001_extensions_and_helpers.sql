-- 0001_extensions_and_helpers.sql
-- TSUMUGI · foundation: schema, subject helpers, updated_at trigger.
--
-- FOUR SUBJECTS. Every policy in later migrations names which of these it is
-- written for; nothing is left to "authenticated means a customer".
--
--   1. anon                     no session. Postgres role `anon`.
--   2. customer                 role `authenticated`, is_anonymous = false,
--                               no staff_roles row.
--   3. staff                    role `authenticated`, is_anonymous = false,
--                               live staff_roles row.
--   4. anonymous demo guest     role `authenticated`, is_anonymous = TRUE.
--
-- The fourth subject is the one the previous design got wrong. Supabase's
-- signInAnonymously() does NOT produce the `anon` Postgres role: an anonymous
-- user is `authenticated`, and every policy written `to authenticated` applied
-- to it. The only reliable discriminator is the JWT's is_anonymous claim, so
-- app.is_anonymous() below is used in every authenticated-facing policy.

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;
revoke all on schema app from anon, authenticated;
grant usage on schema app to anon, authenticated;

-- ---------------------------------------------------------------- subjects --

-- TRUE for a Supabase anonymous sign-in. Coalesced to false so a token minted
-- before the claim existed is treated as a normal session, not as a guest.
create or replace function app.is_anonymous()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- TRUE for a signed-in, non-anonymous account (subject 2 or 3).
create or replace function app.is_account()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null and not app.is_anonymous();
$$;

comment on function app.is_anonymous() is
  'True for Supabase anonymous sign-ins (JWT is_anonymous claim). These users hold the authenticated Postgres role and must be excluded from customer policies.';

-- ------------------------------------------------------------- updated_at --

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------- default-deny base --

-- New objects grant nothing to the API roles by default. Each later migration
-- grants exactly the columns and verbs it means to expose.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- New hosted projects may include Supabase's public.rls_auto_enable() event-
-- trigger helper. The event trigger can keep calling it internally, but API
-- roles must not be able to invoke a SECURITY DEFINER function through RPC.
-- Guard the REVOKE so the same migration also works in local environments
-- where the platform helper is absent.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
