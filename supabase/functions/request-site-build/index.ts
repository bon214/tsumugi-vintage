/* TSUMUGI · request a GitHub Pages rebuild after CMS publication.

   Browser -> authenticated staff JWT -> this function -> GitHub repository
   dispatch. The GitHub token stays in Supabase secrets and is never exposed to
   the static site. */
import { createClient } from "npm:@supabase/supabase-js@2.109.0";

function headers(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}
function json(origin: string, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin") || "";
  const siteOrigin = (Deno.env.get("SITE_ORIGIN") || "").replace(/\/$/, "");
  if (!siteOrigin || origin !== siteOrigin) return json(siteOrigin || "null", 403, { ok: false, code: "forbidden" });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(siteOrigin) });
  if (request.method !== "POST") return json(siteOrigin, 405, { ok: false, code: "method_not_allowed" });

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json(siteOrigin, 401, { ok: false, code: "unauthorized" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return json(siteOrigin, 401, { ok: false, code: "unauthorized" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: staff } = await admin.from("staff_roles")
    .select("role,revoked_at").eq("user_id", userData.user.id).maybeSingle();
  const rank: Record<string, number> = { viewer: 1, support: 2, editor: 3, manager: 4, owner: 5 };
  if (!staff || staff.revoked_at || (rank[String(staff.role)] || 0) < rank.editor) {
    return json(siteOrigin, 403, { ok: false, code: "forbidden" });
  }

  const owner = Deno.env.get("GITHUB_REPOSITORY_OWNER") || "";
  const repository = Deno.env.get("GITHUB_REPOSITORY_NAME") || "";
  const githubToken = Deno.env.get("GITHUB_PAGES_TOKEN") || "";
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repository) || !githubToken) {
    console.error("GitHub rebuild secrets are incomplete");
    return json(siteOrigin, 503, { ok: false, code: "rebuild_unavailable" });
  }

  let reason = "content_changed";
  try {
    const body = await request.json();
    reason = String(body?.reason || reason).replace(/[^a-z0-9_-]/gi, "").slice(0, 60) || reason;
  } catch { /* an empty body uses the default reason */ }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repository}/dispatches`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${githubToken}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "TSUMUGI-CMS",
    },
    body: JSON.stringify({ event_type: "cms-publish", client_payload: { reason } }),
  });
  if (!response.ok) {
    console.error("GitHub dispatch failed", response.status);
    return json(siteOrigin, 502, { ok: false, code: "rebuild_failed" });
  }
  return json(siteOrigin, 202, { ok: true });
});
