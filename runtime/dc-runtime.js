/* runtime/dc-runtime.js — the production half of the Design Component model.
 *
 * The authoring environment fetches sibling templates and compiles them in the
 * browser. None of that ships here. By the time this file runs, every template is already
 * a `render(v)` function in a generated module and every logic class is
 * ordinary module code, so this file only has to do what React itself cannot:
 * hold the logic instance, merge props with renderVals(), and forward
 * lifecycle.
 *
 * Semantics are deliberately identical to the authoring environment, including the parts that
 * are only visible in the DOM — the `div.sc-host` wrapper each component
 * renders inside, and the `display: contents` wrapper around a child mount —
 * because the reviewed layout depends on them. What is intentionally absent is
 * editor plumbing: placeholders, streaming classes, hot-swap, error overlays,
 * `data-dc-tpl`.
 */

import React from "react";

export { React };
export const h = React.createElement;
export const F = React.Fragment;

/* ---------------------------------------------------------------- template
   helpers. Names are short because they appear thousands of times across the
   generated modules and every byte is shipped. */

/* A text hole. The authoring environment renders `null`/`undefined` as nothing rather than as
   the strings "null"/"undefined"; React already does that for both, plus for
   booleans, so the value passes straight through. Objects that are not React
   elements would throw in React, which is the correct loud failure. */
export const tx = (v) => (v === undefined || v === null || v === false ? "" : v);

/* `style="…{{ hole }}…"` arrives as a CSS string and has to become a React
   style object. An object (a whole-value hole off renderVals) passes through. */
export function st(v) {
  if (v == null) return undefined;
  if (typeof v === "object") return v;
  const o = {};
  for (const decl of String(v).split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    if (!prop) continue;
    o[prop.startsWith("--") ? prop : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] =
      decl.slice(i + 1).trim();
  }
  return o;
}

export const cn = (...parts) => parts.filter(Boolean).join(" ");

/* Controlled-input guards: an undefined `value` or
   `checked` getter would make React downgrade the input to uncontrolled and
   warn, so undefined becomes "" / false. `null` is left alone — a template
   that means "uncontrolled" can still say so. */
export const vu = (v) => (v === undefined ? "" : v);
export const cu = (v) => (v === undefined ? false : v);

/* `<sc-for>`: anything non-iterable renders nothing rather than throwing,
   which is what the authoring runtime does while a list is still loading. */
export function each(list, fn) {
  if (Array.isArray(list)) return list.map(fn);
  if (list == null) return null;
  if (typeof list === "number") return Array.from({ length: list }, (_, i) => fn(i, i));
  if (typeof list[Symbol.iterator] === "function") return Array.from(list, fn);
  if (typeof list === "object") return Object.keys(list).map((k, i) => fn(list[k], i));
  return null;
}

/* -------------------------------------------------------------- DCLogic */

export class DCLogic {
  constructor(props) {
    this.props = props || {};
    this.state = {};
    this.__host = null;
  }
  setState(update, cb) {
    if (this.__host) this.__host.__setLogicState(update, cb);
    else {
      /* Before mount there is no host to schedule against. Merging in place
         keeps a constructor-time or field-initialiser setState from being
         silently dropped. */
      const patch = typeof update === "function" ? update(this.state, this.props) : update;
      if (patch) this.state = { ...this.state, ...patch };
    }
  }
  forceUpdate() { if (this.__host) this.__host.forceUpdate(); }
  componentDidMount() {}
  componentDidUpdate(_prevProps) {}
  componentWillUnmount() {}
  renderVals() { return {}; }
}

export { DCLogic as StreamableLogic };

/* ------------------------------------------------------------- createDC */

export function createDC(name, Logic, render, propsMeta) {
  const Base = Logic || DCLogic;

  class DCComponent extends React.Component {
    constructor(props) {
      super(props);
      this.logic = new Base(props);
      this.logic.__host = this;
      /* The logic class owns its state object; React state is only the
         trigger. Keeping one copy avoids the two drifting apart. */
      this.state = { __tick: 0 };
    }
    __setLogicState(update, cb) {
      const patch = typeof update === "function"
        ? update(this.logic.state, this.logic.props) : update;
      if (patch) this.logic.state = { ...this.logic.state, ...patch };
      this.setState((s) => ({ __tick: s.__tick + 1 }), cb);
    }
    componentDidMount() { this.logic.componentDidMount(); }
    componentDidUpdate(prevProps) { this.logic.componentDidUpdate(prevProps); }
    componentWillUnmount() { this.logic.componentWillUnmount(); }
    render() {
      this.logic.props = this.props;
      const vals = { ...this.props, ...(this.logic.renderVals() || {}) };
      return h("div", { className: "sc-host", "data-sc-name": name }, render(vals));
    }
  }
  DCComponent.displayName = name;
  DCComponent.propsMeta = propsMeta || null;
  return DCComponent;
}

/* A child mount (`<dc-import>`): the authoring environment wraps it so the child's own
   `div.sc-host` never becomes a flex/grid item of the parent by accident. */
export const mount = (C, props, ...kids) =>
  h("div", { className: "sc-host-x", style: { display: "contents" } }, h(C, props, ...kids));

/* ---------------------------------------------------------------- mounting */

const FULL_PAGE_CSS =
  "html,body{height:100%;margin:0}#dc-root,#dc-root>.sc-host{height:100%}";

/* Mirrors authoring boot behaviour: `#dc-root` as the host id, prop defaults taken
   from data-props, and the full-page height rule for a component with no
   $preview (i.e. one authored as a page rather than as a card). */
export function bootDC(Component, { container, fullPage = true, props } = {}) {
  const host = container || document.getElementById("dc-root") || (() => {
    const el = document.createElement("div");
    el.id = "dc-root";
    document.body.appendChild(el);
    return el;
  })();
  if (fullPage) {
    const s = document.createElement("style");
    s.textContent = FULL_PAGE_CSS;
    document.head.appendChild(s);
  }
  const defaults = {};
  for (const [k, meta] of Object.entries(Component.propsMeta || {})) {
    if (meta && meta.default !== undefined) defaults[k] = meta.default;
  }
  return { host, element: h(Component, { ...defaults, ...(props || {}) }) };
}
