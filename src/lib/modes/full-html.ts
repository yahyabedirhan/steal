import type { Mode } from "./modes";

/**
 * Full HTML: the page HTML exactly as selected, unchanged in content.
 *
 * `transform` is the identity — the node from `Inspector.capture()` already is
 * the full subtree, ready for `formatHTML`.
 */
export const fullHtml: Mode = {
  id: "full-html",
  key: "1",
  label: "Full HTML",
  showDescriptor: "full",
  showDimensions: true,
  showLength: false,
  transform: (el) => el,
};
