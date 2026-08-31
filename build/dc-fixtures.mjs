/* build/dc-fixtures.mjs — the compiler's specification, as data.
 *
 * Each fixture is a whole (tiny) Design Component plus the values it renders
 * against and the DOM it must produce. The list is parser-agnostic and
 * runtime-agnostic so the same cases run under `node --test` with parse5 and
 * in the editing sandbox with DOMParser — if the two parsers ever disagree,
 * these fail rather than the difference reaching a page.
 *
 * Expected output is written as serialised DOM, not as generated JavaScript:
 * asserting on codegen would lock in the current emitter's formatting and
 * still not prove the template means what the author intended.
 */

const logicFor = (names) =>
  `class Component extends DCLogic {\n  renderVals() {\n    return { ${names.join(", ")} };\n  }\n}`;

export const fixtures = [
  {
    name: "StaticHtml",
    why: "no holes at all — the baseline",
    template: `<section class="wrap"><h2>TSUMUGI</h2><p>Vintage &amp; archive.</p></section>`,
    vals: {},
    expect: `<section className="wrap"><h2>TSUMUGI</h2><p>Vintage & archive.</p></section>`,
  },
  {
    name: "TextInterpolation",
    why: "one hole, and two holes in a single text node with literal text between",
    template: `<p>{{ greeting }}</p><p>{{ count }} 点 / {{ total }} 点</p>`,
    logic: logicFor(["greeting", "count", "total"]),
    vals: { greeting: "こんにちは", count: 3, total: 12 },
    expect: `<p>こんにちは</p><p>3 点 / 12 点</p>`,
  },
  {
    name: "TextHoleNullish",
    why: "an unresolved-at-runtime value renders as nothing, never as \"undefined\"",
    template: `<p>[{{ missing }}]</p>`,
    logic: logicFor(["missing"]),
    vals: { missing: undefined },
    expect: `<p>[]</p>`,
  },
  {
    name: "DynamicAttribute",
    why: "whole-value hole keeps the raw type; interpolated hole makes a string",
    template: `<img src="{{ src }}" alt="{{ alt }}" width="{{ w }}"><a href="/p/{{ slug }}">見る</a>`,
    logic: logicFor(["src", "alt", "w", "slug"]),
    vals: { src: "a.jpg", alt: "コート", w: 320, slug: "coat-01" },
    expect: `<img src="a.jpg" alt="コート" width={320}/><a href="/p/coat-01">見る</a>`,
  },
  {
    name: "BooleanAttribute",
    why: "disabled/checked/required as dynamic booleans and as bare literals",
    template: `<input type="checkbox" checked="{{ on }}" disabled="{{ off }}" required>`,
    logic: logicFor(["on", "off"]),
    vals: { on: true, off: false },
    expect: `<input type="checkbox" checked={true} disabled={false} required=""/>`,
  },
  {
    name: "ControlledInputGuard",
    why: "an undefined value/checked must not flip React to uncontrolled",
    template: `<input value="{{ q }}"><input type="checkbox" checked="{{ c }}">`,
    logic: logicFor(["q", "c"]),
    vals: { q: undefined, c: undefined },
    expect: `<input value=""/><input type="checkbox" checked={false}/>`,
  },
  {
    name: "EventHandler",
    why: "camelCase and lowercase spellings both reach the React prop name",
    template: `<button onClick="{{ save }}" type="button">保存</button><form onSubmit="{{ send }}"></form>`,
    logic: logicFor(["save", "send"]),
    vals: { save: () => "SAVE", send: () => "SEND" },
    expect: `<button onClick={fn:SAVE} type="button">保存</button><form onSubmit={fn:SEND}></form>`,
  },
  {
    name: "ScIfTrue",
    why: "sc-if with a truthy value renders its children",
    template: `<sc-if value="{{ show }}" hint-placeholder-val="{{ true }}"><p>あり</p></sc-if>`,
    logic: logicFor(["show"]),
    vals: { show: true },
    expect: `<p>あり</p>`,
  },
  {
    name: "ScIfFalse",
    why: "…and renders nothing when falsy, including the hint attribute",
    template: `<div><sc-if value="{{ show }}" hint-placeholder-val="{{ true }}"><p>あり</p></sc-if></div>`,
    logic: logicFor(["show"]),
    vals: { show: false },
    expect: `<div></div>`,
  },
  {
    name: "ScForList",
    why: "list + alias + $index",
    template: `<ul><sc-for list="{{ items }}" as="it" hint-placeholder-count="3"><li>{{ $index }}: {{ it.label }}</li></sc-for></ul>`,
    logic: logicFor(["items"]),
    vals: { items: [{ label: "コート" }, { label: "シャツ" }] },
    expect: `<ul><li>0: コート</li><li>1: シャツ</li></ul>`,
  },
  {
    name: "ScForEmpty",
    why: "an empty list and a not-yet-loaded list both render nothing",
    template: `<ul><sc-for list="{{ items }}" as="it" hint-placeholder-count="3"><li>{{ it }}</li></sc-for></ul>`,
    logic: logicFor(["items"]),
    vals: { items: [] },
    expect: `<ul></ul>`,
  },
  {
    name: "ScForMissingList",
    why: "undefined list — must not throw during the first render",
    template: `<ul><sc-for list="{{ items }}" as="it" hint-placeholder-count="2"><li>{{ it }}</li></sc-for></ul>`,
    logic: logicFor(["items"]),
    vals: {},
    expect: `<ul></ul>`,
  },
  {
    name: "NestedIfFor",
    why: "sc-if inside sc-for inside sc-if, with the alias visible at depth",
    template:
      `<sc-if value="{{ ready }}" hint-placeholder-val="{{ true }}">` +
      `<sc-for list="{{ rows }}" as="row" hint-placeholder-count="2">` +
      `<div><sc-if value="{{ row.sold }}" hint-placeholder-val="{{ true }}"><span>SOLD</span></sc-if>{{ row.name }}</div>` +
      `</sc-for></sc-if>`,
    logic: logicFor(["ready", "rows"]),
    vals: { ready: true, rows: [{ name: "A", sold: true }, { name: "B", sold: false }] },
    expect: `<div><span>SOLD</span>A</div><div>B</div>`,
  },
  {
    name: "DcImportProps",
    why: "kebab attrs become camel props; a whole-value hole keeps its object",
    template: `<dc-import name="Card" vm="{{ vm }}" entity-id="{{ id }}" compact="1" hint-size="100%,200px"></dc-import>`,
    logic: logicFor(["vm", "id"]),
    known: ["Card"],
    vals: { vm: { title: "コート" }, id: 7 },
    expect: `<Card vm={{title:コート}} entityId={7} compact="1"/>`,
  },
  {
    name: "Ref",
    why: "ref is a whole-value hole and must pass the object through untouched",
    template: `<div ref="{{ bodyRef }}" contenteditable="true"></div>`,
    logic: logicFor(["bodyRef"]),
    vals: { bodyRef: { current: null } },
    expect: `<div ref={{current:null}} contentEditable="true"></div>`,
  },
  {
    name: "StyleInterpolation",
    why: "static CSS becomes an object at build time; an interpolated one at run time",
    template: `<div style="color:#222;padding:0 12px"></div><div style="width:{{ pct }}%;opacity:{{ o }}"></div>`,
    logic: logicFor(["pct", "o"]),
    vals: { pct: 40, o: 0.5 },
    expect: `<div style="color:#222;padding:0 12px"></div><div style="width:40%;opacity:0.5"></div>`,
  },
  {
    name: "StyleUrlSemicolon",
    why: "a ; inside url() is not a declaration break",
    template: `<div style="background:url(data:image/svg+xml;utf8,x);color:red"></div>`,
    vals: {},
    expect: `<div style="background:url(data:image/svg+xml;utf8,x);color:red"></div>`,
  },
  {
    name: "StylePseudo",
    why: "style-hover/focus/active lift to a class; identical CSS shares one class",
    template:
      `<button style="color:#222" style-hover="color:#000" style-focus="outline:2px solid #000">A</button>` +
      `<button style-hover="color:#000" style-active="transform:scale(0.98)">B</button>`,
    vals: {},
    expect:
      `<button className="scp0 scp1" style="color:#222">A</button>` +
      `<button className="scp0 scp2">B</button>`,
    expectSheet: [
      `.scp0:hover{color:#000 !important}`,
      `.scp1:focus{outline:2px solid #000 !important}`,
      `.scp2:active{transform:scale(0.98) !important}`,
    ],
  },
  {
    name: "PseudoWithDynamicClass",
    why: "a dynamic class and a pseudo class have to coexist",
    template: `<button class="{{ cls }}" style-hover="color:#000">A</button>`,
    logic: logicFor(["cls"]),
    vals: { cls: "on" },
    expect: `<button className="on scp0">A</button>`,
  },
  {
    name: "AriaDataAttributes",
    why: "aria-*/data-* keep their exact hyphenated spelling",
    template: `<div role="dialog" aria-modal="true" aria-labelledby="t" aria-hidden="{{ hidden }}" data-adm-scroll="1" data-trigger="{{ trig }}"></div>`,
    logic: logicFor(["hidden", "trig"]),
    vals: { hidden: false, trig: "panel" },
    expect: `<div role="dialog" aria-modal="true" aria-labelledby="t" aria-hidden={false} data-adm-scroll="1" data-trigger="panel"></div>`,
  },
  {
    name: "ReactNodeChild",
    why: "a hole holding an element (from renderVals) renders in place",
    template: `<div>{{ icon }}<span>ラベル</span></div>`,
    logic: logicFor(["icon"]),
    vals: { icon: { __el: "svg", props: {}, kids: [] } },
    expect: `<div><svg></svg><span>ラベル</span></div>`,
  },
  {
    name: "TableAndSelect",
    why: "table/select children survive parsing without being foster-parented",
    template: `<table><tbody><sc-for list="{{ rows }}" as="r" hint-placeholder-count="2"><tr><td>{{ r }}</td></tr></sc-for></tbody></table>` +
      `<select value="{{ v }}" onChange="{{ ch }}"><option value="a">A</option></select>`,
    logic: logicFor(["rows", "v", "ch"]),
    vals: { rows: ["x"], v: "a", ch: () => "CH" },
    expect: `<table><tbody><tr><td>x</td></tr></tbody></table><select value="a" onChange={fn:CH}><option value="a">A</option></select>`,
  },
  {
    name: "WhitespaceBetweenInline",
    why: "the newline+indent between two inline elements is a real space and must stay",
    template: `<p><span>A</span>\n  <span>B</span></p><p><span>C</span><span>D</span></p>`,
    vals: {},
    expect: `<p><span>A</span>\n  <span>B</span></p><p><span>C</span><span>D</span></p>`,
  },
  {
    name: "JapaneseText",
    why: "multibyte text, entities and <br> in one template",
    template: `<p>古着とアーカイブの店<br>一点物・再入荷なし &amp; 送料無料</p>`,
    vals: {},
    expect: `<p>古着とアーカイブの店<br/>一点物・再入荷なし & 送料無料</p>`,
  },

  /* ---- builds that must fail, with the file, line and construct named ---- */
  {
    name: "MalformedNoClose",
    why: "an unclosed <x-dc> is a truncated file, not an empty component",
    raw: `<x-dc><p>hi</p>`,
    expectError: /x-dc.*never closed/i,
  },
  {
    name: "MalformedProps",
    why: "unparseable data-props must stop the build, not drop the props",
    template: `<p>hi</p>`,
    rawProps: `{ "vm": }`,
    expectError: /data-props.*not valid JSON/i,
  },
  {
    name: "UnresolvedExpression",
    why: "a hole no prop and no logic mention can ever fill",
    template: `<p>{{ tpyo }}</p>`,
    logic: logicFor(["typo"]),
    expectError: /unresolved-expression.*tpyo/i,
  },
  {
    name: "ExpressionTooRich",
    why: "JS in a hole is not silently compiled — renderVals is the place for it",
    template: `<p>{{ a + b }}</p>`,
    logic: logicFor(["a", "b"]),
    expectError: /only identifiers, dotted paths and literals/i,
  },
  {
    name: "MissingImportedComponent",
    why: "a dc-import naming a component that does not exist",
    template: `<dc-import name="Ghost" hint-size="100%,10px"></dc-import>`,
    known: ["Card"],
    expectError: /missing-component.*Ghost/i,
  },
  {
    name: "DynamicImportName",
    why: "production resolves imports statically, so a hole there cannot work",
    template: `<dc-import name="{{ which }}" hint-size="100%,10px"></dc-import>`,
    logic: logicFor(["which"]),
    expectError: /cannot be a/i,
  },
  {
    name: "UnsupportedElement",
    why: "an unimplemented construct fails loudly instead of rendering as text",
    template: `<sc-if value="{{ a }}"><p>y</p></sc-if><sc-else><p>n</p></sc-else>`,
    logic: logicFor(["a"]),
    expectError: /sc-else/i,
  },
  {
    name: "UnsupportedXImport",
    why: "x-import needs a module loader production does not ship",
    template: `<x-import component="Chart" from="./Chart.jsx" hint-size="100%,10px"></x-import>`,
    expectError: /x-import/i,
  },
  {
    name: "UnsupportedCustomElement",
    why: "a custom element has no definition in the production bundle",
    template: `<deck-stage width="1920"></deck-stage>`,
    expectError: /deck-stage/i,
  },
  {
    name: "UnsupportedDangerousHtml",
    why: "raw HTML injection is refused; the sanitiser is the sanctioned path",
    template: `<div dangerouslySetInnerHTML="{{ html }}"></div>`,
    logic: logicFor(["html"]),
    expectError: /dangerously/i,
  },
  {
    name: "ScForBadAlias",
    why: "as=\"class\" would emit a syntax error into the module",
    template: `<sc-for list="{{ items }}" as="class" hint-placeholder-count="1"><p>x</p></sc-for>`,
    logic: logicFor(["items"]),
    expectError: /not a usable variable name/i,
  },
  {
    name: "ScIfNoValue",
    why: "a sc-if with no value silently rendered nothing in the old runtime",
    template: `<sc-if><p>x</p></sc-if>`,
    expectError: /sc-if.*value/i,
  },
  {
    name: "PseudoWithHole",
    why: "pseudo-state CSS is a static stylesheet and cannot interpolate",
    template: `<button style-hover="color:{{ c }}">A</button>`,
    logic: logicFor(["c"]),
    expectError: /style-pseudo/i,
  },
];

/* Duplicate-basename detection is a project-level rule (two files, one output
   path), so it is asserted against findDuplicateBases rather than a template. */
export const duplicateBaseCases = [
  { names: ["TSUMUGI", "TSUMUGI Admin", "PublicHome"], clashes: 0 },
  { names: ["TSUMUGI Admin", "TSUMUGI-Admin"], clashes: 1 },
  { names: ["Card", "Ca rd", "C a r d"], clashes: 2 },
];

export function fixtureSource(f) {
  if (f.raw) return f.raw;
  const props = f.rawProps !== undefined
    ? ` data-props="${f.rawProps.replace(/"/g, "&quot;")}"` : "";
  return `<!DOCTYPE html><html><body>\n<x-dc>\n${f.template}\n</x-dc>\n`
    + `<script type="text/x-dc" data-dc-script${props}>\n${f.logic || ""}\n</script>\n`
    + `</body></html>\n`;
}
