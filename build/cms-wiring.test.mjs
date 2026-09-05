import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("production pages load the CMS bridge in dependency order", async () => {
  for (const file of ["TSUMUGI.dc.html", "TSUMUGI Admin.dc.html", "build/build-app.mjs"]) {
    const source = await read(file);
    const names = [
      "auth-config.js", "tsumugi-supabase.js", "tsumugi-sanitize.js",
      "tsumugi-data.js", "tsumugi-repository.js", "tsumugi-images.js", "tsumugi-auth.js",
    ];
    let previous = -1;
    for (const name of names) {
      const at = source.indexOf(name);
      assert.ok(at > previous, `${file}: ${name} is missing or out of order`);
      previous = at;
    }
  }
});

test("production build carries source-controlled local imagery", async () => {
  const source = await read("build/build-app.mjs");
  const images = await read("tsumugi-images.js");
  const shell = await read("TSUMUGI.dc.html");
  assert.match(source, /ROOT, "uploads"/);
  assert.match(source, /DIST, "uploads"/);
  assert.match(images, /document\.currentScript\.src/);
  assert.match(shell, /TSUMUGI_IMAGES\.asset\("uploads\/RSeo\.png"\)/);
});

test("public production views do not depend on remote stock photography", async () => {
  const files = [
    "TSUMUGI.dc.html", "PublicAbout.dc.html", "PublicContact.dc.html",
    "PublicProduct.dc.html", "tsumugi-data.js",
  ];
  for (const file of files) {
    assert.doesNotMatch(await read(file), /images\.unsplash\.com/i, file);
  }
});

test("production public app suppresses browser-default link underlines", async () => {
  const source = await read("build/build-app.mjs");
  assert.match(source, /#dc-root a \{ text-decoration: none \}/);
});

test("production build carries root component global styles", async () => {
  const source = await read("build/build-app.mjs");
  assert.match(source, /generated", "helmets\.json"/);
  assert.match(source, /helmetStyle\(helmets, "TSUMUGI"\)/);
  assert.match(source, /helmetStyle\(helmets, "TSUMUGI Admin"\)/);
  assert.match(source, /publicGlobalStyle/);
  assert.match(source, /adminGlobalStyle/);
});

test("production assets are content-versioned to bypass stale Pages caches", async () => {
  const app = await read("build/build-app.mjs");
  const bundle = await read("build/bundle.mjs");
  assert.match(app, /createHash\("sha256"\)/);
  assert.match(app, /const versioned = \(url\) => `\$\{url\}\?v=\$\{ASSET_VERSION\}`/);
  assert.match(app, /versioned\(root \+ s\)/);
  assert.match(bundle, /bundle\.js\$2/);
});

test("CMS migration provides tables, public filtering, staff RLS and browser RPC", async () => {
  const sql = await read("supabase/migrations/0011_cms_runtime.sql");
  for (const fragment of [
    "create table if not exists public.hero_features",
    "create table if not exists public.special_features",
    "create or replace view public.public_special_features",
    "create policy hero_features_select_staff",
    "create policy special_features_update_staff",
    "create or replace function public.reorder_hero_features",
    "security invoker",
    "app.has_role('editor')",
  ]) assert.ok(sql.toLowerCase().includes(fragment.toLowerCase()), `migration misses: ${fragment}`);
});

test("repository maps editor data to database rows without privileged secrets", async () => {
  const source = await read("tsumugi-repository.js");
  assert.doesNotMatch(source, /service[_-]?role|sb_secret/i);
  assert.doesNotMatch(source, /from\("products"\)\.select\("\*"\)/);
  assert.match(source, /var PRODUCT_SELECT =/);
  assert.match(source, /s\.placeOrder = function \(\) \{ return \{ ok: false, code: "portfolio_only" \}/);
  const context = { window: { TSUMUGI_AUTH_CONFIG: {} }, console, setTimeout, clearTimeout };
  vm.runInNewContext(source, context, { filename: "tsumugi-repository.js" });
  const cms = context.window.TSUMUGI_CMS;
  const row = cms.productToRow({
    sku: "T-1", slug: "coat", name: "Coat", year: 1998, price: 12000,
    images: [{ src: "https://example.test/coat.jpg" }], stock: 1, status: "published",
  });
  assert.equal(row.sku, "T-1");
  assert.equal(row.tax_status, null);
  assert.equal(row.year, 1998);
  assert.equal(row.status, "published");
  assert.deepEqual(row.images, [{ src: "https://example.test/coat.jpg" }]);
});

test("remote CMS mode cannot display bundled fictional commerce records", async () => {
  const source = await read("tsumugi-data.js");
  for (const collection of ["customers", "orders", "authUsers", "profiles", "addresses", "wishlists"]) {
    assert.match(source, new RegExp(`db\\.${collection} = \\[\\]`), `${collection} demo rows are not cleared`);
  }
});

test("crawler export also respects product column grants", async () => {
  const source = await read("build/export-live-catalog.mjs");
  assert.doesNotMatch(source, /from\("products"\)\.select\("\*"\)/);
  assert.match(source, /const PRODUCT_SELECT =/);
});

test("demo import contains CMS content only and stable unique identifiers", async () => {
  const seed = JSON.parse(await read("supabase/seed/demo-content.json"));
  assert.deepEqual(Object.keys(seed).sort(), [
    "generatedAt", "heroFeatures", "news", "note", "products", "specialFeatures",
  ].sort());
  assert.equal(seed.products.length, 30);
  assert.equal(seed.news.length, 13);
  for (const [rows, key] of [[seed.products, "sku"], [seed.products, "slug"], [seed.news, "slug"]]) {
    const values = rows.map((row) => row[key]);
    assert.ok(values.every(Boolean), `${key} contains a blank value`);
    assert.equal(new Set(values).size, values.length, `${key} contains duplicates`);
  }
});

test("local service key files and backups are excluded from Git", async () => {
  const ignore = await read(".gitignore");
  assert.match(ignore, /^\.env\.\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);
  assert.match(ignore, /^backups\/$/m);
});

test("new-record image namespaces and Storage policies agree", async () => {
  const intake = await read("tsumugi-images.js");
  const sql = await read("supabase/migrations/0007_payments_and_storage.sql");
  assert.match(intake, /if \(!ownerId\) ownerId = crypto\.randomUUID\(\)/);
  assert.match(intake, /bucket === "content-images" \? "content" : "products"/);
  assert.match(sql, /bucket_id = 'product-images' and name ~ '\^products\//);
  assert.match(sql, /bucket_id = 'content-images' and name ~ '\^content\//);
});

test("password recovery keeps Supabase callbacks separate from hash routing", async () => {
  const auth = await read("tsumugi-auth.js");
  const shell = await read("TSUMUGI.dc.html");
  const adminShell = await read("TSUMUGI Admin.dc.html");

  /* The callback must return to the configured Site URL. A route fragment in
     redirectTo collides with Supabase's own implicit/error fragments. */
  assert.match(auth, /resetPasswordForEmail\(email, \{ redirectTo: base \}\)/);
  assert.doesNotMatch(auth, /redirectTo:\s*base\s*\+\s*["']#\/account\/recover/);

  /* PASSWORD_RECOVERY is recorded before the monotonic version gate. A later
     INITIAL_SESSION event must not erase a valid recovery event. */
  const recoveryFlag = auth.indexOf('if (evt === "PASSWORD_RECOVERY") writeRecoveryMarker(sb);');
  const versionGate = auth.indexOf("var version = ++sessionVersion;", recoveryFlag);
  assert.ok(recoveryFlag >= 0 && versionGate > recoveryFlag,
    "PASSWORD_RECOVERY must be recorded synchronously before versioning");
  assert.match(auth, /if \(recoveryPending\) \{ booted = true; session = null; emit\(\); return null; \}/);

  /* Auth callback fragments are recovery state, never catalogue routes. */
  assert.match(shell, /_isAuthCallbackHash\(\)/);
  assert.match(shell, /authHash \? "account\/recover"/);
  assert.match(shell, /_openRecoveryRoute\(A\)/);
  assert.match(shell, /#\/account\/recover/);

  /* The recovered user's server-owned role, not the screen that requested the
     email, chooses the form. Admin completion signs out so the new password is
     proven by a fresh console sign-in. */
  assert.match(auth, /recoveryScopeOf\(user\)/);
  assert.match(auth, /user\s*&&\s*user\.app_metadata\s*&&\s*user\.app_metadata\.role/);
  assert.match(shell, /recoveryScope\(\) === "admin"/);
  assert.match(shell, /#\/admin\/recover/);
  assert.match(adminShell, /scope === "customer"/);
  assert.match(adminShell, /#\/account\/recover/);
  assert.match(adminShell, /onAdminRecoverSubmit/);
  assert.match(adminShell, /A\.updatePassword\(password\)/);
  assert.match(adminShell, /A\.signOut\(\)/);
  assert.match(adminShell, /const recoveryHash = location\.hash === "#\/admin\/recover" \|\| this\._isAuthCallbackHash\(\)/);
  assert.match(adminShell, /const wantsRecover = s\.section === "recover" \|\| recoveryHash/);

  /* Neither surface may turn a provider failure into a success notice. */
  assert.match(shell, /res && res\.code === "rate_limited"/);
  assert.match(adminShell, /res && res\.code === "rate_limited"/);
});

test("PASSWORD_RECOVERY survives a back-to-back initial session event", async () => {
  const source = await read("tsumugi-auth.js");
  let authCallback;
  let finishSessionRead;
  const recoveredSession = {
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      email: "owner@example.test",
      app_metadata: { role: "owner" },
      user_metadata: {},
    },
  };
  const client = {
    auth: {
      onAuthStateChange(callback) {
        authCallback = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getSession() {
        return new Promise((resolve) => { finishSessionRead = resolve; });
      },
    },
  };
  const window = {
    TSUMUGI_AUTH_CONFIG: {
      url: "https://project-ref.supabase.co",
      anonKey: "sb_publishable_test",
    },
    TSUMUGI_SUPABASE_CREATE: () => client,
    TSUMUGI_STORE: {
      setSession() {}, clearSession() {}, mergeAnonWishlist() {},
    },
  };
  const recoveryStore = new Map();
  const context = {
    window, console, Date, Promise, setTimeout, clearTimeout,
    localStorage: { getItem() { return null; } },
    sessionStorage: {
      getItem(key) { return recoveryStore.get(key) ?? null; },
      setItem(key, value) { recoveryStore.set(key, String(value)); },
      removeItem(key) { recoveryStore.delete(key); },
    },
  };
  vm.runInNewContext(source, context, { filename: "tsumugi-auth.js" });

  const boot = window.TSUMUGI_CUSTOMER_AUTH.boot();
  for (let i = 0; i < 12 && (!authCallback || !finishSessionRead); i++) await Promise.resolve();
  assert.equal(typeof authCallback, "function", "Supabase auth callback was not registered");
  assert.equal(typeof finishSessionRead, "function", "initial Supabase session read did not start");
  authCallback("PASSWORD_RECOVERY", recoveredSession);
  authCallback("INITIAL_SESSION", recoveredSession);
  finishSessionRead({ data: { session: recoveredSession } });
  await boot;
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(window.TSUMUGI_CUSTOMER_AUTH.isRecovering(), true);
  assert.equal(window.TSUMUGI_CUSTOMER_AUTH.status(), "signed_out",
    "a recovery-only session must not become an ordinary customer session");
  assert.equal(window.TSUMUGI_AUTH.status(), "signed_out",
    "a recovery-only owner session must not paint the admin console");
  assert.equal(window.TSUMUGI_CUSTOMER_AUTH.recoveryScope(), "admin");
  assert.equal(window.TSUMUGI_AUTH.recoveryScope(), "admin");
  assert.deepEqual(JSON.parse(recoveryStore.get("tsumugi.auth.recovery.v1")), {
    uid: recoveredSession.user.id,
    scope: "admin",
    at: JSON.parse(recoveryStore.get("tsumugi.auth.recovery.v1")).at,
  });
});

test("recovery scope survives the same-origin public-to-admin handoff", async () => {
  const source = await read("tsumugi-auth.js");
  const recoveredSession = {
    user: {
      id: "00000000-0000-4000-8000-000000000002",
      email: "owner@example.test",
      app_metadata: { role: "owner" },
      user_metadata: {},
    },
  };
  const values = new Map([
    ["tsumugi.auth.recovery.v1", JSON.stringify({
      uid: recoveredSession.user.id, scope: "admin", at: Date.now(),
    })],
  ]);
  const sessionStorage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const client = {
    auth: {
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getSession() { return Promise.resolve({ data: { session: recoveredSession } }); },
    },
  };
  const window = {
    TSUMUGI_AUTH_CONFIG: { url: "https://project-ref.supabase.co", anonKey: "sb_publishable_test" },
    TSUMUGI_SUPABASE_CREATE: () => client,
    TSUMUGI_STORE: { setSession() {}, clearSession() {}, mergeAnonWishlist() {} },
  };
  vm.runInNewContext(source, {
    window, console, Date, Promise, setTimeout, clearTimeout, sessionStorage,
    localStorage: { getItem() { return null; } },
  }, { filename: "tsumugi-auth.js" });

  await window.TSUMUGI_AUTH.boot();
  assert.equal(window.TSUMUGI_AUTH.isRecovering(), true);
  assert.equal(window.TSUMUGI_AUTH.recoveryScope(), "admin");
  assert.equal(window.TSUMUGI_AUTH.status(), "signed_out");
});

test("customer recovery stays customer-scoped and reset errors stay visible", async () => {
  const source = await read("tsumugi-auth.js");
  const redirectCalls = [];
  let resetCount = 0;
  let authCallback;
  const client = {
    auth: {
      onAuthStateChange(callback) {
        authCallback = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      resetPasswordForEmail(email, options) {
        redirectCalls.push({ email, redirectTo: options.redirectTo });
        resetCount++;
        return Promise.resolve(resetCount === 1
          ? { error: null }
          : { error: { status: 429, code: "over_email_send_rate_limit", message: "too many" } });
      },
    },
  };
  const recoveryStore = new Map();
  const window = {
    TSUMUGI_AUTH_CONFIG: { url: "https://project-ref.supabase.co", anonKey: "sb_publishable_test" },
    TSUMUGI_SUPABASE_CREATE: () => client,
    TSUMUGI_STORE: { setSession() {}, clearSession() {}, mergeAnonWishlist() {} },
  };
  vm.runInNewContext(source, {
    window, console, Date, Promise, setTimeout, clearTimeout,
    document: { currentScript: { src: "https://bon214.github.io/tsumugi-vintage/tsumugi-auth.js" } },
    location: { origin: "https://bon214.github.io", pathname: "/tsumugi-vintage/" },
    localStorage: { getItem() { return null; } },
    sessionStorage: {
      getItem(key) { return recoveryStore.get(key) ?? null; },
      setItem(key, value) { recoveryStore.set(key, String(value)); },
      removeItem(key) { recoveryStore.delete(key); },
    },
  }, { filename: "tsumugi-auth.js" });

  const adminSend = await window.TSUMUGI_AUTH.resetPassword(" Staff@Example.test ");
  const customerSend = await window.TSUMUGI_CUSTOMER_AUTH.resetPassword(" Buyer@Example.test ");
  assert.equal(adminSend.ok, true);
  assert.equal(adminSend.status, "email_sent");
  assert.equal(customerSend.ok, false);
  assert.equal(customerSend.code, "rate_limited");
  assert.equal(redirectCalls[0].email, "staff@example.test");
  assert.equal(redirectCalls[0].redirectTo, "https://bon214.github.io/tsumugi-vintage/admin.html");
  assert.equal(redirectCalls[1].redirectTo, "https://bon214.github.io/tsumugi-vintage/");

  authCallback("PASSWORD_RECOVERY", {
    user: {
      id: "00000000-0000-4000-8000-000000000003",
      email: "buyer@example.test",
      app_metadata: { role: "customer" },
      user_metadata: {},
    },
  });
  assert.equal(window.TSUMUGI_CUSTOMER_AUTH.recoveryScope(), "customer");
  assert.equal(window.TSUMUGI_AUTH.recoveryScope(), "customer");
});

test("CMS cannot initialize the shared Supabase client before Auth is listening", async () => {
  const source = await read("tsumugi-repository.js");
  let authBooted = false;
  let clientCalls = 0;
  let snapshotApplied = false;
  const query = {
    select() {
      return { order() { return Promise.resolve({ data: [], error: null }); } };
    },
  };
  const window = {
    TSUMUGI_AUTH_CONFIG: {
      url: "https://project-ref.supabase.co",
      anonKey: "sb_publishable_test",
    },
    TSUMUGI_STORE: {
      isStaffSession() { return false; },
      _setRemoteStatus() {},
      _applyRemoteCMS() { snapshotApplied = true; },
    },
    TSUMUGI_SUPABASE_CLIENT() {
      clientCalls++;
      assert.equal(authBooted, true,
        "the shared client was created before Auth registered its recovery listener");
      return Promise.resolve({ from() { return query; } });
    },
  };
  const context = { window, console, Promise, setTimeout, clearTimeout };

  /* Production loads repository before auth. Its eager ready() must wait. */
  vm.runInNewContext(source, context, { filename: "tsumugi-repository.js" });
  assert.equal(clientCalls, 0, "repository touched Supabase while Auth was absent");

  window.TSUMUGI_AUTH = {
    boot() { authBooted = true; return Promise.resolve(); },
    subscribe() { return function () {}; },
  };
  await window.TSUMUGI_CMS.ready();

  assert.equal(clientCalls, 1);
  assert.equal(snapshotApplied, true);
});
