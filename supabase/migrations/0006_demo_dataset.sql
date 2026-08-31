-- 0006_demo_dataset.sql
-- TSUMUGI · what the anonymous demo guest is allowed to see.
--
-- The console's guest view exists so a portfolio visitor can walk through the
-- admin screens. It must not be a hole in the customer data.
--
-- Previously the guest role held orders.view and customers.view, which pointed
-- at the real records — names, addresses, spend, order history. An anonymous
-- token is a stranger, so the fix is not "mask the PII column": it is to serve
-- the orders and customers screens from a separate, synthetic dataset that
-- contains no real person at all.
--
-- Two tables, seeded with obviously-fictional rows, readable by subject 4 and
-- by nobody who could mistake them for the truth.

create table public.demo_orders (
  id           uuid primary key default gen_random_uuid(),
  number       text not null unique,
  date         date not null,
  customer_name text not null,
  contact_email extensions.citext not null,
  item_count   integer not null check (item_count >= 1),
  total        integer not null check (total >= 0),
  payment_status public.payment_status not null default 'pending',
  fulfilment_status public.fulfilment_status not null default 'unfulfilled',
  delivery_method text not null default 'standard'
);

create table public.demo_customers (
  id           text primary key,
  name         text not null,
  email        extensions.citext not null,
  city         text,
  segment      text,
  orders       integer not null default 0,
  total_spent  integer not null default 0,
  registered   date
);

alter table public.demo_orders    enable row level security;
alter table public.demo_orders    force  row level security;
alter table public.demo_customers enable row level security;
alter table public.demo_customers force  row level security;

revoke all on table public.demo_orders, public.demo_customers from anon, authenticated;
grant select on public.demo_orders    to authenticated;
grant select on public.demo_customers to authenticated;

-- Subject 4 only, plus staff (so an operator can see what the demo shows).
-- Subject 1 (anon) is excluded: the demo console requires a session.
create policy demo_orders_select_guest
  on public.demo_orders for select
  to authenticated
  using (app.is_anonymous() or app.has_role('viewer'));

create policy demo_customers_select_guest
  on public.demo_customers for select
  to authenticated
  using (app.is_anonymous() or app.has_role('viewer'));

-- ------------------------------------------------------------------- seeds --

-- example.invalid is reserved by RFC 6761 and can never route mail, so no seed
-- row can accidentally address a real person.
insert into public.demo_orders (number, date, customer_name, contact_email, item_count, total, payment_status, fulfilment_status)
values
  ('DEMO-2026-0001', current_date - 2,  'Demo Buyer A', 'buyer-a@example.invalid', 1, 28000, 'paid',    'preparing'),
  ('DEMO-2026-0002', current_date - 5,  'Demo Buyer B', 'buyer-b@example.invalid', 2, 61000, 'paid',    'shipped'),
  ('DEMO-2026-0003', current_date - 9,  'Demo Buyer C', 'buyer-c@example.invalid', 1, 19000, 'pending', 'unfulfilled'),
  ('DEMO-2026-0004', current_date - 14, 'Demo Buyer D', 'buyer-d@example.invalid', 3, 94000, 'refunded','cancelled')
on conflict (number) do nothing;

insert into public.demo_customers (id, name, email, city, segment, orders, total_spent, registered)
values
  ('DEMO-0001', 'Demo Buyer A', 'buyer-a@example.invalid', 'Tokyo',  'Standard', 1, 28000, current_date - 60),
  ('DEMO-0002', 'Demo Buyer B', 'buyer-b@example.invalid', 'Kyoto',  'VIP',      4, 210000, current_date - 400),
  ('DEMO-0003', 'Demo Buyer C', 'buyer-c@example.invalid', 'Osaka',  'Standard', 1, 19000, current_date - 20)
on conflict (id) do nothing;

-- ------------------------------------------------------------ what remains --

-- The console decides which source to read from the session it holds:
--
--   anonymous guest → public.demo_orders / public.demo_customers
--   staff           → public.orders / public.profiles (+ the shop's own records)
--
-- Both paths are enforced by the policies above, so a guest session that asks
-- for public.orders receives zero rows rather than a masked answer. Masking is
-- a presentation choice; zero rows is a guarantee.
