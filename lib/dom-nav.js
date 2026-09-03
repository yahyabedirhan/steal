// Pure DOM-navigation helpers, side-effect free and framework free.
// Loaded as a plain script before content.js (exposes window.__inspectCopyNav),
// and require()-able in Node for tests (module.exports).

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.__inspectCopyNav = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Given a starting element and a direction, return the element to move the
  // selection to, or null if there is nothing there. Element nodes only; no
  // wrap-around; "left" stops at <html> (parentElement is null above it).
  function nextTarget(node, direction) {
    if (!node || node.nodeType !== 1) return null;
    switch (direction) {
      case "up":
        return node.previousElementSibling || null;
      case "down":
        return node.nextElementSibling || null;
      case "left":
        return node.parentElement || null;
      case "right":
        return node.firstElementChild || null;
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

  return { nextTarget, describeElement };
});
