import type { Mode } from "./modes";

/** Plain Text: just the words, no markup at all. */
export const plainText: Mode = {
  id: "plain-text",
  key: "3",
  label: "Plain Text",
  showDescriptor: "none",
  showDimensions: false,
  showLength: true,
  transform: (el) => (el.textContent ?? "").replace(/\s+/g, " ").trim(),
};
