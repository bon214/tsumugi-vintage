-- Let the public portfolio console read only the isolated synthetic dataset.
--
-- The guest UI now uses a tab-scoped local preview session instead of creating
-- an auth.users row for every portfolio visitor. PostgREST therefore evaluates
-- these requests as `anon`. Real profiles, addresses, orders and order_items
-- keep their existing RLS policies and are not granted to anon.

grant select on public.demo_customers, public.demo_orders to anon;

drop policy if exists demo_customers_select_public_portfolio
  on public.demo_customers;
create policy demo_customers_select_public_portfolio
  on public.demo_customers
  for select
  to anon
  using (true);

drop policy if exists demo_orders_select_public_portfolio
  on public.demo_orders;
create policy demo_orders_select_public_portfolio
  on public.demo_orders
  for select
  to anon
  using (true);

-- Being publicly readable must never imply browser-side mutation.
revoke insert, update, delete on public.demo_customers, public.demo_orders
  from anon, authenticated;
