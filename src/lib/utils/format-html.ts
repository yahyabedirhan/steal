/**
 * Turn a DOM node into an indented HTML string.
 *
 * Used by any mode whose `transform()` returns a node rather than a string
 * (see `src/lib/modes/`). Not a mode itself, just a small pure utility.
 *
 * - Indentation is 2 spaces per depth.
 * - A small set of inline tags flow with surrounding text instead of each
 *   getting their own line; everything else (including unknown/custom
 *   elements) is treated as block-level.
 * - `pre` / `script` / `style` / `textarea` are copied through via `outerHTML`,
 *   untouched, since whitespace inside them is content, not presentation.
 */

const VOID_TAGS = new Set([
  "AREA", "BASE", "BR", "COL", "EMBED", "HR", "IMG", "INPUT",
  "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR",
]);
const VERBATIM_TAGS = new Set(["PRE", "SCRIPT", "STYLE", "TEXTAREA"]);
const INLINE_TAGS = new Set([
  "A", "B", "I", "EM", "STRONG", "SPAN", "CODE", "SMALL", "SUB", "SUP", "BR",
]);

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function openTag(el: Element): string {
  let out = "<" + el.tagName.toLowerCase();
  for (const attr of Array.from(el.attributes)) {
    out += " " + attr.name + '="' + escapeAttr(attr.value) + '"';
  }
  return out + ">";
}

function closeTag(el: Element): string {
  return "</" + el.tagName.toLowerCase() + ">";
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ");
}

/**
 * Serialize an inline element's own children as one continuous string, for
 * embedding inside a line of flowed text. Only reachable from inline context,
 * so any element encountered here is treated as inline too.
 */
function inlineHtml(node: Node): string {
  let out = "";
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) {
      out += escapeText(collapseWhitespace(child.textContent ?? ""));
    } else if (child.nodeType === 1) {
      const el = child as Element;
      out += openTag(el);
      if (!VOID_TAGS.has(el.tagName)) out += inlineHtml(el) + closeTag(el);
    }
  }
  return out;
}

function indent(depth: number): string {
  return "  ".repeat(depth);
}

/**
 * Render `el` in block context: its own opening/closing tag each on their own
 * line at `depth`, with children rendered at `depth + 1`. Returns an array of
 * already-indented lines.
 */
function renderBlock(el: Element, depth: number): string[] {
  if (VOID_TAGS.has(el.tagName)) return [indent(depth) + openTag(el)];
  if (VERBATIM_TAGS.has(el.tagName)) return [indent(depth) + el.outerHTML];

  const lines: string[] = [];
  let buffer = "";
  const flushBuffer = () => {
    const trimmed = buffer.trim();
    if (trimmed) lines.push(indent(depth + 1) + trimmed);
    buffer = "";
  };

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      buffer += escapeText(collapseWhitespace(child.textContent ?? ""));
    } else if (child.nodeType === 1 && INLINE_TAGS.has((child as Element).tagName)) {
      const inline = child as Element;
      buffer += openTag(inline);
      if (!VOID_TAGS.has(inline.tagName)) buffer += inlineHtml(inline) + closeTag(inline);
    } else if (child.nodeType === 1) {
      flushBuffer();
      lines.push(...renderBlock(child as Element, depth + 1));
    }
  }
  flushBuffer();

  if (lines.length === 0) return [indent(depth) + openTag(el) + closeTag(el)];
  return [indent(depth) + openTag(el), ...lines, indent(depth) + closeTag(el)];
}

/**
 * Always renders the root in block context, regardless of its own tag. It is
 * the thing being extracted, not flowed text inside something else.
 */
export function formatHTML(el: Element): string {
  return renderBlock(el, 0).join("\n");
}
