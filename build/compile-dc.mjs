/* build/compile-dc.mjs — CLI: every `.dc.html` in the project → one ES module.
 *
 *   node build/compile-dc.mjs            # write generated/ and report
 *   node build/compile-dc.mjs --check    # compile in memory, write nothing
 *
 * The compiler itself lives in dc-compiler-core.mjs, which is parser-agnostic;
 * this file supplies the Node parser (parse5), walks the project, resolves the
 * import graph, and writes the output. Exit code 1 on any diagnostic — a
 * template this compiler does not fully understand must never reach a build
 * artefact, because the failure mode of guessing is a blank region on a
 * customer-facing page.
 */

import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { parseFragment } from "./parse-node.mjs";
import {
  compileDc, DcCompileError, PseudoSheet, moduleBase, findDuplicateBases,
} from "./dc-compiler-core.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "generated");
const CHECK = process.argv.includes("--check");

/* parse5 lives in parse-node.mjs so the test suite can import the adapter
   without running this CLI. */

const banner = (s) => `\n${s}\n${"─".repeat(s.length)}`;

async function main() {
  const names = (await readdir(ROOT))
    .filter((f) => f.endsWith(".dc.html"))
    .map((f) => f.slice(0, -".dc.html".length))
    .sort();

  if (!names.length) {
    console.error("compile-dc: no .dc.html files found in " + ROOT);
    process.exit(1);
  }

  /* Duplicate module basenames would silently overwrite each other in
     generated/ — "TSUMUGI Admin" and "TSUMUGI-Admin" both reduce to
     TSUMUGIAdmin. Caught before anything is written. */
  for (const clash of findDuplicateBases(names)) {
    console.error(`compile-dc: ${clash.names[0]}.dc.html and ${clash.names[1]}.dc.html `
      + `both compile to generated/${clash.base}.js — rename one`);
    process.exit(1);
  }

  const known = new Set(names);
  const sheet = new PseudoSheet();
  const results = [];
  const errors = [];

  for (const name of names) {
    const file = `${name}.dc.html`;
    const source = await readFile(path.join(ROOT, file), "utf8");
    try {
      results.push(compileDc({ file, name, source, parseFragment, sheet, known }));
    } catch (e) {
      if (e instanceof DcCompileError) errors.push(e);
      else throw e;
    }
  }

  if (errors.length) {
    console.error(banner(`compile-dc: ${errors.length} template error(s)`));
    for (const e of errors) console.error("  " + e.message);
    console.error("\nNothing was written.");
    process.exit(1);
  }

  /* Import-graph checks the per-file pass cannot see. */
  const roots = results.filter((r) => !results.some((o) =>
    o.meta.name !== r.meta.name && o.meta.imports.includes(r.meta.name)));
  const seen = new Set();
  const cycle = [];
  function walk(name, stack) {
    if (stack.includes(name)) { cycle.push([...stack, name].join(" → ")); return; }
    if (seen.has(name)) return;
    seen.add(name);
    const r = results.find((x) => x.meta.name === name);
    for (const child of r ? r.meta.imports : []) walk(child, [...stack, name]);
  }
  walk(roots[0]?.meta.name ?? names[0], []);
  for (const r of results) if (!seen.has(r.meta.name)) walk(r.meta.name, []);
  if (cycle.length) {
    console.error("compile-dc: circular import: " + cycle.join(", "));
    process.exit(1);
  }

  const manifest = {
    components: results.map((r) => ({
      name: r.meta.name,
      module: `generated/${moduleBase(r.meta.name)}.js`,
      source: r.meta.file,
      imports: r.meta.imports,
      hasLogic: r.meta.hasLogic,
      preview: r.meta.preview || null,
      props: r.meta.propsMeta ? Object.keys(r.meta.propsMeta) : [],
    })),
    roots: roots.map((r) => r.meta.name),
    pseudoRules: sheet.rules.length,
  };

  if (CHECK) {
    console.log(`compile-dc --check: ${results.length} components compiled clean, `
      + `${sheet.rules.length} pseudo-state rules, roots: ${manifest.roots.join(", ")}`);
    return;
  }

  if (existsSync(OUT)) await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  for (const r of results) {
    await writeFile(path.join(OUT, moduleBase(r.meta.name) + ".js"), r.code, "utf8");
  }
  await writeFile(path.join(OUT, "pseudo.css"), sheet.stylesheet(), "utf8");
  await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  /* The helmets of the two root components are the only place the shared
     non-component scripts and font links are declared. The shell builder reads
     them from here rather than re-deriving them. */
  await writeFile(path.join(OUT, "helmets.json"), JSON.stringify(
    Object.fromEntries(results.filter((r) => r.meta.helmet)
      .map((r) => [r.meta.name, r.meta.helmet])), null, 2), "utf8");

  console.log(banner("compile-dc"));
  for (const c of manifest.components) {
    console.log(`  ${c.name.padEnd(16)} → ${c.module}`
      + (c.imports.length ? `  (imports ${c.imports.length})` : ""));
  }
  console.log(`\n  ${results.length} modules, ${sheet.rules.length} pseudo-state rules`);
  console.log(`  roots: ${manifest.roots.join(", ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
