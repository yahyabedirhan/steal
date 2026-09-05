import { test, expect } from "vitest";
import { formatHTML } from "../src/lib/utils/format-html";

function elementFor(html: string): Element {
  document.body.innerHTML = html;
  return document.body.firstElementChild!;
}

test("block children each get their own indented line", () => {
  const el = elementFor("<div><p>One</p><p>Two</p></div>");
  expect(formatHTML(el)).toBe(
    ["<div>", "  <p>", "    One", "  </p>", "  <p>", "    Two", "  </p>", "</div>"].join("\n"),
  );
});

test("inline elements flow with surrounding text on one line", () => {
  const el = elementFor('<p>Some <strong>bold</strong> and <a href="/x">a link</a> text</p>');
  expect(formatHTML(el)).toBe(
    '<p>\n  Some <strong>bold</strong> and <a href="/x">a link</a> text\n</p>',
  );
});

test("void elements never get a closing tag or children", () => {
  const el = elementFor('<div><img src="a.png"><br></div>');
  expect(formatHTML(el)).toBe(["<div>", '  <img src="a.png">', "  <br>", "</div>"].join("\n"));
});

test("pre/script/style/textarea are copied through untouched", () => {
  const el = elementFor("<div><pre>  line one\n    line two  </pre></div>");
  expect(formatHTML(el)).toBe(["<div>", "  <pre>  line one\n    line two  </pre>", "</div>"].join("\n"));
});

test("an element with no children at all serializes on one line", () => {
  const el = elementFor("<button></button>");
  expect(formatHTML(el)).toBe("<button></button>");
});

test("attribute values are quote-escaped", () => {
  const el = elementFor("<div></div>");
  el.setAttribute("title", 'say "hi"');
  expect(formatHTML(el)).toBe('<div title="say &quot;hi&quot;"></div>');
});

test("text is HTML-escaped and internal whitespace collapsed", () => {
  const el = elementFor("<p></p>");
  el.textContent = "a  <b>\n  not a tag  ";
  expect(formatHTML(el)).toBe("<p>\n  a &lt;b&gt; not a tag\n</p>");
});

test("an unrecognized custom element is treated as block-level", () => {
  const el = elementFor("<div><my-widget>content</my-widget></div>");
  expect(formatHTML(el)).toBe(
    ["<div>", "  <my-widget>", "    content", "  </my-widget>", "</div>"].join("\n"),
  );
});

test("the selected root is always block, even when it's an inline tag itself", () => {
  const el = elementFor('<a href="/x">a link</a>');
  expect(formatHTML(el)).toBe('<a href="/x">\n  a link\n</a>');
});
