-- 0007_payments_and_storage.sql
-- TSUMUGI · payment state, receipt tokens, and image storage.

-- ---------------------------------------------------------------- payments --
--
-- payment_status is never granted to anon or authenticated (0004). It changes
-- through this function only, and this function is callable only by
-- service_role — i.e. from the payment provider's webhook handler running as an
-- Edge Function. Neither the browser nor a member of staff can mark an order
-- paid, because neither of them is the thing that took the money.

create table public.payment_events (
  id           bigserial primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  provider     text not null,
  provider_ref text not null,
  status       public.payment_status not null,
  amount       integer not null check (amount >= 0),
  raw          jsonb,
  received_at  timestamptz not null default now(),
  constraint payment_events_unique unique (provider, provider_ref, status)
);

alter table public.payment_events enable row level security;
alter table public.payment_events force  row level security;
revoke all on table public.payment_events from anon, authenticated;

grant select on public.payment_events to authenticated;
create policy payment_events_select_staff
  on public.payment_events for select
  to authenticated
  using (app.has_role('manager'));

create or replace function app.apply_payment_event(
  p_order_id uuid, p_provider text, p_provider_ref text,
  p_status public.payment_status, p_amount integer, p_raw jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected integer;
begin
  select total into expected from public.orders where id = p_order_id for update;
  if expected is null then
    raise exception 'unknown order';
  end if;
  -- The amount the provider settled must match the amount the server computed.
  -- A mismatch is a discrepancy to investigate, not an order to mark paid.
  if p_status in ('authorized', 'paid') and p_amount <> expected then
    raise exception 'amount mismatch: order % expects %, event carried %', p_order_id, expected, p_amount;
  end if;

  insert into public.payment_events (order_id, provider, provider_ref, status, amount, raw)
  values (p_order_id, p_provider, p_provider_ref, p_status, p_amount, p_raw)
  on conflict (provider, provider_ref, status) do nothing;   -- webhook replay

  update public.orders
     set payment_status = p_status,
         payment_reference = coalesce(payment_reference, p_provider_ref)
   where id = p_order_id;
end;
$$;

revoke all on function app.apply_payment_event(uuid, text, text, public.payment_status, integer, jsonb)
  from anon, authenticated;

-- ---------------------------------------------------------- receipt tokens --
--
-- A guest has no account, so the completion screen cannot be authorized by
-- auth.uid(). It is authorized by a single-use token the create-order function
-- returns in its response body — never in a URL, never in the order number.
--
-- Only the hash is stored: a leaked table does not yield working tokens.

create table public.order_receipts (
  token_hash text primary key,
  order_id   uuid not null references public.orders (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);

alter table public.order_receipts enable row level security;
alter table public.order_receipts force  row level security;
revoke all on table public.order_receipts from anon, authenticated;
-- No policies: reachable only through the function below, as service_role.

-- Returns the customer-facing projection once, for a live token. A second call
-- with the same token, an expired token or an invented one returns nothing.
create or replace function app.redeem_receipt(p_token text)
returns table (
  number text, date date, total integer, currency char(3),
  payment_status public.payment_status, fulfilment_status public.fulfilment_status,
  delivery_method text, contact_email extensions.citext, ship_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  oid uuid;
begin
  update public.order_receipts r
     set used_at = now()
   where r.token_hash = h
     and r.used_at is null
     and r.expires_at > now()
  returning r.order_id into oid;

  if oid is null then
    return;             -- unknown, expired or already redeemed: zero rows
  end if;

  return query
    select o.number, o.placed_at::date, o.total, o.currency,
           o.payment_status, o.fulfilment_status, o.delivery_method,
           o.contact_email, o.ship_name
    from public.orders o
    where o.id = oid;
end;
$$;

-- Callable by the public roles: the token IS the authorization, and a wrong
-- token returns no rows. Requires pgcrypto for digest().
grant execute on function app.redeem_receipt(text) to anon, authenticated;

-- ----------------------------------------------------------------- storage --
--
-- Two buckets. Public read for shop imagery (it is a shop window); staff-only
-- write. Object paths are built from server-side ids, never from a filename the
-- uploader chose: `products/<product_id>/<uuid>.<ext>` cannot be steered into
-- another prefix by naming a file `../../avatars/x.png`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/avif']),
  ('content-images', 'content-images', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read: anyone, including subject 1 and subject 4.
create policy storage_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('product-images', 'content-images'));

-- Staff write. The path shape is enforced here as well as in the uploader, so a
-- crafted path is rejected by the database.
create policy storage_staff_insert
  on storage.objects for insert
  to authenticated
  with check (
    app.has_role('editor')
    and (
      (bucket_id = 'product-images' and name ~ '^products/[0-9a-f-]{1,40}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$')
      or
      (bucket_id = 'content-images' and name ~ '^content/[0-9a-f-]{1,40}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$')
    )
  );

create policy storage_staff_update
  on storage.objects for update
  to authenticated
  using (bucket_id in ('product-images', 'content-images') and app.has_role('editor'))
  with check (
    app.has_role('editor')
    and (
      (bucket_id = 'product-images' and name ~ '^products/[0-9a-f-]{1,40}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$')
      or
      (bucket_id = 'content-images' and name ~ '^content/[0-9a-f-]{1,40}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$')
    )
  );

create policy storage_staff_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('product-images', 'content-images') and app.has_role('manager'));

-- No insert, update or delete policy names anon, and every write policy carries
-- app.has_role(), so an anonymous demo guest cannot upload — even though it
-- holds the `authenticated` role.
