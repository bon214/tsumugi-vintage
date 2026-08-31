/* supabase/functions/create-order/index.ts
   TSUMUGI · the only path that creates an order.

   The browser sends product ids, quantities and delivery details. It does NOT
   send prices, totals, order numbers or payment state, and anything it does send
   in those fields is ignored. Price, availability and stock are re-read from the
   catalogue inside a transaction, the total is computed here, and the order
   number comes from a Postgres sequence.

   Concurrency. Two buyers reaching the last piece at the same moment must not
   both succeed. The stock decrement is a conditional UPDATE …
       set stock = stock - qty where id = $1 and stock >= qty
   … which either matches a row or does not; the loser sees zero rows updated
   and the whole transaction is rolled back. No read-then-write race, no
   oversell, and no need for an advisory lock.

   Deploy:
     supabase functions deploy create-order
     supabase secrets set SUPABASE_SERVICE_ROLE_KEY=…      (never in the client)

   Gateway JWT verification is disabled because guest checkout may use a modern
   publishable key rather than a JWT. The function still validates any supplied
   access token with Auth before attaching an order to a user. */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ALLOWED_ORIGINS = [
  // Set to the GitHub Pages origin(s) that may call this function. A wildcard
  // is not used: this endpoint writes to the database.
  "https://bon214.github.io",
  "http://localhost:8000",
];

const MAX_LINES = 20;
const MAX_QTY = 5;
const RATE_LIMIT_PER_MIN = 8;
const MAX_BODY_BYTES = 16 * 1024;   /* a cart is small; anything larger is noise */

type Line = { productId: number; qty: number };

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function bad(code: string, status = 400, origin: string | null = null, detail?: string) {
  return new Response(JSON.stringify({ ok: false, code, detail }), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

/* Quantity must be a positive integer. Number() accepts "1e9", " 2 ", true and
   []; the string form is tested instead so none of those survive. */
function parseQty(raw: unknown): number | null {
  if (typeof raw === "boolean" || Array.isArray(raw) || raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!/^[0-9]{1,3}$/.test(s)) return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_QTY) return null;
  return n;
}

function parseId(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  if (!/^[0-9]{1,12}$/.test(s)) return null;
  const n = Number.parseInt(s, 10);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function str(raw: unknown, max: number): string {
  return String(raw ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function validEmail(v: string): boolean {
  return /^[^@\s]{1,64}@[^@\s.]+(\.[^@\s.]+)+$/.test(v) && v.length <= 254;
}

/* Durable, shared rate limit.

   An in-memory Map was per-instance and per-lifetime: Supabase runs many
   instances and recycles them, so a caller who spread requests around — or just
   waited for a cold start — was never limited. The counter now lives in
   Postgres (migration 0009) behind a security-definer RPC, so it is shared by
   every instance and survives restarts.

   CORS is not a limiter and not authentication: an Origin header is trivially
   forged by anything that is not a browser. ALLOWED_ORIGINS only stops another
   *site* from spending a visitor's credentials. */
async function rateLimit(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  limit = RATE_LIMIT_PER_MIN,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const { data, error } = await admin.rpc("rate_limit_hit", {
    p_bucket: bucket,
    p_limit: limit,
    p_window: "00:01:00",
    p_penalty: "00:05:00",
  });
  if (error) {
    /* Fail CLOSED. If the limiter cannot answer, the endpoint that writes to
       the database does not run unlimited — it declines and asks for a retry. */
    console.error("rate_limit_hit failed", error.message);
    return { allowed: false, retryAfter: 30 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: !!row?.allowed, retryAfter: Number(row?.retry_after ?? 30) };
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return bad("method_not_allowed", 405, origin);
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return bad("origin_not_allowed", 403, origin);

  /* service_role: server-side only, never shipped to a browser. Built before
     the limiter because the limiter lives in the database. */
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  /* Oversized payload: refused by length before it is parsed, so a 50 MB body
     is never held in memory or handed to JSON.parse. */
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return bad("payload_too_large", 413, origin);
  }
  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) return bad("payload_too_large", 413, origin);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const ipKey = await sha256Hex(ip + (Deno.env.get("IP_HASH_SALT") ?? ""));
  const limited = await rateLimit(admin, "create-order:ip:" + ipKey.slice(0, 32));
  if (!limited.allowed) {
    return new Response(JSON.stringify({ ok: false, code: "rate_limited" }), {
      status: 429,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Retry-After": String(limited.retryAfter) },
    });
  }

  let body: any;
  try { body = JSON.parse(rawBody); } catch { return bad("bad_json", 400, origin); }

  /* ---- who is ordering: from the token, never from the payload ---- */
  const authHeader = req.headers.get("Authorization") ?? "";
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await anonClient.auth.getUser();
  const user = userData?.user ?? null;
  const isAnonymousUser = user?.is_anonymous === true;

  /* An anonymous Supabase user is a demo console guest, not a shopper. It may
     not place an order; it also may not be silently treated as a guest
     checkout, because it holds a uid that would then own the row. */
  if (user && isAnonymousUser) return bad("anonymous_not_permitted", 403, origin);

  /* ---- validate the request shape before touching the database ---- */
  const rawLines = Array.isArray(body?.items) ? body.items : null;
  if (!rawLines || rawLines.length === 0) return bad("empty_cart", 400, origin);
  if (rawLines.length > MAX_LINES) return bad("too_many_items", 400, origin);

  const lines: Line[] = [];
  const seen = new Set<number>();
  for (const raw of rawLines) {
    const productId = parseId(raw?.productId);
    const qty = parseQty(raw?.qty ?? 1);
    if (productId === null) return bad("unknown_product", 400, origin, String(raw?.productId));
    if (qty === null) return bad("bad_qty", 400, origin, String(productId));
    if (seen.has(productId)) return bad("duplicate_line", 400, origin, String(productId));
    seen.add(productId);
    lines.push({ productId, qty });
  }

  const info = body?.info ?? {};
  const contactEmail = str(info.email, 254).toLowerCase();
  const shipName = str([info.firstName, info.lastName].filter(Boolean).join(" "), 120);
  if (!validEmail(contactEmail)) return bad("bad_email", 400, origin);
  if (!shipName) return bad("bad_name", 400, origin);

  const payload = {
    p_user_id: user && !isAnonymousUser ? user.id : null,
    p_guest_email: user && !isAnonymousUser ? null : contactEmail,
    p_contact_email: contactEmail,
    p_contact_phone: str(info.phone, 32),
    p_ship_name: shipName,
    p_ship_postal: str(info.postalCode, 16),
    p_ship_prefecture: str(info.prefecture, 64),
    p_ship_city: str(info.city, 64),
    p_ship_address: str(info.address, 200),
    p_delivery_method: ["standard", "pickup", "express"].includes(String(body?.deliveryMethod))
      ? String(body.deliveryMethod) : "standard",
    p_lines: lines,
  };

  /* Idempotency. A retried request (flaky network, impatient double tap) must
     not create a second order. The key is the caller's own header when present,
     otherwise a fingerprint of who + what, so a genuine repeat within the
     window is recognised even without client cooperation. */
  const idemHeader = String(req.headers.get("idempotency-key") ?? "").slice(0, 120);
  const idemKey = idemHeader ||
    await sha256Hex(JSON.stringify({ u: payload.p_user_id, e: contactEmail, l: lines }));
  const idemBucket = "create-order:idem:" + (await sha256Hex(idemKey)).slice(0, 40);
  /* limit 1 per 5-minute window: the first call proceeds, a duplicate is told
     it is a duplicate rather than being served a second order. */
  const firstTime = await rateLimit(admin, idemBucket, 1);
  if (!firstTime.allowed) return bad("duplicate_request", 409, origin);

  const { data, error } = await admin.rpc("create_order", payload);
  if (error) {
    /* The RPC raises named exceptions for business refusals; anything else is
       a server fault and is not described to the client. */
    const m = String(error.message ?? "");
    const known = [
      "unknown_product", "not_purchasable", "out_of_stock",
      "insufficient_stock", "bad_price", "empty_cart",
    ].find((c) => m.includes(c));
    if (known) return bad(known, 409, origin);
    /* Internal faults are logged server-side and described to the client as
       nothing more than "server_error": a Postgres message can carry column
       names, constraint names, row contents and email addresses. */
    console.error("create-order failed", { code: error.code, message: error.message });
    return bad("server_error", 500, origin);
  }

  /* The receipt token is returned once, in this response body. It is what the
     completion screen uses; the order number authorizes nothing. */
  return new Response(JSON.stringify({
    ok: true,
    number: data.number,
    total: data.total,
    currency: data.currency,
    receiptToken: data.receipt_token,
  }), {
    status: 201,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
