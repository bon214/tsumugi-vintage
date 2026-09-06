-- Portfolio-only customer and order stories.
--
-- These rows are deliberately separate from profiles/orders and contain no
-- auth user IDs, deliverable email addresses, real phone numbers or real
-- addresses.  They exist only so the public, read-only console can demonstrate
-- customer and fulfilment workflows without exposing a real person's data.

alter table public.demo_customers
  add column if not exists detail jsonb not null default '{}'::jsonb;

alter table public.demo_orders
  add column if not exists customer_id text,
  add column if not exists detail jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'demo_orders_customer_id_fkey'
      and conrelid = 'public.demo_orders'::regclass
  ) then
    alter table public.demo_orders
      add constraint demo_orders_customer_id_fkey
      foreign key (customer_id) references public.demo_customers(id)
      on update cascade on delete set null;
  end if;
end
$$;

alter table public.demo_customers
  drop constraint if exists demo_customers_detail_object;
alter table public.demo_customers
  add constraint demo_customers_detail_object
  check (jsonb_typeof(detail) = 'object');

alter table public.demo_orders
  drop constraint if exists demo_orders_detail_object;
alter table public.demo_orders
  add constraint demo_orders_detail_object
  check (jsonb_typeof(detail) = 'object');

comment on column public.demo_customers.detail is
  'Synthetic portfolio profile fields only. Never copy real customer PII into this table.';
comment on column public.demo_orders.detail is
  'Synthetic portfolio order lines and display metadata only. Never copy real order data into this table.';

-- Keep the dataset read-only in the browser.  Authenticated staff and the
-- anonymous portfolio guest can select through the pre-existing RLS policies;
-- neither role receives INSERT, UPDATE or DELETE here.
revoke insert, update, delete on public.demo_customers, public.demo_orders
  from anon, authenticated;

insert into public.demo_customers
  (id, name, email, city, segment, orders, total_spent, registered, detail)
values
  (
    'DEMO-0001', '佐藤 春人（架空）', 'haruto.sato@example.invalid', '東京都',
    'VIP', 1, 28600, date '2026-05-12',
    jsonb_build_object(
      'kana', 'サトウ ハルト', 'phone', '000-0000-0001',
      'address', '〒000-0001 東京都架空区霧ヶ谷1-2-3', 'country', 'Japan',
      'status', 'Active', 'accountStatus', 'Active', 'engagement', 'Active',
      'tags', jsonb_build_array('High-value customer', 'Outerwear buyer', 'Newsletter subscriber'),
      'marketing', true,
      'notes', jsonb_build_array(jsonb_build_object(
        'id', 'demo-note-0001', 'author', 'TSUMUGI Studio',
        'at', '2026-08-29T10:30:00+09:00',
        'text', 'ポートフォリオ用の架空顧客です。実在人物・実在住所ではありません。'
      )),
      'activity', jsonb_build_array(
        jsonb_build_object('at', '2026-08-28T14:12:00+09:00', 'type', 'Purchase', 'text', 'DEMO-2026-0001 を購入'),
        jsonb_build_object('at', '2026-05-12T09:00:00+09:00', 'type', 'Account', 'text', '顧客登録')
      )
    )
  ),
  (
    'DEMO-0002', '高橋 美月（架空）', 'mizuki.takahashi@example.invalid', '京都府',
    'Standard', 1, 18700, date '2026-06-03',
    jsonb_build_object(
      'kana', 'タカハシ ミヅキ', 'phone', '000-0000-0002',
      'address', '〒000-0002 京都府架空市糸町4-5-6', 'country', 'Japan',
      'status', 'Active', 'accountStatus', 'Active', 'engagement', 'Active',
      'tags', jsonb_build_array('Newsletter subscriber'), 'marketing', true,
      'notes', '[]'::jsonb,
      'activity', jsonb_build_array(
        jsonb_build_object('at', '2026-08-24T11:05:00+09:00', 'type', 'Purchase', 'text', 'DEMO-2026-0002 を購入'),
        jsonb_build_object('at', '2026-06-03T18:20:00+09:00', 'type', 'Account', 'text', '顧客登録')
      )
    )
  ),
  (
    'DEMO-0003', '中村 蓮（架空）', 'ren.nakamura@example.invalid', '大阪府',
    'Standard', 1, 22000, date '2026-07-08',
    jsonb_build_object(
      'kana', 'ナカムラ レン', 'phone', '000-0000-0003',
      'address', '〒000-0003 大阪府架空市継町7-8-9', 'country', 'Japan',
      'status', 'Active', 'accountStatus', 'Active', 'engagement', 'Active',
      'tags', jsonb_build_array('Repeat customer'), 'marketing', false,
      'notes', '[]'::jsonb,
      'activity', jsonb_build_array(
        jsonb_build_object('at', '2026-08-17T16:42:00+09:00', 'type', 'Purchase', 'text', 'DEMO-2026-0003 を購入'),
        jsonb_build_object('at', '2026-07-08T12:10:00+09:00', 'type', 'Account', 'text', '顧客登録')
      )
    )
  ),
  (
    'DEMO-0004', '伊藤 葵（架空）', 'aoi.ito@example.invalid', '神奈川県',
    'Standard', 1, 24200, date '2026-07-20',
    jsonb_build_object(
      'kana', 'イトウ アオイ', 'phone', '000-0000-0004',
      'address', '〒000-0004 神奈川県架空市布浜2-4-8', 'country', 'Japan',
      'status', 'Active', 'accountStatus', 'Active', 'engagement', 'Active',
      'tags', jsonb_build_array('Newsletter subscriber'), 'marketing', true,
      'notes', '[]'::jsonb,
      'activity', jsonb_build_array(
        jsonb_build_object('at', '2026-08-09T13:18:00+09:00', 'type', 'Purchase', 'text', 'DEMO-2026-0004 を購入'),
        jsonb_build_object('at', '2026-07-20T15:00:00+09:00', 'type', 'Account', 'text', '顧客登録')
      )
    )
  ),
  (
    'DEMO-0005', '山本 凛（架空）', 'rin.yamamoto@example.invalid', '福岡県',
    'Standard', 1, 17600, date '2026-07-24',
    jsonb_build_object(
      'kana', 'ヤマモト リン', 'phone', '000-0000-0005',
      'address', '〒000-0005 福岡県架空市余白町3-6-9', 'country', 'Japan',
      'status', 'Active', 'accountStatus', 'Active', 'engagement', 'Dormant',
      'tags', jsonb_build_array(), 'marketing', false,
      'notes', '[]'::jsonb,
      'activity', jsonb_build_array(
        jsonb_build_object('at', '2026-07-30T10:24:00+09:00', 'type', 'Purchase', 'text', 'DEMO-2026-0005 を購入'),
        jsonb_build_object('at', '2026-07-24T09:40:00+09:00', 'type', 'Account', 'text', '顧客登録')
      )
    )
  )
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  city = excluded.city,
  segment = excluded.segment,
  orders = excluded.orders,
  total_spent = excluded.total_spent,
  registered = excluded.registered,
  detail = excluded.detail;
insert into public.demo_orders
  (number, date, customer_name, contact_email, item_count, total,
   payment_status, fulfilment_status, delivery_method, customer_id, detail)
values
  (
    'DEMO-2026-0001', date '2026-08-28', '佐藤 春人（架空）',
    'haruto.sato@example.invalid', 1, 28600, 'paid', 'delivered',
    'Standard shipping', 'DEMO-0001',
    jsonb_build_object(
      'phone', '000-0000-0001',
      'shipping', jsonb_build_object('name', '佐藤 春人（架空）', 'postalCode', '000-0001', 'prefecture', '東京都', 'city', '架空区霧ヶ谷', 'address', '1-2-3'),
      'subtotal', 28600, 'shippingFee', 0, 'paymentMethod', 'Demo card •••• 4242',
      'tracking', 'DEMO-TRACK-0001',
      'items', jsonb_build_array(jsonb_build_object('sku', 'TSU-ARC-013', 'name', 'Faded Black Moleskin Work Jacket', 'brand', 'Unlabelled French Workwear', 'price', 28600, 'qty', 1, 'thumb', 'https://bon214.github.io/tsumugi-vintage/uploads/production/product-faded-black-moleskin-jacket.jpg')),
      'notes', jsonb_build_array(),
      'history', jsonb_build_array(
        jsonb_build_object('at', '2026-08-30T15:20:00+09:00', 'who', 'TSUMUGI Studio', 'role', 'owner', 'text', '配送完了'),
        jsonb_build_object('at', '2026-08-28T14:12:00+09:00', 'who', 'storefront', 'role', 'customer', 'text', '注文を受け付けました')
      )
    )
  ),
  (
    'DEMO-2026-0002', date '2026-08-24', '高橋 美月（架空）',
    'mizuki.takahashi@example.invalid', 1, 18700, 'paid', 'delivered',
    'Standard shipping', 'DEMO-0002',
    jsonb_build_object(
      'phone', '000-0000-0002',
      'shipping', jsonb_build_object('name', '高橋 美月（架空）', 'postalCode', '000-0002', 'prefecture', '京都府', 'city', '架空市糸町', 'address', '4-5-6'),
      'subtotal', 18700, 'shippingFee', 0, 'paymentMethod', 'Demo card •••• 4242',
      'tracking', 'DEMO-TRACK-0002',
      'items', jsonb_build_array(jsonb_build_object('sku', 'TSU-ARC-014', 'name', 'Burgundy Raglan Sweatshirt', 'brand', 'Unlabelled Sportswear', 'price', 18700, 'qty', 1, 'thumb', 'https://bon214.github.io/tsumugi-vintage/uploads/production/product-burgundy-raglan-sweat.jpg')),
      'notes', jsonb_build_array(),
      'history', jsonb_build_array(
        jsonb_build_object('at', '2026-08-27T12:40:00+09:00', 'who', 'TSUMUGI Studio', 'role', 'owner', 'text', '配送完了'),
        jsonb_build_object('at', '2026-08-24T11:05:00+09:00', 'who', 'storefront', 'role', 'customer', 'text', '注文を受け付けました')
      )
    )
  ),
  (
    'DEMO-2026-0003', date '2026-08-17', '中村 蓮（架空）',
    'ren.nakamura@example.invalid', 1, 22000, 'paid', 'shipped',
    'Express shipping', 'DEMO-0003',
    jsonb_build_object(
      'phone', '000-0000-0003',
      'shipping', jsonb_build_object('name', '中村 蓮（架空）', 'postalCode', '000-0003', 'prefecture', '大阪府', 'city', '架空市継町', 'address', '7-8-9'),
      'subtotal', 22000, 'shippingFee', 0, 'paymentMethod', 'Demo card •••• 4242',
      'tracking', 'DEMO-TRACK-0003',
      'items', jsonb_build_array(jsonb_build_object('sku', 'TSU-ARC-015', 'name', 'Brown Herringbone Wool Trousers', 'brand', 'Unlabelled Tailoring', 'price', 22000, 'qty', 1, 'thumb', 'https://bon214.github.io/tsumugi-vintage/uploads/production/product-brown-herringbone-trousers.jpg')),
      'notes', jsonb_build_array(),
      'history', jsonb_build_array(
        jsonb_build_object('at', '2026-08-18T10:15:00+09:00', 'who', 'TSUMUGI Studio', 'role', 'owner', 'text', '発送済み'),
        jsonb_build_object('at', '2026-08-17T16:42:00+09:00', 'who', 'storefront', 'role', 'customer', 'text', '注文を受け付けました')
      )
    )
  ),
  (
    'DEMO-2026-0004', date '2026-08-09', '伊藤 葵（架空）',
    'aoi.ito@example.invalid', 1, 24200, 'paid', 'preparing',
    'Standard shipping', 'DEMO-0004',
    jsonb_build_object(
      'phone', '000-0000-0004',
      'shipping', jsonb_build_object('name', '伊藤 葵（架空）', 'postalCode', '000-0004', 'prefecture', '神奈川県', 'city', '架空市布浜', 'address', '2-4-8'),
      'subtotal', 24200, 'shippingFee', 0, 'paymentMethod', 'Demo card •••• 4242',
      'tracking', '',
      'items', jsonb_build_array(jsonb_build_object('sku', 'TSU-ARC-016', 'name', 'Oatmeal Fisherman Cardigan', 'brand', 'Unlabelled Hand Knit', 'price', 24200, 'qty', 1, 'thumb', 'https://bon214.github.io/tsumugi-vintage/uploads/production/product-oatmeal-fisherman-cardigan.jpg')),
      'notes', jsonb_build_array(jsonb_build_object('id', 'demo-order-note-0004', 'author', 'TSUMUGI Studio', 'at', '2026-08-09T13:40:00+09:00', 'text', 'ポートフォリオ用の架空注文です。')),
      'history', jsonb_build_array(
        jsonb_build_object('at', '2026-08-09T14:00:00+09:00', 'who', 'TSUMUGI Studio', 'role', 'owner', 'text', '出荷準備を開始'),
        jsonb_build_object('at', '2026-08-09T13:18:00+09:00', 'who', 'storefront', 'role', 'customer', 'text', '注文を受け付けました')
      )
    )
  ),
  (
    'DEMO-2026-0005', date '2026-07-30', '山本 凛（架空）',
    'rin.yamamoto@example.invalid', 1, 17600, 'paid', 'delivered',
    'Standard shipping', 'DEMO-0005',
    jsonb_build_object(
      'phone', '000-0000-0005',
      'shipping', jsonb_build_object('name', '山本 凛（架空）', 'postalCode', '000-0005', 'prefecture', '福岡県', 'city', '架空市余白町', 'address', '3-6-9'),
      'subtotal', 17600, 'shippingFee', 0, 'paymentMethod', 'Demo card •••• 4242',
      'tracking', 'DEMO-TRACK-0005',
      'items', jsonb_build_array(jsonb_build_object('sku', 'TSU-ARC-017', 'name', 'Sage Cotton Pullover Shirt', 'brand', 'Unlabelled', 'price', 17600, 'qty', 1, 'thumb', 'https://bon214.github.io/tsumugi-vintage/uploads/production/product-sage-pullover-shirt.jpg')),
      'notes', jsonb_build_array(),
      'history', jsonb_build_array(
        jsonb_build_object('at', '2026-08-02T09:30:00+09:00', 'who', 'TSUMUGI Studio', 'role', 'owner', 'text', '配送完了'),
        jsonb_build_object('at', '2026-07-30T10:24:00+09:00', 'who', 'storefront', 'role', 'customer', 'text', '注文を受け付けました')
      )
    )
  )
on conflict (number) do update set
  date = excluded.date,
  customer_name = excluded.customer_name,
  contact_email = excluded.contact_email,
  item_count = excluded.item_count,
  total = excluded.total,
  payment_status = excluded.payment_status,
  fulfilment_status = excluded.fulfilment_status,
  delivery_method = excluded.delivery_method,
  customer_id = excluded.customer_id,
  detail = excluded.detail;
