-- 0008_create_order_rpc.sql
-- TSUMUGI · the transactional heart of checkout.
--
-- Called only by the create-order Edge Function (service_role). It re-reads
-- price, status and stock from the catalogue, computes the money, decrements
-- stock with a conditional UPDATE so simultaneous orders cannot oversell, and
-- returns the order number plus a one-shot receipt token.
--
-- Everything the client sent about money is absent from the signature. There is
-- no parameter for subtotal, total, payment status or order number, so there is
-- nothing to tamper with.

create or replace function public.create_order(
  p_user_id         uuid,
  p_guest_email     extensions.citext,
  p_contact_email   extensions.citext,
  p_contact_phone   text,
  p_ship_name       text,
  p_ship_postal     text,
  p_ship_prefecture text,
  p_ship_city       text,
  p_ship_address    text,
  p_delivery_method text,
  p_lines           jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  line       jsonb;
  v_product  public.products;
  v_qty      integer;
  v_updated  integer;
  v_subtotal integer := 0;
  v_fee      integer := 0;
  v_order    public.orders;
  v_token    text;
  v_count    integer := 0;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'empty_cart';
  end if;
  if jsonb_array_length(p_lines) > 20 then
    raise exception 'too_many_items';
  end if;
  -- Exactly one owner, matching the table's XOR constraint. Belt and braces:
  -- the caller is trusted code, and this is still checked.
  if num_nonnulls(p_user_id, p_guest_email) <> 1 then
    raise exception 'bad_owner';
  end if;

  create temporary table _lines (product_id bigint, qty integer, unit_price integer, name text, brand text, thumb text)
  on commit drop;

  for line in select * from jsonb_array_elements(p_lines) loop
    v_qty := (line ->> 'qty')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 5 then
      raise exception 'bad_qty';
    end if;

    -- Price and status from the catalogue, not from the request.
    select * into v_product
    from public.products
    where id = (line ->> 'productId')::bigint;

    if not found then raise exception 'unknown_product'; end if;
    if v_product.status <> 'published' then raise exception 'not_purchasable'; end if;
    if v_product.price is null or v_product.price < 0 then raise exception 'bad_price'; end if;
    if v_product.stock <= 0 then raise exception 'out_of_stock'; end if;

    -- The decrement IS the availability test. A concurrent order that took the
    -- last unit leaves stock < qty, no row matches, and this transaction fails
    -- rather than selling a piece twice.
    update public.products
       set stock = stock - v_qty,
           status = case when stock - v_qty = 0 then 'soldout'::public.product_status else status end
     where id = v_product.id
       and stock >= v_qty;

    get diagnostics v_updated = row_count;
    if v_updated = 0 then raise exception 'insufficient_stock'; end if;

    insert into _lines values (
      v_product.id, v_qty, v_product.price, v_product.name, v_product.brand,
      coalesce(v_product.images -> 0 ->> 'thumb', '')
    );
    v_subtotal := v_subtotal + (v_product.price * v_qty);
    v_count := v_count + 1;
  end loop;

  insert into public.orders (
    user_id, guest_email, contact_email, contact_phone,
    ship_name, ship_postal, ship_prefecture, ship_city, ship_address,
    delivery_method, subtotal, shipping_fee, total, payment_status, fulfilment_status
  ) values (
    p_user_id, p_guest_email, p_contact_email, left(coalesce(p_contact_phone, ''), 32),
    left(p_ship_name, 120), left(coalesce(p_ship_postal, ''), 16),
    left(coalesce(p_ship_prefecture, ''), 64), left(coalesce(p_ship_city, ''), 64),
    left(coalesce(p_ship_address, ''), 200),
    coalesce(p_delivery_method, 'standard'),
    v_subtotal, v_fee, v_subtotal + v_fee,
    -- Nothing has been charged. Only app.apply_payment_event() (called by the
    -- payment webhook) may ever move this off 'pending'.
    'pending', 'unfulfilled'
  ) returning * into v_order;

  insert into public.order_items (order_id, product_id, name, brand, unit_price, qty, thumb)
  select v_order.id, l.product_id, l.name, l.brand, l.unit_price, l.qty, l.thumb from _lines l;

  -- One-shot receipt token: 32 random bytes, stored as a SHA-256 hash, valid for
  -- thirty minutes. The plaintext is returned to the caller and never persisted.
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.order_receipts (token_hash, order_id, expires_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_order.id, now() + interval '30 minutes');

  -- Link a signed-in buyer's profile to the shop customer record, if one exists.
  if p_user_id is not null and v_order.customer_id is not null then
    update public.profiles set customer_id = coalesce(customer_id, v_order.customer_id)
     where id = p_user_id;
  end if;

  return jsonb_build_object(
    'number', v_order.number,
    'total', v_order.total,
    'currency', v_order.currency,
    'item_count', v_count,
    'receipt_token', v_token
  );
end;
$$;

-- service_role only. Not callable from a browser session under any role: the
-- Edge Function is the front door, and it validates before it calls.
revoke all on function public.create_order(uuid, extensions.citext, extensions.citext, text, text, text, text, text, text, text, jsonb)
  from anon, authenticated;
