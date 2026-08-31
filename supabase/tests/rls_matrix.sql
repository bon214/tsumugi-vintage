-- supabase/tests/rls_matrix.sql
-- TSUMUGI · the RLS test I could not run here, written so a human can.
--
-- WHY THIS FILE EXISTS AND IS NOT A REPORT
-- The environment this project is edited in has no Postgres and no Supabase
-- CLI, so the migrations in supabase/migrations/ are UNVERIFIED SQL. They are
-- written against documented Supabase behaviour and reviewed by eye; that is
-- not the same as applied and tested, and this project does not claim it is.
--
-- HOW TO RUN
--   supabase start                       # local stack, Docker required
--   supabase db reset                    # applies migrations/0001…0010 in order
--   psql "$(supabase status -o json | jq -r .DB_URL)" -f supabase/tests/rls_matrix.sql
--
-- EXPECTED RESULT
--   Every assertion prints its own name and PASS. The first failure raises and
--   aborts the transaction — a run that reaches the final NOTICE is a pass.
--
-- WHAT IT COVERS
--   Five subjects × the tables that matter, plus the revocation invariant that
--   cannot be tested from a browser at all.

begin;

set client_min_messages to notice;

-- --------------------------------------------------------------- harness --

create or replace function pg_temp.ok(p_desc text, p_cond boolean) returns void
language plpgsql as $$
begin
  if p_cond then
    raise notice 'PASS  %', p_desc;
  else
    raise exception 'FAIL  %', p_desc;
  end if;
end;
$$;

-- Runs a statement as a subject and reports whether it was permitted.
-- Returns true when the statement succeeded, false when RLS or a grant refused.
create or replace function pg_temp.permitted(p_sql text) returns boolean
language plpgsql as $$
begin
  execute p_sql;
  return true;
exception
  when insufficient_privilege then return false;
  when others then
    -- A zero-row SELECT is a refusal expressed as emptiness, not an error, so
    -- callers test row counts for reads and this for writes.
    if sqlstate in ('42501', '42P01') then return false; end if;
    raise;
end;
$$;

-- Counts rows visible to the current subject.
create or replace function pg_temp.visible(p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into n;
  return n;
exception when insufficient_privilege then return -1;
end;
$$;

-- Impersonation. Supabase resolves auth.uid() and auth.jwt() from the request
-- JWT claims, which are carried in the `request.jwt.claims` GUC.
create or replace function pg_temp.become(
  p_role text, p_uid uuid default null, p_anonymous boolean default false
) returns void
language plpgsql as $$
begin
  perform set_config('role', p_role, true);
  if p_uid is null then
    perform set_config('request.jwt.claims', '', true);
  else
    perform set_config('request.jwt.claims',
      json_build_object(
        'sub', p_uid::text,
        'role', p_role,
        'is_anonymous', p_anonymous,
        'aud', 'authenticated'
      )::text, true);
  end if;
end;
$$;

-- ----------------------------------------------------------------- fixtures --

set role postgres;

-- Four users. Inserted directly because there is no auth API in a SQL test.
insert into auth.users (id, email, raw_app_meta_data, is_anonymous, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'customer@example.invalid', '{}'::jsonb, false, 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'staff@example.invalid',    '{}'::jsonb, false, 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', null,                      '{"provider":"anonymous"}'::jsonb, true, 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'exstaff@example.invalid',  '{}'::jsonb, false, 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.staff_roles (user_id, role, note) values
  ('22222222-2222-2222-2222-222222222222', 'manager', 'test staff'),
  ('44444444-4444-4444-4444-444444444444', 'manager', 'to be revoked')
on conflict (user_id) do update set role = excluded.role, revoked_at = null;

insert into public.products (id, name, brand, price, stock, status)
values (9001, 'Test Published', 'TESTBRAND', 20000, 1, 'published'),
       (9002, 'Test Draft',     'TESTBRAND', 20000, 1, 'draft')
on conflict (id) do update set status = excluded.status, stock = excluded.stock;

insert into public.news (id, title, slug, status, body)
values (9101, 'Live', 'test-live', 'published', '<p>ok</p>'),
       (9102, 'Draft', 'test-draft', 'draft', '<p>ok</p>')
on conflict (id) do update set status = excluded.status;

insert into public.profiles (id, display_name) values
  ('11111111-1111-1111-1111-111111111111', 'Test Customer')
on conflict (id) do nothing;

-- One order per owner kind, exercising the XOR.
insert into public.orders (
  id, user_id, guest_email, contact_email, ship_name,
  subtotal, shipping_fee, total
) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', null,
   'customer@example.invalid', 'Test Customer', 20000, 0, 20000),
  ('aaaaaaaa-0000-0000-0000-000000000002', null, 'guest@example.invalid',
   'guest@example.invalid', 'Test Guest', 20000, 0, 20000)
on conflict (id) do nothing;

-- ---------------------------------------------------- constraint assertions --

select pg_temp.ok('orders: XOR rejects both owners set',
  not pg_temp.permitted($$
    insert into public.orders (user_id, guest_email, contact_email, ship_name, subtotal, shipping_fee, total)
    values ('11111111-1111-1111-1111-111111111111', 'both@example.invalid',
            'both@example.invalid', 'Both', 1, 0, 1)$$));

select pg_temp.ok('orders: XOR rejects neither owner set',
  not pg_temp.permitted($$
    insert into public.orders (user_id, guest_email, contact_email, ship_name, subtotal, shipping_fee, total)
    values (null, null, 'none@example.invalid', 'None', 1, 0, 1)$$));

select pg_temp.ok('orders: total must equal subtotal + fee',
  not pg_temp.permitted($$
    insert into public.orders (user_id, contact_email, ship_name, subtotal, shipping_fee, total)
    values ('11111111-1111-1111-1111-111111111111', 'x@example.invalid', 'X', 100, 0, 1)$$));

select pg_temp.ok('order_items: qty must be 1..5',
  not pg_temp.permitted($$
    insert into public.order_items (order_id, product_id, name, unit_price, qty)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 9001, 'x', 100, 0)$$));

-- ============================================================ subject 1: anon

select pg_temp.become('anon');

select pg_temp.ok('anon: sees published products',
  pg_temp.visible($$select 1 from public.products where id = 9001$$) = 1);
select pg_temp.ok('anon: cannot see draft products',
  pg_temp.visible($$select 1 from public.products where id = 9002$$) = 0);
select pg_temp.ok('anon: sees published news',
  pg_temp.visible($$select 1 from public.news where id = 9101$$) = 1);
select pg_temp.ok('anon: cannot see draft news',
  pg_temp.visible($$select 1 from public.news where id = 9102$$) = 0);
select pg_temp.ok('anon: cannot read profiles',
  pg_temp.visible($$select 1 from public.profiles$$) <= 0);
select pg_temp.ok('anon: cannot read orders',
  pg_temp.visible($$select 1 from public.orders$$) <= 0);
select pg_temp.ok('anon: cannot read staff_roles',
  pg_temp.visible($$select 1 from public.staff_roles$$) <= 0);
select pg_temp.ok('anon: cannot read rate_limits',
  pg_temp.visible($$select 1 from public.rate_limits$$) <= 0);
select pg_temp.ok('anon: cannot insert a product',
  not pg_temp.permitted($$insert into public.products (name, price) values ('x', 1)$$));
select pg_temp.ok('anon: cannot insert an order',
  not pg_temp.permitted($$insert into public.orders (guest_email, contact_email, ship_name, subtotal, shipping_fee, total)
    values ('a@example.invalid','a@example.invalid','A',1,0,1)$$));
select pg_temp.ok('anon: cannot call create_order',
  not pg_temp.permitted($$select public.create_order(null,'a@example.invalid','a@example.invalid',null,'A',null,null,null,null,'standard','[]'::jsonb)$$));
select pg_temp.ok('anon: cannot call apply_payment_event',
  not pg_temp.permitted($$select app.apply_payment_event('aaaaaaaa-0000-0000-0000-000000000001','x','y','paid',20000,null)$$));
select pg_temp.ok('anon: redeem_receipt with a bogus token returns nothing',
  pg_temp.visible($$select 1 from app.redeem_receipt('not-a-real-token')$$) = 0);

reset role;

-- ======================================== subject 4: anonymous authenticated

select pg_temp.become('authenticated', '33333333-3333-3333-3333-333333333333', true);

select pg_temp.ok('anon-auth: is_anonymous() true',
  (select app.is_anonymous()) is true);
select pg_temp.ok('anon-auth: is_account() false',
  (select app.is_account()) is false);
select pg_temp.ok('anon-auth: is_staff() false',
  (select app.is_staff()) is false);
select pg_temp.ok('anon-auth: sees published products',
  pg_temp.visible($$select 1 from public.products where id = 9001$$) = 1);
select pg_temp.ok('anon-auth: CANNOT read real orders',
  pg_temp.visible($$select 1 from public.orders$$) = 0);
select pg_temp.ok('anon-auth: CANNOT read profiles (PII)',
  pg_temp.visible($$select 1 from public.profiles$$) = 0);
select pg_temp.ok('anon-auth: CANNOT read order_items',
  pg_temp.visible($$select 1 from public.order_items$$) = 0);
select pg_temp.ok('anon-auth: CAN read the demo dataset',
  pg_temp.visible($$select 1 from public.demo_orders$$) > 0);
select pg_temp.ok('anon-auth: cannot write a product',
  not pg_temp.permitted($$insert into public.products (name, price) values ('x', 1)$$));
select pg_temp.ok('anon-auth: cannot write news',
  not pg_temp.permitted($$insert into public.news (title, slug) values ('x','x-anon')$$));
select pg_temp.ok('anon-auth: cannot insert a wishlist row',
  not pg_temp.permitted($$insert into public.wishlists (user_id, product_id)
    values ('33333333-3333-3333-3333-333333333333', 9001)$$));

reset role;

-- ============================================= subject 2: customer

select pg_temp.become('authenticated', '11111111-1111-1111-1111-111111111111', false);

select pg_temp.ok('customer: is_account() true', (select app.is_account()) is true);
select pg_temp.ok('customer: is_staff() false',  (select app.is_staff()) is false);
select pg_temp.ok('customer: sees own profile',
  pg_temp.visible($$select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111'$$) = 1);
select pg_temp.ok('customer: cannot see another profile',
  pg_temp.visible($$select 1 from public.profiles where id <> '11111111-1111-1111-1111-111111111111'$$) = 0);
select pg_temp.ok('customer: may update display_name',
  pg_temp.permitted($$update public.profiles set display_name = 'Renamed' where id = '11111111-1111-1111-1111-111111111111'$$));
-- The two locks on escalation: column grant, then policy.
select pg_temp.ok('customer: CANNOT update customer_id',
  not pg_temp.permitted($$update public.profiles set customer_id = 'CUS-9999' where id = '11111111-1111-1111-1111-111111111111'$$));
select pg_temp.ok('customer: profiles has no role column to write',
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role') = 0);
select pg_temp.ok('customer: cannot grant itself staff',
  not pg_temp.permitted($$insert into public.staff_roles (user_id, role)
    values ('11111111-1111-1111-1111-111111111111','owner')$$));
select pg_temp.ok('customer: sees own order',
  pg_temp.visible($$select 1 from public.orders where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$) = 1);
select pg_temp.ok('customer: cannot see the guest order',
  pg_temp.visible($$select 1 from public.orders where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$) = 0);
select pg_temp.ok('customer: my_orders view shows exactly its own',
  pg_temp.visible($$select 1 from public.my_orders$$) = 1);
select pg_temp.ok('customer: cannot update payment_status',
  not pg_temp.permitted($$update public.orders set payment_status = 'paid'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$));
select pg_temp.ok('customer: cannot update its own order total',
  not pg_temp.permitted($$update public.orders set total = 1
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$));
select pg_temp.ok('customer: cannot write a product',
  not pg_temp.permitted($$insert into public.products (name, price) values ('x', 1)$$));
select pg_temp.ok('customer: may add to its own wishlist',
  pg_temp.permitted($$insert into public.wishlists (user_id, product_id)
    values ('11111111-1111-1111-1111-111111111111', 9001)$$));
select pg_temp.ok('customer: cannot add to another wishlist',
  not pg_temp.permitted($$insert into public.wishlists (user_id, product_id)
    values ('22222222-2222-2222-2222-222222222222', 9001)$$));
select pg_temp.ok('customer: cannot read contact messages',
  pg_temp.visible($$select 1 from public.contact_messages$$) = 0);

reset role;

-- ================================================ subject 3: staff (manager)

select pg_temp.become('authenticated', '22222222-2222-2222-2222-222222222222', false);

select pg_temp.ok('staff: is_staff() true', (select app.is_staff()) is true);
select pg_temp.ok('staff: staff_role() is manager', (select app.staff_role()) = 'manager');
select pg_temp.ok('staff: has_role(editor) true — ladder is ordered',
  (select app.has_role('editor')) is true);
select pg_temp.ok('staff: has_role(owner) false',
  (select app.has_role('owner')) is false);
select pg_temp.ok('staff: sees draft products',
  pg_temp.visible($$select 1 from public.products where id = 9002$$) = 1);
select pg_temp.ok('staff: sees all orders',
  pg_temp.visible($$select 1 from public.orders$$) >= 2);
select pg_temp.ok('staff: may update fulfilment',
  pg_temp.permitted($$update public.orders set fulfilment_status = 'shipped'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$));
select pg_temp.ok('staff: may NOT update payment_status',
  not pg_temp.permitted($$update public.orders set payment_status = 'paid'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$));
select pg_temp.ok('staff: may write news',
  pg_temp.permitted($$insert into public.news (title, slug) values ('Staff wrote this','staff-wrote-this')$$));
select pg_temp.ok('staff: cannot read staff_roles (owner only)',
  pg_temp.visible($$select 1 from public.staff_roles$$) <= 0);
select pg_temp.ok('staff: cannot grant a role',
  not pg_temp.permitted($$insert into public.staff_roles (user_id, role)
    values ('11111111-1111-1111-1111-111111111111','owner')$$));
select pg_temp.ok('staff: cannot call create_order directly',
  not pg_temp.permitted($$select public.create_order(null,'a@example.invalid','a@example.invalid',null,'A',null,null,null,null,'standard','[]'::jsonb)$$));

reset role;

-- ============================ subject 5: revoked staff holding a stale JWT

-- The JWT still claims manager. This is exactly the one-hour window that a
-- claim-based check cannot close.
set role postgres;
select app.revoke_staff('44444444-4444-4444-4444-444444444444', false);
reset role;

do $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object(
      'sub', '44444444-4444-4444-4444-444444444444',
      'role', 'authenticated',
      'is_anonymous', false,
      -- the stale claim, verbatim
      'app_metadata', json_build_object('role', 'manager')
    )::text, true);
end;
$$;

select pg_temp.ok('ex-staff: JWT still carries the manager claim',
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');
select pg_temp.ok('ex-staff: app.staff_role() is NULL despite the claim',
  (select app.staff_role()) is null);
select pg_temp.ok('ex-staff: is_staff() false despite the claim',
  (select app.is_staff()) is false);
select pg_temp.ok('ex-staff: CANNOT write news',
  not pg_temp.permitted($$insert into public.news (title, slug) values ('x','ex-staff-news')$$));
select pg_temp.ok('ex-staff: CANNOT update an order',
  not pg_temp.permitted($$update public.orders set fulfilment_status = 'delivered'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$));
select pg_temp.ok('ex-staff: CANNOT see other customers'' orders',
  pg_temp.visible($$select 1 from public.orders$$) = 0);
select pg_temp.ok('ex-staff: CANNOT see draft products',
  pg_temp.visible($$select 1 from public.products where id = 9002$$) = 0);

reset role;

-- ------------------------------------------------------------ rate limiting --

set role postgres;

do $$
declare
  a record;
  i integer;
begin
  perform app.rate_limit_sweep(interval '0');
  for i in 1..3 loop
    select * into a from app.rate_limit_hit('test:bucket', 3, interval '1 minute', interval '1 minute');
    if not a.allowed then raise exception 'FAIL  rate limit refused hit % of 3', i; end if;
  end loop;
  select * into a from app.rate_limit_hit('test:bucket', 3, interval '1 minute', interval '1 minute');
  if a.allowed then raise exception 'FAIL  rate limit allowed a 4th hit past a limit of 3'; end if;
  if a.retry_after < 1 then raise exception 'FAIL  rate limit gave no retry_after'; end if;
  raise notice 'PASS  rate limit: 3 allowed, 4th refused with retry_after %', a.retry_after;
end;
$$;

reset role;

-- ------------------------------------------------------------------ receipts --

set role postgres;
do $$
declare
  tok text := encode(extensions.gen_random_bytes(32), 'hex');
  n integer;
begin
  insert into public.order_receipts (token_hash, order_id, expires_at)
  values (encode(extensions.digest(tok, 'sha256'), 'hex'),
          'aaaaaaaa-0000-0000-0000-000000000002', now() + interval '30 minutes');

  perform set_config('role', 'anon', true);
  select count(*) into n from app.redeem_receipt(tok);
  if n <> 1 then raise exception 'FAIL  receipt: first redemption returned % rows', n; end if;
  select count(*) into n from app.redeem_receipt(tok);
  if n <> 0 then raise exception 'FAIL  receipt: second redemption returned % rows (must be single use)', n; end if;
  raise notice 'PASS  receipt: single use — first redemption 1 row, second 0 rows';
  perform set_config('role', 'postgres', true);

  -- Expired token
  tok := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.order_receipts (token_hash, order_id, expires_at)
  values (encode(extensions.digest(tok, 'sha256'), 'hex'),
          'aaaaaaaa-0000-0000-0000-000000000002', now() - interval '1 minute');
  perform set_config('role', 'anon', true);
  select count(*) into n from app.redeem_receipt(tok);
  if n <> 0 then raise exception 'FAIL  receipt: expired token returned % rows', n; end if;
  raise notice 'PASS  receipt: expired token returns 0 rows';
  perform set_config('role', 'postgres', true);
end;
$$;
reset role;

-- --------------------------------------------------------------- oversell --

-- Two concurrent orders for a one-of-one piece. Serialised here (a single
-- session cannot truly race), so this proves the conditional UPDATE refuses the
-- second attempt; the concurrent case is proven by the same condition holding
-- under MVCC. For a real race, run two psql sessions with BEGIN and no COMMIT.
set role postgres;
do $$
declare
  r1 jsonb;
  failed boolean := false;
begin
  update public.products set stock = 1, status = 'published' where id = 9001;
  r1 := public.create_order(null, 'g1@example.invalid', 'g1@example.invalid', null, 'G One',
                            null, null, null, null, 'standard',
                            jsonb_build_array(jsonb_build_object('productId', 9001, 'qty', 1)));
  if r1 ->> 'number' is null then raise exception 'FAIL  first order did not return a number'; end if;
  if (select stock from public.products where id = 9001) <> 0 then
    raise exception 'FAIL  stock not decremented';
  end if;
  if (select status from public.products where id = 9001) <> 'soldout' then
    raise exception 'FAIL  zero stock did not become soldout';
  end if;
  begin
    perform public.create_order(null, 'g2@example.invalid', 'g2@example.invalid', null, 'G Two',
                                null, null, null, null, 'standard',
                                jsonb_build_array(jsonb_build_object('productId', 9001, 'qty', 1)));
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL  a sold-out piece was sold twice'; end if;
  if (select stock from public.products where id = 9001) < 0 then
    raise exception 'FAIL  stock went negative';
  end if;
  raise notice 'PASS  oversell: second order refused, stock 0, status soldout, never negative';
  raise notice 'PASS  order number generated server-side: %', r1 ->> 'number';
end;
$$;
reset role;

do $$
begin
  raise notice '--------------------------------------------------';
  raise notice 'ALL ASSERTIONS PASSED';
  raise notice '--------------------------------------------------';
end;
$$;

rollback;   -- the test leaves the database exactly as it found it
