// Browser regression against the assembled dist, with local demo data only.
// Usage: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node build/admin-ui.smoke.mjs
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve("dist");
const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(/^\/tsumugi-vintage/, "");
  const file = path.resolve(root, "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const mime = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".svg":"image/svg+xml", ".jpg":"image/jpeg", ".png":"image/png" };
    res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port + "/tsumugi-vintage";
let browser;
try {
  browser = await chromium.launch({ headless:true, channel:process.env.BROWSER_CHANNEL || "chrome" });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  // Disable all external access; no admin credentials or production mutations.
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort();
    if (url.pathname.endsWith("/auth-config.js")) return route.fulfill({ contentType:"text/javascript", body:"window.TSUMUGI_AUTH_CONFIG={};" });
    return route.continue();
  });
  await page.goto(base + "/admin.html#/admin/products");
  await page.waitForFunction(() => window.TSUMUGI_AUTH?.status() === "signed_out");
  await page.evaluate(async () => {
    const S = window.TSUMUGI_STORE;
    await window.TSUMUGI_AUTH.signIn(S.DEMO.email, S.DEMO.password, false);
    S.setLang("ja");
  });
  await page.locator(".admin-list").waitFor();
  await page.locator("#dc-boot").waitFor({ state:"detached" });
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height:900 });
    for (const section of ["products","orders","customers","news"]) {
      await page.evaluate(s => { location.hash = "#/admin/" + s; }, section);
      const list = page.locator('[data-sc-name="Admin' + section[0].toUpperCase() + section.slice(1) + '"] .admin-list-scroll');
      await list.waitFor();
      const before = await page.evaluate(() => {
        const box = sel => { const r=document.querySelector(sel)?.getBoundingClientRect(); return r ? {y:r.y,bottom:r.bottom}:null; };
        return { header:box("header"), filter:box(".admin-list-filters"), pager:box(".admin-list-pager") };
      });
      if (section === "products" && (width === 1440 || width === 390)) {
        await page.screenshot({ path:"/private/tmp/tsumugi-admin-products-" + width + ".png" });
      }
      const area = await list.boundingBox();
      assert.ok(area.height > 80, section + " usable list height at " + width);
      assert.ok(area.y >= before.filter.bottom, section + " filter separated");
      assert.ok(area.y + area.height <= (before.pager?.y ?? 900) + 1, section + " pagination separated");
      await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
      const after = await page.evaluate(() => {
        const box = sel => { const r=document.querySelector(sel)?.getBoundingClientRect(); return r ? {y:r.y,bottom:r.bottom}:null; };
        const area = document.querySelector(".admin-list-scroll");
        return { header:box("header"), filter:box(".admin-list-filters"), pager:box(".admin-list-pager"),
          scroll:area.scrollTop, max:area.scrollHeight-area.clientHeight, body:window.scrollY,
          overflow:document.documentElement.scrollWidth > innerWidth };
      });
      assert.deepEqual(after.header, before.header);
      assert.deepEqual(after.filter, before.filter);
      assert.deepEqual(after.pager, before.pager);
      assert.equal(after.body, 0);
      assert.equal(after.overflow, false);
      if (after.max > 0) assert.ok(after.scroll > 0, "list actually scrolled");
      if (before.pager && before.pager.bottom > 901) {
        console.log(JSON.stringify({ section, width, area, before, after }));
        console.log(await list.evaluate(el => { const rows=[]; for(let n=el;n;n=n.parentElement) { const c=getComputedStyle(n); rows.push({tag:n.tagName,cl:n.className,attr:n.getAttribute("data-admin-fixed"),height:c.height,min:c.minHeight,display:c.display,flex:c.flex,overflow:c.overflow}); } return rows; }));
        await page.screenshot({ path:"/private/tmp/tsumugi-admin-layout-debug.png" });
      }
      if (before.pager) assert.ok(before.pager.bottom <= 901, "pager stays in viewport");
      console.log("PASS fixed list", section, width, "scroll", after.scroll);
    }
  }
  await page.setViewportSize({ width:1440, height:900 });
  await page.evaluate(() => { location.hash = "#/admin/featured"; });
  const add = page.locator("header button").filter({ hasText:/Feature を追加|Featureを追加|Add feature|追加/ }).last();
  await add.waitFor();
  const count = await page.evaluate(() => window.TSUMUGI_STORE.heroFeatures().length);
  // The bundled demo may have six heroes; remove one in local storage only.
  await page.evaluate(() => { const S=window.TSUMUGI_STORE; while(S.heroFeatures().length >= S.HERO_MAX) S.deleteHeroFeature(S.heroFeatures().at(-1).id); });
  const baseline = await page.evaluate(() => window.TSUMUGI_STORE.heroFeatures().length);
  await add.click();
  await page.locator("#fc-new-source").waitFor();
  assert.equal(await page.evaluate(() => window.TSUMUGI_STORE.heroFeatures().length), baseline);
  await page.locator("#fc-new-type").selectOption("page");
  await page.locator("#fc-new-source").selectOption("about");
  await page.screenshot({ path:"/private/tmp/tsumugi-admin-feature-add.png" });
  await page.locator('form button[type="submit"]').click();
  await page.waitForFunction(() => location.hash === "#/admin/featured");
  const saved = await page.evaluate(() => window.TSUMUGI_STORE.heroFeatures().at(-1));
  assert.equal(saved.sourceType, "page"); assert.equal(saved.route, "about"); assert.equal(saved.enabled, false);
  assert.equal(await page.evaluate(() => window.TSUMUGI_STORE.heroFeatures().length), baseline + 1);
  console.log("PASS header hero add, source selection, disabled save");
  await page.evaluate(() => { location.hash = "#/admin/specials"; });
  const specialAdd = page.locator("header button").filter({ hasText:/特集を追加|特集を作成|New feature|追加/ }).last();
  await specialAdd.waitFor();
  await specialAdd.click();
  await page.waitForFunction(() => /^#\/admin\/specials\/.+/.test(location.hash));
  console.log("PASS header special add opens editor");
  assert.deepEqual(errors, []);
  console.log("PASS no browser runtime exceptions; no external requests permitted");
} finally {
  if (browser) await browser.close();
  await new Promise(r => server.close(r));
}
