/* build/dc-test-harness.mjs — runs a fixture without React and without a DOM.
 *
 * The generated module is real ES module text, so to exercise it the harness
 * strips its import/export lines and evaluates the body against a stub runtime
 * whose `$h` builds plain objects. Two reasons for the stub rather than React:
 * the assertions become readable strings instead of React internals, and the
 * compiler's own test suite gains no dependency on the framework it targets.
 *
 * `new Function` appears here, in a build-time test, and nowhere in anything
 * that ships — that distinction is the whole point of the compiler.
 */

import {
  compileDc, DcCompileError, PseudoSheet,
} from "./dc-compiler-core.mjs";
import { fixtureSource } from "./dc-fixtures.mjs";

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img",
  "input", "link", "meta", "param", "source", "track", "wbr"]);

const camelToKebab = (k) => (k.startsWith("--") ? k : k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()));

function fmtValue(v) {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "function") return `{fn:${v()}}`;
  if (v && typeof v === "object") {
    if (v.__el) return `{el:${v.__el}}`;
    const inner = Object.entries(v)
      .map(([k, x]) => `${k}:${x === null ? "null" : typeof x === "object" ? "…" : String(x)}`)
      .join(",");
    return `{{${inner}}}`;
  }
  return `{${String(v)}}`;
}

function serialiseStyle(obj) {
  return Object.entries(obj).map(([k, v]) => `${camelToKebab(k)}:${v}`).join(";");
}

export function serialise(node) {
  if (node === null || node === undefined || node === false || node === true) return "";
  if (Array.isArray(node)) return node.map(serialise).join("");
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node !== "object") return String(node);

  const kids = (node.kids || []).map(serialise).join("");
  const tag = node.__el;

  if (tag === "#frag") return kids;

  /* A child component mount: printed by component name so a fixture can
     assert which component received which props. */
  if (typeof tag === "object" && tag && tag.__dcName) {
    const attrs = Object.entries(node.props || {})
      .map(([k, v]) => ` ${k}=${fmtValue(v)}`).join("");
    return `<${tag.__dcName}${attrs}${kids ? ">" + kids + `</${tag.__dcName}>` : "/>"}`;
  }

  const parts = [];
  for (const [k, v] of Object.entries(node.props || {})) {
    if (v === undefined || k === "key") continue;
    if (k === "style" && v && typeof v === "object") {
      parts.push(` style="${serialiseStyle(v)}"`);
      continue;
    }
    parts.push(typeof v === "string" ? ` ${k}="${v}"` : ` ${k}=${fmtValue(v)}`);
  }
  const attrs = parts.join("");
  if (VOID_TAGS.has(tag)) return `<${tag}${attrs}/>`;
  return `<${tag}${attrs}>${kids}</${tag}>`;
}

function stubRuntime() {
  const flat = (kids) => kids.flat(Infinity)
    .filter((k) => k !== null && k !== undefined && k !== false && k !== true && k !== "");
  return {
    $h: (tag, props, ...kids) => ({ __el: tag, props: props || {}, kids: flat(kids) }),
    $F: "#frag",
    $each: (list, fn) => {
      if (Array.isArray(list)) return list.map(fn);
      if (list == null) return null;
      if (typeof list === "number") return Array.from({ length: list }, (_, i) => fn(i, i));
      if (typeof list[Symbol.iterator] === "function") return Array.from(list, fn);
      if (typeof list === "object") return Object.keys(list).map((k, i) => fn(list[k], i));
      return null;
    },
    $tx: (v) => (v === undefined || v === null || v === false ? "" : v),
    $st: (v) => {
      if (v == null) return undefined;
      if (typeof v === "object") return v;
      const o = {};
      for (const decl of String(v).split(";")) {
        const i = decl.indexOf(":");
        if (i < 0) continue;
        const p = decl.slice(0, i).trim();
        if (p) o[p.startsWith("--") ? p : p.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = decl.slice(i + 1).trim();
      }
      return o;
    },
    $cn: (...p) => p.filter(Boolean).join(" "),
    $vu: (v) => (v === undefined ? "" : v),
    $cu: (v) => (v === undefined ? false : v),
    $createDC: (name, Logic, render, propsMeta) => ({ name, Logic, render, propsMeta }),
    DCLogic: class { constructor(p) { this.props = p || {}; this.state = {}; } renderVals() { return {}; } },
    React: { createElement: (t, p, ...k) => ({ __el: t, props: p || {}, kids: flat(k) }) },
  };
}

/* The generated module, made callable: imports dropped (the harness supplies
   those bindings by name), exports turned into locals. */
function instantiate(code, childNames) {
  const body = code
    .replace(/^import[^\n]*;$/gm, "")
    .replace(/^export default /m, "const __default = ")
    .replace(/^export const /m, "const ");
  const rt = stubRuntime();
  const rtNames = ["$h", "$F", "$each", "$tx", "$st", "$cn", "$vu", "$cu", "$createDC", "DCLogic", "React"];
  const childBindings = childNames.map((n) => "$c_" + n.replace(/[^A-Za-z0-9_$]/g, ""));
  const childValues = childNames.map((n) => ({ __dcName: n }));
  // eslint-disable-next-line no-new-func -- build-time test only; see file header
  const fn = new Function(...rtNames, ...childBindings,
    body + "\n;return { render, propsMeta, __default };");
  return fn(...rtNames.map((n) => rt[n]), ...childValues);
}

export function runFixture(f, parseFragment) {
  const sheet = new PseudoSheet();
  const known = new Set(f.known || []);
  let compiled;
  try {
    compiled = compileDc({
      file: f.name + ".dc.html", name: f.name, source: fixtureSource(f),
      parseFragment, sheet, known,
    });
  } catch (e) {
    if (!(e instanceof DcCompileError)) return { ok: false, why: `threw ${e.name}: ${e.message}` };
    if (!f.expectError) return { ok: false, why: `unexpected build failure: ${e.message}` };
    if (!f.expectError.test(e.message)) {
      return { ok: false, why: `wrong diagnostic\n    want /${f.expectError.source}/\n    got  ${e.message}` };
    }
    if (!/\.dc\.html:/.test(e.message)) {
      return { ok: false, why: `diagnostic names no file/line: ${e.message}` };
    }
    return { ok: true, note: "failed as required" };
  }
  if (f.expectError) {
    return { ok: false, why: `compiled clean but should have failed (/${f.expectError.source}/)` };
  }

  const mod = instantiate(compiled.code, [...known]);
  let out;
  try {
    out = serialise(mod.render(f.vals || {}));
  } catch (e) {
    return { ok: false, why: `render threw ${e.name}: ${e.message}` };
  }
  if (out !== f.expect) {
    return { ok: false, why: `render mismatch\n    want ${JSON.stringify(f.expect)}\n    got  ${JSON.stringify(out)}` };
  }
  if (f.expectSheet) {
    const missing = f.expectSheet.filter((r) => !sheet.rules.includes(r));
    if (missing.length) {
      return { ok: false, why: `stylesheet missing rule(s):\n    ${missing.join("\n    ")}\n    got: ${sheet.rules.join(" ")}` };
    }
  }
  return { ok: true };
}
