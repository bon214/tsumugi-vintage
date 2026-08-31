-- 0003_profiles.sql
-- TSUMUGI · customer profile, with role and linkage removed from reach.
--
-- The row is still "the customer's own row", but it is no longer a row the
-- customer may rewrite. Two mechanisms, deliberately doubled:
--
--   1. RLS decides WHICH rows a subject may touch (their own, never another's).
--   2. Column-level GRANTs decide WHICH COLUMNS an update may name. RLS cannot
--      express that; `grant update (display_name, phone)` can. A statement that
--      names customer_id is rejected by the grant before any policy runs.
--
-- role is gone from this table entirely — it lives in staff_roles (0002).
-- Leaving a role column here at all invites the next reader to trust it.

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  phone         text,
  -- Server-managed link to the shop's customer record. Set by the create-order
  -- Edge Function or by staff; never by the account holder.
  customer_id   text,
  marketing_opt_in boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint profiles_display_name_len check (display_name is null or char_length(display_name) <= 80),
  constraint profiles_phone_len        check (phone is null or char_length(phone) <= 32),
  constraint profiles_phone_shape      check (phone is null or phone ~ '^[0-9+()\-\s]{6,32}$')
);

create trigger profiles_touch before update on public.profiles
for each row execute function app.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- ------------------------------------------------------------ grants first --

revoke all on table public.profiles from anon, authenticated;

-- Customers may read their own row (RLS restricts to it) …
grant select (id, display_name, phone, customer_id, marketing_opt_in, created_at, updated_at)
  on public.profiles to authenticated;

-- … and may update ONLY these columns. Naming any other column in an UPDATE is
-- a permission error, whatever the policy would have allowed.
grant update (display_name, phone, marketing_opt_in) on public.profiles to authenticated;

-- Insert is limited to the identity columns a new account legitimately supplies.
grant insert (id, display_name, phone, marketing_opt_in) on public.profiles to authenticated;

-- There is no grant of any kind to anon: a profile is never public.

-- ---------------------------------------------------------------- policies --

-- Subject 2 (customer): own row only, and only when not anonymous. The
-- is_account() test is what keeps subject 4 (anonymous guest) out of a table
-- that would otherwise be open to every `authenticated` session.
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid() and app.is_account());

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() and app.is_account());

-- WITH CHECK repeats the USING condition: without it, an update could move a
-- row to another id (the row you may edit is not necessarily the row you may
-- produce). The column grant already blocks customer_id, so this is the second
-- of the two locks, not the only one.
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid() and app.is_account())
  with check (id = auth.uid() and app.is_account());

-- Deletion belongs to account deletion, which is an auth-level operation.
-- No delete policy exists, so no subject may delete a profile row.

-- Subject 3 (staff): support and above may read profiles to answer a customer
-- enquiry. Reading is not writing — there is no staff update policy, so nobody
-- can quietly rewrite a customer's details from the console.
create policy profiles_select_staff
  on public.profiles for select
  to authenticated
  using (app.has_role('support'));

-- ------------------------------------------------------------ server paths --

-- Linking a profile to a shop customer record is a server action. Exposed as a
-- security-definer function so the Edge Function can call it with the caller's
-- identity, without granting the column to anyone.
create or replace function app.link_customer_record(p_customer_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or app.is_anonymous() then
    raise exception 'not an account';
  end if;
  if p_customer_id !~ '^CUS-[0-9]{4,10}$' then
    raise exception 'malformed customer id';
  end if;
  update public.profiles
     set customer_id = coalesce(customer_id, p_customer_id)
   where id = auth.uid();
end;
$$;

-- Deliberately NOT granted to authenticated: the create-order function calls it
-- with service_role. Left here as the one supported way the column changes.
revoke all on function app.link_customer_record(text) from anon, authenticated;

-- --------------------------------------------------------------- new users --

-- A profile row for every new non-anonymous account, so the customer has
-- something to read on first sign-in. Anonymous users get nothing: they are the
-- console's demo guest, not a shopper.
create or replace function app.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((new.raw_app_meta_data ->> 'provider'), '') = 'anonymous'
     or coalesce(new.is_anonymous, false) then
    return new;
  end if;
  insert into public.profiles (id, display_name)
  values (new.id, nullif(split_part(coalesce(new.email, ''), '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_created_profile
after insert on auth.users
for each row execute function app.on_auth_user_created();
