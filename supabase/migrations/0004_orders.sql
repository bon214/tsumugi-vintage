-- 0004_orders.sql
-- TSUMUGI · orders, order lines, and the XOR that makes ownership answerable.
--
-- THREE FIXES
--
--   1. Ownership XOR. The previous constraint allowed a row with BOTH user_id
--      and guest_email set, which makes "whose order is this?" ambiguous — and
--      an ambiguous owner is an unenforceable policy. num_nonnulls() = 1 makes
--      exactly one of them present.
--
--   2. No client-set money or state. subtotal, total and payment_status are not
--      granted to any API role. They are written by the create-order function
--      (service_role) and by the payment webhook. A browser cannot name them in
--      an insert or an update, so it cannot declare its own order paid.
--
--   3. No guest SELECT. A guest never reads back from this table. Completion is
--      served once, from the create-order response, and the order number alone
--      unlocks nothing. Guessing TSU-2026-1531 yields no row and no email.

create type public.payment_status   as enum ('pending', 'authorized', 'paid', 'refunded', 'failed');
create type public.fulfilment_status as enum ('unfulfilled', 'preparing', 'shipped', 'delivered', 'cancelled');

create sequence public.order_number_seq start with 1500;

create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  -- Server-generated, gap-tolerant, never supplied by a client.
  number         text not null unique
                   default 'TSU-' || to_char(now(), 'YYYY') || '-'
                        || lpad(nextval('public.order_number_seq')::text, 4, '0'),

  user_id        uuid references auth.users (id) on delete set null,
  guest_email    extensions.citext,
  customer_id    text,

  -- Contact and delivery details, supplied by the buyer, length-bounded.
  contact_email  extensions.citext not null,
  contact_phone  text,
  ship_name      text not null,
  ship_postal    text,
  ship_prefecture text,
  ship_city      text,
  ship_address   text,
  delivery_method text not null default 'standard',

  -- Money, computed server-side from the catalogue. Never client-supplied.
  subtotal       integer not null check (subtotal >= 0),
  shipping_fee   integer not null default 0 check (shipping_fee >= 0),
  total          integer not null check (total >= 0),
  currency       char(3) not null default 'JPY',

  payment_status    public.payment_status    not null default 'pending',
  fulfilment_status public.fulfilment_status not null default 'unfulfilled',
  payment_reference text,

  tracking       text,
  placed_at      timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- (1) Exactly one owner. An account order carries user_id; a guest order
  -- carries guest_email. Never both, never neither.
  constraint orders_owner_xor check (num_nonnulls(user_id, guest_email) = 1),
  constraint orders_total_matches check (total = subtotal + shipping_fee),
  constraint orders_email_len check (char_length(contact_email::text) <= 254),
  constraint orders_ship_name_len check (char_length(ship_name) between 1 and 120)
);

create index orders_user_idx  on public.orders (user_id) where user_id is not null;
create index orders_guest_idx on public.orders (guest_email) where guest_email is not null;

create trigger orders_touch before update on public.orders
for each row execute function app.touch_updated_at();

create table public.order_items (
  id          bigserial primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  product_id  bigint not null,
  -- Snapshot of what was sold, at the price the server computed.
  name        text not null,
  brand       text,
  unit_price  integer not null check (unit_price >= 0),
  qty         integer not null check (qty >= 1 and qty <= 5),
  thumb       text,
  constraint order_items_unique_line unique (order_id, product_id)
);

create index order_items_order_idx on public.order_items (order_id);

alter table public.orders      enable row level security;
alter table public.orders      force  row level security;
alter table public.order_items enable row level security;
alter table public.order_items force  row level security;

-- ------------------------------------------------------------------ grants --

revoke all on table public.orders, public.order_items from anon, authenticated;
revoke all on sequence public.order_number_seq from anon, authenticated;

-- Customers read a projection of their own orders. The column list IS the
-- projection: internal notes, payment_reference and the staff history are not
-- selectable by anyone but staff.
grant select (id, number, user_id, customer_id, contact_email, contact_phone,
              ship_name, ship_postal, ship_prefecture, ship_city, ship_address,
              delivery_method, subtotal, shipping_fee, total, currency,
              payment_status, fulfilment_status, tracking, placed_at, updated_at)
  on public.orders to authenticated;

grant select (id, order_id, product_id, name, brand, unit_price, qty, thumb)
  on public.order_items to authenticated;

-- No INSERT grant for anon or authenticated on either table. Orders are created
-- exclusively by supabase/functions/create-order (service_role), which
-- revalidates price, status and stock inside one transaction.
--
-- If direct insert is ever wanted for signed-in customers, the ONLY safe shape
-- is below — note that user_id is forced to auth.uid() rather than trusted, and
-- money columns are still ungranted:
--
--   grant insert (contact_email, contact_phone, ship_name, ship_postal,
--                 ship_prefecture, ship_city, ship_address, delivery_method,
--                 user_id) on public.orders to authenticated;
--   create policy orders_insert_own on public.orders for insert
--     to authenticated
--     with check (app.is_account() and user_id = auth.uid() and guest_email is null);
--
-- A guest insert policy is NOT offered: `to anon with check (user_id is null)`
-- would let anyone write unlimited rows into the orders table.

-- ---------------------------------------------------------------- policies --

-- Subject 2 (customer): own orders, by uid. Not by email — an email typed at
-- checkout is not evidence of ownership, and matching on it would hand every
-- guest order to whoever signs up with that address later.
create policy orders_select_own
  on public.orders for select
  to authenticated
  using (app.is_account() and user_id = auth.uid());

create policy order_items_select_own
  on public.order_items for select
  to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and app.is_account()
      and o.user_id = auth.uid()
  ));

-- Subject 3 (staff): support and above may read every order; only support and
-- above may move fulfilment. payment_status is absent from the update grant
-- below on purpose — see 0007_payments.sql.
create policy orders_select_staff
  on public.orders for select
  to authenticated
  using (app.has_role('support'));

create policy order_items_select_staff
  on public.order_items for select
  to authenticated
  using (app.has_role('support'));

grant update (fulfilment_status, tracking) on public.orders to authenticated;

create policy orders_update_staff
  on public.orders for update
  to authenticated
  using (app.has_role('support'))
  with check (app.has_role('support'));

-- Subject 1 (anon) and subject 4 (anonymous guest): no policy of any kind.
-- Both are denied by default. The demo console reads the seeded demo dataset
-- instead (0006_demo_dataset.sql), never these tables.
--
-- PERMISSIVE-POLICY NOTE. Policies of the same command OR together, so a single
-- careless policy widens everything before it. Every policy above therefore
-- carries its own subject test (app.is_account() or app.has_role(...)) rather
-- than relying on `to authenticated` to narrow it — an anonymous session
-- satisfies `to authenticated` and would otherwise slip through the OR.

-- ------------------------------------------------- customer-facing view --

-- What the storefront account page reads. A view, so the projection is one
-- object rather than a column list repeated in application code, and
-- security_invoker keeps the caller's RLS in force.
create view public.my_orders
with (security_invoker = true)
as
select o.id, o.number, o.placed_at::date as date,
       o.subtotal, o.shipping_fee, o.total, o.currency,
       o.payment_status, o.fulfilment_status, o.delivery_method, o.tracking,
       o.ship_name, o.ship_postal, o.ship_prefecture, o.ship_city, o.ship_address,
       o.contact_email
from public.orders o
where o.user_id = auth.uid() and app.is_account();

grant select on public.my_orders to authenticated;
