/* tsumugi-analytics.js — privacy-aware GA4 adapter for the public storefront.
 *
 * The measurement id is injected into dist/ by build/build-app.mjs. The source
 * tree intentionally carries no live id, so local previews and authoring files
 * cannot send production analytics by accident.
 *
 * This site is a hash-routed SPA. Automatic page views are disabled and the
 * root component calls pageView() only after the route title has been updated.
 * The adapter also owns the 90% `scroll` event so it can reset per virtual
 * page. Never send form values, search text, account ids or order ids here.
 */
(function (root) {
  "use strict";

  var CFG = {
    measurementId: "",
    siteUrl: "https://bon214.github.io/tsumugi-vintage"
  };
  var OPT_OUT_KEY = "tsumugi.analytics.excluded";
  var LAST_PAGE_KEY = "tsumugi.analytics.lastPage";
  var CONTROL_PARAM = "analytics";
  var PII_KEY = /(?:email|e_mail|name|address|phone|postal|message|query|search_term|password|token|order_id|customer_id)/i;
  var FORBIDDEN_EVENTS = { purchase: true, refund: true };
  var doc = root.document;
  var id = String(CFG.measurementId || "").trim();
  var storageOkay = true;
  var tagStarted = false;
  var currentLocation = "";
  var currentGroup = "";
  var scrollSent = false;
  var releaseReload = false;
  var debugMode = false;

  function storage(name) {
    try {
      var area = root[name];
      var probe = "__tsumugi_analytics_probe__";
      area.setItem(probe, "1");
      area.removeItem(probe);
      return area;
    } catch (e) {
      storageOkay = false;
      return null;
    }
  }

  var local = storage("localStorage");
  var session = storage("sessionStorage");

  function persistExcluded(value) {
    if (!local) return false;
    try {
      if (value) local.setItem(OPT_OUT_KEY, "1");
      else local.removeItem(OPT_OUT_KEY);
      return true;
    } catch (e) {
      storageOkay = false;
      return false;
    }
  }

  function storedExcluded() {
    if (!local) return true;
    try { return local.getItem(OPT_OUT_KEY) === "1"; }
    catch (e) { storageOkay = false; return true; }
  }

  /* ?analytics=off is the zero-beacon setup URL for the site owner and test
     browsers. It is consumed before the Google script can be requested, then
     removed so it never fragments GA page locations or copied links. */
  function consumeControlParam() {
    try {
      var url = new URL(root.location.href);
      releaseReload = url.searchParams.has("_tsumugi_release")
        || url.searchParams.has("_lumie_release")
        || url.searchParams.has("__tsumugi_update");
      var command = String(url.searchParams.get(CONTROL_PARAM) || "").toLowerCase();
      if (command === "debug") {
        /* A one-tab diagnostic session. It deliberately does not change the
           owner's persisted opt-out, and disappears on the next full load. */
        debugMode = true;
        url.searchParams.delete(CONTROL_PARAM);
        var debugClean = url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "") + url.hash;
        root.history.replaceState(root.history.state, "", debugClean);
        return;
      }
      if (command !== "off" && command !== "on") return;
      persistExcluded(command === "off");
      url.searchParams.delete(CONTROL_PARAM);
      var clean = url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "") + url.hash;
      root.history.replaceState(root.history.state, "", clean);
    } catch (e) { }
  }

  function validId() { return /^G-[A-Z0-9]+$/i.test(id) && id !== "G-XXXXXXXXXX"; }

  function isProductionStorefront() {
    if (!validId() || !doc || !root.location) return false;
    if (root.navigator && root.navigator.webdriver === true) return false;
    if (root.location.protocol !== "https:") return false;
    if (/^#\/admin(?:\/|$)/.test(root.location.hash || "")) return false;
    if (/\/admin\.html$/i.test(root.location.pathname || "")) return false;
    try {
      var expected = new URL(CFG.siteUrl);
      var prefix = expected.pathname.replace(/\/+$/, "") + "/";
      var actual = (root.location.pathname || "/").replace(/\/{2,}/g, "/");
      return root.location.origin === expected.origin
        && (actual === expected.pathname.replace(/\/+$/, "") || actual.indexOf(prefix) === 0);
    } catch (e) { return false; }
  }

  function disabled() { return !storageOkay || (storedExcluded() && !debugMode) || !isProductionStorefront(); }

  function applyDisableFlag() {
    if (validId()) root["ga-disable-" + id] = disabled();
  }

  function gtag() {
    root.dataLayer = root.dataLayer || [];
    root.dataLayer.push(arguments);
  }

  function startTag() {
    applyDisableFlag();
    if (tagStarted || disabled()) return false;
    tagStarted = true;
    root.dataLayer = root.dataLayer || [];
    root.gtag = root.gtag || gtag;
    root.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    root.gtag("js", new Date());
    root.gtag("config", id, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      debug_mode: debugMode
    });
    var script = doc.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    script.setAttribute("data-tsumugi-analytics", "1");
    doc.head.appendChild(script);
    return true;
  }

  function cleanLocation() {
    try {
      var url = new URL(root.location.href);
      /* Only the documented campaign keys survive. Arbitrary query values can
         contain pasted email addresses or names, and therefore do not belong
         in Analytics even when a third party constructs such a link. */
      Array.from(url.searchParams.keys()).forEach(function (key) {
        if (["utm_source", "utm_medium", "utm_campaign"].indexOf(key) < 0) {
          url.searchParams.delete(key);
        }
      });
      return url.toString();
    } catch (e) { return String(root.location.href || ""); }
  }

  function cleanReferrer(value) {
    try {
      var url = new URL(String(value || ""));
      return url.origin + url.pathname;
    } catch (e) { return ""; }
  }

  function routeGroup() {
    var raw = String(root.location.hash || "#/home").replace(/^#\/?/, "");
    var first = raw.split("/")[0] || "home";
    return first.replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "home";
  }

  function cleanGroup(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  }

  function recentReloadOf(url) {
    if (!session) return false;
    try {
      var previous = JSON.parse(session.getItem(LAST_PAGE_KEY) || "null");
      if (!previous || previous.url !== url) return false;
      var nav = root.performance && root.performance.getEntriesByType
        ? root.performance.getEntriesByType("navigation")[0] : null;
      var quickReload = nav && nav.type === "reload" && Date.now() - Number(previous.at || 0) < 30000;
      return releaseReload || quickReload;
    } catch (e) { return false; }
  }

  function rememberPage(url) {
    if (!session) return;
    try { session.setItem(LAST_PAGE_KEY, JSON.stringify({ url: url, at: Date.now() })); }
    catch (e) { }
  }

  function pageView(details) {
    if (disabled()) return false;
    startTag();
    var url = cleanLocation();
    if (!url || url === currentLocation) return false;
    /* For a virtual navigation, the previous virtual URL is the referrer.
       On the first view only, use the external document referrer. */
    var referrer = currentLocation || cleanReferrer(doc.referrer);
    currentLocation = url;
    currentGroup = cleanGroup(details && details.group) || routeGroup();
    scrollSent = false;
    if (recentReloadOf(url)) {
      scrollSent = true;
      rememberPage(url);
      return false;
    }
    rememberPage(url);
    root.gtag("event", "page_view", {
      page_title: String((details && details.title) || doc.title || "TSUMUGI").slice(0, 300),
      page_location: url,
      page_referrer: referrer,
      page_group: currentGroup
    });
    root.setTimeout(checkScroll, 0);
    return true;
  }

  function safeParams(params) {
    var out = {};
    Object.keys(params || {}).forEach(function (key) {
      if (!/^[a-z][a-z0-9_]{0,39}$/i.test(key) || PII_KEY.test(key)) return;
      var value = params[key];
      if (typeof value === "string") {
        if (value.indexOf("@") >= 0) return;
        out[key] = value.slice(0, 100);
      } else if (typeof value === "number" && isFinite(value)) out[key] = value;
      else if (typeof value === "boolean") out[key] = value;
    });
    out.page_location = currentLocation || cleanLocation();
    out.page_title = String(doc.title || "TSUMUGI").slice(0, 300);
    out.page_group = currentGroup || routeGroup();
    return out;
  }

  function track(name, params) {
    name = String(name || "").toLowerCase();
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(name) || FORBIDDEN_EVENTS[name] || disabled()) return false;
    startTag();
    root.gtag("event", name, safeParams(params));
    return true;
  }

  function checkScroll() {
    if (scrollSent || disabled() || !currentLocation) return;
    var de = doc.documentElement || {};
    var body = doc.body || {};
    var height = Math.max(Number(de.scrollHeight || 0), Number(body.scrollHeight || 0));
    var seen = Number(root.scrollY || root.pageYOffset || 0) + Number(root.innerHeight || 0);
    if (height > 0 && seen / height >= 0.9) {
      scrollSent = true;
      track("scroll", { percent_scrolled: 90 });
    }
  }

  function clearAnalyticsCookies() {
    if (!doc || !doc.cookie) return;
    String(doc.cookie).split(";").forEach(function (part) {
      var name = part.split("=")[0].trim();
      if (!/^_ga(?:_|$)/.test(name)) return;
      doc.cookie = name + "=; Max-Age=0; path=/; SameSite=Lax";
    });
  }

  function setExcluded(value) {
    value = !!value;
    if (!persistExcluded(value)) return state();
    applyDisableFlag();
    if (value) {
      clearAnalyticsCookies();
      return state();
    }
    currentLocation = "";
    currentGroup = "";
    scrollSent = false;
    startTag();
    pageView({ title: doc.title });
    return state();
  }

  function state() {
    var excluded = !storageOkay || (storedExcluded() && !debugMode);
    var eligible = isProductionStorefront();
    return {
      configured: validId(),
      eligible: eligible,
      excluded: excluded,
      debug: debugMode,
      enabled: validId() && eligible && !excluded,
      reason: !validId() ? "not_configured"
        : !storageOkay ? "storage_unavailable"
        : excluded ? "excluded"
        : !eligible ? "not_production"
        : "enabled"
    };
  }

  consumeControlParam();
  applyDisableFlag();
  if (isProductionStorefront() && (!storedExcluded() || debugMode)) startTag();
  if (root.addEventListener) root.addEventListener("scroll", checkScroll, { passive: true });

  root.TSUMUGI_ANALYTICS = Object.freeze({
    pageView: pageView,
    track: track,
    state: state,
    setExcluded: setExcluded,
    storageKey: OPT_OUT_KEY
  });
})(window);
