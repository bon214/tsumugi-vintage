/* build/prerender.mjs — static HTML for crawlers that do not run JavaScript.
 *
 * WHY
 * The storefront is a hash-routed single page. Client-side metadata
 * (_syncDocumentMeta in TSUMUGI.dc.html) fixes the browser tab, bookmarks,
 * share sheets and any crawler that executes JS — but a crawler that does not
 * sees one page's metadata for every route. This generator emits a real URL per
 * route with real metadata and real body copy, then hands a human into the app.
 *
 * OUTPUT (paths are real, not fragments)
 *   dist/index.html            home
 *   dist/about/index.html
 *   dist/shop/index.html
 *   dist/journal/index.html
 *   dist/contact/index.html
 *   dist/p/<id>/index.html     one per published product
 *   dist/a/<slug>/index.html   one per published article
 *   dist/sitemap.xml
 *
 * SUBPATH SAFETY
 * Nothing is written as a root-absolute path. Every href, src and canonical is
 * relative to the emitted file's own depth, so the same output works at
 * https://user.github.io/repo/ and at https://example.com/. When SITE_URL is
 * given, canonical and og:url are additionally stamped absolute (crawlers
 * prefer that) — pass it in CI:
 *
 *   SITE_URL=https://user.github.io/repo node build/prerender.mjs
 *
 * USAGE
 *   node build/prerender.mjs [--out dist] [--app ./TSUMUGI.dc.html]
 *
 * The catalogue comes from build/seed-catalog.json. Regenerate that from a live
 * Supabase project (or from the seeded store) as part of the build; committing a
 * snapshot is the supported alternative and is what this repository does.
 */

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const OUT = argOf("out", "dist");
const APP = argOf("app", "TSUMUGI.dc.html");     // entry the human is sent to
const SITE_URL = (process.env.SITE_URL || "").replace(/\/+$/, "");
const DEPLOY_BASE = (() => {
  const explicit = process.env.BASE_PATH || "";
  let value = explicit;
  if (!value && SITE_URL) {
    try { value = new URL(SITE_URL).pathname; } catch { value = ""; }
  }
  value = String(value || "/").replace(/^\/+|\/+$/g, "");
  return value ? `/${value}/` : "/";
})();
const SITE = "TSUMUGI";
const OG_IMAGE = "og-cover.jpg";

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const yen = (n) => "¥ " + Number(n || 0).toLocaleString("en-US");
const clip = (s, n) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
};

/* "p/1/index.html" is two directories deep, so its relative root is "../../". */
const upTo = (file) => {
  const depth = file.split("/").length - 1;
  return depth === 0 ? "./" : "../".repeat(depth);
};

/* The shared shell. Body copy is real content, not a placeholder: a page that
   redirects with an empty body is worth nothing to a crawler and nothing to a
   visitor whose JavaScript failed. */
function page({ file, route, lang = "ja", title, description, ogType = "website",
                image, jsonLd, heading, kicker, body = [], facts = [], links = [] }) {
  const root = upTo(file);
  const canonicalRel = route === "" ? root : root + route + "/";
  const canonical = SITE_URL ? SITE_URL + "/" + (route ? route + "/" : "") : canonicalRel;
  const imgAbs = image || (SITE_URL ? SITE_URL + "/" + OG_IMAGE : root + OG_IMAGE);
  const fullTitle = route === "" ? `${SITE} — ${title}` : `${title} | ${SITE}`;
  /* The app is hash-routed today, so the handoff carries a fragment. The URL a
     crawler and a visitor SEE is a real path; the fragment exists only inside
     the application shell. */
  const hashRoute = route ? route.replace(/^p\//, "product/").replace(/^a\//, "journal/") : "";
  const appHref = root + APP + (hashRoute ? "#/" + hashRoute : "");

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow">
<!-- The route this page represents inside the application, as markup rather
     than as an inline script: build/build-app.mjs turns these pages into the
     app's own entry points, and the bundle reads this to open the right screen
     without any inline JavaScript (so script-src can stay 'self'). -->
<meta name="dc-route" content="${esc(hashRoute)}">
<meta name="theme-color" content="#F8F7F4">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}favicon.svg">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(imgAbs)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="ja_JP">
<meta property="og:locale:alternate" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(imgAbs)}">
<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>
<style>
  /* Scoped to .prerendered on purpose. In a production build these pages are
     also the application's entry points (build/build-app.mjs), so a bare "p"
     or "a" rule here would restyle every screen of the app that mounts into
     the same document. Only the page-level rules stay global. */
  :root { color-scheme: light }
  *, *::before, *::after { box-sizing: border-box }
  html, body { margin: 0 }
  body { background: #F8F7F4; color: #222222;
         font-family: 'Hanken Grotesk', system-ui, -apple-system, sans-serif }
  .dc-boot { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center;
             min-height: 100svh; background: #F8F7F4; opacity: 1; visibility: visible;
             transition: opacity 420ms ease, visibility 0s linear 420ms }
  .dc-boot__inner { width: min(72vw, 290px); display: flex; flex-direction: column;
                    align-items: center; gap: 22px }
  .dc-boot__logo { display: block; width: 100%; height: auto }
  .dc-boot__track { width: 100%; height: 1px; overflow: hidden; background: #DDD8CF }
  .dc-boot__bar { display: block; width: 38%; height: 100%; background: #6D7761;
                  animation: dcBoot 1.25s cubic-bezier(.4,0,.2,1) infinite }
  .dc-boot__label { font-family: ui-monospace, 'IBM Plex Mono', monospace; font-size: 9px;
                    letter-spacing: .26em; color: #9C978F }
  body.dc-live .dc-boot, body.dc-boot-failed .dc-boot {
    opacity: 0; visibility: hidden; pointer-events: none
  }
  @keyframes dcBoot {
    0% { transform: translateX(-110%) }
    55% { transform: translateX(85%) }
    100% { transform: translateX(270%) }
  }
  .prerendered { max-width: 720px; margin: 0 auto; font-size: 15px; line-height: 1.9;
                 padding: clamp(32px,7vh,80px) clamp(20px,5vw,40px) }
  .prerendered .kicker { font-family: ui-monospace, monospace; font-size: 11px; letter-spacing: .2em; color: #6D7761; margin: 0 0 14px }
  .prerendered h1 { margin: 0 0 18px; font-family: 'EB Garamond', Georgia, serif;
       font-size: clamp(25px,3.2vw,36px); font-weight: 400; line-height: 1.2; text-wrap: pretty }
  .prerendered p { margin: 0 0 16px; color: #4A4740; text-wrap: pretty }
  .prerendered dl { margin: 22px 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 18px; font-size: 13.5px }
  .prerendered dt { color: #9C978F; font-family: ui-monospace, monospace; font-size: 11px; letter-spacing: .12em }
  .prerendered dd { margin: 0; color: #4A4740 }
  .prerendered img { max-width: 100%; height: auto; display: block; margin: 0 0 24px; background: #E4DCD1 }
  .prerendered nav { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 34px;
        border-top: 1px solid #E6E0D7; padding-top: 22px }
  .prerendered a { color: #222222; font-size: 12px; letter-spacing: .16em; text-decoration: none;
      border-bottom: 1px solid #C9C2B7; padding-bottom: 5px;
      min-height: 44px; display: inline-flex; align-items: center }
  .prerendered a:hover { border-bottom-color: #222222 }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important } }
</style>
<script>
  /* Progressive handoff. The content above is what a crawler indexes and what a
     visitor without JavaScript reads; a visitor with JavaScript is moved into
     the application. replace(), so the static page does not sit in history. */
  location.replace(${JSON.stringify(appHref)});
</script>
</head>
<body>
<div id="dc-boot" class="dc-boot" role="status" aria-label="TSUMUGIを読み込んでいます">
  <div class="dc-boot__inner">
    <img class="dc-boot__logo" src="${root}assets/tsumugi-logo.svg" alt="TSUMUGI Vintage Shop" width="145" height="27">
    <span class="dc-boot__track" aria-hidden="true"><span class="dc-boot__bar"></span></span>
    <span class="dc-boot__label">LOADING ARCHIVE</span>
  </div>
</div>
<noscript><style>.dc-boot { display: none !important }</style></noscript>
<main class="prerendered">
  ${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ""}
  <h1>${esc(heading || title)}</h1>
  ${image ? `<img src="${esc(image)}" alt="${esc(body.alt || heading || title)}" width="1200" height="800" loading="eager" decoding="async">` : ""}
  ${body.map((t) => `<p>${esc(t)}</p>`).join("\n  ")}
  ${facts.length ? `<dl>\n    ${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("\n    ")}\n  </dl>` : ""}
  <nav>
    ${[["ONLINE SHOP", root + "shop/"], ["JOURNAL", root + "journal/"],
       ["ABOUT", root + "about/"], ["CONTACT", root + "contact/"],
       ["TSUMUGI", root]].concat(links)
      .map(([label, href]) => `<a href="${esc(href)}">${esc(label)}</a>`).join("\n    ")}
  </nav>
</main>
</body>
</html>
`;
}

const ORG = {
  "@type": "ClothingStore",
  name: SITE,
  address: {
    "@type": "PostalAddress", streetAddress: "4-11-6 Kirigaya",
    addressLocality: "Shibuya-ku", addressRegion: "Tokyo",
    postalCode: "151-0074", addressCountry: "JP",
  },
  priceRange: "¥¥",
};

async function emit(file, html) {
  const path = join(OUT, file);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, html, "utf8");
  return file;
}

const catalog = JSON.parse(await readFile("build/seed-catalog.json", "utf8"));
const written = [];
const urls = [];

/* ------------------------------------------------------------ static routes */

written.push(await emit("index.html", page({
  file: "index.html", route: "", title: "古着とアーカイブの店",
  description: "TSUMUGI は東京の古着店です。年代やブランドではなく、生地・仕立て・今の服と合わせて着られるかで一点ずつ選んでいます。すべて一点物、再入荷はありません。",
  jsonLd: { "@context": "https://schema.org", ...ORG },
  kicker: "TOKYO · VINTAGE & ARCHIVE",
  heading: "新しい服との出会いを、ここから",
  body: [
    "TSUMUGI は東京・渋谷の古着店です。年代や希少性ではなく、生地の質、仕立て、そして今の服と合わせて自然に着られるかを見て、一点ずつ選んでいます。",
    "在庫はすべて一点物です。同じ服にもう一度出会える機会はなかなかありません。",
    "TSUMUGI is a vintage and archive clothing shop in Tokyo. Every piece is one of one, and nothing is restocked.",
  ],
})));
urls.push("");

written.push(await emit("about/index.html", page({
  file: "about/index.html", route: "about", title: "私たちについて",
  description: "生地・つくり・状態・今も着られるか。TSUMUGI が一着を選ぶときの四つの基準と、修理をどこまで見せるかについて。",
  jsonLd: { "@context": "https://schema.org", "@type": "AboutPage", mainEntity: ORG },
  kicker: "ABOUT",
  heading: "人と服との出会いを紡ぐ",
  body: [
    "私自身、古着を選ぶときに年代やブランドだけを見ることはありません。生地や仕立て、着込まれたあとの表情を見て、今でも着たいと思えるかを考えます。",
    "良いところだけでなく、傷や分からないこともそのまま伝え、皆様に古着との出会いを楽しんでもらえる。そんな店でありたいと思っています。",
  ],
  facts: [
    ["生地", "天然繊維を中心に、着込んだあとも風合いが残る生地を選びます。"],
    ["つくり", "縫製やパターン、細部の仕立てまで見て選びます。"],
    ["状態", "傷や色褪せがあっても、まだ十分に着られるものを選びます。"],
    ["今、着てもらえるか", "現代の服と合わせても自然に着られるかを判断材料にしています。"],
  ],
})));
urls.push("about");

written.push(await emit("shop/index.html", page({
  file: "shop/index.html", route: "shop", title: "オンラインショップ",
  description: `一点物のアーカイブを ${catalog.prods.length} 点掲載。アウター、ニット、スウェット、シャツ、トラウザー。再入荷はありません。`,
  jsonLd: {
    "@context": "https://schema.org", "@type": "CollectionPage",
    name: "TSUMUGI Online Shop",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: catalog.prods.length,
      itemListElement: catalog.prods.map((p, i) => ({
        "@type": "ListItem", position: i + 1,
        url: (SITE_URL ? SITE_URL + "/" : "../") + "p/" + p.id + "/",
        name: `${p.brand} ${p.name}`,
      })),
    },
  },
  kicker: "ONLINE SHOP",
  heading: "The Archive",
  body: [
    "在庫はすべて一点物です。売り切れた品は再入荷しません。生地、仕立て、傷や色褪せ、実寸を一着ずつ確認し、分かっていることを商品ページに記載します。",
    "公開準備中の商品は一覧に表示されません。採寸と状態確認が完了したものから順に掲載し、古着特有の変化も含めて、選ぶために必要な情報をできる限り具体的にお伝えします。",
  ],
  facts: catalog.prods.map((p) => [`${p.brand} · ${p.size}`, `${p.name} — ${yen(p.price)}`]),
  links: catalog.prods.map((p) => [`${p.brand} ${p.name}`.toUpperCase(), `../p/${p.id}/`]),
})));
urls.push("shop");

written.push(await emit("journal/index.html", page({
  file: "journal/index.html", route: "journal", title: "Journal",
  description: "入荷の記録、仕入れの旅、修理の考え方、ラベルの読み方。TSUMUGI が書いている服についての覚書。",
  jsonLd: {
    "@context": "https://schema.org", "@type": "Blog", name: "TSUMUGI Journal",
    blogPost: catalog.news.map((n) => ({
      "@type": "BlogPosting", headline: n.title, datePublished: n.date,
      url: (SITE_URL ? SITE_URL + "/" : "../") + "a/" + n.slug + "/",
    })),
  },
  kicker: "JOURNAL",
  heading: "Journal",
  body: [
    "新しく仕入れた服と、その服についての覚書です。年代やラベルだけで価値を決めず、生地、縫製、修理、着込まれたあとの表情を観察して記録します。",
    "記事は取材と写真の準備が整ったものから公開します。仕入れの背景、手入れの方法、残す修理と直す修理の違いまで、一着を長く着るための判断材料をまとめています。",
  ],
  facts: catalog.news.map((n) => [n.date, n.title]),
  links: catalog.news.map((n) => [n.title.toUpperCase().slice(0, 40), `../a/${n.slug}/`]),
})));
urls.push("journal");

written.push(await emit("contact/index.html", page({
  file: "contact/index.html", route: "contact", title: "お問い合わせ",
  description: "TSUMUGI へのお問い合わせ。東京都渋谷区霧ヶ谷4-11-6。営業日・修理相談・お取り置きについて。",
  jsonLd: { "@context": "https://schema.org", "@type": "ContactPage", mainEntity: ORG },
  kicker: "CONTACT",
  heading: "お問い合わせ",
  body: [
    "服のこと、状態のこと、修理のことなど、お気軽にご連絡ください。",
    "※ウェブ上のフォームはポートフォリオ用のデモで、送信は行われません。実際のお問い合わせ先は下記の住所です。",
  ],
  facts: [
    ["ADDRESS", "〒151-0074 東京都渋谷区霧ヶ谷4-11-6"],
    ["HOURS", "金・土・日 12:00–19:00"],
  ],
})));
urls.push("contact");

/* ---------------------------------------------------------------- products */

for (const p of catalog.prods) {
  const route = `p/${p.id}`;
  const title = `${p.brand} ${p.name}`;
  written.push(await emit(`${route}/index.html`, page({
    file: `${route}/index.html`, route, title, ogType: "product",
    description: clip(`${p.brand} ${p.name}（${p.year}年頃・${p.country}）。${p.size} / ${p.material} / 状態 ${p.condition}。${p.note}`, 158),
    image: p.img,
    jsonLd: {
      "@context": "https://schema.org", "@type": "Product",
      name: title, brand: { "@type": "Brand", name: p.brand },
      description: clip(p.note, 300), material: p.material, color: p.colour,
      size: p.size, itemCondition: "https://schema.org/UsedCondition",
      image: p.img ? [p.img] : undefined,
      offers: {
        "@type": "Offer", price: p.price, priceCurrency: "JPY",
        availability: p.status === "soldout"
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
        itemCondition: "https://schema.org/UsedCondition",
        eligibleQuantity: { "@type": "QuantitativeValue", value: 1, unitText: "piece" },
      },
    },
    kicker: `${p.category} · ${p.year} · ${p.country}`,
    heading: title,
    body: [p.note, "一点物です。同じ状態のものは他にありません。"],
    facts: [
      ["PRICE", yen(p.price)], ["SIZE", p.size], ["MATERIAL", p.material],
      ["CONDITION", p.condition], ["ERA", String(p.year)], ["MADE IN", p.country],
    ],
  })));
  urls.push(route);
}

/* ---------------------------------------------------------------- articles */

for (const n of catalog.news) {
  const route = `a/${n.slug}`;
  written.push(await emit(`${route}/index.html`, page({
    file: `${route}/index.html`, route, title: n.title, ogType: "article",
    description: clip(n.summary || n.body, 158),
    image: n.img,
    jsonLd: {
      "@context": "https://schema.org", "@type": "BlogPosting",
      headline: n.title, datePublished: n.date, dateModified: n.date,
      description: clip(n.summary, 300), articleSection: n.category,
      image: n.img ? [n.img] : undefined,
      author: { "@type": "Organization", name: SITE },
      publisher: { "@type": "Organization", name: SITE },
    },
    kicker: `${n.date} · ${n.category}`,
    heading: n.title,
    body: [n.summary, n.body].filter(Boolean),
  })));
  urls.push(route);
}

/* -------------------------------------------------------------- 404 page */

/* GitHub Pages serves /404.html for any path it cannot resolve, which is the
   only server-side behaviour the platform offers. Two things make it matter
   here: a mistyped or retired product URL should land on the shop rather than
   on the platform's default page, and this file is the fallback for a deep
   link that no longer has a prerendered directory.

   It carries noindex — a soft 404 that indexes is worse than none. GitHub Pages
   serves its contents at the unknown URL, so relative assets would resolve at
   the unknown depth. Its links therefore use the explicit deployment base
   (BASE_PATH, SITE_URL's pathname, or "/" for a root deployment). */
written.push(await emit("404.html", `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ページが見つかりません — ${SITE}</title>
<meta name="description" content="お探しのページは見つかりませんでした。一点物のため、販売済みの商品ページは公開を終了することがあります。">
<meta name="robots" content="noindex,follow">
<meta name="theme-color" content="#F8F7F4">
<link rel="icon" href="${DEPLOY_BASE}favicon.svg" type="image/svg+xml">
<meta name="dc-route" content="">
<meta name="dc-base" content="${DEPLOY_BASE}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Hanken+Grotesk:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Noto+Serif+JP:wght@400;500&family=Noto+Sans+JP:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light }
  *, *::before, *::after { box-sizing: border-box }
  html, body { margin: 0 }
  body { background: #F8F7F4; color: #222222;
         font-family: 'Hanken Grotesk', system-ui, -apple-system, sans-serif }
  .dc-boot { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center;
             min-height: 100svh; background: #F8F7F4; opacity: 1; visibility: visible;
             transition: opacity 420ms ease, visibility 0s linear 420ms }
  .dc-boot__inner { width: min(72vw, 290px); display: flex; flex-direction: column; align-items: center; gap: 22px }
  .dc-boot__logo { display: block; width: 100%; height: auto }
  .dc-boot__track { width: 100%; height: 1px; overflow: hidden; background: #DDD8CF }
  .dc-boot__bar { display: block; width: 38%; height: 100%; background: #6D7761; animation: dcBoot 1.25s cubic-bezier(.4,0,.2,1) infinite }
  .dc-boot__label { font-family: ui-monospace, monospace; font-size: 9px; letter-spacing: .26em; color: #9C978F }
  body.dc-live .dc-boot, body.dc-boot-failed .dc-boot { opacity: 0; visibility: hidden; pointer-events: none }
  @keyframes dcBoot { 0% { transform: translateX(-110%) } 55% { transform: translateX(85%) } 100% { transform: translateX(270%) } }
  .prerendered { max-width: 720px; margin: 0 auto; font-size: 15px; line-height: 1.9;
                 padding: clamp(32px,7vh,80px) clamp(20px,5vw,40px) }
  .prerendered .kicker { font-family: ui-monospace, monospace; font-size: 11px;
                         letter-spacing: .2em; color: #6D7761; margin: 0 0 14px }
  .prerendered h1 { margin: 0 0 18px; font-family: 'EB Garamond', Georgia, serif;
       font-size: clamp(25px,3.2vw,36px); font-weight: 400; line-height: 1.2 }
  .prerendered p { margin: 0 0 16px; color: #4A4740; text-wrap: pretty }
  .prerendered nav { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 34px;
        border-top: 1px solid #E6E0D7; padding-top: 22px }
  .prerendered a { color: #222222; font-size: 12px; letter-spacing: .16em; text-decoration: none;
      border-bottom: 1px solid #C9C2B7; padding-bottom: 5px;
      min-height: 44px; display: inline-flex; align-items: center }
  .prerendered a:hover { border-bottom-color: #222222 }
</style>
</head>
<body>
<div id="dc-boot" class="dc-boot" role="status" aria-label="TSUMUGIを読み込んでいます">
  <div class="dc-boot__inner">
    <img class="dc-boot__logo" src="${DEPLOY_BASE}assets/tsumugi-logo.svg" alt="TSUMUGI Vintage Shop" width="145" height="27">
    <span class="dc-boot__track" aria-hidden="true"><span class="dc-boot__bar"></span></span>
    <span class="dc-boot__label">LOADING ARCHIVE</span>
  </div>
</div>
<noscript><style>.dc-boot { display: none !important }</style></noscript>
<main class="prerendered">
  <p class="kicker">404</p>
  <h1>ページが見つかりません</h1>
  <p>お探しのページは見つかりませんでした。取り扱いはすべて一点物のため、販売済みの商品ページは公開を終了することがあります。</p>
  <p>Page not found. Everything we carry is one of a kind, so a sold piece's page is sometimes retired.</p>
  <nav>
    <a href="${DEPLOY_BASE}">HOME</a>
    <a href="${DEPLOY_BASE}shop/">ONLINE SHOP</a>
    <a href="${DEPLOY_BASE}journal/">JOURNAL</a>
    <a href="${DEPLOY_BASE}contact/">CONTACT</a>
  </nav>
</main>
</body>
</html>
`));

/* --------------------------------------------------------------- robots.txt */

written.push(await emit("robots.txt", `User-agent: *
Allow: /
Disallow: /admin.html
${SITE_URL ? `\nSitemap: ${SITE_URL}/sitemap.xml\n` : "\n# Sitemap: set SITE_URL at build time to emit an absolute sitemap URL here.\n"}`));

/* ---------------------------------------------------------------- sitemap */

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc((SITE_URL || "") + "/" + (u ? u + "/" : ""))}</loc></url>`).join("\n")}
</urlset>
`;
written.push(await emit("sitemap.xml", sitemap));

console.log(`prerender: ${written.length} files → ${OUT}/`);
if (!SITE_URL) {
  console.warn("prerender: SITE_URL not set — canonical/og:url emitted as relative URLs and sitemap locs are path-only.");
}
