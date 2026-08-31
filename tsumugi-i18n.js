/* TSUMUGI bilingual copy — public API.
   window.TSUMUGI_I18N.t(lang) returns a flat {key: string} map for templates;
   the other members translate individual record values.

   The strings themselves live in four sibling part files, which MUST be loaded
   before this one (each registers itself on window.TSUMUGI_I18N_PARTS):

     tsumugi-i18n-public.js     PUB, LIST            storefront copy
     tsumugi-i18n-admin.js      ADM, ADMPAIRS, ADM2  admin console copy
     tsumugi-i18n-orders.js     ORD                  orders / checkout / roles
     tsumugi-i18n-content.js    product + article record copy, taxonomy

   The split is internal only: every key, and the whole external API, is
   unchanged from when all of it lived in this file. */
(function () {
  "use strict";
  if (window.TSUMUGI_I18N) return;

  var P = window.TSUMUGI_I18N_PARTS;
  var NEEDED = ["PUB", "LIST", "ADM", "ADMPAIRS", "ADM2", "ORD", "TAX", "PROD", "NOTE",
                "ART", "ART_BODY", "MAT_VOICE", "MAT_CARE", "SILHOUETTE", "GRADE_VOICE",
                "DETAIL_CAPS", "STORY"];
  var missing = P ? NEEDED.filter(function (k) { return !P[k]; }) : NEEDED;
  if (missing.length) {
    // Loud rather than silent: a missing part would otherwise show as blank labels.
    throw new Error("tsumugi-i18n.js: copy parts not loaded — missing " + missing.join(", ")
      + ". Load tsumugi-i18n-public.js, -admin.js, -orders.js and -content.js first.");
  }

  var PUB = P.PUB, LIST = P.LIST, ADM = P.ADM, ADMPAIRS = P.ADMPAIRS, ADM2 = P.ADM2, ORD = P.ORD;
  var TAX = P.TAX, PROD = P.PROD, NOTE = P.NOTE, ART = P.ART, ART_BODY = P.ART_BODY;
  var MAT_VOICE = P.MAT_VOICE, MAT_CARE = P.MAT_CARE, SILHOUETTE = P.SILHOUETTE;
  var GRADE_VOICE = P.GRADE_VOICE, DETAIL_CAPS = P.DETAIL_CAPS, STORY = P.STORY;

  function build(src, lang) {
    var i = lang === "ja" ? 1 : 0, out = {};
    for (var k in src) out[k] = src[k][i];
    return out;
  }

  window.TSUMUGI_I18N = {
    LANGS: ["en", "ja"],
    t: function (lang) {
      var o = build(PUB, lang);
      var a = build(ADM, lang);
      for (var k in a) if (!(k in o)) o[k] = a[k];
      var b = build(ADM2, lang);
      for (var k2 in b) o[k2] = b[k2];
      var c = build(ORD, lang);
      for (var k3 in c) o[k3] = c[k3];
      return o;
    },
    /* translate one English display string (exact match) — used for values that
       must stay English in state but read Japanese on screen, e.g. sort options */
    label: function (en, lang) {
      if (lang !== "ja") return en;
      for (var n = 0; n < ADMPAIRS.length; n++) if (ADMPAIRS[n][0] === en) return ADMPAIRS[n][1];
      return en;
    },
    /* translate a taxonomy value (category, condition, status) for display */
    editorial: function (p, lang) {
      var k = lang === "ja" ? 1 : 0;
      var mv = (MAT_VOICE[p.material] || MAT_VOICE.Cotton)[k];
      var mc = (MAT_CARE[p.material] || MAT_CARE.Cotton)[k];
      var sil = (SILHOUETTE[p.category] || SILHOUETTE.Outerwear)[k];
      var gr = (GRADE_VOICE[p.conditionName] || GRADE_VOICE["Very Good"])[k];
      var note = lang === "ja"
        ? [p.story, mv].join("\n\n")
        : [p.story, mv].join("\n\n");
      var cond = lang === "ja"
        ? gr + "\n" + p.short + "\n気になる箇所は近くから撮影し、写真に写しています。"
        : gr + "\n" + p.short + "\nAnything of concern is photographed close and appears in the images.";
      var style = lang === "ja"
        ? sil + "\n表記は " + p.size + "。当時の着方に沿うなら、そのままの寸法で。"
        : sil + "\nMarked " + p.size + ". Worn as it was originally worn, the marked size is the size.";
      var care = lang === "ja"
        ? mc + "\n当店でお求めの品は、店が続くかぎり修理します。持ち込みでも、送っていただいても構いません。"
        : mc + "\nWe repair anything we have sold, for as long as we are open — bring it in or send it to us.";
      return {
        note: note,
        condition: cond,
        styling: style,
        care: care,
        details: DETAIL_CAPS.map(function (c) { return c[k]; })
      };
    },
    story: function (value, lang) {
      if (lang !== "ja") return value;
      return STORY[value] || value;
    },
    art: function (value, lang) {
      if (lang !== "ja") return value;
      return ART[value] || value;
    },
    artBody: function (title, lang) {
      return ART_BODY[title] || "";
    },
    note: function (value, lang) {
      if (lang !== "ja") return value;
      return NOTE[value] || value;
    },
    pname: function (value, lang) {
      if (lang !== "ja") return value;
      return PROD[value] || value;
    },
    tx: function (value, lang) {
      if (lang !== "ja") return value;
      return TAX[value] || value;
    },
    locale: function (lang) { return lang === "ja" ? "ja-JP" : "en-US"; },
    /* ordered editorial blocks resolved for one language */
    lists: function (lang) {
      var i = lang === "ja" ? 1 : 0;
      var pick = function (pair) { return pair[i]; };
      return {
        sortOption: function (v) { for (var n = 0; n < LIST.sortOptions.length; n++) if (LIST.sortOptions[n][0] === v) return LIST.sortOptions[n][i]; return v; },
        sortOptions: LIST.sortOptions.map(function (p) { return { value: p[0], label: p[i] }; }),
        group: function (v) { return LIST.groups[v] ? LIST.groups[v][i] : v; },
        price: function (v) { return LIST.prices[v] ? LIST.prices[v][i] : v; },
        accordionTitle: function (v) { return LIST.accordion[v] ? LIST.accordion[v][i] : v; },
        accordionBody: LIST.accordionBody,
        body: function (key, vars) {
          var str = LIST.accordionBody[key][i];
          for (var k in (vars || {})) str = str.split("{" + k + "}").join(vars[k]);
          return str;
        },
        steps: LIST.steps.map(function (x, n) { return { n: "0" + (n + 1), title: pick(x.title), body: pick(x.body), shot: pick(x.shot) }; }),
        standards: LIST.standards.map(function (x) { return { title: pick(x.title), tag: pick(x.tag), body: pick(x.body) }; }),
        timeline: LIST.timeline.map(function (x) { return { year: x.year, body: pick(x.body) }; }),
        footerShop: LIST.footerShop.map(pick),
        footerArchive: LIST.footerArchive.map(pick),
        storeAdmin: pick(LIST.storeAdmin),
        newsletterIdle: pick(LIST.newsletterIdle),
        newsletterOk: pick(LIST.newsletterOk),
        newsletterBad: pick(LIST.newsletterBad),
        recentlyAdded: pick(LIST.recentlyAdded),
        contactHelp: LIST.contactHelp.map(function (c) { return { title: pick(c.title), body: pick(c.body) }; })
      };
    }
  };
})();
