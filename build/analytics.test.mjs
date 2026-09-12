import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../tsumugi-analytics.js", import.meta.url), "utf8");
const shell = await readFile(new URL("../TSUMUGI.dc.html", import.meta.url), "utf8");
const builder = await readFile(new URL("./build-app.mjs", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
const caseStudy = await readFile(new URL("../case-study.html", import.meta.url), "utf8");
const caseStudyBridge = await readFile(new URL("../runtime/case-study-analytics.js", import.meta.url), "utf8");

class MemoryStorage {
  constructor(initial = {}) { this.map = new Map(Object.entries(initial)); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

function harness({
  url = "https://bon214.github.io/tsumugi-vintage/#/home",
  measurementId = "G-TEST123456",
  excluded = false,
  webdriver = false,
  navigationType = "navigate",
  lastPage = null
} = {}) {
  let current = new URL(url);
  const appended = [];
  const listeners = {};
  const localStorage = new MemoryStorage(excluded ? { "tsumugi.analytics.excluded": "1" } : {});
  const sessionStorage = new MemoryStorage(lastPage ? {
    "tsumugi.analytics.lastPage": JSON.stringify(lastPage)
  } : {});
  const location = {};
  for (const key of ["href", "origin", "protocol", "pathname", "search", "hash"]) {
    Object.defineProperty(location, key, { get: () => current[key] });
  }
  const document = {
    title: "TSUMUGI — Home",
    referrer: "https://example.com/profile?email=hidden@example.com",
    cookie: "",
    documentElement: { scrollHeight: 2000 },
    body: { scrollHeight: 2000 },
    head: { appendChild(node) { appended.push(node); } },
    createElement(tag) {
      return { tagName: tag, attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } };
    }
  };
  const root = {
    document,
    location,
    history: {
      state: null,
      replaceState(state, _title, next) {
        this.state = state;
        current = new URL(next, current.origin);
      }
    },
    navigator: { webdriver },
    performance: { getEntriesByType: () => [{ type: navigationType }] },
    localStorage,
    sessionStorage,
    innerHeight: 800,
    scrollY: 0,
    pageYOffset: 0,
    setTimeout(fn) { fn(); return 1; },
    addEventListener(name, fn) { listeners[name] = fn; }
  };
  root.window = root;
  const compiled = source.replace('measurementId: ""', `measurementId: ${JSON.stringify(measurementId)}`);
  vm.runInNewContext(compiled, { window: root, URL, Date, Array, Object, JSON, String, Number, Math, RegExp, encodeURIComponent, isFinite });
  const commands = () => (root.dataLayer || []).map((entry) => Array.from(entry));
  return {
    root, document, appended, listeners, localStorage, sessionStorage, commands,
    navigate(next) { current = new URL(next, current.origin); }
  };
}

test("missing id and non-production surfaces never request the Google tag", () => {
  const missing = harness({ measurementId: "" });
  assert.equal(missing.root.TSUMUGI_ANALYTICS.state().reason, "not_configured");
  assert.equal(missing.appended.length, 0);

  const local = harness({ url: "http://localhost:4173/#/home" });
  assert.equal(local.root.TSUMUGI_ANALYTICS.state().reason, "not_production");
  assert.equal(local.root["ga-disable-G-TEST123456"], true);
  assert.equal(local.appended.length, 0);

  const admin = harness({ url: "https://bon214.github.io/tsumugi-vintage/admin.html#/admin" });
  assert.equal(admin.root.TSUMUGI_ANALYTICS.state().reason, "not_production");
  assert.equal(admin.appended.length, 0);
});

test("owner opt-out is applied before loading and the control query is removed", () => {
  const h = harness({ url: "https://bon214.github.io/tsumugi-vintage/?analytics=off#/analytics" });
  assert.equal(h.localStorage.getItem("tsumugi.analytics.excluded"), "1");
  assert.equal(h.root.location.search, "");
  assert.equal(h.root["ga-disable-G-TEST123456"], true);
  assert.equal(h.appended.length, 0);
});

test("debug mode is one-tab only and does not erase the owner's persisted opt-out", () => {
  const h = harness({
    url: "https://bon214.github.io/tsumugi-vintage/?analytics=debug#/home",
    excluded: true
  });
  assert.equal(h.root.location.search, "");
  assert.equal(h.localStorage.getItem("tsumugi.analytics.excluded"), "1");
  assert.equal(h.root["ga-disable-G-TEST123456"], false);
  assert.equal(h.root.TSUMUGI_ANALYTICS.state().debug, true);
  assert.equal(h.root.TSUMUGI_ANALYTICS.state().enabled, true);
  assert.equal(h.appended.length, 1);
  const config = h.commands().find((row) => row[0] === "config");
  assert.equal(config[2].debug_mode, true);
  assert.equal(h.root.TSUMUGI_ANALYTICS.pageView({ title: "Debug home" }), true);
});

test("production config disables automatic views and sends each virtual page once", () => {
  const h = harness({ url: "https://bon214.github.io/tsumugi-vintage/?utm_source=crowdworks&utm_medium=referral&utm_campaign=portfolio&email=drop-me#/home" });
  assert.equal(h.appended.length, 1);
  assert.match(h.appended[0].src, /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-TEST123456$/);
  const config = h.commands().find((row) => row[0] === "config");
  assert.equal(config[2].send_page_view, false);
  assert.equal(config[2].allow_google_signals, false);

  assert.equal(h.root.TSUMUGI_ANALYTICS.pageView({ title: "Home" }), true);
  assert.equal(h.root.TSUMUGI_ANALYTICS.pageView({ title: "Home again" }), false);
  let views = h.commands().filter((row) => row[0] === "event" && row[1] === "page_view");
  assert.equal(views.length, 1);
  assert.match(views[0][2].page_location, /utm_source=crowdworks/);
  assert.doesNotMatch(views[0][2].page_location, /email=/);
  assert.equal(views[0][2].page_referrer, "https://example.com/profile");

  h.navigate("https://bon214.github.io/tsumugi-vintage/?utm_source=crowdworks&utm_medium=referral&utm_campaign=portfolio#/shop");
  assert.equal(h.root.TSUMUGI_ANALYTICS.pageView({ title: "Shop" }), true);
  views = h.commands().filter((row) => row[0] === "event" && row[1] === "page_view");
  assert.equal(views.length, 2);
  assert.equal(views[1][2].page_group, "shop");
  assert.match(views[1][2].page_referrer, /#\/home$/);
});

test("90 percent scroll resets per virtual page and sensitive parameters are dropped", () => {
  const h = harness();
  h.root.TSUMUGI_ANALYTICS.pageView({ title: "Home" });
  h.root.scrollY = 1000;
  h.listeners.scroll();
  h.listeners.scroll();
  let scrolls = h.commands().filter((row) => row[0] === "event" && row[1] === "scroll");
  assert.equal(scrolls.length, 1);
  assert.equal(scrolls[0][2].percent_scrolled, 90);

  assert.equal(h.root.TSUMUGI_ANALYTICS.track("demo_contact_submit", {
    form_type: "portfolio_contact",
    email: "hidden@example.com",
    query: "private words",
    product_id: "12"
  }), true);
  const custom = h.commands().find((row) => row[0] === "event" && row[1] === "demo_contact_submit");
  assert.equal(custom[2].email, undefined);
  assert.equal(custom[2].query, undefined);
  assert.equal(custom[2].product_id, "12");
  assert.equal(h.root.TSUMUGI_ANALYTICS.track("purchase", { value: 1000 }), false);

  h.navigate("https://bon214.github.io/tsumugi-vintage/#/journal");
  h.root.scrollY = 0;
  h.root.TSUMUGI_ANALYTICS.pageView({ title: "Journal" });
  h.root.scrollY = 1000;
  h.listeners.scroll();
  scrolls = h.commands().filter((row) => row[0] === "event" && row[1] === "scroll");
  assert.equal(scrolls.length, 2);
});

test("the standalone production case study has its own page group", () => {
  const h = harness({ url: "https://bon214.github.io/tsumugi-vintage/case-study.html" });
  assert.equal(h.root.TSUMUGI_ANALYTICS.pageView({ title: "TSUMUGI 制作解説", group: "case_study" }), true);
  assert.equal(h.root.TSUMUGI_ANALYTICS.track("case_study_site_select", { destination: "home" }), true);
  const view = h.commands().find((row) => row[0] === "event" && row[1] === "page_view");
  const selection = h.commands().find((row) => row[0] === "event" && row[1] === "case_study_site_select");
  assert.equal(view[2].page_group, "case_study");
  assert.equal(selection[2].page_group, "case_study");
});

test("a rapid reload or release-marker reload does not add a normal page view", () => {
  const url = "https://bon214.github.io/tsumugi-vintage/#/home";
  const rapid = harness({ navigationType: "reload", lastPage: { url, at: Date.now() } });
  assert.equal(rapid.root.TSUMUGI_ANALYTICS.pageView({ title: "Home" }), false);
  assert.equal(rapid.commands().filter((row) => row[1] === "page_view").length, 0);

  const release = harness({
    url: "https://bon214.github.io/tsumugi-vintage/?__tsumugi_update=abc#/home",
    lastPage: { url, at: 1 }
  });
  assert.equal(release.root.TSUMUGI_ANALYTICS.pageView({ title: "Home" }), false);
  assert.equal(release.commands().filter((row) => row[1] === "page_view").length, 0);
});

test("the storefront, build and Pages workflow wire one public-only analytics adapter", () => {
  assert.equal((shell.match(/src="\.\/tsumugi-analytics\.js"/g) || []).length, 1);
  assert.match(shell, /isAnalyticsSettings/);
  assert.match(shell, /アクセス解析設定/);
  assert.match(builder, /process\.env\.GA4_MEASUREMENT_ID/);
  assert.match(builder, /appTags\("\.\/", "main-admin\.js", false\)/);
  assert.match(builder, /https:\/\/www\.googletagmanager\.com/);
  assert.match(builder, /https:\/\/\*\.google-analytics\.com/);
  assert.match(builder, /https:\/\/\*\.analytics\.google\.com/);
  assert.match(workflow, /GA4_MEASUREMENT_ID:\s*\$\{\{ vars\.GA4_MEASUREMENT_ID \}\}/);
  assert.equal((caseStudy.match(/tsumugi-analytics\.js/g) || []).length, 1);
  assert.match(caseStudy, /runtime\/case-study-analytics\.js/);
  assert.match(caseStudyBridge, /group:\s*"case_study"/);
  assert.match(caseStudyBridge, /case_study_site_select/);
});
