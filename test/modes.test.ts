import { test, expect } from "vitest";
import { formatHTML } from "../src/lib/utils/format-html";
import { fullHtml } from "../src/lib/modes/full-html";
import { cleanHtml } from "../src/lib/modes/clean-html";
import { plainText } from "../src/lib/modes/plain-text";
import { MODES } from "../src/lib/modes/modes";

function elementFor(html: string): Element {
  document.body.innerHTML = html;
  return document.body.firstElementChild!;
}

const serialize = (out: Element | string) => (typeof out === "string" ? out : formatHTML(out));

test("the registry lists exactly the three shipped modes, in key order", () => {
  expect(MODES.map((m) => m.id)).toEqual(["full-html", "clean-html", "plain-text"]);
  expect(MODES.map((m) => m.key)).toEqual(["1", "2", "3"]);
});

test("Full HTML transform is the identity", () => {
  const el = elementFor('<div class="a b">Hi</div>');
  expect(fullHtml.transform(el)).toBe(el);
});

test("Clean HTML drops every attribute except the allowlisted ones", () => {
  const el = elementFor(
    '<div class="card" data-x="1"><img class="icon" src="a.png" alt="An icon"><a class="link" href="/x" target="_blank">Go</a></div>',
  );
  expect(serialize(cleanHtml.transform(el))).toBe(
    ["<div>", '  <img src="a.png" alt="An icon">', '  <a href="/x">Go</a>', "</div>"].join("\n"),
  );
});

test("Clean HTML drops any subtree with no text anywhere in it", () => {
  const el = elementFor(
    '<div><button aria-label="Report"><svg><path d="M0 0"></path></svg></button><p>Real content</p></div>',
  );
  expect(serialize(cleanHtml.transform(el))).toBe(
    ["<div>", "  <p>", "    Real content", "  </p>", "</div>"].join("\n"),
  );
});

test("Clean HTML never drops the root itself, even if it has no text", () => {
  const el = elementFor("<button><svg></svg></button>");
  expect(serialize(cleanHtml.transform(el))).toBe("<button></button>");
});

test("Clean HTML unwraps a chain of textless single-child wrappers", () => {
  const el = elementFor('<div class="a"><div class="b"><div class="c"><p>Text</p></div></div></div>');
  expect(serialize(cleanHtml.transform(el))).toBe(
    ["<div>", "  <p>", "    Text", "  </p>", "</div>"].join("\n"),
  );
});

test("a wrapper is kept once it has its own direct text, but its still-wrapper child is unwrapped", () => {
  const el = elementFor('<div class="a">Label<span class="only"><em>child</em></span></div>');
  expect(serialize(cleanHtml.transform(el))).toBe("<div>\n  Label<em>child</em>\n</div>");
});

test("an image with no caption keeps its wrapper alive", () => {
  const el = elementFor('<div class="card"><img class="icon" src="a.png"></div>');
  expect(serialize(cleanHtml.transform(el))).toBe('<div>\n  <img src="a.png">\n</div>');
});

test("Clean HTML keeps a wrapper with more than one child", () => {
  const el = elementFor('<div class="a"><p>One</p><p>Two</p></div>');
  expect(serialize(cleanHtml.transform(el))).toBe(
    ["<div>", "  <p>", "    One", "  </p>", "  <p>", "    Two", "  </p>", "</div>"].join("\n"),
  );
});

test("Clean HTML drops <style> tags even though their textContent is non-empty", () => {
  const el = elementFor(
    '<div><svg><style>@font-face { font-family: "X"; src: url(data:font/woff2;base64,AAAA); }</style><text>One</text><text>Two</text></svg></div>',
  );
  expect(serialize(cleanHtml.transform(el))).toBe(
    [
      "<div>",
      "  <svg>",
      "    <text>",
      "      One",
      "    </text>",
      "    <text>",
      "      Two",
      "    </text>",
      "  </svg>",
      "</div>",
    ].join("\n"),
  );
});

test("Clean HTML drops a wrapper that contains only a <style> tag", () => {
  const el = elementFor('<div><style>body { color: red; }</style><p>Real content</p></div>');
  expect(serialize(cleanHtml.transform(el))).toBe(
    ["<div>", "  <p>", "    Real content", "  </p>", "</div>"].join("\n"),
  );
});

test("Plain Text returns only the text, whitespace collapsed and trimmed", () => {
  const el = elementFor("<div>  Hello\n\n  <b>world</b>   !  </div>");
  expect(plainText.transform(el)).toBe("Hello world !");
});

test("Plain Text numbers the items of an ordered list", () => {
  const el = elementFor("<ol><li>First</li><li>Second</li><li>Third</li></ol>");
  expect(plainText.transform(el)).toBe("1. First\n2. Second\n3. Third");
});

test("Plain Text bullets the items of an unordered list", () => {
  const el = elementFor("<ul><li>First</li><li>Second</li></ul>");
  expect(plainText.transform(el)).toBe("- First\n- Second");
});

test("Plain Text keeps each list item's own text on one line", () => {
  const el = elementFor(
    '<ol class="mdx-ol">' +
      '<li class="mdx-li"><div class="mdx-p"><strong>REST</strong> - uses standard\n  HTTP methods.</div></li>' +
      '<li class="mdx-li"><div class="mdx-p"><strong>GraphQL</strong> - a single <span class="mdx-code">endpoint</span>.</div></li>' +
      "</ol>",
  );
  expect(plainText.transform(el)).toBe(
    "1. REST - uses standard HTTP methods.\n2. GraphQL - a single endpoint.",
  );
});

test("Plain Text indents a nested list under its parent item", () => {
  const el = elementFor("<ul><li>Fruit<ul><li>Apple</li><li>Pear</li></ul></li><li>Veg</li></ul>");
  expect(plainText.transform(el)).toBe("- Fruit\n  - Apple\n  - Pear\n- Veg");
});

test("Plain Text surrounds a list with the paragraph text around it", () => {
  const el = elementFor("<div><p>Protocols to know</p><ol><li>REST</li><li>gRPC</li></ol></div>");
  expect(plainText.transform(el)).toBe("Protocols to know\n1. REST\n2. gRPC");
});
