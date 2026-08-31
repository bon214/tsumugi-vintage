/* build/parse-node.mjs — the Node HTML parser adapter for the compiler.
 *
 * dc-compiler-core.mjs takes a `parseFragment(html) -> Node[]` function so it
 * can run anywhere. This is the Node implementation, on parse5, which follows
 * the same HTML5 tree-construction spec a browser does — the fixture suite
 * runs the browser adapter against the identical cases so a divergence between
 * the two shows up as a test failure rather than as a broken page.
 */

import { parseFragment as parse5Fragment } from "parse5";

const convert = (n) => {
  if (n.nodeName === "#text") return { type: "text", text: n.value };
  if (!n.tagName) return null;                       // comments, doctype
  return {
    type: "element",
    tag: n.tagName.toLowerCase(),
    attrs: (n.attrs || []).map((a) => ({ name: a.name, value: a.value })),
    children: (n.childNodes || []).map(convert).filter(Boolean),
  };
};

export function parseFragment(html) {
  const frag = parse5Fragment(html);
  return (frag.childNodes || []).map(convert).filter(Boolean);
}
