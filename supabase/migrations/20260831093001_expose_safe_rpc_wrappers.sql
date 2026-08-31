-- PostgREST exposes public by default, while privileged implementations live
-- in the non-exposed app schema. These SECURITY INVOKER wrappers are the
-- deliberately small API surface used by Edge Functions and the receipt page.

revoke all on function app.rate_limit_hit(text, integer, interval, interval)
  from public, anon, authenticated;
grant execute on function app.rate_limit_hit(text, integer, interval, interval)
  to service_role;

create or replace function public.rate_limit_hit(
  p_bucket text,
  p_limit integer,
  p_window interval default interval '1 minute',
  p_penalty interval default interval '5 minutes'
) returns table (allowed boolean, remaining integer, retry_after integer)
language sql
security invoker
set search_path = ''
as $$
  select * from app.rate_limit_hit(p_bucket, p_limit, p_window, p_penalty);
$$;

revoke all on function public.rate_limit_hit(text, integer, interval, interval)
  from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, interval, interval)
  to service_role;

revoke all on function app.bot_check_required(text)
  from public, anon, authenticated;
grant execute on function app.bot_check_required(text) to service_role;

create or replace function public.bot_check_required(p_bucket text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.bot_check_required(p_bucket);
$$;

revoke all on function public.bot_check_required(text)
  from public, anon, authenticated;
grant execute on function public.bot_check_required(text) to service_role;

create or replace function public.redeem_receipt(p_token text)
returns table (
  number text,
  date date,
  total integer,
  currency char(3),
  payment_status public.payment_status,
  fulfilment_status public.fulfilment_status,
  delivery_method text,
  contact_email extensions.citext,
  ship_name text
)
language sql
security invoker
set search_path = ''
as $$
  select * from app.redeem_receipt(p_token);
$$;

revoke all on function public.redeem_receipt(text) from public;
grant execute on function public.redeem_receipt(text) to anon, authenticated;

comment on function public.rate_limit_hit(text, integer, interval, interval) is
  'Service-role-only Data API wrapper for the private atomic limiter.';
comment on function public.bot_check_required(text) is
  'Service-role-only Data API wrapper for private bot-check configuration.';
comment on function public.redeem_receipt(text) is
  'Public one-shot receipt projection. The unguessable single-use token is the authorization.';
