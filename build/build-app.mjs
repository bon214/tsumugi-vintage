/* build/build-app.mjs — assembles dist/ from the prerendered pages, the
 * compiled components and the vendored libraries.
 *
 *   node build/build-app.mjs
 *
 * WHAT THIS PRODUCES
 *   dist/                       every prerendered route, now also the app entry
 *   dist/generated/*.js         compiled Design Components
 *   dist/runtime/*.js           production runtime + entries
 *   dist/vendor/*               React, ReactDOM, Supabase SDK (local)
 *   dist/admin.html             console shell (noindex, separate entry)
 *   dist/*.js                   the shared store/auth/i18n/sanitiser scripts
 *
 * HOW THE TWO LAYERS JOIN
 * prerender.mjs writes standalone documents that redirect a JavaScript-capable
 * visitor to the authoring entry. For a production build that redirect is
 * wrong: the visitor should stay on the URL they asked for. So each page is
 * rewritten here — the redirect is removed and replaced by the app's own
 * script tags plus a rule that hides the static copy once React has painted.
 * The route is already in the page as <meta name="dc-route">.
 *
 * Every step asserts what it expects to find. A silent no-op in a build script
 * is how a site ships half-transformed.
 */

import { readdir, readFile, writeFile, mkdir, rm, cp, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const DEPLOY_BASE = (() => {
  const siteUrl = (process.env.SITE_URL || "").replace(/\/+$/, "");
  let value = process.env.BASE_PATH || "";
  if (!value && siteUrl) {
    try { value = new URL(siteUrl).pathname; } catch { value = ""; }
  }
  value = String(value || "/").replace(/^\/+|\/+$/g, "");
  return value ? `/${value}/` : "/";
})();

/* The classic scripts that hold everything that is not a component: catalogue,
   store, auth, i18n, sanitiser, image provider. Order matters and is the order
   the two root components declare in their <helmet>. */
const SHARED_SCRIPTS = [
  "auth-config.js",
  "tsumugi-supabase.js",
  "tsumugi-sanitize.js",
  "tsumugi-data.js",
  "tsumugi-repository.js",
  "tsumugi-images.js",
  "tsumugi-auth.js",
  "tsumugi-i18n-public.js",
  "tsumugi-i18n-admin.js",
  "tsumugi-i18n-orders.js",
  "tsumugi-i18n-content.js",
  "tsumugi-i18n.js",
];

const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Hanken+Grotesk:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Noto+Serif+JP:wght@400;500&family=Noto+Sans+JP:wght@300;400;500&display=swap" rel="stylesheet">`;

/* Content-Security-Policy for the built site. Every source is either 'self' or
   Google Fonts; there is no script-src 'unsafe-eval' and no third-party script
   origin, which is only possible because nothing is compiled or imported at
   runtime any more. 'unsafe-inline' remains for style-src because the design
   is built from inline style attributes — those are not scripts, and React
   sets them as properties, so no nonce can cover them. */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const die = (msg) => { console.error("build-app: " + msg); process.exit(1); };

const upTo = (file) => {
  const depth = file.split("/").length - 1;
  return depth === 0 ? "./" : "../".repeat(depth);
};

/* The import map: three bare specifiers, all resolved to local files. Written
   per page because the paths are relative to the page's depth (a root-absolute
   path would break on a GitHub Pages repository subpath). */
const importMap = (root) => `<script type="importmap">
{
  "imports": {
    "react": "${root}vendor/react.js",
    "react-dom/client": "${root}vendor/react-dom-client.js",
    "@supabase/supabase-js": "${root}vendor/supabase-js.js"
  }
}
</script>`;

const appTags = (root, entry) => `${importMap(root)}
<script src="${root}vendor/react.production.min.js"></script>
<script src="${root}vendor/react-dom.production.min.js"></script>
<script src="${root}vendor/supabase.umd.js"></script>
${SHARED_SCRIPTS.map((s) => `<script src="${root}${s}"></script>`).join("\n")}
<script type="module" src="${root}runtime/${entry}"></script>`;

/* The static article stays in the DOM until React has painted, then goes. It
   is hidden rather than removed so that a JavaScript failure after this point
   still leaves readable content. */
const LIVE_CSS = `<style>
  body.dc-live main.prerendered { display: none }
  body.dc-live { display: block }
  #dc-root:empty + main.prerendered { display: block }
  #dc-root a { text-decoration: none }
</style>`;

async function main() {
  /* ---- preconditions ------------------------------------------------- */
  if (!existsSync(path.join(ROOT, "generated", "TSUMUGI.js"))) {
    die("generated/ is missing or incomplete — run `npm run build:dc` first.");
  }
  const vendorNeeded = [
    "vendor/react.js", "vendor/react-dom-client.js", "vendor/supabase-js.js",
    "vendor/react.production.min.js", "vendor/react-dom.production.min.js",
    "vendor/supabase.umd.js",
  ];
  const missing = vendorNeeded.filter((f) => !existsSync(path.join(ROOT, f)));
  if (missing.length) {
    die(`vendor/ is incomplete — missing ${missing.join(", ")}.\n`
      + "  These are third-party bytes, so they are not written by hand:\n"
      + "    npm ci && npm run build:vendor\n"
      + "  See BUILD.md §2. Nothing else in the build depends on the network.");
  }

  /* ---- 1. prerender straight into dist/ ------------------------------ */
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  const pre = spawnSync(process.execPath,
    [path.join(ROOT, "build", "prerender.mjs"), "--out", DIST],
    { stdio: "inherit", cwd: ROOT });
  if (pre.status !== 0) die("prerender failed; dist/ is incomplete.");

  /* ---- 2. copy the application ------------------------------------- */
  await cp(path.join(ROOT, "generated"), path.join(DIST, "generated"), { recursive: true });
  await cp(path.join(ROOT, "runtime"), path.join(DIST, "runtime"), { recursive: true });
  await cp(path.join(ROOT, "vendor"), path.join(DIST, "vendor"), { recursive: true });
  if (existsSync(path.join(ROOT, "uploads"))) {
    await cp(path.join(ROOT, "uploads"), path.join(DIST, "uploads"), { recursive: true });
  }
  if (existsSync(path.join(ROOT, "assets"))) {
    await cp(path.join(ROOT, "assets"), path.join(DIST, "assets"), { recursive: true });
  }
  for (const f of ["favicon.svg", "robots.txt"]) {
    if (existsSync(path.join(ROOT, f))) await cp(path.join(ROOT, f), path.join(DIST, f));
  }
  // Makes the artifact safe even if it is deployed through the legacy Pages
  // branch path instead of the Actions artifact path.
  await writeFile(path.join(DIST, ".nojekyll"), "", "utf8");
  for (const s of SHARED_SCRIPTS) {
    await cp(path.join(ROOT, s), path.join(DIST, s));
  }

  /* Connection values are injected only into dist/. The source file stays a
     safe offline-demo template, while GitHub Actions supplies the real project
     values. A Supabase publishable key is designed for browsers; privileged
     service-role/secret keys are rejected by verify-dist and never belong
     here. */
  const sbUrl = String(process.env.SUPABASE_URL || "").trim();
  const sbKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!!sbUrl !== !!sbKey) {
    die("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be supplied together.");
  }
  if (sbUrl && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(sbUrl)) {
    die("SUPABASE_URL must look like https://<project-ref>.supabase.co");
  }
  if (sbKey) {
    const configPath = path.join(DIST, "auth-config.js");
    let configSource = await readFile(configPath, "utf8");
    configSource = configSource
      .replace(/(url:\s*)""/, `$1${JSON.stringify(sbUrl)}`)
      .replace(/(anonKey:\s*)""/, `$1${JSON.stringify(sbKey)}`);
    await writeFile(configPath, configSource, "utf8");
  }

  /* generated/manifest.json and helmets.json are build metadata, not runtime
     files; publishing them would leak the source file names. */
  for (const f of ["manifest.json", "helmets.json"]) {
    await rm(path.join(DIST, "generated", f), { force: true });
  }

  /* ---- 3. cut the remote SDK path out of the shipped auth file ----- */
  const authPath = path.join(DIST, "tsumugi-auth.js");
  const authSrc = await readFile(authPath, "utf8");
  const NEEDLE = `      : CFG.sdk
        ? import(/* @vite-ignore */ CFG.sdk)
        : Promise.reject(new Error("Supabase SDK is not bundled and no sdk URL is configured"));`;
  if (!authSrc.includes(NEEDLE)) {
    die("tsumugi-auth.js no longer contains the dynamic-import fallback this "
      + "build strips. Update the NEEDLE in build-app.mjs to match the new source "
      + "— do not skip the strip.");
  }
  const authOut = authSrc.replace(NEEDLE,
    `      /* Remote import removed by build/build-app.mjs: a production build
         resolves the SDK from vendor/, never from a URL. */
      : Promise.reject(new Error("Supabase SDK unavailable: vendor bundle did not load"));`);
  await writeFile(authPath, authOut, "utf8");

  /* auth-config.js keeps its documentation but must not carry a CDN URL into
     production, where nothing may read it. */
  const cfgPath = path.join(DIST, "auth-config.js");
  const cfgSrc = await readFile(cfgPath, "utf8");
  const cfgOut = cfgSrc.replace(/sdk:\s*"[^"]*"/,
    `sdk: ""  /* bundled locally in this build — see vendor/manifest.json */`)
    .replace(/sdkIntegrityNote:\s*"[^"]*"/,
      `sdkIntegrityNote: "bundled from node_modules by build/vendor.mjs; sha256 in vendor/manifest.json"`);
  if (cfgOut === cfgSrc) die("auth-config.js: could not blank the sdk URL — check the field name.");
  await writeFile(cfgPath, cfgOut, "utf8");

  /* ---- 4. turn every prerendered page into an app entry ------------- */
  const pages = [];
  await (async function walk(dir, rel = "") {
    for (const name of await readdir(dir)) {
      const abs = path.join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      if ((await stat(abs)).isDirectory()) {
        if (["generated", "runtime", "vendor"].includes(relPath)) continue;
        await walk(abs, relPath);
      } else if (name.endsWith(".html")) pages.push(relPath);
    }
  })(DIST);

  let rewritten = 0, handoffsRemoved = 0;
  for (const rel of pages) {
    const file = path.join(DIST, rel);
    let html = await readFile(file, "utf8");
    /* GitHub Pages serves 404.html at the unknown URL itself. Only that page
       needs a deployment-root path; known prerendered pages remain portable
       relative URLs. */
    const root = rel === "404.html" ? DEPLOY_BASE : upTo(rel);

    /* The prerender handoff. Removing it is mandatory where it exists: leaving
       it in would bounce the visitor to the authoring entry, which does not
       exist in dist/. 404.html is written without one — it is a fallback, not
       a route — so its absence there is expected. */
    const redirect = /<script>\s*\/\* Progressive handoff[\s\S]*?<\/script>/;
    if (redirect.test(html)) { html = html.replace(redirect, ""); handoffsRemoved++; }
    else if (rel !== "404.html") {
      die(`${rel}: no prerender handoff script found. prerender.mjs changed shape; `
        + "update build-app.mjs rather than shipping pages that redirect nowhere.");
    }

    if (!/<meta name="dc-route" content="/.test(html)) {
      die(`${rel}: no <meta name="dc-route"> — prerender.mjs must emit it for the `
        + "app to open the right screen without an inline script.");
    }

    /* prerender.mjs scopes its own stylesheet under .prerendered so those
       rules cannot restyle the application that mounts into the same
       document. If the class is gone, that scoping is broken. */
    if (!/<main class="prerendered">/.test(html)) {
      die(`${rel}: <main class="prerendered"> not found — prerender.mjs must emit it, `
        + "or the static page's CSS will leak into every app screen.");
    }

    html = html.replace("</head>",
      `<meta http-equiv="Content-Security-Policy" content="${CSP}">\n`
      + `<link rel="stylesheet" href="${root}generated/pseudo.css">\n`
      + `${FONT_LINKS}\n${LIVE_CSS}\n</head>`);
    html = html.replace("</body>",
      `<div id="dc-root"></div>\n${appTags(root, "main-public.js")}\n</body>`);

    await writeFile(file, html, "utf8");
    rewritten++;
  }

  /* ---- 5. the console shell ---------------------------------------- */
  const admin = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TSUMUGI — Admin</title>
<!-- The console is never indexed and never prerendered: it has no public
     content, and a staff role in the JWT is what gates it. -->
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex">
<meta name="googlebot" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<link rel="icon" href="./favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="./generated/pseudo.css">
${FONT_LINKS}
<style>
  html, body { margin: 0; min-height: 100% }
  body { background: #F6F5F2; color: #232220;
         font-family: 'Hanken Grotesk', system-ui, -apple-system, sans-serif }
  .dc-boot { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center;
             min-height: 100svh; background: #F6F5F2; opacity: 1; visibility: visible;
             transition: opacity 420ms ease, visibility 0s linear 420ms }
  .dc-boot__inner { width: min(72vw, 260px); display: flex; flex-direction: column; align-items: center; gap: 22px }
  .dc-boot__logo { display: block; width: 100%; height: auto }
  .dc-boot__track { width: 100%; height: 1px; overflow: hidden; background: #DBD6CC }
  .dc-boot__bar { display: block; width: 38%; height: 100%; background: #6D7761; animation: dcBoot 1.25s cubic-bezier(.4,0,.2,1) infinite }
  .dc-boot__label { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 9px; letter-spacing: .26em; color: #8C887F }
  body.dc-live .dc-boot, body.dc-boot-failed .dc-boot { opacity: 0; visibility: hidden; pointer-events: none }
  @keyframes dcBoot { 0% { transform: translateX(-110%) } 55% { transform: translateX(85%) } 100% { transform: translateX(270%) } }
  @media (prefers-reduced-motion: reduce) { .dc-boot, .dc-boot__bar { animation: none; transition: none } }
  noscript p { padding: 24px; font-size: 13px }
</style>
</head>
<body>
<div id="dc-boot" class="dc-boot" role="status" aria-label="TSUMUGI管理画面を読み込んでいます">
  <div class="dc-boot__inner">
    <img class="dc-boot__logo" src="./assets/tsumugi-logo.svg" alt="TSUMUGI Vintage Shop" width="145" height="27">
    <span class="dc-boot__track" aria-hidden="true"><span class="dc-boot__bar"></span></span>
    <span class="dc-boot__label">LOADING CONSOLE</span>
  </div>
</div>
<div id="dc-root"></div>
<noscript><style>.dc-boot { display: none !important }</style><p>JavaScript が必要です / JavaScript required.</p></noscript>
${appTags("./", "main-admin.js")}
</body>
</html>
`;
  await writeFile(path.join(DIST, "admin.html"), admin, "utf8");

  if (!existsSync(path.join(DIST, "404.html"))) {
    die("prerender produced no 404.html — GitHub Pages needs one for any path it "
      + "cannot resolve, and a retired product URL would otherwise hit the platform's "
      + "default page.");
  }

  console.log(`\nbuild-app: ${rewritten} prerendered pages are now app entries `
    + `(${handoffsRemoved} handoff redirects removed), console shell written, `
    + `SDK remote import stripped.`);
  console.log("build-app: next step is `npm run verify` (build/verify-dist.mjs dist).");
}

main().catch((e) => { console.error(e); process.exit(1); });
