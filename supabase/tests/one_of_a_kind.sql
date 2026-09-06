-- Run against the migrated TSUMUGI database via the SQL editor or psql.
-- Temporary negative-ID fixtures; all product/order writes roll back.
-- Successful test orders consume order sequence values (harmless gaps).
-- No payment provider, email delivery, or real customer is involved.
begin;
insert into public.products (id,name,sku,slug,price,stock,status)
values (-930601,'QA one-off','QA-930601','qa-930601',1000,1,'published'),
       (-930602,'QA quantity','QA-930602','qa-930602',2000,3,'published');
do $$
declare result jsonb; rejected boolean; before_count bigint;
begin
  if not has_function_privilege('service_role','public.create_order(uuid,extensions.citext,extensions.citext,text,text,text,text,text,text,text,jsonb)','execute')
     or has_function_privilege('anon','public.create_order(uuid,extensions.citext,extensions.citext,text,text,text,text,text,text,text,jsonb)','execute')
     or has_function_privilege('authenticated','public.create_order(uuid,extensions.citext,extensions.citext,text,text,text,text,text,text,text,jsonb)','execute') then
    raise exception 'FAIL: create_order must be server-only'; end if;
  select count(*) into before_count from public.orders;
  result := public.create_order(null,'qa@example.invalid','qa@example.invalid','',
    'QA only','','','','','standard','[{"productId":-930601,"qty":1}]'::jsonb);
  if not exists(select 1 from public.products where id=-930601 and stock=0 and status='soldout') then
    raise exception 'FAIL: one-off did not become sold out'; end if;
  if not exists(select 1 from public.orders where number=result->>'number' and payment_status='pending') then
    raise exception 'FAIL: order was incorrectly marked paid'; end if;
  drop table pg_temp._lines;
  rejected := false;
  begin
    perform public.create_order(null,'qa@example.invalid','qa@example.invalid','',
      'QA only','','','','','standard','[{"productId":-930601,"qty":1}]'::jsonb);
  exception when others then
    if sqlerrm <> 'not_purchasable' then raise; end if;
    rejected := true;
  end;
  if not rejected or (select count(*) from public.orders) <> before_count+1 then
    raise exception 'FAIL: duplicate purchase was accepted'; end if;
  rejected := false;
  begin
    perform public.create_order(null,'qa@example.invalid','qa@example.invalid','',
      'QA only','','','','','standard','[{"productId":-930602,"qty":1},{"productId":-930601,"qty":1}]'::jsonb);
  exception when others then
    if sqlerrm <> 'not_purchasable' then raise; end if;
    rejected := true;
  end;
  if not rejected or (select stock from public.products where id=-930602) <> 3 then
    raise exception 'FAIL: failed order consumed stock'; end if;
  result := public.create_order(null,'qa@example.invalid','qa@example.invalid','',
    'QA only','','','','','standard','[{"productId":-930602,"qty":1}]'::jsonb);
  if not exists(select 1 from public.products where id=-930602 and stock=2 and status='published') then
    raise exception 'FAIL: remaining stock should remain published'; end if;
end $$;
rollback;
select 'PASS: one-off sold out, duplicate refused, failure atomic, remaining quantity correct; rolled back' as result;
