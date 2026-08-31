/* TSUMUGI — HTML sanitizer (single source of truth).

   The news editor is a contenteditable surface: whatever a browser or a paste
   puts into it becomes stored markup, and that markup is written into the public
   article page. Any path from "stored" to "rendered" therefore runs through
   here, twice — once before the value is written (so the database never holds an
   executable payload) and once before it is rendered (so a row written by an
   older build, or restored from a backup, still cannot execute).

   Allowlist, not blocklist: an element or attribute that is not named below is
   removed regardless of how it is spelled, encoded or nested. No dependency, no
   network, no eval — a classic script exposing window.TSUMUGI_SANITIZE.

   Deliberately absent: script, style, iframe, object, embed, form, input,
   button, link, meta, base, svg, math, template, noscript, on* attributes,
   style attributes, srcdoc/srcset, and every URL scheme except http, https,
   mailto, tel and (for images only) data:image of a known raster type. */
(function () {
  "use strict";
  if (window.TSUMUGI_SANITIZE) return;

  /* Structural + inline text elements an editorial body legitimately needs. */
  var ALLOWED = {
    p: [], br: [], hr: [],
    h2: [], h3: [], h4: [],
    strong: [], b: [], em: [], i: [], u: [], s: [], sub: [], sup: [],
    blockquote: ["cite"],
    ul: [], ol: ["start"], li: [],
    dl: [], dt: [], dd: [],
    figure: [], figcaption: [],
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "width", "height", "loading", "decoding"],
    table: [], thead: [], tbody: [], tr: [], th: ["scope"], td: [],
    code: [], pre: [], small: [], span: [], div: []
  };

  /* Wrappers that carry no meaning of their own: unwrapped rather than dropped,
     so the text they contain survives. */
  var UNWRAP = { span: true, div: true, font: true, section: true, article: true, header: true, footer: true, main: true, aside: true, center: true, tt: true, big: true };

  /* Removed with everything inside them. Text inside a <script> is code, not
     copy, so it must not be preserved the way an unknown wrapper's is. */
  var DROP_SUBTREE = {
    script: true, style: true, iframe: true, object: true, embed: true, applet: true,
    form: true, input: true, textarea: true, select: true, option: true, button: true,
    link: true, meta: true, base: true, title: true, noscript: true, template: true,
    svg: true, math: true, audio: true, video: true, source: true, track: true,
    frame: true, frameset: true, marquee: true, dialog: true, portal: true, slot: true
  };

  var SAFE_SCHEME = /^(?:https?:|mailto:|tel:)/i;
  var SAFE_IMG_DATA = /^data:image\/(?:png|jpeg|jpg|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i;
  var MAX_LENGTH = 200000;   /* a body longer than this is truncated, not stored */

  /* Control characters, zero-width joiners and BOMs are how "java\0script:" and
     "j&#x0a;avascript:" survive a naive scheme test. Strip them before testing,
     and test the decoded value the browser itself would act on. */
  function normaliseUrl(raw) {
    return String(raw == null ? "" : raw)
      .replace(/[\u0000-\u0020\u007f-\u009f\u00a0\u1680\u180e\u2000-\u200f\u2028-\u202f\u205f-\u2064\u206a-\u206f\u3000\ufeff]/g, "")
      .trim();
  }

  function safeHref(raw) {
    var v = normaliseUrl(raw);
    if (!v) return null;
    /* Fragment and site-relative links stay inside the document. A protocol
       relative URL (//evil) is not: it inherits the page scheme and leaves. */
    if (v.charAt(0) === "#") return v;
    if (v.charAt(0) === "/" && v.charAt(1) !== "/") return v;
    if (/^\.{1,2}\//.test(v)) return v;
    if (SAFE_SCHEME.test(v)) return v;
    return null;
  }

  function safeImgSrc(raw) {
    var v = normaliseUrl(raw);
    if (!v) return null;
    if (v.charAt(0) === "/" && v.charAt(1) !== "/") return v;
    if (/^\.{1,2}\//.test(v)) return v;
    if (/^https?:/i.test(v)) return v;
    if (SAFE_IMG_DATA.test(v)) return v.replace(/\s+/g, "");
    return null;
  }

  function isExternal(href) {
    if (!/^https?:/i.test(href)) return false;
    try { return new URL(href, location.href).origin !== location.origin; }
    catch (e) { return true; }
  }

  /* The parse happens in an inert document: <template> content and
     DOMParser documents do not run scripts, load images or fire handlers, so
     nothing in the payload executes while it is being inspected. */
  function parse(html) {
    var doc;
    try {
      doc = new DOMParser().parseFromString("<body>" + html + "</body>", "text/html");
      if (doc && doc.body) return doc.body;
    } catch (e) { }
    var tpl = document.createElement("template");
    tpl.innerHTML = html;                                  /* inert fragment */
    var host = document.createElement("div");
    host.appendChild(tpl.content.cloneNode(true));
    return host;
  }

  /* Removes a node only if it is still attached. The re-walk after an unwrap
     revisits nodes that an earlier step may already have detached, and calling
     removeChild on a null parent threw — which, in a sanitizer, means the whole
     sanitize call fails and the caller gets nothing back. Found by
     shots/security-qa.html once the harness stopped swallowing suite errors. */
  function drop(el) {
    var p = el && el.parentNode;
    if (p) { try { p.removeChild(el); } catch (e) { } }
    return false;
  }

  /* Moves an element's children up to its parent, then removes it. */
  function unwrap(el) {
    var p = el && el.parentNode;
    if (!p) return false;
    while (el.firstChild) p.insertBefore(el.firstChild, el);
    try { p.removeChild(el); } catch (e) { }
    return false;
  }

  function cleanElement(el) {
    var tag = el.tagName.toLowerCase();
    var i, attrs, name;

    if (!el.parentNode) return false;              /* already detached */
    if (DROP_SUBTREE[tag]) return drop(el);

    var allowedAttrs = ALLOWED[tag];
    if (!allowedAttrs) {
      /* Unknown element: keep the words, lose the element — whether it is a
         known-harmless wrapper or something nobody planned for. */
      return unwrap(el);
    }

    /* Attributes are removed by iterating a snapshot: the live NamedNodeMap
       shifts under a forward loop and quietly leaves survivors behind. */
    attrs = Array.prototype.slice.call(el.attributes);
    for (i = 0; i < attrs.length; i++) {
      name = attrs[i].name.toLowerCase();
      if (allowedAttrs.indexOf(name) < 0) { el.removeAttribute(attrs[i].name); continue; }
      if (name === "href") {
        var href = safeHref(attrs[i].value);
        if (href === null) { el.removeAttribute(attrs[i].name); continue; }
        el.setAttribute("href", href);
      } else if (name === "src") {
        var src = safeImgSrc(attrs[i].value);
        if (src === null) return drop(el);
        el.setAttribute("src", src);
      } else if (name === "rel") {
        /* Only the value this sanitizer sets is acceptable. An author-supplied
           rel is discarded rather than merged: rel="opener" would undo the
           protection added below. */
        el.removeAttribute(attrs[i].name);
      } else if (name === "target") {
        var tv = String(attrs[i].value).toLowerCase();
        if (tv !== "_blank" && tv !== "_self") el.removeAttribute(attrs[i].name);
      } else if (name === "width" || name === "height" || name === "start") {
        if (!/^[0-9]{1,5}$/.test(String(attrs[i].value).trim())) el.removeAttribute(attrs[i].name);
      } else if (name === "loading" || name === "decoding") {
        var v = String(attrs[i].value).toLowerCase();
        if (["lazy", "eager", "async", "sync", "auto"].indexOf(v) < 0) el.removeAttribute(attrs[i].name);
      }
    }
    /* An <a> that lost its href is no longer a link; an <img> keeps an alt.
       rel/target are (re)applied last, after the attribute pass has run, so the
       second sanitizing pass sees values this module produced rather than values
       it must trust. */
    if (tag === "a") {
      var finalHref = el.getAttribute("href");
      if (!finalHref) { el.removeAttribute("rel"); el.removeAttribute("target"); }
      else if (isExternal(finalHref)) {
        el.setAttribute("rel", "noopener noreferrer");
        el.setAttribute("target", "_blank");
      } else {
        el.removeAttribute("rel");
      }
    }
    if (tag === "img" && el.getAttribute("alt") == null) el.setAttribute("alt", "");
    return true;
  }

  function walk(root) {
    /* Depth-first over a static child snapshot, because cleanElement mutates
       the tree it is walking (unwrap moves children up a level). A node whose
       parent has since been detached is skipped rather than touched. */
    var kids = Array.prototype.slice.call(root.childNodes);
    for (var i = 0; i < kids.length; i++) {
      var node = kids[i];
      if (!node.parentNode) continue;
      if (node.nodeType === 1) {
        var parent = node.parentNode;
        var kept = cleanElement(node);
        if (kept) walk(node);
        else if (parent && parent.parentNode !== null || parent === root) walk(parent);
      } else if (node.nodeType === 8) {
        drop(node);                          /* comments can hide markup */
      } else if (node.nodeType !== 3) {
        drop(node);                          /* CDATA, PI, doctype */
      }
    }
  }

  var API = {
    /* Sanitize rich-text HTML. Returns a string safe to store and to render. */
    html: function (dirty) {
      if (dirty == null) return "";
      var input = String(dirty);
      if (!input) return "";
      if (input.length > MAX_LENGTH) input = input.slice(0, MAX_LENGTH);
      var root;
      try { root = parse(input); } catch (e) { return API.text(input); }
      /* Two passes: the second proves the first reached a fixed point, which is
         what catches markup that only becomes markup after one unwrap. */
      walk(root);
      var once = root.innerHTML;
      var again = parse(once);
      walk(again);
      return again.innerHTML;
    },

    /* Plain-text escape, for values that are never markup (titles, summaries,
       form fields echoed back to the page). */
    text: function (s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },

    /* Strip markup entirely — used for meta descriptions and search indexes. */
    plain: function (dirty) {
      var root;
      try { root = parse(API.html(dirty)); } catch (e) { return ""; }
      return String(root.textContent || "").replace(/\s+/g, " ").trim();
    },

    href: safeHref,
    imgSrc: safeImgSrc,
    ALLOWED: ALLOWED,
    MAX_LENGTH: MAX_LENGTH
  };

  window.TSUMUGI_SANITIZE = API;

  /* Fail-closed entry point used by the shells. If this module ever fails to
     load, callers get an empty string rather than raw markup: an article body
     that renders blank is a visible bug; one that renders a payload is not. */
  window.TSUMUGI_SAN = function (dirty) {
    var S = window.TSUMUGI_SANITIZE;
    if (!S) { try { console.error("TSUMUGI: sanitizer missing — rich text suppressed."); } catch (e) { } return ""; }
    try { return S.html(dirty); } catch (e) { return ""; }
  };
})();
