/**
 * Tag-name sets shared by every walker that has to decide whether an element is
 * block-level or inline: `formatHTML` and the Plain Text and Markdown modes.
 * One copy means all three agree on what "block" and "inline" mean.
 *
 * Names are uppercase to match `Element.tagName` for HTML elements. Compare
 * case-insensitively (`.toUpperCase()`) when a node may be in the SVG namespace,
 * where `tagName` is lowercase, for example an inline `<svg><style>`.
 */

/** No closing tag, no children. */
export const VOID_TAGS = new Set([
  "AREA", "BASE", "BR", "COL", "EMBED", "HR", "IMG", "INPUT",
  "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR",
]);

/** Whitespace inside these is content, not presentation, so it is kept verbatim. */
export const VERBATIM_TAGS = new Set(["PRE", "SCRIPT", "STYLE", "TEXTAREA"]);

/** Flow with the surrounding text instead of each starting its own line. */
export const INLINE_TAGS = new Set([
  "A", "B", "I", "EM", "STRONG", "SPAN", "CODE", "SMALL", "SUB", "SUP", "BR",
]);

/**
 * Tags whose `textContent` is markup or code, never prose. A `<style>` full of
 * `@font-face` rules (often a base64 web font) or a `<script>` can dwarf the
 * real content beside it without being content itself. The text-shaped modes
 * emit nothing for these, the same rule Clean HTML uses.
 */
export const NEVER_CONTENT_TAGS = new Set(["STYLE", "SCRIPT"]);

/** Collapse every run of whitespace to a single space. */
export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ");
}

/** True for a tag whose `textContent` is markup or code and must never be emitted as prose. */
export function isNeverContent(el: Element): boolean {
  return NEVER_CONTENT_TAGS.has(el.tagName.toUpperCase());
}
