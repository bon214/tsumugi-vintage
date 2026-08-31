/* runtime/supabase-client.js — the production SDK binding.
 *
 * The editing build reaches the Supabase SDK through a dynamic `import()` of a
 * CDN URL held in auth-config.js. That is one remote origin in the critical
 * path of every sign-in, an un-pinnable ESM graph, and the reason the page
 * cannot run under a strict CSP.
 *
 * Here the SDK is an ordinary static import, resolved at build time from the
 * exact version in package.json. This module's only job is to hand
 * `createClient` to tsumugi-auth.js, which owns all authentication behaviour
 * and is unchanged. It must be imported before that file runs — the shell
 * loads it first, as a module, and the shared classic scripts after.
 */

import { createClient } from "@supabase/supabase-js";

window.TSUMUGI_SUPABASE_CREATE = createClient;

export { createClient };
