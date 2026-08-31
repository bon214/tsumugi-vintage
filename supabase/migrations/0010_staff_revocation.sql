-- 0010_staff_revocation.sql
-- TSUMUGI · make revocation take effect immediately, and prove it.
--
-- THE PROBLEM WITH A CLAIM
-- app_metadata.role travels inside the access token. Revoking a staff row does
-- not invalidate a token already in a browser, so a claim-based check keeps
-- saying "owner" for up to the token lifetime (one hour by default).
--
-- THE RULE THIS SCHEMA FOLLOWS
--   · Postgres NEVER reads the claim. app.staff_role() queries staff_roles on
--     every request, so authority is re-evaluated per statement.
--   · The browser MAY read the claim, for presentation only — which menu items
--     to draw. It cannot grant itself anything, because every write is decided
--     by RLS, which asks the table.
--
-- The consequence is the desired one: the second a staff row is revoked, that
-- user's next insert/update/delete is refused even though their JWT is
-- unchanged. Their console may briefly still show staff chrome; every action it
-- offers will fail.

-- ----------------------------------------------------- hardening the helpers --

-- Every security-definer function in this schema must pin search_path, or a
-- caller who can create objects in a schema earlier in the path can shadow the
-- tables the function reads. These were written with `set search_path = ''`;
-- this block re-asserts it so a later edit cannot quietly drop it.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig, p.proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public')
      and p.prosecdef
  loop
    if fn.proconfig is null
       or not (fn.proconfig @> array['search_path=']
            or exists (select 1 from unnest(fn.proconfig) c where c like 'search_path=%'))
    then
      raise exception 'security definer function % has no pinned search_path', fn.sig;
    end if;
  end loop;
end;
$$;

-- Nothing in the public API should be able to call the privileged entry points.
-- Asserted rather than assumed: a `grant execute … to public` added by hand, or
-- inherited from a default privilege, is a silent escalation.
revoke all on function public.create_order(uuid, extensions.citext, extensions.citext, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function app.apply_payment_event(uuid, text, text, public.payment_status, integer, jsonb) from public, anon, authenticated;
revoke all on function app.link_customer_record(text) from public, anon, authenticated;
revoke all on function app.rate_limit_sweep(interval) from public, anon, authenticated;
revoke all on function app.sync_staff_claim() from public, anon, authenticated;
revoke all on function app.on_auth_user_created() from public, anon, authenticated;

-- staff_roles: writable by service_role only. Asserted the same way.
revoke all on table public.staff_roles from public, anon, authenticated;

-- ------------------------------------------------------- revocation helper --

-- Revoke in one call: drops the row's authority, clears the mirrored claim via
-- the existing trigger, and (optionally) kills the user's refresh tokens so the
-- stale access token cannot be renewed.
create or replace function app.revoke_staff(p_user_id uuid, p_kill_sessions boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.staff_roles
     set revoked_at = now()
   where user_id = p_user_id and revoked_at is null;

  if p_kill_sessions then
    -- The access token still works until it expires; without a refresh token it
    -- cannot be renewed, so the window is bounded by expiry and nothing more.
    delete from auth.refresh_tokens where user_id::uuid = p_user_id;
    delete from auth.sessions where user_id = p_user_id;
  end if;
end;
$$;

revoke all on function app.revoke_staff(uuid, boolean) from public, anon, authenticated;

-- ------------------------------------------------------------- self-audit --

-- A view an operator can read to confirm the invariant holds. If any row
-- appears with claim_role set and authority_role null, a revoked user is still
-- carrying a stale claim — expected until their token refreshes, and visible
-- rather than invisible.
create or replace view public.staff_claim_audit
with (security_invoker = true)
as
select
  u.id                                          as user_id,
  u.email,
  u.raw_app_meta_data ->> 'role'                as claim_role,
  case when sr.revoked_at is null then sr.role::text end as authority_role,
  sr.revoked_at,
  case
    when sr.revoked_at is not null and (u.raw_app_meta_data ->> 'role') is not null
      then 'stale claim — writes already refused, claim clears on token refresh'
    when (u.raw_app_meta_data ->> 'role') is distinct from sr.role::text
      then 'claim and authority disagree — run the sync trigger'
    else 'consistent'
  end as state
from auth.users u
left join public.staff_roles sr on sr.user_id = u.id
where u.raw_app_meta_data ? 'role' or sr.user_id is not null;

revoke all on public.staff_claim_audit from anon, authenticated;
grant select on public.staff_claim_audit to authenticated;

create policy staff_claim_audit_owner_only
  on public.staff_roles for select
  to authenticated
  using (app.has_role('owner'));
