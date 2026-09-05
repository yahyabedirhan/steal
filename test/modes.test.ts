import { test, expect } from "vitest";
import { formatHTML } from "../src/lib/utils/format-html";
import { fullHtml } from "../src/lib/modes/full-html";
import { cleanHtml } from "../src/lib/modes/clean-html";
import { plainText } from "../src/lib/modes/plain-text";
import { markdown } from "../src/lib/modes/markdown";
import { MODES } from "../src/lib/modes/modes";

function elementFor(html: string): Element {
  document.body.innerHTML = html;
  return document.body.firstElementChild!;
}

const serialize = (out: Element | string) => (typeof out === "string" ? out : formatHTML(out));

test("the registry lists exactly the four shipped modes, in key order", () => {
  expect(MODES.map((m) => m.id)).toEqual(["full-html", "clean-html", "plain-text", "markdown"]);
  expect(MODES.map((m) => m.key)).toEqual(["1", "2", "3", "4"]);
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

test("Plain Text puts each block-level element on its own line", () => {
  const el = elementFor(
    '<div><div class="mdx-p">Course intro</div><h1>API Design</h1><p>Principles and patterns.</p></div>',
  );
  expect(plainText.transform(el)).toBe("Course intro\nAPI Design\nPrinciples and patterns.");
});

test("Plain Text keeps inline elements flowing with their text", () => {
  const el = elementFor('<p>Choose <strong>one</strong> of the <a href="/x">three protocols</a> here.</p>');
  expect(plainText.transform(el)).toBe("Choose one of the three protocols here.");
});

test("Plain Text drops inline <style> and <script> content", () => {
  const el = elementFor(
    '<div><svg><style>@font-face { src: url(data:font/woff2;base64,AAAABBBBCCCC); }</style></svg>' +
      "<script>window.x = 1;</script><p>Real text</p></div>",
  );
  expect(plainText.transform(el)).toBe("Real text");
});

test("Plain Text keeps a <pre> block verbatim on its own", () => {
  const el = elementFor(
    "<div><p>Endpoints</p><pre>GET /events        # all events\nGET /events/{id}   # one event</pre></div>",
  );
  expect(plainText.transform(el)).toBe(
    "Endpoints\nGET /events        # all events\nGET /events/{id}   # one event",
  );
});

test("Plain Text separates blocks with a single newline and collapses longer runs", () => {
  const el = elementFor("<div><p>One</p><div><div><p>Two</p></div></div><p>Three</p></div>");
  expect(plainText.transform(el)).toBe("One\nTwo\nThree");
});

test("Plain Text renders headings as bare lines with no prefix", () => {
  const el = elementFor("<div><h2>Heading</h2><p>Body</p></div>");
  expect(plainText.transform(el)).toBe("Heading\nBody");
});

test("Markdown maps h1-h4 to # .. #### and h5/h6 to a bold line", () => {
  const el = elementFor(
    "<div><h1>A</h1><h2>B</h2><h3>C</h3><h4>D</h4><h5>E</h5><h6>F</h6></div>",
  );
  expect(markdown.transform(el)).toBe("# A\n\n## B\n\n### C\n\n#### D\n\n**E**\n\n**F**");
});

test("Markdown converts the three inline emphases", () => {
  const el = elementFor(
    "<p><strong>bold</strong> <b>bold</b> <em>it</em> <i>it</i> <del>gone</del> <s>gone</s></p>",
  );
  expect(markdown.transform(el)).toBe("**bold** **bold** *it* *it* ~~gone~~ ~~gone~~");
});

test("Markdown wraps inline code, including a span carrying the mdx-code class", () => {
  const el = elementFor(
    '<p>Call <code>fn()</code> with <kbd>Enter</kbd> and read <span class="mdx-code">event_id</span>.</p>',
  );
  expect(markdown.transform(el)).toBe("Call `fn()` with `Enter` and read `event_id`.");
});

test("Markdown reads no CSS class other than mdx-code", () => {
  const el = elementFor('<p>Plain <span class="inline-code highlight">x</span> span.</p>');
  expect(markdown.transform(el)).toBe("Plain x span.");
});

test("Markdown emits <pre> as a fenced block, verbatim, with no language tag", () => {
  const el = elementFor(
    "<div><p>Sample</p><pre><code>GET /events        # all\nGET /events/{id}   # one</code></pre></div>",
  );
  expect(markdown.transform(el)).toBe(
    "Sample\n\n```\nGET /events        # all\nGET /events/{id}   # one\n```",
  );
});

test("Markdown converts links and images", () => {
  const el = elementFor(
    '<p>See <a href="/docs">the docs</a> and <img src="d.png" alt="a diagram"></p>',
  );
  expect(markdown.transform(el)).toBe("See [the docs](/docs) and ![a diagram](d.png)");
});

test("Markdown renders nested lists with indentation", () => {
  const el = elementFor(
    "<ul><li>Fruit<ul><li><strong>Apple</strong></li><li>Pear</li></ul></li><li>Veg</li></ul>",
  );
  expect(markdown.transform(el)).toBe("- Fruit\n  - **Apple**\n  - Pear\n- Veg");
});

test("Markdown prefixes a blockquote and converts hr and br", () => {
  const el = elementFor("<div><blockquote><p>Quoted line</p></blockquote><hr><p>After<br>wrap</p></div>");
  expect(markdown.transform(el)).toBe("> Quoted line\n\n---\n\nAfter\\\nwrap");
});

test("Markdown flattens a table instead of emitting GFM table syntax", () => {
  const el = elementFor(
    "<table><thead><tr><th>Verb</th><th>Path</th></tr></thead>" +
      "<tbody><tr><td>GET</td><td>/events</td></tr></tbody></table>",
  );
  expect(markdown.transform(el)).toBe("Verb Path\nGET /events");
});

test("Markdown escapes only a leading structural token, never mid-line * or _", () => {
  const el = elementFor(
    "<div><p># not a heading</p><p>1. not a list</p><p>rates are 3*x and user_id stays</p></div>",
  );
  expect(markdown.transform(el)).toBe(
    "\\# not a heading\n\n1\\. not a list\n\nrates are 3*x and user_id stays",
  );
});

test("Markdown drops <style> and <script> text and separates blocks with a blank line", () => {
  const el = elementFor(
    "<div><svg><style>@font-face{src:url(data:font/woff2;base64,AAAA)}</style></svg>" +
      "<p>First</p><p>Second</p></div>",
  );
  expect(markdown.transform(el)).toBe("First\n\nSecond");
});
