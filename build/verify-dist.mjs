/* build/verify-dist.mjs — the release gate.
 *
 * Exits non-zero if the production output contains anything that would force a
 * weaker CSP, depend on a third-party CDN, or index as an empty page. This runs
 * as the last step of `npm run build`, so a regression fails the build instead
 * of reaching GitHub Pages.
 *
 * Two layers are checked. The SEO layer (prerendered pages: metadata, JSON-LD,
 * uniqueness, subpath safety) and the APPLICATION layer (compiled components,
 * local vendor libraries, import map, CSP, no runtime compilation). The second
 * set is what proves the `unsafe-eval` removal actually landed: it fails if a
 * page still loads the authoring runtime, if a bare specifier resolves to a
 * remote origin, or if any shipped file evaluates a string.
 *
 *   node build/verify-dist.mjs dist
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path, { join } from "node:path";

const ROOT = process.argv[2] || "dist";

/* Each entry is a reason, not just a string: a future reader needs to know why
   the build refuses, not only that it did. */
const BANNED = [
  ["new Function", "runtime compilation — forces script-src 'unsafe-eval'"],
  ["eval(", "runtime evaluation — forces script-src 'unsafe-eval'"],
  ["unsafe-eval", "a CSP that permits runtime compilation"],
  ["babel", "Babel standalone transpiles in the browser; production must ship compiled output"],
  ["text/x-dc", "an uncompiled Design Component script block"],
  ["<x-dc", "an uncompiled Design Component template"],
  ["unpkg.com", "React loaded from a third-party CDN — a CDN outage takes the site down"],
  ["esm.sh", "Supabase SDK loaded from a third-party CDN; bundle it instead"],
  ["cdn.jsdelivr.net", "third-party CDN dependency"],
  ["support.js", "Design Component runtime — an editing-time dependency, not a production one"],
  ["sourceMappingURL", "source map reference left in production output"],
  ["service_role", "service-role key or reference must never reach a browser file"],
  ["sb_secret", "Supabase secret key must never reach a browser file"],
  ["SUPABASE_SERVICE", "service-role environment reference must never reach a browser file"],
  ["console.debug", "debug logging left in production output"],
];

/* Files that legitimately mention a banned token. Empty by default, and it
 * should stay that way: an entry here is a hole in the gate and needs a reason
 * written next to it, not just a path. */
const ALLOW = [];

const files = [];
async function walk(dir) {
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    const s = await stat(p);
    if (s.isDirectory()) await walk(p);
    else files.push(p);
  }
}

try {
  await walk(ROOT);
} catch (e) {
  console.error(`verify: cannot read ${ROOT}/ — run the build first.`);
  process.exit(2);
}

const problems = [];
const titles = new Map();
const descriptions = new Map();
let htmlCount = 0;

for (const f of files) {
  if (!/\.(html|js|mjs|css|json|xml|svg)$/i.test(f)) continue;
  const raw = await readFile(f, "utf8");
  const lower = raw.toLowerCase();

  if (!ALLOW.includes(f)) {
    for (const [token, why] of BANNED) {
      if (lower.includes(token.toLowerCase())) {
        problems.push(`${f}: contains "${token}" — ${why}`);
      }
    }
  }

  if (!f.endsWith(".html")) continue;
  htmlCount++;

  const pick = (re) => { const m = re.exec(raw); return m ? m[1] : null; };
  const title = pick(/<title>([\s\S]*?)<\/title>/);
  const desc = pick(/<meta name="description" content="([^"]*)"/);
  const canonical = pick(/<link rel="canonical" href="([^"]*)"/);
  const ogImage = pick(/<meta property="og:image" content="([^"]*)"/);
  const ogType = pick(/<meta property="og:type" content="([^"]*)"/);
  const twitter = pick(/<meta name="twitter:card" content="([^"]*)"/);
  const lang = pick(/<html lang="([^"]*)"/);
  const dcBase = pick(/<meta name="dc-base" content="([^"]*)"/);
  const jsonLd = pick(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  const isAdmin = /noindex/.test(raw);

  const need = (cond, msg) => { if (!cond) problems.push(`${f}: ${msg}`); };

  need(title, "no <title>");
  need(lang, "no lang on <html>");
  need(/rel="icon"/.test(raw), "no favicon link — a favicon 404 on every page");

  if (!isAdmin) {
    need(desc && desc.length >= 30, `description missing or under 30 chars (${(desc || "").length})`);
    need(!desc || desc.length <= 200, `description over 200 chars (${(desc || "").length}) — it will be truncated`);
    need(canonical, "no canonical");
    need(ogImage, "no og:image");
    need(ogType, "no og:type");
    need(twitter, "no twitter:card");
    need(jsonLd, "no JSON-LD");
    if (jsonLd) {
      try {
        const o = JSON.parse(jsonLd);
        need(o["@context"] && o["@type"], "JSON-LD missing @context or @type");
      } catch (e) {
        problems.push(`${f}: JSON-LD does not parse — ${e.message}`);
      }
    }

    /* A page whose body is only a redirect indexes as empty. */
    const bodyText = (raw.split("<body")[1] || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    need(bodyText.length >= 120, `body copy is ${bodyText.length} chars — a redirect-only page indexes as empty`);

    /* Duplicate metadata is the defect this whole exercise started from. */
    if (title) {
      if (titles.has(title)) problems.push(`${f}: duplicate <title> with ${titles.get(title)}`);
      else titles.set(title, f);
    }
    if (desc) {
      if (descriptions.has(desc)) problems.push(`${f}: duplicate description with ${descriptions.get(desc)}`);
      else descriptions.set(desc, f);
    }
  }

  /* Subpath safety: a root-absolute reference breaks on
     https://user.github.io/<repo>/ , which is where this deploys. */
  const abs = [...raw.matchAll(/(?:href|src)="(\/(?!\/)[^"]*)"/g)].map((m) => m[1]);
  const allowed404Base = f.endsWith("404.html") && dcBase
    && /^\/(?:[^/]+\/)*$/.test(dcBase) && abs.every((p) => p.startsWith(dcBase));
  if (abs.length && !allowed404Base) {
    problems.push(`${f}: root-absolute path(s) break a repository subpath — ${abs.slice(0, 3).join(", ")}`);
  }
}

/* ------------------------------------------------------- application layer */

/* A build that passes every SEO check and still ships the authoring runtime is
   the failure this section exists to catch. */
const rel = (p) => p.slice(ROOT.length + 1).split("\\").join("/");
const names = new Set(files.map(rel));
const has = (p) => names.has(p);
const bundled = has("runtime/main-public.bundle.js");
const menuAnimations = ["menuBackdropIn", "menuPanelIn", "menuItemIn"];
const adminAnimations = ["admFade", "admRise", "admToast", "admDrawer", "admSpin", "admPulse"];

const needFile = (p, why) => { if (!has(p)) problems.push(`missing ${p} — ${why}`); };

if (bundled) {
  needFile("runtime/main-admin.bundle.js", "the console entry was not bundled with the storefront");
  if (has("generated/TSUMUGI.js")) {
    problems.push("generated/ still present alongside a bundle — dead weight, and two "
      + "copies of every component can drift");
  }
  const publicBundle = await readFile(join(ROOT, "runtime/main-public.bundle.js"), "utf8");
  for (const name of menuAnimations) {
    if (!publicBundle.includes(name)) {
      problems.push(`runtime/main-public.bundle.js: no ${name} animation reference`);
    }
  }
  const adminBundle = await readFile(join(ROOT, "runtime/main-admin.bundle.js"), "utf8");
  for (const name of adminAnimations) {
    if (!adminBundle.includes(name)) {
      problems.push(`runtime/main-admin.bundle.js: no ${name} animation reference`);
    }
  }
} else {
  needFile("runtime/main-public.js", "no application entry: the pages would stay static");
  needFile("runtime/main-admin.js", "no console entry");
  needFile("runtime/dc-runtime.js", "the compiled components import this");
  needFile("generated/TSUMUGI.js", "the storefront root component is not compiled into dist");
  needFile("generated/TSUMUGIAdmin.js", "the console root component is not compiled into dist");
  const componentCount = [...names].filter((n) => /^generated\/[^/]+\.js$/.test(n)).length;
  if (componentCount && componentCount < 21) {
    problems.push(`only ${componentCount} compiled components in generated/ — the project has 21`);
  }
}

needFile("generated/pseudo.css", "hover/focus styling would be missing from every page");
needFile("404.html", "GitHub Pages serves /404.html for every unresolvable path; without it "
  + "a retired product URL lands on the platform's default page");
needFile("favicon.svg", "every page references it, so its absence is an asset 404 sitewide");
needFile("assets/tsumugi-logo.svg", "the supplied brand mark is missing from the published site");
needFile("robots.txt", "crawlers get no sitemap pointer and the console is not disallowed");
needFile("sitemap.xml", "no sitemap for the prerendered routes");
for (const v of ["vendor/react.production.min.js", "vendor/react-dom.production.min.js",
                 "vendor/supabase.umd.js", "vendor/manifest.json"]) {
  needFile(v, "a third-party library is not vendored, so the browser would need a CDN");
}
for (const s of ["tsumugi-auth.js", "tsumugi-data.js", "tsumugi-i18n.js", "tsumugi-sanitize.js"]) {
  needFile(s, "a shared script the application depends on is not published");
}
if ([...names].some((n) => n.endsWith(".dc.html"))) {
  problems.push("an authoring .dc.html source was copied into dist/ — it is not needed and "
    + "reveals the pre-compilation sources");
}

/* Per page: the app must be wired in, and wired in locally. */
for (const f of files.filter((f) => f.endsWith(".html"))) {
  const raw = await readFile(f, "utf8");
  const name = rel(f);
  const isConsole = name === "admin.html";
  const dcBase = /<meta name="dc-base" content="([^"]*)"/.exec(raw)?.[1] || null;
  const need = (cond, msg) => { if (!cond) problems.push(`${name}: ${msg}`); };

  need(/<div id="dc-root">/.test(raw), "no #dc-root — the application has nowhere to mount");
  need(/id="dc-boot"/.test(raw), "no branded loading cover — prerendered text would flash before the app paints");
  need(/assets\/tsumugi-logo\.svg/.test(raw), "the loading cover does not use the supplied TSUMUGI logo");
  need(/<script type="module" src="[^"]*runtime\/main-(public|admin)(\.bundle)?\.js(?:\?v=[a-f0-9]{12})?"/.test(raw),
    "no module entry — the page would never boot the application");
  if (bundled) {
    const localScripts = [...raw.matchAll(/<script(?:\s+type="module")?\s+src="([^"]+)"/g)]
      .map((match) => match[1]);
    need(localScripts.length > 0 && localScripts.every((src) => /\?v=[a-f0-9]{12}$/.test(src)),
      "local scripts are not content-versioned — browsers could keep a stale auth build");
  }
  need(/http-equiv="Content-Security-Policy"/.test(raw), "no CSP meta");
  const csp = /content="([^"]*script-src[^"]*)"/.exec(raw);
  if (csp) {
    need(/script-src 'self'/.test(csp[1]), "CSP script-src is not 'self'");
    need(!/unsafe-eval/.test(csp[1]), "CSP still allows unsafe-eval");
    need(!/script-src[^;]*https?:\/\//.test(csp[1]), "CSP allows a remote script origin");
  }
  need(!/location\.replace\(/.test(raw),
    "a redirect survived: a production page must serve its own route, not bounce");

  const map = /<script type="importmap">([\s\S]*?)<\/script>/.exec(raw);
  if (map) {
    need(csp && /script-src[^;]*(?:'unsafe-inline'|'nonce-[^']+'|'sha256-[^']+')/.test(csp[1]),
      "inline import map is blocked by the page CSP; bundle the entries or authorize its exact hash");
    let parsed = null;
    try { parsed = JSON.parse(map[1]); } catch (e) { problems.push(`${name}: import map does not parse — ${e.message}`); }
    for (const [spec, target] of Object.entries(parsed?.imports || {})) {
      if (/^https?:/.test(target)) problems.push(`${name}: import map sends "${spec}" to a remote origin (${target})`);
      if (target.startsWith("/")) problems.push(`${name}: import map target "${target}" is root-absolute and breaks a repository subpath`);
    }
  } else if (!bundled) {
    problems.push(`${name}: no import map, so "react" resolves to nothing`);
  }

  if (!isConsole) {
    /* 404.html carries an empty dc-route on purpose: it is a fallback, not a
       route, and the app opens the home screen from it. */
    need(/<meta name="dc-route" content="/.test(raw),
      "no dc-route meta — the application cannot tell which screen this URL is");
    need(/<main class="prerendered">/.test(raw),
      "the prerendered article is not marked, so it will not be hidden once the app paints");
    need((raw.match(/data-dc-global="TSUMUGI"/g) || []).length === 1,
      "compiled TSUMUGI global styles must appear exactly once");
    for (const animation of menuAnimations) {
      need((raw.match(new RegExp(`@keyframes\\s+${animation}\\b`, "g")) || []).length === 1,
        `${animation} keyframes must appear exactly once while the component references them`);
    }
  } else {
    need((raw.match(/data-dc-global="TSUMUGI Admin"/g) || []).length === 1,
      "compiled TSUMUGI Admin global styles must appear exactly once");
    for (const animation of adminAnimations) {
      need((raw.match(new RegExp(`@keyframes\\s+${animation}\\b`, "g")) || []).length === 1,
        `${animation} admin keyframes must appear exactly once`);
    }
  }

  /* Asset references must resolve inside dist/, or the deployed page 404s on
     its own stylesheet. Remote and data URLs are out of scope here; the CSP
     and import-map checks above cover those. */
  for (const m of raw.matchAll(/(?:src|href)="(?!https?:|data:|mailto:|#)([^"]+)"/g)) {
    const target = m[1].split("#")[0].split("?")[0];
    if (!target) continue;
    const dir = path.dirname(f);
    const abs = target.startsWith("/") && name === "404.html" && dcBase
      && target.startsWith(dcBase)
      ? path.resolve(ROOT, target.slice(dcBase.length))
      : path.resolve(dir, target);
    const asDir = target.endsWith("/") ? path.join(abs, "index.html") : abs;
    if (!existsSync(asDir) && !existsSync(abs)) {
      problems.push(`${name}: references ${target}, which does not exist in dist/ `
        + "(this is an asset 404 on the deployed site)");
    }
  }
}

/* No shipped script may reach out for a module at runtime. */
for (const f of files.filter((f) => /\.(js|mjs)$/.test(f))) {
  const raw = await readFile(f, "utf8");
  const remote = /import\s*\(\s*["'`]https?:/.exec(raw) || /from\s*["'`]https?:/.exec(raw);
  if (remote) problems.push(`${rel(f)}: imports a module from a remote URL (${remote[0]})`);
  if (/\bimport\s*\(\s*[A-Za-z_$]/.test(raw)) {
    problems.push(`${rel(f)}: dynamic import with a computed specifier — production resolves `
      + "every module statically");
  }
  /* Component image paths are bundled JavaScript strings, not HTML attributes,
     so the per-page asset walk above cannot see them. */
  /* Match complete asset filenames, not a dynamic directory prefix such as
     "uploads/production/" + file. The release-content tests validate every
     member of those controlled filename pools before this dist check runs. */
  for (const m of raw.matchAll(/\buploads\/[A-Za-z0-9._/-]+\.[A-Za-z0-9]{2,6}\b/g)) {
    const target = m[0].replace(/[),;'"`]+$/, "");
    if (!has(target)) problems.push(`${rel(f)}: references ${target}, which is missing from dist/`);
  }
}

/* A Design Component source must not be LOADED at runtime. The filename may
   still appear in a comment carried over from the source — that is provenance,
   not a dependency — so the check looks for a fetch, an import or an
   href/src, not for the string. */
for (const f of files.filter((f) => /\.(html|js|mjs)$/.test(f))) {
  const raw = await readFile(f, "utf8");
  const load = /(?:src|href)\s*=\s*["'][^"']*\.dc\.html/i.exec(raw)
    || /(?:fetch|import)\s*\(\s*[^)]{0,120}\.dc\.html/i.exec(raw);
  if (load) {
    problems.push(`${rel(f)}: loads an authoring source at runtime (${load[0].slice(0, 60)}) `
      + "— production must use the compiled modules");
  }
}

console.log(`verify: ${files.length} files, ${htmlCount} HTML pages, ` +
            `${titles.size} unique titles, ${descriptions.size} unique descriptions, ` +
            `${bundled ? "bundled" : "unbundled"} application`);

if (problems.length) {
  console.error(`\nverify: ${problems.length} problem(s) — build REJECTED\n`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("verify: no banned strings, metadata complete and unique, subpath-safe — build accepted");
