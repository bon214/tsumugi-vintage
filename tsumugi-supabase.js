/* TSUMUGI · one Supabase client shared by Auth, CMS and image uploads.

   Production loads the locally bundled Supabase SDK before this classic
   script.  The authoring build may instead use auth-config.js's pinned ESM
   fallback.  A publishable/anon key belongs in the browser; a service-role or
   secret key never does. */
(function () {
  "use strict";
  if (window.TSUMUGI_SUPABASE_CLIENT) return;

  var client = null;

  function config() { return window.TSUMUGI_AUTH_CONFIG || {}; }
  function configured() {
    var c = config();
    return !!(c.url && c.anonKey);
  }
  function options() {
    return {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce"
      }
    };
  }
  function make(createClient) {
    if (client) return client;
    var c = config();
    if (!c.url || !c.anonKey) throw new Error("Supabase is not configured");
    client = createClient(c.url, c.anonKey, options());
    return client;
  }
  function globalFactory() {
    return window.supabase && typeof window.supabase.createClient === "function"
      ? window.supabase.createClient
      : null;
  }
  function getClient() {
    if (client) return Promise.resolve(client);
    if (!configured()) return Promise.reject(new Error("Supabase is not configured"));

    var factory = globalFactory();
    if (factory) return Promise.resolve(make(factory));

    return Promise.reject(new Error(
      "Supabase SDK is unavailable. Use the production build, which loads the pinned local SDK."
    ));
  }

  /* tsumugi-auth.js expects a synchronous factory in production.  Install it
     only when the bundled global is already present; authoring mode keeps its
     own pinned dynamic-import fallback. */
  if (globalFactory()) {
    window.TSUMUGI_SUPABASE_CREATE = function () { return make(globalFactory()); };
  }
  window.TSUMUGI_SUPABASE_CLIENT = getClient;
  window.TSUMUGI_SUPABASE_CONFIGURED = configured;
})();
