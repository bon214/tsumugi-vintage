-- SECURITY INVOKER public wrappers still need permission to resolve their
-- private app-schema implementations. This grants schema traversal only; it
-- does not grant table access or broaden any browser role.
grant usage on schema app to service_role;

notify pgrst, 'reload schema';
