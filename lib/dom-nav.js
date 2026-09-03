// Pure DOM-navigation helpers, side-effect free and framework free.
// Loaded as a plain script before content.js (exposes window.__inspectCopyNav),
// and require()-able in Node for tests (module.exports).

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.__inspectCopyNav = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Elements that are never worth selecting: document metadata and other
  // non-visual nodes. Arrow navigation skips straight over these, so pressing
  // Right on <html> lands on <body>, not <head>.
  const SKIP_TAGS = new Set([
    "HEAD", "META", "TITLE", "SCRIPT", "LINK", "STYLE", "BASE", "NOSCRIPT",
  ]);

  function isSkippable(el) {
    return !el || el.nodeType !== 1 || SKIP_TAGS.has(el.tagName);
  }

  function nextSiblingPast(el, skip) {
    let n = el && el.nextElementSibling;
    while (n && skip(n)) n = n.nextElementSibling;
    return n || null;
  }

  function prevSiblingPast(el, skip) {
    let n = el && el.previousElementSibling;
    while (n && skip(n)) n = n.previousElementSibling;
    return n || null;
  }

  function firstChildPast(el, skip) {
    let n = el && el.firstElementChild;
    while (n && skip(n)) n = n.nextElementSibling;
    return n || null;
  }

  // Given a starting element and a direction, return the element to move the
  // selection to, or null if there is nothing sensible there.
  //
  //   up    previous element sibling; if none, the parent
  //   down  next element sibling; if none, the nearest following element of an
  //         ancestor (so a lone child still steps forward instead of dead-ending)
  //   left  parent element (stops above <html>, where parentElement is null)
  //   right first element child
  //
  // `skip` decides which elements to step over (default: document metadata,
  // see SKIP_TAGS). Element nodes only; no wrap-around.
  function nextTarget(node, direction, skip) {
    if (!node || node.nodeType !== 1) return null;
    skip = skip || isSkippable;

    switch (direction) {
      case "up": {
        const prev = prevSiblingPast(node, skip);
        if (prev) return prev;
        const parent = node.parentElement;
        return parent && !skip(parent) ? parent : null;
      }
      case "down": {
        const next = nextSiblingPast(node, skip);
        if (next) return next;
        let p = node.parentElement;
        while (p) {
          const s = nextSiblingPast(p, skip);
          if (s) return s;
          p = p.parentElement;
        }
        return null;
      }
      case "left": {
        const parent = node.parentElement;
        return parent && !skip(parent) ? parent : null;
      }
      case "right":
        return firstChildPast(node, skip);
      default:
        return null;
    }
  }

  // Build a "tag#id.class1.class2" description of an element.
  function describeElement(el) {
    if (!el || el.nodeType !== 1) return "";
    let out = el.tagName.toLowerCase();
    if (el.id) out += "#" + el.id;
    const classes = el.classList ? Array.from(el.classList) : [];
    for (const c of classes) out += "." + c;
    return out;
  }

  return { nextTarget, describeElement, isSkippable, SKIP_TAGS };
});
