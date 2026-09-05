// Turns a DOM node into an indented HTML string. Shared by any format whose
// transform() returns a node rather than a string (see lib/formats/). Not a
// format itself — lives here, not in lib/formats/, so that directory stays a
// reliable listing of "every format that exists".
//
// Indentation is 2 spaces per depth. A small set of inline tags flow with
// surrounding text instead of each getting their own line; everything else
// (including unrecognized/custom elements) is treated as block-level.
// `pre`/`script`/`style`/`textarea` are copied through via outerHTML,
// untouched, since whitespace inside them is content, not presentation.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.__inspectCopySerialize = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const VOID_TAGS = new Set([
    "AREA", "BASE", "BR", "COL", "EMBED", "HR", "IMG", "INPUT",
    "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR",
  ]);
  const VERBATIM_TAGS = new Set(["PRE", "SCRIPT", "STYLE", "TEXTAREA"]);
  const INLINE_TAGS = new Set([
    "A", "B", "I", "EM", "STRONG", "SPAN", "CODE", "SMALL", "SUB", "SUP", "BR",
  ]);

  function escapeText(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escapeAttr(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }

  function openTag(el) {
    let out = "<" + el.tagName.toLowerCase();
    for (const attr of el.attributes) {
      out += " " + attr.name + '="' + escapeAttr(attr.value) + '"';
    }
    return out + ">";
  }

  function closeTag(el) {
    return "</" + el.tagName.toLowerCase() + ">";
  }

  function collapseWhitespace(s) {
    return s.replace(/\s+/g, " ");
  }

  // Serialize an inline element's own children as one continuous string, for
  // embedding inside a line of flowed text. Only reachable from inline
  // context, so any element encountered here is treated as inline too.
  function inlineHtml(node) {
    let out = "";
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        out += escapeText(collapseWhitespace(child.textContent));
      } else if (child.nodeType === 1) {
        out += openTag(child);
        if (!VOID_TAGS.has(child.tagName)) out += inlineHtml(child) + closeTag(child);
      }
    }
    return out;
  }

  function indent(depth) {
    return "  ".repeat(depth);
  }

  // Render `el` in block context: its own opening/closing tag each on their
  // own line at `depth`, with children rendered at `depth + 1`. Returns an
  // array of already-indented lines.
  function renderBlock(el, depth) {
    if (VOID_TAGS.has(el.tagName)) return [indent(depth) + openTag(el)];
    if (VERBATIM_TAGS.has(el.tagName)) return [indent(depth) + el.outerHTML];

    const lines = [];
    let buffer = "";
    const flushBuffer = () => {
      const trimmed = buffer.trim();
      if (trimmed) lines.push(indent(depth + 1) + trimmed);
      buffer = "";
    };

    for (const child of el.childNodes) {
      if (child.nodeType === 3) {
        buffer += escapeText(collapseWhitespace(child.textContent));
      } else if (child.nodeType === 1 && INLINE_TAGS.has(child.tagName)) {
        buffer += openTag(child);
        if (!VOID_TAGS.has(child.tagName)) buffer += inlineHtml(child) + closeTag(child);
      } else if (child.nodeType === 1) {
        flushBuffer();
        lines.push(...renderBlock(child, depth + 1));
      }
    }
    flushBuffer();

    if (lines.length === 0) return [indent(depth) + openTag(el) + closeTag(el)];
    return [indent(depth) + openTag(el), ...lines, indent(depth) + closeTag(el)];
  }

  // Always renders the root in block context, regardless of its own tag —
  // it's the thing being extracted, not flowed text inside something else.
  function serialize(el) {
    return renderBlock(el, 0).join("\n");
  }

  return { serialize };
});
