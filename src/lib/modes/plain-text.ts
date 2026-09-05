import type { Mode } from "./modes";
import { INLINE_TAGS, collapseWhitespace, isNeverContent } from "../utils/html-tags";

/**
 * Plain Text: the words with their structure, but no markup.
 *
 * Every block-level element lands on its own line; inline elements keep flowing
 * with their surrounding text. `<pre>` is emitted verbatim as its own block.
 * `<style>` / `<script>` text is dropped, the same "never content" rule Clean
 * HTML uses. Blocks are joined with a single `\n`.
 *
 * Lists keep the richer shape they shipped with as a follow-on to 01: every
 * `<li>` on its own line, numbered `1. ` under an `<ol>` and bulleted `- `
 * under a `<ul>`, nested lists indented two spaces per level. `renderList` is
 * exported so the Markdown mode can reuse the exact same structure.
 */

const LIST_TAGS = new Set(["UL", "OL"]);

function isInline(el: Element): boolean {
  return INLINE_TAGS.has(el.tagName.toUpperCase());
}

/** An inline element's text, children concatenated with no line breaks. */
function renderInline(el: Element): string {
  if (isNeverContent(el)) return "";
  let out = "";
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) out += collapseWhitespace(child.textContent ?? "");
    else if (child.nodeType === 1) out += renderInline(child as Element);
  }
  return out;
}

/**
 * Render an element in block context. Inline runs among its children collapse
 * onto one line; each block child is a further line. Returns the block's text,
 * lines joined with a single `\n`.
 */
function renderBlock(el: Element): string {
  const tag = el.tagName.toUpperCase();
  if (isNeverContent(el)) return "";
  if (tag === "PRE") return (el.textContent ?? "").replace(/^\s+|\s+$/g, "");
  if (LIST_TAGS.has(el.tagName)) return renderList(el, 0, flatten);

  const parts: string[] = [];
  let line = "";
  const flushLine = () => {
    if (line.trim()) parts.push(line.trim());
    line = "";
  };

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      line += collapseWhitespace(child.textContent ?? "");
    } else if (child.nodeType === 1 && isInline(child as Element)) {
      line += renderInline(child as Element);
    } else if (child.nodeType === 1) {
      flushLine();
      const block = renderBlock(child as Element);
      if (block) parts.push(block);
    }
  }
  flushLine();
  return parts.join("\n");
}

/**
 * Flatten a node to a single run of text (no structure), for the text of one
 * list item. A nested list directly under an `<li>` is handled by `renderList`
 * itself, not here.
 */
function flatten(node: Node): string {
  if (node.nodeType === 3) return collapseWhitespace(node.textContent ?? "");
  if (node.nodeType !== 1) return "";
  const el = node as Element;
  if (isNeverContent(el)) return "";
  if (LIST_TAGS.has(el.tagName)) return "\n" + renderList(el, 0, flatten) + "\n";

  let out = "";
  for (const child of Array.from(el.childNodes)) out += flatten(child);
  return out;
}

/**
 * Render a `<ul>` / `<ol>` as marked, newline-separated lines.
 *
 * `renderContent` turns one non-list child of an `<li>` into text. Plain Text
 * passes `flatten` (strips all markup); Markdown mode passes its own inline
 * renderer so emphasis and links survive.
 */
export function renderList(
  list: Element,
  depth: number,
  renderContent: (node: Node) => string,
): string {
  const ordered = list.tagName === "OL";
  const pad = "  ".repeat(depth);
  const lines: string[] = [];
  let index = 0;

  for (const li of Array.from(list.children)) {
    if (li.tagName !== "LI") continue;
    index += 1;
    const marker = ordered ? `${index}. ` : "- ";

    const parts: string[] = [];
    let nested = "";
    for (const child of Array.from(li.childNodes)) {
      if (child.nodeType === 1 && LIST_TAGS.has((child as Element).tagName)) {
        nested += "\n" + renderList(child as Element, depth + 1, renderContent);
      } else {
        parts.push(renderContent(child));
      }
    }

    const body = parts.join(" ").replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").trim();
    const [first = "", ...rest] = body.split("\n");
    lines.push(pad + marker + first);
    for (const line of rest) lines.push(pad + " ".repeat(marker.length) + line);
    if (nested) lines.push(nested.replace(/^\n/, ""));
  }

  return lines.join("\n");
}

export const plainText: Mode = {
  id: "plain-text",
  key: "3",
  label: "Plain Text",
  showDescriptor: "none",
  showDimensions: false,
  showLength: true,
  transform: (el) =>
    renderBlock(el)
      .replace(/[^\S\n]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+|\s+$/g, ""),
};
