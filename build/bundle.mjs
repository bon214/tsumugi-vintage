/* build/bundle.mjs — optional: collapse dist/ into one minified file per entry.
 *
 * The site is already deployable without this step: dist/ ships plain ES
 * modules and an import map that resolves the three bare specifiers to local
 * vendor files. That is honest, debuggable, and needs no bundler. What it is
 * not is small — the compiled components are ~900 KB of unminified JavaScript
 * across 21 files.
 *
 * This step is therefore about bytes and request count, not correctness. It
 * rewrites the module graph into dist/runtime/main-public.bundle.js (and the
 * admin equivalent), points the shells at it, and drops the import map.
 *
 *   node build/bundle.mjs        # after build/build-app.mjs
 */

import { readdir, readFile, writeFile, stat, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");

let esbuild;
try {
  esbuild = await import("esbuild");
} catch {
  console.error("bundle: esbuild is not installed. Run `npm ci` first, or deploy "
    + "dist/ as-is — the unbundled output is complete and correct.");
  process.exit(1);
}

if (!existsSync(DIST)) {
  console.error("bundle: dist/ does not exist — run `npm run app` first.");
  process.exit(1);
}

const ENTRIES = [
  { in: "runtime/main-public.js", out: "runtime/main-public.bundle.js" },
  { in: "runtime/main-admin.js", out: "runtime/main-admin.bundle.js" },
];

/* The vendor shims read globals installed by the UMD scripts, so they stay
   external: bundling them would inline a second copy of React's module
   wrapper without removing the UMD script tags. */
const result = await esbuild.build({
  entryPoints: ENTRIES.map((e) => path.join(DIST, e.in)),
  outdir: path.join(DIST, "runtime"),
  entryNames: "[name].bundle",
  bundle: true,
  format: "esm",
  target: ["es2020"],
  minify: true,
  sourcemap: false,          // a public source map would republish the sources
  legalComments: "none",
  logLevel: "info",
  metafile: true,
  alias: {
    "react": path.join(DIST, "vendor", "react.js"),
    "react-dom/client": path.join(DIST, "vendor", "react-dom-client.js"),
    "@supabase/supabase-js": path.join(DIST, "vendor", "supabase-js.js"),
  },
});

/* Point every shell at the bundle and remove the import map, which now
   resolves nothing. */
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

let patched = 0;
for (const rel of pages) {
  const file = path.join(DIST, rel);
  let html = await readFile(file, "utf8");
  const before = html;
  html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, "");
  html = html.replace(/(runtime\/main-(?:public|admin))\.js(\?v=[^"]+)?"/g,
    '$1.bundle.js$2"');
  if (html !== before) { await writeFile(file, html, "utf8"); patched++; }
}

/* The unbundled modules are dead weight once every page loads a bundle. Keep
   pseudo.css: it is generated beside the modules but is a runtime stylesheet
   referenced by every page. */
const pseudoCss = await readFile(path.join(DIST, "generated", "pseudo.css"));
await rm(path.join(DIST, "generated"), { recursive: true, force: true });
await mkdir(path.join(DIST, "generated"), { recursive: true });
await writeFile(path.join(DIST, "generated", "pseudo.css"), pseudoCss);
for (const e of ENTRIES) await rm(path.join(DIST, e.in), { force: true });
await rm(path.join(DIST, "runtime", "dc-runtime.js"), { force: true });
await rm(path.join(DIST, "runtime", "supabase-client.js"), { force: true });

const sizes = Object.entries(result.metafile.outputs)
  .map(([f, o]) => `  ${path.relative(DIST, f).padEnd(38)} ${(o.bytes / 1024).toFixed(1)} kB`);
console.log("bundle:\n" + sizes.join("\n"));
console.log(`bundle: ${patched} pages now load a bundled entry; unbundled modules removed.`);
console.log("bundle: pseudo.css is unaffected — it is a stylesheet, not a module.");
