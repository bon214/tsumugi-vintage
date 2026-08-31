/* TSUMUGI — authentication connection.

   Fill BOTH values to move the site and console from the local demo provider
   onto Supabase Auth. Only the publishable (anon) key belongs in a browser
   file: never a privileged server key, never a secret key, never an administrator
   password. Anything in this file ships to GitHub Pages and is world-readable.

   Empty strings mean "not configured". The app then runs its local demo
   provider, says so on the sign-in screens, and makes no network call.

     url:     https://<project-ref>.supabase.co
     anonKey: the project's publishable (anon) key — safe to publish

   Required dashboard settings when these are filled (AUTH_MIGRATION.md has the
   full checklist):

     Authentication → Providers → Anonymous sign-ins   enabled (guest console)
     Authentication → URL Configuration → Site URL      the Pages URL
     Authentication → URL Configuration → Redirect URLs the Pages URL plus
                                                        <pages-url>#/account/recover
     Authentication → Providers → Email → Confirm email  on, for real signups

   Staff roles are NOT configured here. A console role is read from the JWT's
   app_metadata.role, which only the service role can write — see
   supabase/migrations/0002_staff_roles.sql. */
window.TSUMUGI_AUTH_CONFIG = {
  url: "",
  anonKey: "",

  /* Pinned exactly, not a floating major. "@2" resolves to whatever the CDN
     publishes today: a breaking change or a compromised release would land in
     production without a commit. Bump this deliberately, after testing.

     For a production build this should be a bundled local file rather than a
     CDN URL — see BUILD.md, which also covers the CSP that becomes possible
     once nothing is loaded from a third-party origin. */
  sdk: "https://esm.sh/@supabase/supabase-js@2.45.4",
  sdkIntegrityNote: "esm.sh does not serve SRI hashes for ESM graphs; bundle locally for production (BUILD.md).",

  /* Edge Function endpoints. Same project, so same origin as `url`. */
  functions: {
    createOrder: "/functions/v1/create-order",
    contact: "/functions/v1/contact",
    /* Function name used by supabase-js after a published CMS change. */
    rebuild: "request-site-build"
  }
};
