/* build/dc-compiler-core.mjs — Design Component → ES module compiler.
 *
 * WHY THIS EXISTS
 * The editable source of this project is a set of `.dc.html` files, each a
 * template plus a `class Component extends DCLogic`. In the editing runtime
 * (`support.js`) both halves are interpreted in the browser: the template is
 * walked into closures at load time and the logic class is built with
 * `new Function`. That is a fine authoring model and a bad production one — it
 * forces `script-src 'unsafe-eval'`, ships a compiler to every visitor, and
 * makes every screen a runtime `fetch` of a sibling `.dc.html`.
 *
 * This module does the same work at build time and emits a plain ES module per
 * component: React.createElement calls for the template, the logic class
 * verbatim as module-level source, and static imports for child components.
 * Nothing in the output evaluates a string.
 *
 * SEMANTIC PARITY IS THE POINT
 * Every rule below mirrors a specific behaviour of `support.js`, because the
 * design that was reviewed and approved is the one that runtime produces.
 * Where the two could differ, the support.js behaviour wins and the reason is
 * recorded in a comment. The deliberate differences are exactly three:
 *   1. editor plumbing is dropped (`data-dc-tpl`, `hint-*`, the streaming
 *      placeholders, the `.sc-interp` span around every resolved hole);
 *   2. pseudo-state CSS (`style-hover` and friends) is emitted as one static
 *      stylesheet instead of `insertRule` calls made during the first render;
 *   3. an unsupported construct fails the build instead of being warned about
 *      in a console nobody reads.
 *
 * NO DOM DEPENDENCY
 * The caller passes a `parseFragment(html) -> Node[]` adapter, so the same
 * compiler runs under Node (parse5) and in a browser (<template>.innerHTML).
 * Node shape: { type: "element"|"text", tag, attrs: [{name,value}],
 * children: Node[], text }.
 */

/* ------------------------------------------------------------------ shared */

/* support.js/src/encode.ts — `<table>`/`<select>` and their children are
   parsed with foster-parenting rules that would hoist `<sc-if>` out of a
   table. Both runtimes therefore rename them before parsing and rename back
   when emitting. */
export const RAW_WRAP = {
  select: "sc-raw-select", table: "sc-raw-table", tbody: "sc-raw-tbody",
  thead: "sc-raw-thead", tfoot: "sc-raw-tfoot", tr: "sc-raw-tr",
  td: "sc-raw-td", th: "sc-raw-th", caption: "sc-raw-caption",
};
export const RAW_UNWRAP = Object.fromEntries(
  Object.entries(RAW_WRAP).map(([k, v]) => [v, k]));

const CAMEL_ATTR = "sc-camel-";

/* Lowercase `onclick=` in source maps to the React name. Attributes already
   written in camelCase (`onClick=`) survive parsing via the CAMEL_ATTR
   encoding below and need no entry here. */
const EVENT_MAP = {
  onclick: "onClick", onchange: "onChange", oninput: "onInput",
  onsubmit: "onSubmit", onkeydown: "onKeyDown", onkeyup: "onKeyUp",
  onkeypress: "onKeyPress", onmousedown: "onMouseDown", onmouseup: "onMouseUp",
  onmouseenter: "onMouseEnter", onmouseleave: "onMouseLeave", onfocus: "onFocus",
  onblur: "onBlur", ondoubleclick: "onDoubleClick", oncontextmenu: "onContextMenu",
  onmousemove: "onMouseMove", onmouseover: "onMouseOver", onmouseout: "onMouseOut",
  onpointerdown: "onPointerDown", onpointerup: "onPointerUp",
  onpointermove: "onPointerMove", onpointerenter: "onPointerEnter",
  onpointerleave: "onPointerLeave", onpointercancel: "onPointerCancel",
  onpointerover: "onPointerOver", onpointerout: "onPointerOut",
  ontouchstart: "onTouchStart", ontouchend: "onTouchEnd",
  ontouchmove: "onTouchMove", ontouchcancel: "onTouchCancel",
  ondragstart: "onDragStart", ondragend: "onDragEnd", ondragenter: "onDragEnter",
  ondragleave: "onDragLeave", ondragover: "onDragOver", ondrop: "onDrop",
  onanimationstart: "onAnimationStart", onanimationend: "onAnimationEnd",
  onanimationiteration: "onAnimationIteration", ontransitionend: "onTransitionEnd",
  onwheel: "onWheel", onscroll: "onScroll", onload: "onLoad", onerror: "onError",
  ontoggle: "onToggle", onreset: "onReset", onselect: "onSelect",
};

/* HTML spells some attributes all-lowercase; React's canonical prop name is
   camelCase and it warns ("Did you mean contentEditable?") for the lowercase
   form. The authoring runtime passes these straight through and lives with the
   warning; production maps them, which changes nothing in the rendered DOM. */
const ATTR_CASE_MAP = {
  tabindex: "tabIndex", contenteditable: "contentEditable", crossorigin: "crossOrigin",
  readonly: "readOnly", maxlength: "maxLength", minlength: "minLength",
  autocomplete: "autoComplete", autocapitalize: "autoCapitalize", spellcheck: "spellCheck",
  inputmode: "inputMode", novalidate: "noValidate", colspan: "colSpan",
  rowspan: "rowSpan", autofocus: "autoFocus", srcset: "srcSet", usemap: "useMap",
  enctype: "encType", datetime: "dateTime", accesskey: "accessKey",
  autoplay: "autoPlay", formaction: "formAction", formnovalidate: "formNoValidate",
  enterkeyhint: "enterKeyHint", allowfullscreen: "allowFullScreen",
  referrerpolicy: "referrerPolicy", frameborder: "frameBorder",
};

const RAW_TEXT_TAGS = new Set(["script", "style", "textarea", "title"]);

/* Constructs this project does not use. Listed rather than ignored: a template
   that grows one of them must fail loudly, not render a literal `<sc-else>`
   into the page (which is what the editing runtime would do). */
const UNSUPPORTED_TAGS = {
  "sc-else": "sc-else (no template in this project uses it)",
  "x-import": "x-import (external React/web components — none in this project)",
  "deck-stage": "deck-stage (slide runtime — not part of this project)",
  "sc-slot": "sc-slot",
};

export class DcCompileError extends Error {
  constructor({ file, line, syntax, message }) {
    super(`${file}:${line || "?"}: [${syntax}] ${message}`);
    this.name = "DcCompileError";
    Object.assign(this, { file, line, syntax, detail: message });
  }
}

const countNl = (s) => {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === "\n") n++;
  return n;
};

/* ------------------------------------------------- line stamping (for errors) */

/* Records the source line of every element as `data-dc-line`, before parsing,
   so a diagnostic can name a line the author can actually navigate to. The
   attribute is consumed by the compiler and never reaches the output. */
export function stampLines(html, lineOffset = 0) {
  let out = "", line = 1 + lineOffset, i = 0;
  const n = html.length;
  while (i < n) {
    const c = html[i];
    if (c === "\n") { line++; out += c; i++; continue; }
    if (c !== "<") { out += c; i++; continue; }
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      const seg = html.slice(i, end === -1 ? n : end + 3);
      line += countNl(seg); out += seg; i += seg.length; continue;
    }
    const m = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(i, i + 64));
    if (!m) {
      const end = html.indexOf(">", i);
      const seg = html.slice(i, end === -1 ? n : end + 1);
      line += countNl(seg); out += seg; i += seg.length; continue;
    }
    let j = i + m[0].length, q = "";
    while (j < n) {
      const ch = html[j];
      if (q) { if (ch === q) q = ""; }
      else if (ch === '"' || ch === "'") q = ch;
      else if (ch === ">") break;
      j++;
    }
    const openTag = html.slice(i, Math.min(j + 1, n));
    out += "<" + m[1] + ` data-dc-line="${line}"` + openTag.slice(m[0].length);
    line += countNl(openTag);
    i += openTag.length;
    const tag = m[1].toLowerCase();
    if (RAW_TEXT_TAGS.has(tag) && !openTag.endsWith("/>")) {
      const close = html.toLowerCase().indexOf("</" + tag, i);
      const seg = html.slice(i, close === -1 ? n : close);
      line += countNl(seg); out += seg; i += seg.length;
    }
  }
  return out;
}

/* --------------------------------------------------------------- encodeCase */

const ATTRS = `(?:[^>"']|"[^"]*"|'[^']*')*`;
const IMPORT_SELF_CLOSE_RE = new RegExp("<(x-import|dc-import)(" + ATTRS + ")/>", "gi");
const CAMEL_ATTR_RE = /(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)/g;

/* Byte-for-byte the transformation support.js applies before parsing: HTML
   lowercases attribute names, so `onClick` and `hintSize` are encoded into
   kebab-case markers and decoded after parsing. */
export function encodeCase(html) {
  html = html.replace(IMPORT_SELF_CLOSE_RE, (_, t, a) => "<" + t + a + "></" + t + ">");
  html = html.replace(/<helmet(\s|>)/gi, "<sc-helmet$1").replace(/<\/helmet\s*>/gi, "</sc-helmet>");
  html = html.replace(CAMEL_ATTR_RE, (_, sp, name, eq) =>
    sp + CAMEL_ATTR + name.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()) + eq);
  for (const [real, alias] of Object.entries(RAW_WRAP)) {
    html = html.replace(new RegExp("(</?)" + real + "(?=[\\s>])", "gi"), "$1" + alias);
  }
  return html;
}

const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/* Splits a declaration list on `;`, ignoring separators inside quotes,
   parentheses and unquoted url(). `background:url(data:image/svg+xml;utf8,x)`
   is one declaration, not two — splitting it naively truncated the value. */
export function splitDecls(css) {
  const decls = [];
  let start = 0, depth = 0, quote = "";
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = ""; }
    else if (c === "'" || c === '"') quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === ";" && depth === 0) { decls.push(css.slice(start, i)); start = i + 1; }
    else {
      const end = scanUnquotedUrl(css, i);
      if (end !== -1) i = end - 1;
    }
  }
  decls.push(css.slice(start));
  return decls;
}

export function cssToObj(css) {
  const o = {};
  for (const decl of splitDecls(String(css))) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    if (!prop) continue;
    o[prop.startsWith("--") ? prop : kebabToCamel(prop)] = decl.slice(i + 1).trim();
  }
  return o;
}

/* ------------------------------------------------- pseudo-state stylesheet */

/* support.js/src/pseudo.ts, verbatim in behaviour: declarations get
   `!important` so a hover rule beats the element's own inline style, and `;`
   inside url() or a quoted string is not a declaration break. */
function scanUnquotedUrl(css, i) {
  if ((css[i] !== "u" && css[i] !== "U") || css.slice(i, i + 4).toLowerCase() !== "url("
      || /[a-z0-9_-]/i.test(css[i - 1] ?? "")) return -1;
  let j = i + 4;
  while (j < css.length && /\s/.test(css[j])) j++;
  if (css[j] === '"' || css[j] === "'") return -1;
  while (j < css.length && css[j] !== ")") {
    if (css[j] === "\\") j++;
    j++;
  }
  return j < css.length ? j + 1 : css.length;
}

function stripComments(css) {
  let out = "", quote = "";
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      if (c === "\\") { out += c + (css[i + 1] ?? ""); i++; continue; }
      if (c === quote) quote = "";
      out += c;
    } else if (c === "'" || c === '"') { quote = c; out += c; }
    else if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? css.length : end + 1;
      out += " ";
    } else {
      const end = scanUnquotedUrl(css, i);
      if (end === -1) out += c;
      else { out += css.slice(i, end); i = end - 1; }
    }
  }
  return out;
}

export function importantify(css) {
  return splitDecls(stripComments(css))
    .map((d) => d.trim()).filter(Boolean)
    .map((d) => (/!\s*important$/i.test(d) ? d : d + " !important")).join(";");
}

/* One sheet for the whole application: identical `style-hover` values across
   21 components collapse to one class, which is a saving the runtime's
   per-render cache cannot make across component boundaries. */
export class PseudoSheet {
  constructor() { this.cache = new Map(); this.rules = []; }
  classFor(pseudo, css) {
    const key = pseudo + "|" + css;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const cls = "scp" + this.cache.size.toString(36);
    const isElement = pseudo === "before" || pseudo === "after";
    const sel = isElement ? `.${cls}::${pseudo}` : `.${cls}:${pseudo}`;
    this.rules.push(`${sel}{${isElement ? css : importantify(css)}}`);
    this.cache.set(key, cls);
    return cls;
  }
  stylesheet() {
    return "/* Generated by build/compile-dc.mjs — pseudo-state rules lifted from\n"
      + "   style-hover / style-focus / style-active template attributes. */\n"
      + this.rules.join("\n") + "\n";
  }
}

/* ------------------------------------------------------ expression compiler */

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*/;
const RESERVED = new Set(["break", "case", "catch", "class", "const", "continue",
  "debugger", "default", "delete", "do", "else", "export", "extends", "finally",
  "for", "function", "if", "import", "in", "instanceof", "new", "return", "super",
  "switch", "this", "throw", "try", "typeof", "var", "void", "while", "with",
  "yield", "let", "static", "enum", "await", "implements", "package", "protected",
  "interface", "private", "public"]);

/* The grammar the templates actually use, and nothing more: an identifier, a
   dotted or indexed path off one, or a literal. support.js additionally
   tolerates `===`-style comparisons inside a hole; no template in this project
   contains one, so it is left out deliberately — if one appears, the build
   stops and names the file and line rather than quietly compiling a wider
   language than was reviewed. */
export function compileExpr(raw, scope, fail) {
  const expr = String(raw).trim();
  if (!expr) fail("expression", "empty {{ }} hole");
  if (/^-?\d+(\.\d+)?$/.test(expr)) return expr;
  if (expr === "true" || expr === "false" || expr === "null") return expr;
  if (expr === "undefined") return "void 0";
  if (/^"[^"\\]*"$/.test(expr) || /^'[^'\\]*'$/.test(expr)) {
    return JSON.stringify(expr.slice(1, -1));
  }
  const head = IDENT_RE.exec(expr);
  if (!head || head.index !== 0) {
    fail("expression", `cannot compile {{ ${expr} }} — only identifiers, dotted `
      + `paths and literals are supported (compute anything else in renderVals)`);
  }
  const name = head[0];
  let out = scope.has(name) ? name : `v.${name}`;
  let i = name.length;
  while (i < expr.length) {
    if (expr[i] === ".") {
      const m = IDENT_RE.exec(expr.slice(i + 1)) || /^\d+/.exec(expr.slice(i + 1));
      if (!m || m.index !== 0) fail("expression", `malformed path {{ ${expr} }}`);
      out += /^\d/.test(m[0]) ? `?.[${m[0]}]` : `?.${m[0]}`;
      i += 1 + m[0].length;
      continue;
    }
    if (expr[i] === "[") {
      let depth = 0, j = i;
      for (; j < expr.length; j++) {
        if (expr[j] === "[") depth++;
        else if (expr[j] === "]") { depth--; if (!depth) break; }
      }
      if (depth !== 0) fail("expression", `unbalanced [ ] in {{ ${expr} }}`);
      out += `?.[${compileExpr(expr.slice(i + 1, j), scope, fail)}]`;
      i = j + 1;
      continue;
    }
    fail("expression", `cannot compile {{ ${expr} }} — only identifiers, dotted `
      + `paths and literals are supported (compute anything else in renderVals), `
      + `but found "${expr.slice(i).trim()}"`);
  }
  return out;
}

const HOLE_SPLIT = /\{\{([\s\S]+?)\}\}/g;
const hasHole = (s) => s.includes("{{");

/* `x="{{ a.b }}"` yields the value itself (function, number, object);
   `x="a {{ b }} c"` yields a string with `undefined` rendered as "". Both
   match compileAttr() in support.js. */
function compileAttrValue(raw, scope, fail) {
  const whole = /^\s*\{\{([\s\S]+?)\}\}\s*$/.exec(raw);
  if (whole) return { dynamic: true, code: compileExpr(whole[1], scope, fail) };
  if (!hasHole(raw)) return { dynamic: false, value: raw };
  const parts = raw.split(HOLE_SPLIT);
  let out = "`";
  parts.forEach((p, i) => {
    if (i & 1) out += "${" + compileExpr(p, scope, fail) + ' ?? ""}';
    else out += p.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  });
  return { dynamic: true, code: out + "`" };
}

/* ------------------------------------------------------------- JS emission */

const IDENT_ONLY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const jsKey = (k) => (IDENT_ONLY.test(k) ? k : JSON.stringify(k));
const objLit = (pairs) => pairs.length ? `{ ${pairs.join(", ")} }` : "null";

/* ------------------------------------------------------------------ compile */

export function compileDc({ file, name, source, parseFragment, sheet, known = new Set() }) {
  const at = { line: null };
  const fail = (syntax, message, line) => {
    throw new DcCompileError({ file, line: line ?? at.line, syntax, message });
  };

  /* --- split the document ------------------------------------------------ */
  const open = /<x-dc(?:\s[^>]*)?>/.exec(source);
  const close = source.lastIndexOf("</x-dc>");
  if (!open) fail("document", "no <x-dc> element — not a Design Component");
  if (close === -1 || close < open.index) fail("document", "<x-dc> is never closed");
  const tplStart = open.index + open[0].length;
  const template = source.slice(tplStart, close);
  const lineOffset = countNl(source.slice(0, tplStart));

  const scriptRe = /<script\b[^>]*\bdata-dc-script\b[^>]*>([\s\S]*?)<\/script\s*>/i;
  const scriptMatch = scriptRe.exec(source.slice(close));
  const logicSrc = scriptMatch ? scriptMatch[1] : "";
  const scriptOpen = scriptMatch ? /<script\b[^>]*\bdata-dc-script\b[^>]*>/i.exec(source.slice(close))[0] : "";
  const propsRaw = scriptOpen ? /\bdata-props\s*=\s*"([^"]*)"/i.exec(scriptOpen) : null;

  let propsMeta = null, preview = null;
  if (propsRaw) {
    const decoded = propsRaw[1]
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    let parsed;
    try { parsed = JSON.parse(decoded); }
    catch (e) { fail("data-props", `data-props is not valid JSON: ${e.message}`); }
    preview = parsed.$preview && typeof parsed.$preview === "object" ? parsed.$preview : null;
    propsMeta = {};
    for (const k of Object.keys(parsed)) if (k[0] !== "$") propsMeta[k] = parsed[k];
    if (!Object.keys(propsMeta).length) propsMeta = null;
  }

  /* --- parse ------------------------------------------------------------- */
  const nodes = parseFragment(encodeCase(stampLines(template, lineOffset)));

  const ctx = {
    file, name, sheet, known, fail, at,
    imports: new Map(),      // component name -> local binding
    helmet: null,
    heads: new Map(),        // hole head identifier -> first line seen
    keyN: 0,
  };

  const children = walkNodes(nodes, ctx, new Set(), 1);

  /* --- unresolved-hole check -------------------------------------------- */
  /* A hole's head must be something the component can actually produce: a
     declared prop, a `sc-for` alias (already resolved to a local binding), or
     a name the logic source mentions — anything a renderVals() key must do.
     A typo in a hole is otherwise invisible until a customer sees a gap. */
  const propNames = new Set(Object.keys(propsMeta || {}));
  const logicWords = new Set(logicSrc.match(/[A-Za-z_$][\w$]*/g) || []);
  const unresolved = [...ctx.heads.keys()].filter((h) => !propNames.has(h) && !logicWords.has(h));
  if (unresolved.length) {
    fail("unresolved-expression",
      `{{ ${unresolved.join(" }}, {{ ")} }} — no prop, no sc-for alias, and no `
      + `mention in the component logic, so the hole can never resolve`,
      ctx.heads.get(unresolved[0]));
  }

  /* --- emit -------------------------------------------------------------- */
  const usesReact = /\bReact\b/.test(logicSrc);
  const rtNames = ["h as $h", "F as $F", "each as $each", "tx as $tx", "st as $st",
    "cn as $cn", "vu as $vu", "cu as $cu", "createDC as $createDC", "DCLogic"];
  if (usesReact) rtNames.push("React");
  if (/\bStreamableLogic\b/.test(logicSrc)) rtNames.push("StreamableLogic");

  const lines = [];
  /* The source filename is written without its extension on purpose: the
     release gate bans any reference to an authoring source file in shipped
     output, and a comment is still a reference. */
  lines.push(`/* GENERATED — do not edit. Design Component source: ${name}`);
  lines.push(`   Regenerate with: node build/compile-dc.mjs */`);
  lines.push(`import { ${rtNames.join(", ")} } from "../runtime/dc-runtime.js";`);
  for (const [child, binding] of ctx.imports) {
    lines.push(`import ${binding} from "./${moduleBase(child)}.js";`);
  }
  lines.push("");
  if (logicSrc.trim()) {
    lines.push(`/* ---- component logic, verbatim from ${file} ---- */`);
    lines.push(logicSrc.trim());
    lines.push("");
  }
  lines.push(`/* ---- template ---- */`);
  lines.push(`function render(v) {`);
  lines.push(`  return [${children.length ? "\n    " + children.join(",\n    ") + "\n  " : ""}];`);
  lines.push(`}`);
  lines.push("");
  lines.push(`export const propsMeta = ${propsMeta ? JSON.stringify(propsMeta) : "null"};`);
  lines.push(`export default $createDC(${JSON.stringify(name)}, `
    + `${logicSrc.includes("class Component") ? "Component" : "null"}, render, propsMeta);`);

  return {
    code: lines.join("\n") + "\n",
    meta: {
      name, file, preview, propsMeta,
      imports: [...ctx.imports.keys()],
      helmet: ctx.helmet,
      hasLogic: !!logicSrc.trim(),
    },
  };
}

export const moduleBase = (name) => name.replace(/[^A-Za-z0-9_$]/g, "");

/* Two component names can reduce to one module filename ("TSUMUGI Admin" and
   "TSUMUGI-Admin" both give TSUMUGIAdmin). The second write would silently
   replace the first, so the build refuses instead. */
export function findDuplicateBases(names) {
  const byBase = new Map();
  const clashes = [];
  for (const n of names) {
    const b = moduleBase(n);
    if (byBase.has(b)) clashes.push({ base: b, names: [byBase.get(b), n] });
    else byBase.set(b, n);
  }
  return clashes;
}

/* ------------------------------------------------------------------- walker */

function walkNodes(nodes, ctx, scope, depth) {
  const out = [];
  for (const node of nodes) {
    const code = walkNode(node, ctx, scope, depth);
    if (code != null) out.push(code);
  }
  return out;
}

const attrMap = (node) => {
  const m = new Map();
  for (const a of node.attrs) m.set(a.name, a.value);
  return m;
};
const lineOf = (node) => Number(attrMap(node).get("data-dc-line")) || null;

function walkNode(node, ctx, scope, depth) {
  if (node.type === "text") return walkText(node, ctx, scope);
  if (node.type !== "element") return null;
  ctx.at.line = lineOf(node) ?? ctx.at.line;
  const tag = node.tag;
  if (UNSUPPORTED_TAGS[tag]) {
    ctx.fail("unsupported-element", `<${tag}> is not supported by this compiler: `
      + UNSUPPORTED_TAGS[tag], lineOf(node));
  }
  if (tag === "sc-helmet") { ctx.helmet = serialise(node.children); return null; }
  if (tag === "sc-if") return walkIf(node, ctx, scope, depth);
  if (tag === "sc-for") return walkFor(node, ctx, scope, depth);
  if (tag === "dc-import") return walkImport(node, ctx, scope, depth);
  return walkElement(node, ctx, scope, depth);
}

/* support.js/walkText: a text node with no hole is kept unless it is blank AND
   contains no space — so the newline+indent between two inline elements is a
   real space in the rendered output and must stay one here. The `.sc-interp`
   span the editing runtime wraps each resolved hole in is dropped: it exists
   to give the editor something to click. */
function walkText(node, ctx, scope) {
  const txt = node.text ?? "";
  if (!hasHole(txt)) {
    if (!txt.trim() && !txt.includes(" ")) return null;
    return JSON.stringify(txt);
  }
  const parts = txt.split(HOLE_SPLIT);
  const pieces = [];
  parts.forEach((p, i) => {
    if (i & 1) {
      trackHead("{{" + p + "}}", ctx, scope);
      pieces.push(`$tx(${compileExpr(p, scope, ctx.fail)})`);
    } else if (p) pieces.push(JSON.stringify(p));
  });
  return pieces.length === 1 ? pieces[0] : `$h($F, null, ${pieces.join(", ")})`;
}

function requireAttr(node, ctx, attrs, key, tag) {
  const v = attrs.get(key);
  if (v == null || v === "") {
    ctx.fail(tag, `<${tag}> without a ${key} attribute renders nothing — remove `
      + `it or give it a ${key}`, lineOf(node));
  }
  return v;
}

function checkExtraAttrs(node, ctx, attrs, allowed, tag) {
  for (const k of attrs.keys()) {
    if (allowed.has(k) || k.startsWith("hint-") || k === "data-dc-line") continue;
    ctx.fail(tag, `<${tag}> does not take a "${k}" attribute`, lineOf(node));
  }
}

/* Records the head identifier of a hole so the caller can prove every hole is
   fillable. A `sc-for` alias is already a real binding, so it is skipped. */
function trackHead(raw, ctx, scope) {
  const m = /\{\{\s*([A-Za-z_$][\w$]*)/.exec(raw);
  if (!m) return;
  if (scope && scope.has(m[1])) return;
  if (/^(true|false|null|undefined)$/.test(m[1])) return;
  if (!ctx.heads.has(m[1])) ctx.heads.set(m[1], ctx.at.line);
}

function walkIf(node, ctx, scope, depth) {
  const attrs = attrMap(node);
  checkExtraAttrs(node, ctx, attrs, new Set(["value"]), "sc-if");
  const raw = requireAttr(node, ctx, attrs, "value", "sc-if");
  trackHead(raw, ctx, scope);
  const cond = compileAttrValue(raw, scope, ctx.fail);
  const test = cond.dynamic ? cond.code : JSON.stringify(cond.value);
  const kids = walkNodes(node.children, ctx, scope, depth + 1);
  const key = `i${ctx.keyN++}`;
  const pad = "  ".repeat(depth + 1);
  if (!kids.length) return `(${test} ? $h($F, { key: "${key}" }) : null)`;
  return `(${test} ? $h($F, { key: "${key}" },\n${pad}${kids.join(`,\n${pad}`)}) : null)`;
}

function walkFor(node, ctx, scope, depth) {
  const attrs = attrMap(node);
  checkExtraAttrs(node, ctx, attrs, new Set(["list", "as"]), "sc-for");
  const raw = requireAttr(node, ctx, attrs, "list", "sc-for");
  trackHead(raw, ctx, scope);
  const alias = attrs.get("as") || "item";
  if (!IDENT_ONLY.test(alias) || RESERVED.has(alias)) {
    ctx.fail("sc-for", `as="${alias}" is not a usable variable name`, lineOf(node));
  }
  const list = compileAttrValue(raw, scope, ctx.fail);
  const listCode = list.dynamic ? list.code : JSON.stringify(list.value);
  const inner = new Set(scope);
  inner.add(alias);
  inner.add("$index");
  const kids = walkNodes(node.children, ctx, inner, depth + 2);
  const pad = "  ".repeat(depth + 1);
  const body = kids.length ? `\n${pad}  ${kids.join(`,\n${pad}  `)}` : "";
  return `$each(${listCode}, (${alias}, $index) => $h($F, { key: $index }${body ? "," + body : ""}))`;
}

function walkImport(node, ctx, scope, depth) {
  const attrs = attrMap(node);
  const child = attrs.get("name") || attrs.get("component");
  if (!child) ctx.fail("dc-import", "<dc-import> without a name attribute", lineOf(node));
  if (hasHole(child)) {
    ctx.fail("dc-import", `name="${child}" — a component name cannot be a `
      + `{{ hole }}: production resolves imports statically`, lineOf(node));
  }
  if (!ctx.known.has(child)) {
    ctx.fail("missing-component", `<dc-import name="${child}"> — no ${child}.dc.html `
      + `in the project (known: ${[...ctx.known].sort().join(", ")})`, lineOf(node));
  }
  if (attrs.has("style")) {
    ctx.fail("dc-import", `a style attribute on <dc-import> positions the child host `
      + `in the editing runtime; no template here uses it and production does not `
      + `implement it`, lineOf(node));
  }
  let binding = ctx.imports.get(child);
  if (!binding) {
    binding = "$c_" + moduleBase(child);
    ctx.imports.set(child, binding);
  }

  const pairs = [];
  let spread = null;
  for (const [rawName, value] of attrs) {
    if (rawName === "name" || rawName === "component" || rawName === "data-dc-line") continue;
    if (rawName === "hint-size" || rawName.startsWith("hint-")) continue;
    let key = rawName.startsWith(CAMEL_ATTR) ? kebabToCamel(rawName.slice(CAMEL_ATTR.length)) : rawName;
    if (key.includes("-")) key = kebabToCamel(key);   // support.js: dc-import camelises
    trackHead(value, ctx, scope);
    const v = compileAttrValue(value, scope, ctx.fail);
    if (key === "dcProps") { spread = v.dynamic ? v.code : JSON.stringify(v.value); continue; }
    pairs.push(`${jsKey(key)}: ${v.dynamic ? v.code : JSON.stringify(v.value)}`);
  }
  const kids = walkNodes(node.children, ctx, scope, depth + 1);
  const props = spread
    ? `Object.assign(${objLit(pairs) === "null" ? "{}" : objLit(pairs)}, ${spread})`
    : objLit(pairs);
  const pad = "  ".repeat(depth + 1);
  const tail = kids.length ? `,\n${pad}${kids.join(`,\n${pad}`)}` : "";
  return `$h(${binding}, ${props}${tail})`;
}

function walkElement(node, ctx, scope, depth) {
  const tag = RAW_UNWRAP[node.tag] || node.tag;
  if (tag.includes("-")) {
    ctx.fail("unsupported-element", `<${tag}> is a custom element; production has `
      + `no runtime that defines it`, lineOf(node));
  }
  const pairs = [];
  const pseudo = [];
  let classCode = null, classStatic = null;

  for (const { name: rawName, value } of node.attrs) {
    if (rawName === "data-dc-line" || rawName === "sc-name" || rawName === "data-dc-tpl") continue;
    let key = rawName.startsWith(CAMEL_ATTR)
      ? kebabToCamel(rawName.slice(CAMEL_ATTR.length)) : rawName;

    if (key === "hint-size" || key.startsWith("hint-")) continue;

    if (key.startsWith("style-")) {
      const which = key.slice(6);
      if (hasHole(value)) {
        ctx.fail("style-pseudo", `${key}="${value}" contains a {{ hole }}; `
          + `pseudo-state rules are static CSS and cannot interpolate`, lineOf(node));
      }
      if (!/^(hover|focus|active|focus-visible|focus-within|before|after|visited|disabled|checked)$/.test(which)) {
        ctx.fail("style-pseudo", `unsupported pseudo state "${which}"`, lineOf(node));
      }
      pseudo.push(ctx.sheet.classFor(which, value));
      continue;
    }

    if (/^dangerously/i.test(key)) {
      ctx.fail("unsupported-attribute", `${key} — no template in this project sets `
        + `raw HTML, and the sanitiser exists so none needs to`, lineOf(node));
    }

    if (key === "class") key = "className";
    else if (key === "for") key = "htmlFor";
    else if (ATTR_CASE_MAP[key]) key = ATTR_CASE_MAP[key];
    else if (/^on[a-z]/.test(key)) key = EVENT_MAP[key] || "on" + key[2].toUpperCase() + key.slice(3);

    trackHead(value, ctx, scope);
    const v = compileAttrValue(value, scope, ctx.fail);

    if (key === "className") {
      if (v.dynamic) classCode = v.code; else classStatic = v.value;
      continue;
    }
    if (key === "style") {
      /* Static styles become an object at build time. A style containing a
         hole is assembled as a string and converted by the runtime, which is
         exactly what support.js does — splitting it here would change what a
         hole yielding "a;b" means. */
      if (v.dynamic) pairs.push(`style: $st(${v.code})`);
      else {
        const obj = cssToObj(v.value);
        const decls = Object.entries(obj).map(([k, val]) => `${jsKey(k)}: ${JSON.stringify(val)}`);
        if (decls.length) pairs.push(`style: { ${decls.join(", ")} }`);
      }
      continue;
    }
    if (v.dynamic && (key === "value" || key === "checked")) {
      /* support.js substitutes "" / false for an *undefined* getter so React
         does not flip a controlled input to uncontrolled mid-session. */
      pairs.push(`${jsKey(key)}: ${key === "value" ? "$vu" : "$cu"}(${v.code})`);
      continue;
    }
    pairs.push(`${jsKey(key)}: ${v.dynamic ? v.code : JSON.stringify(v.value)}`);
  }

  if (pseudo.length) {
    const p = pseudo.join(" ");
    if (classCode) pairs.unshift(`className: $cn(${classCode}, ${JSON.stringify(p)})`);
    else pairs.unshift(`className: ${JSON.stringify(classStatic ? classStatic + " " + p : p)}`);
  } else if (classCode) pairs.unshift(`className: ${classCode}`);
  else if (classStatic != null) pairs.unshift(`className: ${JSON.stringify(classStatic)}`);

  const kids = walkNodes(node.children, ctx, scope, depth + 1);
  const pad = "  ".repeat(depth + 1);
  const tail = kids.length ? `,\n${pad}${kids.join(`,\n${pad}`)}` : "";
  return `$h(${JSON.stringify(tag)}, ${objLit(pairs)}${tail})`;
}

/* --------------------------------------------------------- helmet passthrough */

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img",
  "input", "link", "meta", "param", "source", "track", "wbr"]);

/* The helmet is not rendered by the application in production — it is lifted
   into the shell's <head> at build time, so it is serialised back to HTML
   rather than compiled. Attribute case was mangled by parsing, so the
   CAMEL_ATTR encoding is undone on the way out. */
function serialise(nodes) {
  let out = "";
  for (const n of nodes) {
    if (n.type === "text") { out += n.text ?? ""; continue; }
    if (n.type !== "element") continue;
    const tag = RAW_UNWRAP[n.tag] || n.tag;
    const attrs = n.attrs
      .filter((a) => a.name !== "data-dc-line")
      .map((a) => {
        const name = a.name.startsWith(CAMEL_ATTR)
          ? kebabToCamel(a.name.slice(CAMEL_ATTR.length)) : a.name;
        return a.value === "" ? ` ${name}` : ` ${name}="${a.value.replace(/"/g, "&quot;")}"`;
      }).join("");
    out += `<${tag}${attrs}>`;
    if (VOID_TAGS.has(tag)) continue;
    out += serialise(n.children) + `</${tag}>`;
  }
  return out;
}
