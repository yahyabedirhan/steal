// The ordered format registry. content.js and the label renderer both work
// only off this array — adding a format is adding a module here, not editing
// either of those.
(function (root, factory) {
  const deps = (typeof module === "object" && module.exports)
    ? {
        fullHtml: require("./full-html.js"),
        cleanHtml: require("./clean-html.js"),
        plainText: require("./plain-text.js"),
      }
    : {
        fullHtml: root.__inspectCopyFormatFullHtml,
        cleanHtml: root.__inspectCopyFormatCleanHtml,
        plainText: root.__inspectCopyFormatPlainText,
      };
  const api = factory(deps);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.__inspectCopyFormats = api;
})(typeof self !== "undefined" ? self : this, function (deps) {
  "use strict";
  return [deps.fullHtml, deps.cleanHtml, deps.plainText];
});
