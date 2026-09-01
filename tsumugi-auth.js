/* TSUMUGI — authentication service.

   ONE identity per origin, TWO scopes reading it.

   That is not a convenience: it is what Supabase Auth actually gives a browser.
   A single origin holds a single session, so "admin signed in" and "customer
   signed in" cannot be two independent booleans without the two contradicting
   each other the first time someone uses both. Instead there is one session
   record and each scope answers a different question about it:

     scope "admin"     staff email + password → role from the profile
                       anonymous sign-in      → role "guest" (read-only console)
     scope "customer"  customer email + password → role "customer"

   A session belonging to the other scope reads as signed_out — a customer
   session never authenticates the console, and a staff session is not a
   customer account. Nothing in the browser can promote itself: the role travels
   with the session record, and under Supabase it comes from the profile row or
   server-set app_metadata.

   Four subjects, kept apart on purpose:

     Public Visitor     no session at all. Shop, journal, cart, checkout.
     Customer           scope customer. Account, wishlist, orders, profile.
     Admin Staff        scope admin, password. Console by role.
     Admin Demo Guest   scope admin, anonymous. Console, read-only.

   Two interchangeable providers behind the same interface:

     supabase   used when auth-config.js carries a url + anon key
     local      the offline demo provider this prototype ships with

   Everything Supabase-specific lives in this file. No view imports the SDK: it
   asks a scope for a status, a session and a few actions. Swapping the local
   provider for Supabase needs no change in any view.

   Status is an explicit state machine per scope, because neither the console
   nor the account page may paint anything before it knows who is asking:

     booting → signed_out | authenticated        (customer)
     booting → signed_out | authenticated | guest (admin)

   Sign-up adds two provider-dependent outcomes, never faked:

     signup_complete        the provider signed the new account straight in
     verification_required  the provider really did send a confirmation email

   Nothing here stores a password. The local provider hands it to the store's
   demo digest and keeps no copy; the Supabase provider hands it to the SDK,
   which exchanges it for a token.

   Load order: after tsumugi-data.js and auth-config.js, before any shell. */
(function () {
  "use strict";
  if (window.TSUMUGI_AUTH) return;

  var CFG = window.TSUMUGI_AUTH_CONFIG || {};
  var configured = !!(CFG.url && CFG.anonKey);
  var SESSION_KEY = "tsumugi.session.v1";   /* owned by the store; read here only to tell localStorage from sessionStorage */
  var STAFF = ["owner", "manager", "editor", "support", "viewer"];
  var RECOVERY_KEY = "tsumugi.auth.recovery.v1";
  /* The classic auth script is copied to the deployment root even when a
     prerendered page lives several directories deep. Its own URL is therefore
     the only subpath-safe source of the application root on GitHub Pages. */
  var APP_BASE = (function () {
    try {
      var src = typeof document !== "undefined" && document.currentScript
        ? String(document.currentScript.src || "") : "";
      return src ? src.replace(/[^/]*(?:[?#].*)?$/, "") : "";
    } catch (e) { return ""; }
  })();

  function recoveryUrl(scope) {
    var base = APP_BASE;
    if (!base) {
      try {
        base = location.origin + String(location.pathname || "/").replace(/[^/]*$/, "");
      } catch (e) { base = ""; }
    }
    return base + (scope === "admin" ? "admin.html" : "");
  }

  var session = null;        /* the one identity record, or null */
  var booted = false;
  var bootPromise = null;
  var listeners = { admin: [], customer: [] };

  function store() { return window.TSUMUGI_STORE; }
  function isStaff(r) { return STAFF.indexOf(r) >= 0; }

  /* Which scope owns a session. Default-deny: an unrecognised role is treated
     as a customer, never as staff, so a role string nobody planned for cannot
     open the console. */
  function scopeOf(s) {
    if (!s) return "";
    if (s.mode === "anonymous") return "admin";
    return isStaff(s.role) ? "admin" : "customer";
  }

  /* The session shape both providers produce and the only shape any view or
     the store ever sees. `mode` is the read-only boundary: "anonymous" is the
     console's demo guest, and under Supabase it is derived from the token's
     is_anonymous claim, not from anything the browser could edit. */
  function record(o) {
    var mode = o.mode === "anonymous" ? "anonymous" : "password";
    var r = {
      uid: o.uid || "",
      email: o.email || "",
      name: o.name || "",
      role: mode === "anonymous" ? "guest" : (o.role || "customer"),
      mode: mode,
      customerId: o.customerId || null,
      at: new Date().toISOString()
    };
    r.scope = scopeOf(r);
    return r;
  }

  function statusFor(scope) {
    if (!booted) return "booting";
    if (!session || scopeOf(session) !== scope) return "signed_out";
    if (scope === "admin") return session.mode === "anonymous" ? "guest" : "authenticated";
    return "authenticated";
  }
  function sessionFor(scope) {
    return (session && scopeOf(session) === scope) ? session : null;
  }
  function stateFor(scope) {
    return {
      scope: scope, status: statusFor(scope), session: sessionFor(scope),
      provider: configured ? "supabase" : "local"
    };
  }
  function emit() {
    ["admin", "customer"].forEach(function (scope) {
      listeners[scope].slice().forEach(function (fn) {
        try { fn(stateFor(scope)); } catch (e) { }
      });
    });
  }

  /* The single write path. Persisting is the store's job; deriving status is
     this file's. Both scopes are notified, because one identity changing is
     news to whichever scope just lost or gained it. */
  function apply(s, remember) {
    session = s;
    booted = true;
    var S = store();
    if (S) { if (s) S.setSession(s, !!remember); else S.clearSession(); }
    emit();
    return s;
  }

  /* ---------- local provider (offline prototype) ---------- */
  var local = {
    capabilities: { signUp: true, passwordReset: false, emailVerification: false },

    boot: function () {
      var S = store();
      var s = S && S.session();
      if (!s) { booted = true; emit(); return Promise.resolve(null); }
      var mode = s.mode === "anonymous" ? "anonymous" : "password";
      /* Default-deny. A stored session with no role (written by an older build,
         or edited by hand) is NOT an operator: it resolves to "customer", whose
         console permission list is empty. Staff must sign in again. */
      var role = s.role || (mode === "anonymous" ? "guest" : "customer");
      var remembered = false;
      try { remembered = !!localStorage.getItem(SESSION_KEY); } catch (e) { }
      return Promise.resolve(apply(record({
        uid: s.uid || s.email, email: s.email, name: s.name, role: role,
        mode: mode, customerId: s.customerId
      }), remembered));
    },

    adminSignIn: function (email, password, remember) {
      /* The store owns the demo credential check; no password is retained. */
      var r = store().login(email, password, remember);
      if (!r || !r.ok) return Promise.resolve({ ok: false, code: "invalid" });
      var s = record({
        uid: r.session.email, email: r.session.email, name: r.session.name,
        role: r.session.role, mode: "password"
      });
      apply(s, remember !== false);
      return Promise.resolve({ ok: true, session: s });
    },

    adminSignInAnonymous: function () {
      var s = record({ uid: "local-anon", email: "", name: "Guest", role: "guest", mode: "anonymous" });
      /* sessionStorage: survives reload in this tab and nowhere else. */
      apply(s, false);
      try { store().logAudit("login.anonymous", "session", "guest", "Anonymous guest session started (local provider)"); } catch (e) { }
      return Promise.resolve({ ok: true, session: s });
    },

    customerSignIn: function (email, password, remember) {
      var S = store();
      return S.customerVerify(email, password).then(function (res) {
        if (!res || !res.ok) return { ok: false, code: "invalid" };
        return local._enterCustomer(res.user, remember);
      });
    },

    customerSignUp: function (email, password, remember) {
      var S = store();
      return S.customerCreate(email, password).then(function (res) {
        if (!res || !res.ok) return { ok: false, code: res ? res.code : "failed" };
        /* No email is sent by this provider, so nothing pretends one was: the
           new account is signed in and the caller is told exactly that. */
        return local._enterCustomer(res.user, remember).then(function (r) {
          r.status = "signup_complete";
          return r;
        });
      });
    },

    _enterCustomer: function (u, remember) {
      var S = store();
      var p = S.profileOf(u.id) || {};
      var s = record({
        uid: u.id, email: u.email, name: p.displayName || "",
        role: "customer", mode: "password", customerId: u.customerId || null
      });
      apply(s, remember !== false);
      /* A wishlist built before signing in belongs to the person who built it. */
      try { S.mergeAnonWishlist(u.id); } catch (e) { }
      return Promise.resolve({ ok: true, session: s, status: "signed_in" });
    },

    resetPassword: function () {
      return Promise.resolve({ ok: false, code: "unsupported" });
    },

    updatePassword: function () {
      return Promise.resolve({ ok: false, code: "unsupported" });
    },

    isRecovering: function () { return false; },
    recoveryScope: function () { return ""; },

    signOut: function () {
      var wasAdmin = session && scopeOf(session) === "admin";
      if (wasAdmin) { try { store().logout(); } catch (e) { } }
      apply(null);
      return Promise.resolve({ ok: true });
    }
  };

  /* ---------- supabase provider ---------- */
  var client = null;
  var authSub = null;
  /* Monotonic id for session resolution. Every asynchronous resolve carries the
     id it started with; when it finishes, an id that is no longer current is
     discarded. Without this, a slow resolve for a session that has since been
     replaced (or signed out) lands last and wins. */
  var sessionVersion = 0;
  /* PASSWORD_RECOVERY arrives as an ordinary session; the UI must know the
     session exists only to set a new password. The scope belongs to the
     recovered user, not to whichever screen happened to request the email. */
  var recoveryPending = false;
  var recoveryScope = "";
  var recoveryUserId = "";

  function recoveryScopeOf(user) {
    var role = String(user && user.app_metadata && user.app_metadata.role || "");
    return STAFF.indexOf(role) >= 0 ? "admin" : "customer";
  }

  function readRecoveryMarker() {
    try {
      var value = JSON.parse(sessionStorage.getItem(RECOVERY_KEY) || "null");
      if (!value || !value.uid || (value.scope !== "admin" && value.scope !== "customer")) return null;
      if (!value.at || Date.now() - Number(value.at) > 15 * 60 * 1000) {
        sessionStorage.removeItem(RECOVERY_KEY);
        return null;
      }
      return value;
    } catch (e) { return null; }
  }

  function writeRecoveryMarker(sb) {
    var user = sb && sb.user;
    recoveryPending = true;
    recoveryScope = recoveryScopeOf(user);
    recoveryUserId = String(user && user.id || "");
    try {
      sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({
        uid: recoveryUserId, scope: recoveryScope, at: Date.now()
      }));
    } catch (e) { }
  }

  function clearRecovery() {
    recoveryPending = false;
    recoveryScope = "";
    recoveryUserId = "";
    try { sessionStorage.removeItem(RECOVERY_KEY); } catch (e) { }
  }

  /* A staff recovery first lands on the public callback only when the request
     was made from the customer screen. The marker survives the immediate
     same-origin handoff to admin.html; it is accepted only for the same user
     and only for fifteen minutes. */
  var restoredRecovery = readRecoveryMarker();
  if (restoredRecovery) {
    recoveryPending = true;
    recoveryScope = restoredRecovery.scope;
    recoveryUserId = restoredRecovery.uid;
  }

  function sbClient() {
    if (client) return Promise.resolve(client);
    /* Where the SDK comes from.

       A production build bundles @supabase/supabase-js locally and installs
       its createClient on this hook before this file loads (see
       runtime/supabase-client.js), so the browser makes no request to a
       third-party origin and the page can run under a CSP with no remote
       script source. The dynamic import below is the editing-environment
       fallback only, and build/build-app.mjs removes it from the built copy of
       this file — dist/ must contain no remote module URL at all.

       Neither path changes what a caller gets back: the same client, created
       with the same options. */
    var factory = (typeof window !== "undefined" && window.TSUMUGI_SUPABASE_CREATE) || null;
    var sdk = factory
      ? Promise.resolve({ createClient: factory })
      : CFG.sdk
        ? import(/* @vite-ignore */ CFG.sdk)
        : Promise.reject(new Error("Supabase SDK is not bundled and no sdk URL is configured"));
    return sdk.then(function (mod) {
      client = mod.createClient(CFG.url, CFG.anonKey, {
        auth: {
          persistSession: true, autoRefreshToken: true,
          /* PKCE returns a short-lived code in the query string. Keeping the
             callback out of the fragment leaves location.hash exclusively to
             the storefront router. Error fragments are mapped to the recovery
             screen by the shell instead of being mistaken for catalogue URLs. */
          detectSessionInUrl: true,
          flowType: "pkce"
        }
      });

      /* The callback does no Supabase work of its own. Supabase documents that
         calling further auth APIs (or awaiting anything) inside
         onAuthStateChange can deadlock the client's internal lock, so the
         handler only records the event and hands the session to a queue that
         runs after the callback has returned. */
      var sub = client.auth.onAuthStateChange(function (evt, sb) {
        queueSessionEvent(evt, sb);
      });
      authSub = (sub && sub.data && sub.data.subscription) || null;
      return client;
    });
  }

  /* Explicit handling per event, so an unrecognised future event cannot be
     mistaken for a sign-in. */
  function queueSessionEvent(evt, sb) {
    /* Record recovery synchronously, before the queued resolver can be
       superseded by INITIAL_SESSION or SIGNED_IN. Supabase may emit those
       events back-to-back while completing a PKCE exchange; previously the
       version guard discarded PASSWORD_RECOVERY before it ever set this flag,
       so a valid one-time link opened the ordinary sign-in screen. This writes
       local state only — no Supabase API is called inside the auth callback. */
    if (evt === "PASSWORD_RECOVERY") writeRecoveryMarker(sb);
    if (evt === "SIGNED_OUT") clearRecovery();
    var version = ++sessionVersion;
    var run = function () {
      switch (evt) {
        case "SIGNED_OUT":
          if (version !== sessionVersion) return;
          apply(null);
          return;
        case "PASSWORD_RECOVERY":
          /* A recovery session must not be treated as a sign-in: it is applied
             as no session at all, and only updatePassword() may use it. */
          if (version !== sessionVersion) return;
          booted = true; session = null; emit();
          return;
        case "INITIAL_SESSION":
        case "SIGNED_IN":
        case "TOKEN_REFRESHED":
        case "USER_UPDATED":
          if (!sb || !sb.user) { if (version === sessionVersion) apply(null); return; }
          resolveUser(sb.user).then(function (s) {
            if (version !== sessionVersion) return;   /* superseded — drop it */
            if (recoveryPending && evt !== "USER_UPDATED") { booted = true; session = null; emit(); return; }
            apply(s, true);
          }).catch(function () {
            if (version === sessionVersion) { booted = true; emit(); }
          });
          return;
        case "MFA_CHALLENGE_VERIFIED":
          return;
        default:
          /* Unknown event: report booted state, change nothing. */
          if (version === sessionVersion) { booted = true; emit(); }
          return;
      }
    };
    /* Out of the callback, onto the next macrotask: nothing here runs while
       Supabase still holds its auth lock. */
    setTimeout(run, 0);
  }

  /* Role resolution.

     A staff role comes from ONE server-managed source: the JWT's app_metadata,
     which only the service role (or a Postgres trigger writing through
     auth.users) can set. The browser cannot write app_metadata, so a customer
     cannot promote themselves.

     profiles is NOT consulted for the role. In the previous build it was read
     first, while the accompanying RLS example let a signed-in user update their
     whole profiles row — so a customer could write profiles.role = 'owner' and
     the console believed it. profiles now supplies display data only, and its
     role/customer_id columns are revoked from customers at the database level
     (see supabase/migrations).

     Anything unrecognised resolves to "customer", which holds no console
     permission. There is no fallback to an operator role. */
  var STAFF_CLAIM_ROLES = ["owner", "manager", "editor", "support", "viewer"];

  function resolveUser(user) {
    if (!user) return Promise.resolve(null);
    var meta = user.app_metadata || {}, umeta = user.user_metadata || {};

    /* An anonymous Supabase user is `authenticated` in Postgres, not `anon`.
       The only reliable marker is the is_anonymous claim. */
    var anon = user.is_anonymous === true || meta.is_anonymous === true;
    if (anon) {
      return Promise.resolve(record({ uid: user.id, name: "Guest", role: "guest", mode: "anonymous" }));
    }

    var claimed = String(meta.role || "");
    var role = STAFF_CLAIM_ROLES.indexOf(claimed) >= 0 ? claimed : "customer";

    /* Staff do not need a profiles row; customers read theirs for display name
       and the customer_id link. A failed or absent read is not an error. */
    if (role !== "customer") {
      return Promise.resolve(record({
        uid: user.id, email: user.email || "",
        name: umeta.name || (user.email || "").split("@")[0],
        role: role, mode: "password", customerId: null
      }));
    }
    return profileRow(user.id).then(function (row) {
      return record({
        uid: user.id,
        email: user.email || "",
        name: (row && row.display_name) || umeta.name || (user.email || "").split("@")[0],
        role: "customer",
        mode: "password",
        customerId: row ? row.customer_id : null
      });
    });
  }

  /* Display columns only. role is deliberately not selected: nothing in the
     browser should be able to act on a value a customer might be able to write.
     Absent table, absent row and a failed request are all "no profile yet". */
  function profileRow(id) {
    return sbClient().then(function (c) {
      return c.from("profiles").select("display_name,phone,customer_id").eq("id", id).maybeSingle();
    }).then(function (res) {
      return (res && res.data) ? res.data : null;
    }).catch(function () { return null; });
  }

  /* Wrong-scope sign-in. Credentials that authenticate but belong to the other
     surface must leave NO session behind: the Supabase session is signed out
     before the refusal is returned, so a failed console sign-in cannot quietly
     log the visitor in as a customer (or the reverse). */
  function enforceScope(c, s, wantScope, badCode) {
    if (s && scopeOf(s) === wantScope) return Promise.resolve({ ok: true, session: s });
    return Promise.resolve(c.auth.signOut()).catch(function () { }).then(function () {
      sessionVersion++;              /* invalidate any resolve already in flight */
      apply(null);
      return { ok: false, code: badCode };
    });
  }

  var supabase = {
    capabilities: { signUp: true, passwordReset: true, emailVerification: true },

    boot: function () {
      return sbClient().then(function (c) { return c.auth.getSession(); }).then(function (res) {
        var sb = res && res.data ? res.data.session : null;
        if (!sb) { clearRecovery(); booted = true; emit(); return null; }
        /* A marker may have crossed from the public callback to admin.html.
           Never apply it to a different signed-in user. */
        if (recoveryPending && recoveryUserId && String(sb.user && sb.user.id || "") !== recoveryUserId) {
          clearRecovery();
        }
        if (recoveryPending) { booted = true; session = null; emit(); return null; }
        return resolveUser(sb.user).then(function (s) {
          /* PASSWORD_RECOVERY can arrive while role resolution is in flight.
             Do not let that older ordinary-session read overwrite recovery. */
          if (recoveryPending) { booted = true; session = null; emit(); return null; }
          return apply(s, true);
        });
      }).catch(function () { booted = true; emit(); return null; });
    },

    adminSignIn: function (email, password) {
      var C;
      return sbClient().then(function (c) {
        C = c;
        return c.auth.signInWithPassword({ email: email, password: password });
      }).then(function (res) {
        if (res.error || !res.data || !res.data.user) return { ok: false, code: "invalid" };
        return resolveUser(res.data.user).then(function (s) {
          /* Scope is verified BEFORE the session is applied. Customer
             credentials typed into the console sign in nowhere: the Supabase
             session is discarded and the console reports notStaff. */
          return enforceScope(C, s, "admin", "notStaff").then(function (r) {
            if (!r.ok) return r;
            apply(s, true);
            return { ok: true, session: s };
          });
        });
      }).catch(function () { return { ok: false, code: "invalid" }; });
    },

    adminSignInAnonymous: function () {
      return sbClient().then(function (c) { return c.auth.signInAnonymously(); }).then(function (res) {
        if (res.error || !res.data || !res.data.user) return { ok: false, code: "unavailable", error: res.error ? res.error.message : "" };
        return resolveUser(res.data.user).then(function (s) {
          apply(s, true);
          return { ok: true, session: s };
        });
      }).catch(function (e) { return { ok: false, code: "unavailable", error: String(e) }; });
    },

    customerSignIn: function (email, password) {
      var C;
      return sbClient().then(function (c) {
        C = c;
        return c.auth.signInWithPassword({ email: email, password: password });
      }).then(function (res) {
        if (res.error || !res.data || !res.data.user) return { ok: false, code: "invalid" };
        return resolveUser(res.data.user).then(function (s) {
          /* Staff credentials typed into the storefront sign-in leave no admin
             session behind: verified first, applied only on success. */
          return enforceScope(C, s, "customer", "notCustomer").then(function (r) {
            if (!r.ok) return r;
            apply(s, true);
            try { store().mergeAnonWishlist(s.uid); } catch (e) { }
            return { ok: true, session: s, status: "signed_in" };
          });
        });
      }).catch(function () { return { ok: false, code: "invalid" }; });
    },

    customerSignUp: function (email, password) {
      return sbClient().then(function (c) {
        return c.auth.signUp({
          email: email, password: password,
          options: { data: { role: "customer" } }
        });
      }).then(function (res) {
        if (res.error || !res.data) {
          var m = String((res.error && res.error.message) || "").toLowerCase();
          return { ok: false, code: /already|registered|exists/.test(m) ? "duplicate" : "invalid" };
        }
        /* No session back means the project has email confirmation on and has
           genuinely sent a message. Only then does the UI say so. */
        if (!res.data.session) return { ok: true, status: "verification_required" };
        return resolveUser(res.data.user).then(function (s) {
          apply(s, true);
          try { store().mergeAnonWishlist(s.uid); } catch (e) { }
          return { ok: true, session: s, status: "signup_complete" };
        });
      }).catch(function () { return { ok: false, code: "invalid" }; });
    },

    resetPassword: function (email, requestedScope) {
      /* Do not put the app route in redirectTo's fragment. Supabase owns the
         callback URL while it returns a PKCE code (and returns failures in a
         #error fragment); sharing that fragment with the storefront router
         made successful recovery and expired-link handling race each other.
         The requesting surface chooses only the callback document. Once the
         link is opened, PASSWORD_RECOVERY derives the authoritative scope from
         server-owned app_metadata and the shells correct a cross-scope request. */
      var base = recoveryUrl(requestedScope === "admin" ? "admin" : "customer");
      return sbClient().then(function (c) {
        return c.auth.resetPasswordForEmail(email, { redirectTo: base });
      }).then(function (res) {
        if (!res || !res.error) return { ok: true, status: "email_sent" };
        var code = String(res.error.code || "").toLowerCase();
        var message = String(res.error.message || "").toLowerCase();
        var limited = Number(res.error.status) === 429 || /rate[_ -]?limit|too many/.test(code + " " + message);
        return { ok: false, code: limited ? "rate_limited" : "failed" };
      }).catch(function (error) {
        var text = String(error && (error.code || error.message) || "").toLowerCase();
        return { ok: false, code: /rate[_ -]?limit|too many/.test(text) ? "rate_limited" : "failed" };
      });
    },

    /* Completes recovery. Only valid while a PASSWORD_RECOVERY session exists;
       Supabase rejects the call outright once the link has expired, which is
       reported as expired rather than as a generic failure. */
    updatePassword: function (password) {
      if (!recoveryPending) return Promise.resolve({ ok: false, code: "expired" });
      var completedScope = recoveryScope;
      return sbClient().then(function (c) {
        return c.auth.updateUser({ password: password });
      }).then(function (res) {
        if (res && res.error) {
          var m = String(res.error.message || "").toLowerCase();
          var expired = /expired|invalid|not found|session/.test(m);
          return { ok: false, code: expired ? "expired" : "failed", message: res.error.message };
        }
        clearRecovery();
        /* USER_UPDATED follows; the queue resolves and applies the now-ordinary
           session, so the visitor lands signed in. */
        return { ok: true, status: "password_updated", scope: completedScope };
      }).catch(function () { return { ok: false, code: "failed" }; });
    },

    isRecovering: function () { return recoveryPending; },
    recoveryScope: function () { return recoveryScope; },

    signOut: function () {
      var wasAdmin = session && scopeOf(session) === "admin";
      sessionVersion++;                    /* drop anything still resolving */
      clearRecovery();
      return sbClient().then(function (c) { return c.auth.signOut(); })
        .catch(function () { })
        .then(function () {
          if (wasAdmin) { try { store().logout(); } catch (e) { } }
          apply(null);
          return { ok: true };
        });
    },

    /* Releases the onAuthStateChange subscription. Called by the shells on
       unmount so a reloaded Design Component does not accumulate listeners. */
    dispose: function () {
      try { if (authSub && authSub.unsubscribe) authSub.unsubscribe(); } catch (e) { }
      authSub = null;
    }
  };

  /* Local provider: no anonymous-vs-authenticated distinction to model and no
     recovery mail to send, so these answer honestly rather than pretending. */
  local.updatePassword = function () { return Promise.resolve({ ok: false, code: "unsupported" }); };
  local.isRecovering = function () { return false; };
  local.recoveryScope = function () { return ""; };
  local.dispose = function () { };

  var P = configured ? supabase : local;

  function boot() {
    if (bootPromise) return bootPromise;
    bootPromise = Promise.resolve(P.boot()).catch(function () { booted = true; emit(); });
    return bootPromise;
  }
  function subscribe(scope, fn) {
    listeners[scope].push(fn);
    return function () {
      listeners[scope] = listeners[scope].filter(function (f) { return f !== fn; });
    };
  }
  var common = {
    PROVIDER: configured ? "supabase" : "local",
    isConfigured: function () { return configured; },
    capabilities: function () { return P.capabilities; }
  };

  /* ---------- scope: admin console ---------- */
  window.TSUMUGI_AUTH = Object.assign({}, common, {
    SCOPE: "admin",
    status: function () { return statusFor("admin"); },
    session: function () { return sessionFor("admin"); },
    isGuest: function () { return statusFor("admin") === "guest"; },
    subscribe: function (fn) { return subscribe("admin", fn); },
    boot: boot,
    resetPassword: function (email) {
      if (!P.capabilities.passwordReset) return Promise.resolve({ ok: false, code: "unsupported" });
      return Promise.resolve(P.resetPassword(String(email || "").trim().toLowerCase(), "admin"));
    },
    isRecovering: function () { return !!P.isRecovering && P.isRecovering(); },
    recoveryScope: function () { return P.recoveryScope ? P.recoveryScope() : ""; },
    recoveryUrl: recoveryUrl,
    updatePassword: function (password) {
      if (!P.updatePassword) return Promise.resolve({ ok: false, code: "unsupported" });
      var pw = String(password || "");
      if (pw.length < 8) return Promise.resolve({ ok: false, code: "weak" });
      return Promise.resolve(P.updatePassword(pw));
    },
    signIn: function (email, password, remember) {
      return Promise.resolve(P.adminSignIn(String(email || "").trim().toLowerCase(), String(password || ""), remember !== false));
    },
    signInAsGuest: function () { return Promise.resolve(P.adminSignInAnonymous()); },
    signOut: function () { return Promise.resolve(P.signOut()); },
    dispose: function () { try { P.dispose && P.dispose(); } catch (e) { } }
  });

  /* ---------- scope: storefront customer ---------- */
  window.TSUMUGI_CUSTOMER_AUTH = Object.assign({}, common, {
    SCOPE: "customer",
    status: function () { return statusFor("customer"); },
    session: function () { return sessionFor("customer"); },
    subscribe: function (fn) { return subscribe("customer", fn); },
    boot: boot,
    signIn: function (email, password, remember) {
      return Promise.resolve(P.customerSignIn(String(email || "").trim().toLowerCase(), String(password || ""), remember !== false));
    },
    signUp: function (email, password, remember) {
      return Promise.resolve(P.customerSignUp(String(email || "").trim().toLowerCase(), String(password || ""), remember !== false));
    },
    resetPassword: function (email) {
      if (!P.capabilities.passwordReset) return Promise.resolve({ ok: false, code: "unsupported" });
      return Promise.resolve(P.resetPassword(String(email || "").trim().toLowerCase(), "customer"));
    },
    /* Recovery: Supabase first completes its PKCE exchange at the Site URL;
       the PASSWORD_RECOVERY event then opens #/account/recover. isRecovering()
       tells the shell whether that recovery session is actually present — an
       expired or already-used link leaves none. */
    isRecovering: function () { return !!P.isRecovering && P.isRecovering(); },
    recoveryScope: function () { return P.recoveryScope ? P.recoveryScope() : ""; },
    recoveryUrl: recoveryUrl,
    updatePassword: function (password) {
      if (!P.updatePassword) return Promise.resolve({ ok: false, code: "unsupported" });
      var pw = String(password || "");
      if (pw.length < 8) return Promise.resolve({ ok: false, code: "weak" });
      return Promise.resolve(P.updatePassword(pw));
    },
    signOut: function () { return Promise.resolve(P.signOut()); },
    dispose: function () { try { P.dispose && P.dispose(); } catch (e) { } }
  });

  /* Both scopes reachable from one handle, for anything that needs the pair. */
  window.TSUMUGI_AUTH.admin = window.TSUMUGI_AUTH;
  window.TSUMUGI_AUTH.customer = window.TSUMUGI_CUSTOMER_AUTH;
})();
