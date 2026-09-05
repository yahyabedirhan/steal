// Plain Text: just the words, no markup at all.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.__inspectCopyFormatPlainText = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function transform(el) {
    return el.textContent.replace(/\s+/g, " ").trim();
  }

  return {
    id: "plain-text",
    key: "3",
    label: "Plain Text",
    showDescriptor: "none",
    showDimensions: false,
    showLength: true,
    transform,
  };
});
