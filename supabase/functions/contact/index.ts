/* supabase/functions/contact/index.ts
   TSUMUGI · contact form and newsletter intake.

   Two things this fixes about the prototype's behaviour:

     1. Nothing was ever sent, but the UI said "we will reply within two working
        days". The storefront now says plainly that it is a demo until this
        function is deployed and wired up.

     2. When it IS deployed, success is reported only after this function
        answers 2xx. A network failure, a timeout or a rate-limit refusal shows
        the visitor an error, not a thank-you.

   Everything stored is length-bounded and HTML-escaped: the console renders
   these messages, and a message is not rich text.

   Deploy:
     supabase functions deploy contact
     supabase secrets set RESEND_API_KEY=…        (or your mail provider's)
     supabase secrets set CONTACT_TO=shop@example.com */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ALLOWED_ORIGINS = [
  "https://bon214.github.io",
  "http://localhost:8000",
];

const LIMITS = { name: 120, email: 254, subject: 200, message: 4000 };
const RATE_LIMIT_PER_10MIN = 3;
const MAX_BODY_BYTES = 32 * 1024;

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/* Control characters out, length capped, HTML escaped. The console displays
   these as text; escaping here means a stored message can never become markup
   even if a future screen forgets to escape. */
function clean(raw: unknown, max: number): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function validEmail(v: string): boolean {
  return /^[^@\s]{1,64}@[^@\s.]+(\.[^@\s.]+)+$/.test(v) && v.length <= LIMITS.email;
}

/* Durable, shared rate limit — see supabase/migrations/0009_rate_limit.sql.
   The previous in-memory Map was per-instance and reset on every cold start.

   CORS is not a rate limit and not authentication: the Origin header is a
   browser convention, forged in one line by anything else. ALLOWED_ORIGINS
   stops another site from using a visitor's session; throughput control and
   identity are separate problems, handled here and by the JWT respectively. */
async function rateLimit(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  limit = RATE_LIMIT_PER_10MIN,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const { data, error } = await admin.rpc("rate_limit_hit", {
    p_bucket: bucket,
    p_limit: limit,
    p_window: "00:10:00",
    p_penalty: "00:30:00",
  });
  if (error) {
    console.error("rate_limit_hit failed", error.message);
    return { allowed: false, retryAfter: 60 };   /* fail closed */
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: !!row?.allowed, retryAfter: Number(row?.retry_after ?? 60) };
}

/* Bot-check provider interface. Which provider (if any) is demanded, and at
   what point, is configured in public.security_settings — so the threshold can
   be raised mid-attack without redeploying. */
async function botCheck(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  token: string,
  ip: string,
): Promise<{ ok: boolean; code?: string }> {
  const { data } = await admin.rpc("bot_check_required", { p_bucket: bucket });
  const cfg = (data ?? {}) as { required?: boolean; provider?: string };
  if (!cfg.required) return { ok: true };
  if (!token) return { ok: false, code: "bot_check_required" };

  const endpoints: Record<string, string> = {
    turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    hcaptcha: "https://api.hcaptcha.com/siteverify",
    recaptcha: "https://www.google.com/recaptcha/api/siteverify",
  };
  const url = endpoints[String(cfg.provider)];
  const secret = Deno.env.get("BOT_CHECK_SECRET") ?? "";
  if (!url || !secret) {
    /* Configured to demand a check but unable to perform one: refuse rather
       than wave the request through. */
    console.error("bot check configured without a usable provider/secret");
    return { ok: false, code: "bot_check_unavailable" };
  }
  const form = new URLSearchParams({ secret, response: token, remoteip: ip });
  try {
    const res = await fetch(url, { method: "POST", body: form });
    const out = await res.json();
    return out?.success ? { ok: true } : { ok: false, code: "bot_check_failed" };
  } catch (e) {
    console.error("bot check request failed", String(e));
    return { ok: false, code: "bot_check_unavailable" };
  }
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ ok: false, code: "method_not_allowed" }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ ok: false, code: "origin_not_allowed" }, 403, origin);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return json({ ok: false, code: "payload_too_large" }, 413, origin);
  }
  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) return json({ ok: false, code: "payload_too_large" }, 413, origin);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const ipKey = (await sha256Hex(ip + (Deno.env.get("IP_HASH_SALT") ?? ""))).slice(0, 32);
  const bucket = "contact:ip:" + ipKey;
  const limited = await rateLimit(admin, bucket);
  if (!limited.allowed) {
    return new Response(JSON.stringify({ ok: false, code: "rate_limited" }), {
      status: 429,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Retry-After": String(limited.retryAfter) },
    });
  }

  let body: any;
  try { body = JSON.parse(rawBody); } catch { return json({ ok: false, code: "bad_json" }, 400, origin); }

  const kind = body?.kind === "newsletter" ? "newsletter" : "contact";
  const email = clean(body?.email, LIMITS.email).toLowerCase();
  if (!validEmail(email)) return json({ ok: false, code: "bad_email" }, 400, origin);

  /* Bot deterrents that do not punish a real visitor: an unfilled honeypot
     field, and a form that took at least a couple of seconds to complete. */
  if (clean(body?.company, 80)) return json({ ok: true, code: "accepted" }, 202, origin);
  const elapsed = Number(body?.elapsedMs ?? 0);
  if (Number.isFinite(elapsed) && elapsed > 0 && elapsed < 1500) {
    return json({ ok: false, code: "too_fast" }, 429, origin);
  }

  const bot = await botCheck(admin, bucket, String(body?.botToken ?? ""), ip);
  if (!bot.ok) return json({ ok: false, code: bot.code }, 403, origin);

  if (kind === "newsletter") {
    /* Double opt-in. The row is a pending request until the confirmation link is
       followed; nothing is mailed to an unconfirmed address, and the response
       says "check your inbox", not "you are subscribed". */
    const token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await admin.from("newsletter_subscribers").upsert({
      email,
      token_hash: await sha256Hex(token),
      confirmed_at: null,
    }, { onConflict: "email" });
    /* Internal detail stays in the log: a Postgres error can name columns,
       constraints and stored values. */
    if (error) { console.error("newsletter upsert failed", { code: error.code, message: error.message }); return json({ ok: false, code: "server_error" }, 500, origin); }

    // await sendConfirmation(email, token);   ← wire to your mail provider
    return json({ ok: true, status: "confirmation_pending" }, 202, origin);
  }

  const name = clean(body?.name, LIMITS.name);
  const message = clean(body?.message, LIMITS.message);
  if (!name) return json({ ok: false, code: "bad_name" }, 400, origin);
  if (!message) return json({ ok: false, code: "bad_message" }, 400, origin);

  const { error } = await admin.from("contact_messages").insert({
    name,
    email,
    subject: clean(body?.subject, LIMITS.subject) || null,
    message,
    /* The address is hashed with a server-side salt: enough to rate-limit and
       to spot a flood, not a stored identifier. */
    source_ip_hash: ipKey,
    user_agent: clean(req.headers.get("user-agent"), 200) || null,
  });
  if (error) { console.error("contact insert failed", { code: error.code, message: error.message }); return json({ ok: false, code: "server_error" }, 500, origin); }

  // await notifyShop(name, email, message);  ← wire to your mail provider
  return json({ ok: true, status: "received" }, 201, origin);
});
