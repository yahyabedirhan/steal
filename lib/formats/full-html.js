// Full HTML: the page HTML exactly as selected, unchanged in content. Loaded
// before formats.js; each format module sets its own window global so the
// registry can assemble them without a bundler.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.__inspectCopyFormatFullHtml = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Identity: the node returned by page.capture() already is the full page
  // HTML, ready for lib/serialize.js.
  function transform(el) {
    return el;
  }

  return {
    id: "full-html",
    key: "1",
    label: "Full HTML",
    showDescriptor: "full",
    showDimensions: true,
    showLength: false,
    transform,
  };
});
