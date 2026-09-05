// Clean HTML: the same subtree, stripped of everything that isn't content.
// Attributes are removed except a small per-tag allowlist where the
// attribute *is* content rather than presentation; subtrees with no text
// anywhere in them are dropped entirely (icon-only buttons, empty layout
// containers, decorative SVGs); and wrapper elements that exist purely for
// layout (no text of their own, exactly one child) are unwrapped so nesting
// reflects real structure instead of styling scaffolding.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.__inspectCopyFormatCleanHtml = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Tag name -> attributes worth keeping. Add a case here to extend the
  // allowlist; nothing else about the removal logic needs to change.
  const ATTRIBUTE_ALLOWLIST = {
    IMG: ["src", "alt"],
    A: ["href"],
  };

  // Tags whose entire content lives in an attribute, never in text — an
  // <img> is never going to have a text child, but it is never "textless
  // noise" either. These count as content on their own, and so does any
  // element that merely contains one, so a caption-less image doesn't get
  // pruned along with its wrapper.
  const CONTENT_BEARING_VOID_TAGS = new Set(["IMG"]);

  // Tags whose textContent is markup/code, never prose — a <style> full of
  // @font-face rules (often base64 fonts) or a <script> can dwarf the real
  // content it sits beside without being content itself, so they never count
  // toward hasContent even though el.textContent is non-empty. Compared
  // case-insensitively: an inline <svg><style> lives in the SVG namespace,
  // where tagName is lowercase "style" rather than HTML's "STYLE".
  const NEVER_CONTENT_TAGS = new Set(["STYLE", "SCRIPT"]);

  function hasContent(el) {
    if (NEVER_CONTENT_TAGS.has(el.tagName.toUpperCase())) return false;
    if (el.textContent.trim() !== "") return true;
    if (CONTENT_BEARING_VOID_TAGS.has(el.tagName)) return true;
    for (const descendant of el.querySelectorAll("*")) {
      if (CONTENT_BEARING_VOID_TAGS.has(descendant.tagName)) return true;
    }
    return false;
  }

  // Removes any descendant (never the root itself) with no content. Single
  // forward pass: querySelectorAll is pre-order, so an ancestor removed
  // earlier makes root.contains() false for its still-listed descendants,
  // which are then correctly skipped.
  function pruneTextless(root) {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el !== root && root.contains(el) && !hasContent(el)) {
        el.remove();
      }
    }
  }

  function isPlainWrapper(el) {
    if (el.children.length !== 1) return false;
    for (const child of el.childNodes) {
      if (child.nodeType === 3 && child.textContent.trim() !== "") return false;
    }
    return true;
  }

  // Collapses a wrapper with no text of its own and exactly one child into
  // that child. Never applied to the root itself. Single forward pass for
  // the same reason as pruneTextless: a chain of wrappers each become
  // eligible in turn as their ancestor above them is spliced out, in the
  // same order querySelectorAll already visits them (outermost first).
  function unwrapPlainWrappers(root) {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el !== root && root.contains(el) && isPlainWrapper(el)) {
        el.replaceWith(el.children[0]);
      }
    }
  }

  function stripAttributes(el) {
    const allow = ATTRIBUTE_ALLOWLIST[el.tagName] || [];
    for (const attr of Array.from(el.attributes)) {
      if (!allow.includes(attr.name)) el.removeAttribute(attr.name);
    }
    for (const child of el.children) stripAttributes(child);
  }

  function transform(el) {
    pruneTextless(el);
    unwrapPlainWrappers(el);
    stripAttributes(el);
    return el;
  }

  return {
    id: "clean-html",
    key: "2",
    label: "Clean HTML",
    showDescriptor: "tag",
    showDimensions: true,
    showLength: true,
    transform,
  };
});
