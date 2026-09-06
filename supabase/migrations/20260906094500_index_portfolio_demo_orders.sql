-- Covers the synthetic customer/order relationship used by the admin detail
-- screen and by the ON DELETE SET NULL foreign-key check.
create index if not exists demo_orders_customer_id_idx
  on public.demo_orders (customer_id);
