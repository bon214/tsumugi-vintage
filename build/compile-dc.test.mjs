/* build/compile-dc.test.mjs — `node --test build/*.test.mjs`
 *
 * Two suites:
 *   1. the fixture cases in dc-fixtures.mjs, each compiled and rendered
 *      against a stub runtime, plus the cases that must FAIL to compile;
 *   2. the project itself — all 21 `.dc.html` files must compile clean, and
 *      the import graph must resolve.
 *
 * The second suite is the one that catches a real regression: an edit to a
 * template that introduces a construct the compiler does not implement fails
 * here, before the build writes anything.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { parseFragment } from "./parse-node.mjs";
import { fixtures, duplicateBaseCases } from "./dc-fixtures.mjs";
import { runFixture } from "./dc-test-harness.mjs";
import { compileDc, PseudoSheet, findDuplicateBases, importantify, cssToObj }
  from "./dc-compiler-core.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

test("production compiler CLI completes its real project graph check", () => {
  const run = spawnSync(process.execPath,
    [path.join(ROOT, "build", "compile-dc.mjs"), "--check"],
    { cwd: ROOT, encoding: "utf8" });
  assert.equal(run.status, 0,
    `compile-dc --check failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`);
  assert.match(run.stdout, /21 components compiled clean/);
});

test("template fixtures", async (t) => {
  for (const f of fixtures) {
    await t.test(`${f.name} — ${f.why}`, () => {
      const r = runFixture(f, parseFragment);
      assert.ok(r.ok, r.why);
    });
  }
});

test("duplicate module basenames are refused", () => {
  for (const c of duplicateBaseCases) {
    assert.equal(findDuplicateBases(c.names).length, c.clashes, c.names.join(" / "));
  }
});

test("pseudo-state CSS keeps url() and quoted strings intact", () => {
  assert.equal(
    importantify("background:url(data:image/svg+xml;utf8,x);color:red"),
    "background:url(data:image/svg+xml;utf8,x) !important;color:red !important");
  assert.equal(
    importantify("content:'a;b';color:red"),
    "content:'a;b' !important;color:red !important");
  assert.deepEqual(
    cssToObj("background:url(a;b);--x:1;font-size:12px"),
    { background: "url(a;b)", "--x": "1", fontSize: "12px" });
});

test("every component in the project compiles", async (t) => {
  const names = (await readdir(ROOT))
    .filter((f) => f.endsWith(".dc.html"))
    .map((f) => f.slice(0, -".dc.html".length)).sort();

  assert.ok(names.length >= 21, `expected the project's components, found ${names.length}`);
  assert.equal(findDuplicateBases(names).length, 0);

  const known = new Set(names);
  const sheet = new PseudoSheet();
  const metas = [];

  for (const name of names) {
    await t.test(name, async () => {
      const source = await readFile(path.join(ROOT, `${name}.dc.html`), "utf8");
      const r = compileDc({ file: `${name}.dc.html`, name, source, parseFragment, sheet, known });
      /* Nothing may reach the output that would need a compiler in the
         browser, and no editor-only attribute may survive. */
      assert.doesNotMatch(r.code, /new Function|\beval\(/, "generated module evaluates a string");
      assert.doesNotMatch(r.code, /hint-(size|placeholder)/, "hint attribute leaked into the output");
      assert.doesNotMatch(r.code, /data-dc-(line|tpl)/, "editor attribute leaked into the output");
      assert.match(r.code, /export default \$createDC\(/);
      metas.push(r.meta);
    });
  }

  await t.test("import graph resolves and every child is imported statically", () => {
    const byName = new Map(metas.map((m) => [m.name, m]));
    for (const m of metas) {
      for (const child of m.imports) {
        assert.ok(byName.has(child), `${m.name} imports ${child}, which does not exist`);
      }
    }
    const roots = metas.filter((m) => !metas.some((o) => o.imports.includes(m.name)));
    assert.deepEqual(roots.map((r) => r.name).sort(), ["TSUMUGI", "TSUMUGI Admin"]);

    /* Every non-root component must be reachable from a root, or it is dead
       weight in the bundle. */
    const seen = new Set();
    (function walk(name) {
      if (seen.has(name)) return;
      seen.add(name);
      for (const c of byName.get(name).imports) walk(c);
    })("TSUMUGI");
    (function walk(name) {
      if (seen.has(name)) return;
      seen.add(name);
      for (const c of byName.get(name).imports) walk(c);
    })("TSUMUGI Admin");
    const orphans = metas.map((m) => m.name).filter((n) => !seen.has(n));
    assert.deepEqual(orphans, [], `unreachable component(s): ${orphans.join(", ")}`);
  });
});
