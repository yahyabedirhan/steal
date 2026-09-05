import type { Mode } from "./modes";
import { renderList } from "./plain-text";
import { INLINE_TAGS, collapseWhitespace, isNeverContent } from "../utils/html-tags";

/**
 * Markdown: best-effort HTML-to-Markdown for pulling a page section into notes.
 *
 * The guiding rule: convert only what an HTML *tag* guarantees with certainty
 * (headings, emphasis, code, links, images, lists, blockquotes, rules) and drop
 * information that lives only in CSS classes. The
 * one deliberate class-based exception is `mdx-code`, the inline-code marker
 * HelloInterview's MDX renderer puts on a `<span>` rather than a `<code>`.
 *
 * `transform` returns a string and never routes through `formatHTML`, the same
 * as Plain Text.
 */

/**
 * Tags handled as inline by the conversion switch even though several are not in
 * the shared `INLINE_TAGS` set. Any element not listed here and not in
 * `INLINE_TAGS` falls back to the shared block/inline classification.
 */
const CONVERTED_INLINE_TAGS = new Set([
  "STRONG", "B", "EM", "I", "DEL", "S", "CODE", "KBD", "SAMP", "VAR", "A", "IMG", "BR",
]);

/** `<h1>`-`<h4>` map to `#`-`####`; `<h5>`/`<h6>` render as a bold line instead. */
const ATX_LEVEL: Record<string, number> = { H1: 1, H2: 2, H3: 3, H4: 4 };

function tagOf(el: Element): string {
  return el.tagName.toUpperCase();
}

/** The MDX renderer's inline-code marker. The only CSS class this mode reads. */
function isMdxCode(el: Element): boolean {
  return el.classList.contains("mdx-code");
}

function isInlineEl(el: Element): boolean {
  const tag = tagOf(el);
  return CONVERTED_INLINE_TAGS.has(tag) || INLINE_TAGS.has(tag) || isMdxCode(el);
}

/** An element's children rendered as one inline string. */
function inlineChildren(el: Element): string {
  let out = "";
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) out += collapseWhitespace(child.textContent ?? "");
    else if (child.nodeType === 1) out += renderInline(child as Element);
  }
  return out;
}

/** Convert one inline element to its Markdown form. */
function renderInline(el: Element): string {
  if (isNeverContent(el)) return "";
  const inner = inlineChildren(el);
  switch (tagOf(el)) {
    case "BR":
      return "\\\n";
    case "IMG":
      return "![" + (el.getAttribute("alt") ?? "") + "](" + (el.getAttribute("src") ?? "") + ")";
    case "STRONG":
    case "B":
      return "**" + inner + "**";
    case "EM":
    case "I":
      return "*" + inner + "*";
    case "DEL":
    case "S":
      return "~~" + inner + "~~";
    case "CODE":
    case "KBD":
    case "SAMP":
    case "VAR":
      return "`" + inner + "`";
    case "A": {
      const href = el.getAttribute("href");
      return href ? "[" + inner + "](" + href + ")" : inner;
    }
  }
  if (isMdxCode(el)) return "`" + inner + "`";
  return inner;
}

/** One list item's non-list child, rendered inline so emphasis and links survive. */
function listItemContent(node: Node): string {
  if (node.nodeType === 3) return collapseWhitespace(node.textContent ?? "");
  if (node.nodeType !== 1) return "";
  return renderInline(node as Element);
}

/**
 * Escape a leading structural token so body text is not silently promoted into
 * a heading, quote, or list item. Only `#`, `>`, `-`, `+`, `*` each followed by
 * a space, and a leading `<digits>.` followed by a space. Nothing mid-line.
 */
function escapeLeadingToken(line: string): string {
  const marker = line.match(/^([#>+\-*]) /);
  if (marker) return "\\" + line;
  const ordered = line.match(/^(\d+)\. /);
  if (ordered) return ordered[1] + "\\. " + line.slice(ordered[0].length);
  return line;
}

function escapeParagraph(text: string): string {
  return text.split("\n").map(escapeLeadingToken).join("\n");
}

/** Render `el` in block context, returning zero or more Markdown blocks. */
function renderBlocks(el: Element): string[] {
  const tag = tagOf(el);
  if (isNeverContent(el)) return [];
  if (tag in ATX_LEVEL) return ["#".repeat(ATX_LEVEL[tag]) + " " + inlineChildren(el).trim()];
  if (tag === "H5" || tag === "H6") return ["**" + inlineChildren(el).trim() + "**"];
  if (tag === "HR") return ["---"];
  if (tag === "PRE") {
    // Ends trimmed, internal newlines kept, the same rule Plain Text uses.
    return ["```\n" + (el.textContent ?? "").replace(/^\s+|\s+$/g, "") + "\n```"];
  }
  if (tag === "UL" || tag === "OL") return [renderList(el, 0, listItemContent)];
  if (tag === "BLOCKQUOTE") {
    const inner = renderContainer(el).join("\n\n");
    return [inner.split("\n").map((l) => (l ? "> " + l : ">")).join("\n")];
  }
  if (tag === "TABLE") {
    const rows = Array.from(el.querySelectorAll("tr"))
      .map((tr) =>
        Array.from(tr.querySelectorAll("th,td"))
          .map((cell) => inlineChildren(cell).trim())
          .filter(Boolean)
          .join(" "),
      )
      .filter(Boolean);
    return rows.length ? [rows.join("\n")] : [];
  }

  return renderContainer(el);
}

/**
 * Walk a transparent container: inline runs among the children become paragraph
 * blocks, block children recurse through `renderBlocks`.
 */
function renderContainer(el: Element): string[] {
  const blocks: string[] = [];
  let paragraph = "";
  const flush = () => {
    const trimmed = paragraph.trim();
    if (trimmed) blocks.push(escapeParagraph(trimmed));
    paragraph = "";
  };

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      paragraph += collapseWhitespace(child.textContent ?? "");
    } else if (child.nodeType === 1 && isInlineEl(child as Element)) {
      paragraph += renderInline(child as Element);
    } else if (child.nodeType === 1) {
      flush();
      blocks.push(...renderBlocks(child as Element));
    }
  }
  flush();
  return blocks;
}

export const markdown: Mode = {
  id: "markdown",
  key: "4",
  label: "Markdown",
  showDescriptor: "tag",
  showDimensions: true,
  showLength: true,
  transform: (el) =>
    renderBlocks(el)
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+|\s+$/g, ""),
};
