/* runtime/main-admin.js — production entry for the staff console.
 *
 * Separate entry, separate bundle: a customer loading the storefront should
 * never download the console, and the console is noindex/nofollow and gated on
 * a staff role in the JWT (supabase/migrations/0002_staff_roles.sql).
 *
 * fullPage is false because "TSUMUGI Admin" declares a $preview size, which is
 * what the authoring runtime uses to decide the same thing — the console
 * manages its own scroll containers and must not be forced to 100% height.
 */

import ReactDOM from "react-dom/client";
import { bootDC } from "./dc-runtime.js";
import TSUMUGIAdmin from "../generated/TSUMUGIAdmin.js";

async function main() {
  if (window.TSUMUGI_CMS && window.TSUMUGI_CMS.configured()) {
    try { await window.TSUMUGI_CMS.ready(); }
    catch {
      const host = document.getElementById("dc-root") || document.body;
      host.textContent = "管理データを読み込めませんでした。Supabaseの設定とマイグレーションを確認してください。";
      host.setAttribute("role", "alert");
      return;
    }
  }
  const { host, element } = bootDC(TSUMUGIAdmin, { fullPage: false });
  ReactDOM.createRoot(host).render(element);
}

main();
