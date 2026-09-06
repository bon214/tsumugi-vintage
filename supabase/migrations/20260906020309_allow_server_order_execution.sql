-- Version matches the verified migration applied to the hosted database.
-- The original hardening revoked PUBLIC's implicit execute privilege but
-- omitted the explicit server grant. The browser must remain denied.
-- Deploy create-order with the default-off COMMERCE_ENABLED gate first.
revoke all on function public.create_order(uuid, extensions.citext, extensions.citext, text, text, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, extensions.citext, extensions.citext, text, text, text, text, text, text, text, jsonb)
  to service_role;
