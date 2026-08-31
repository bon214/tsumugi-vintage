/* runtime/main-public.js — production entry for the storefront.
 *
 * Every screen is a static import, so the whole component graph is one module
 * graph the bundler can see: no runtime fetch of a `.dc.html`, no registry
 * lookup by filename, no compile step in the browser.
 *
 * This entry also joins the two halves of the site. Each page in dist/ is a
 * prerendered document with real copy — that is what a crawler indexes and
 * what a visitor sees before this file executes. The app then takes over that
 * same URL rather than redirecting away from it: the route comes from the
 * page's own <meta name="dc-route">, and the static article is hidden once
 * React has painted. One URL, one history entry, no flash of a second page.
 */

import ReactDOM from "react-dom/client";
import { bootDC } from "./dc-runtime.js";
import TSUMUGI from "../generated/TSUMUGI.js";

/* The storefront routes on the fragment. A prerendered page lives at a real
   path (/p/coat-01/), so its route is declared in markup and copied into the
   fragment before the app reads it. replaceState, not assignment: setting
   location.hash would push a second entry and make Back a no-op. */
function seedRoute() {
  const meta = document.querySelector('meta[name="dc-route"]');
  const route = meta && meta.getAttribute("content");
  if (route && !location.hash) {
    history.replaceState(null, "", location.pathname + location.search + "#/" + route);
  }
}

async function main() {
  /* With Supabase configured, never paint the bundled demo catalogue and then
     swap it out. The prerendered copy remains readable until the authoritative
     public rows have loaded. */
  if (window.TSUMUGI_CMS && window.TSUMUGI_CMS.configured()) {
    try { await window.TSUMUGI_CMS.ready(); }
    catch {
      document.documentElement.dataset.cmsError = "1";
      return;
    }
  }

  seedRoute();
  const { host, element } = bootDC(TSUMUGI, { fullPage: true });
  ReactDOM.createRoot(host).render(element);

  /* Hiding the prerendered copy is deferred to after the first paint, so a
     failure in the app leaves the readable static page on screen instead of a
     blank one. */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.body.classList.add("dc-live"));
  });
}

main();
