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
