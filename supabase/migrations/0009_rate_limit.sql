-- 0009_rate_limit.sql
-- TSUMUGI · shared, durable rate limiting.
--
-- WHAT WAS WRONG
-- Both Edge Functions kept their counters in a module-level Map. Supabase runs
-- many function instances and recycles them freely, so that limiter was
-- per-instance and per-lifetime: a caller who spread requests across instances,
-- or simply waited for a cold start, was never limited. It also could not limit
-- anything but an IP.
--
-- WHAT REPLACES IT
-- One Postgres table, one security-definer RPC, called by every function before
-- it does any work. Because the state is in the database, it survives restarts,
-- is shared by all instances, and can be keyed on whatever the caller actually
-- is: an IP hash, a user id, a session, or an action name.
--
-- CORS AND ORIGIN CHECKS ARE NOT RATE LIMITING, AND NOT AUTHENTICATION.
-- Access-Control-Allow-Origin is a browser instruction; curl ignores it. An
-- allowlisted Origin header is trivially forged. ALLOWED_ORIGINS exists to stop
-- a *browser on another site* from using a visitor's credentials — nothing more.
-- Authorization comes from the JWT and from RLS; throughput comes from here.

create table public.rate_limits (
  -- bucket = action + subject, e.g. 'contact:ip:9f2a…' or 'create-order:user:uuid'
  bucket      text primary key,
  window_start timestamptz not null default now(),
  hits        integer not null default 0,
  blocked_until timestamptz,
  updated_at  timestamptz not null default now(),
  constraint rate_limits_bucket_len check (char_length(bucket) between 3 and 200)
);

create index rate_limits_sweep_idx on public.rate_limits (updated_at);

alter table public.rate_limits enable row level security;
alter table public.rate_limits force  row level security;

-- No policies, no grants: the table is reachable only through the RPC below
-- (security definer) and by service_role. A client that could read it would
-- learn how close it is to the limit; a client that could write it would set
-- its own limit.
revoke all on table public.rate_limits from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fixed-window counter with a penalty box.
--
-- Returns (allowed, remaining, retry_after_seconds). One statement does the
-- whole thing: the INSERT … ON CONFLICT is atomic, so two concurrent callers
-- cannot both see "0 hits so far".
create or replace function app.rate_limit_hit(
  p_bucket   text,
  p_limit    integer,
  p_window   interval default interval '1 minute',
  p_penalty  interval default interval '5 minutes'
) returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rate_limits;
begin
  if p_bucket is null or char_length(p_bucket) < 3 then
    raise exception 'bad_bucket';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'bad_limit';
  end if;

  insert into public.rate_limits (bucket, window_start, hits, updated_at)
  values (p_bucket, now(), 1, now())
  on conflict (bucket) do update
    set
      -- A window that has expired resets; one still open increments.
      window_start = case
        when public.rate_limits.blocked_until is not null and public.rate_limits.blocked_until > now()
          then public.rate_limits.window_start
        when public.rate_limits.window_start < now() - p_window
          then now()
        else public.rate_limits.window_start
      end,
      hits = case
        when public.rate_limits.blocked_until is not null and public.rate_limits.blocked_until > now()
          then public.rate_limits.hits
        when public.rate_limits.window_start < now() - p_window
          then 1
        else public.rate_limits.hits + 1
      end,
      updated_at = now()
  returning * into r;

  -- Still serving a penalty: refuse without extending it.
  if r.blocked_until is not null and r.blocked_until > now() then
    return query select false, 0, greatest(1, ceil(extract(epoch from (r.blocked_until - now())))::integer);
    return;
  end if;

  -- Over the limit: open the penalty box.
  if r.hits > p_limit then
    update public.rate_limits
       set blocked_until = now() + p_penalty, updated_at = now()
     where bucket = p_bucket;
    return query select false, 0, greatest(1, ceil(extract(epoch from p_penalty))::integer);
    return;
  end if;

  return query select true, greatest(0, p_limit - r.hits), 0;
end;
$$;

-- Internal implementation. Edge Functions reach it through the service-role-
-- only wrapper created by expose_safe_rpc_wrappers.sql.
revoke all on function app.rate_limit_hit(text, integer, interval, interval)
  from public, anon, authenticated;
grant execute on function app.rate_limit_hit(text, integer, interval, interval)
  to service_role;

-- ---------------------------------------------------------------------------
-- Expiry / cleanup. Rows are worthless once their window and penalty are past.
create or replace function app.rate_limit_sweep(p_older_than interval default interval '1 day')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.rate_limits
   where updated_at < now() - p_older_than
     and (blocked_until is null or blocked_until < now());
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function app.rate_limit_sweep(interval) from anon, authenticated;

-- Schedule it if pg_cron is available; otherwise call it from any function.
--   select cron.schedule('tsumugi-rate-limit-sweep', '17 4 * * *',
--                        $$select app.rate_limit_sweep()$$);

-- ---------------------------------------------------------------------------
-- Bot-check provider interface.
--
-- The contact function calls app.bot_check_required() to decide whether it must
-- demand a CAPTCHA/Turnstile token. Keeping the decision in the database means
-- the threshold can be raised during an attack without redeploying a function.
create table public.security_settings (
  key   text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.security_settings enable row level security;
alter table public.security_settings force  row level security;
revoke all on table public.security_settings from anon, authenticated;

insert into public.security_settings (key, value) values
  ('bot_check', jsonb_build_object(
     -- 'none' | 'turnstile' | 'hcaptcha' | 'recaptcha'
     'provider', 'none',
     -- Demand a token once a bucket has this many hits in its window.
     'threshold', 2,
     'enabled', false))
on conflict (key) do nothing;

create or replace function app.bot_check_required(p_bucket text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg jsonb;
  hits integer := 0;
begin
  select value into cfg from public.security_settings where key = 'bot_check';
  if cfg is null or coalesce((cfg ->> 'enabled')::boolean, false) = false then
    return jsonb_build_object('required', false, 'provider', 'none');
  end if;
  select r.hits into hits from public.rate_limits r where r.bucket = p_bucket;
  return jsonb_build_object(
    'required', coalesce(hits, 0) >= coalesce((cfg ->> 'threshold')::integer, 2),
    'provider', cfg ->> 'provider'
  );
end;
$$;

revoke all on function app.bot_check_required(text) from public, anon, authenticated;
grant execute on function app.bot_check_required(text) to service_role;
