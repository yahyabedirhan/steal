import type { Mode } from "./modes";

/**
 * Plain Text: just the words, no markup.
 *
 * The one structure it does keep is lists: every `<li>` lands on its own line,
 * numbered `1. `, `2. ` … under an `<ol>` and bulleted `- ` under a `<ul>`,
 * with nested lists indented two spaces per level. Everything else collapses to
 * a single run of whitespace, as before.
 */

const LIST_TAGS = new Set(["UL", "OL"]);

function collapse(s: string): string {
  return s.replace(/\s+/g, " ");
}

/**
 * Flatten a node to text, turning any list it contains into newline-separated,
 * marked lines. Newlines only ever come from list rendering; raw whitespace in
 * text nodes is collapsed to spaces here so source formatting never leaks
 * through as line breaks.
 */
function flatten(node: Node): string {
  if (node.nodeType === 3) return collapse(node.textContent ?? "");
  if (node.nodeType !== 1) return "";

  const el = node as Element;
  if (LIST_TAGS.has(el.tagName)) return "\n" + renderList(el, 0) + "\n";

  let out = "";
  for (const child of Array.from(el.childNodes)) out += flatten(child);
  return out;
}

function renderList(list: Element, depth: number): string {
  const ordered = list.tagName === "OL";
  const pad = "  ".repeat(depth);
  const lines: string[] = [];
  let index = 0;

  for (const li of Array.from(list.children)) {
    if (li.tagName !== "LI") continue;
    index += 1;
    const marker = ordered ? `${index}. ` : "- ";

    // A nested list directly under the `<li>` is rendered one level deeper;
    // anything else contributes inline text.
    const parts: string[] = [];
    let nested = "";
    for (const child of Array.from(li.childNodes)) {
      if (child.nodeType === 1 && LIST_TAGS.has((child as Element).tagName)) {
        nested += "\n" + renderList(child as Element, depth + 1);
      } else {
        parts.push(flatten(child));
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
    flatten(el)
      // Trailing spaces before a break, and whitespace-only lines, go. A
      // line's own leading indentation (nested-list markers) stays.
      .replace(/[^\S\n]+\n/g, "\n")
      .replace(/\n[^\S\n]+\n/g, "\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+|\s+$/g, ""),
};
