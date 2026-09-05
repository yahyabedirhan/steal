"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { serialize } = require("../lib/serialize.js");

function elementFor(html) {
  const dom = new JSDOM(`<body>${html}</body>`);
  return dom.window.document.body.firstElementChild;
}

test("block children each get their own indented line", () => {
  const el = elementFor("<div><p>One</p><p>Two</p></div>");
  assert.equal(serialize(el), [
    "<div>",
    "  <p>",
    "    One",
    "  </p>",
    "  <p>",
    "    Two",
    "  </p>",
    "</div>",
  ].join("\n"));
});

test("inline elements flow with surrounding text on one line", () => {
  const el = elementFor('<p>Some <strong>bold</strong> and <a href="/x">a link</a> text</p>');
  assert.equal(serialize(el),
    '<p>\n  Some <strong>bold</strong> and <a href="/x">a link</a> text\n</p>');
});

test("void elements never get a closing tag or children", () => {
  const el = elementFor('<div><img src="a.png"><br></div>');
  assert.equal(serialize(el), [
    "<div>",
    '  <img src="a.png">',
    "  <br>",
    "</div>",
  ].join("\n"));
});

test("pre/script/style/textarea are copied through untouched", () => {
  const el = elementFor("<div><pre>  line one\n    line two  </pre></div>");
  assert.equal(serialize(el), [
    "<div>",
    "  <pre>  line one\n    line two  </pre>",
    "</div>",
  ].join("\n"));
});

test("an element with no children at all serializes on one line", () => {
  const el = elementFor("<button></button>");
  assert.equal(serialize(el), "<button></button>");
});

test("attribute values are quote-escaped", () => {
  const el = elementFor("<div></div>");
  el.setAttribute("title", 'say "hi"');
  assert.equal(serialize(el), '<div title="say &quot;hi&quot;"></div>');
});

test("text is HTML-escaped and internal whitespace collapsed", () => {
  const el = elementFor("<p></p>");
  el.textContent = "a  <b>\n  not a tag  ";
  assert.equal(serialize(el), "<p>\n  a &lt;b&gt; not a tag\n</p>");
});

test("an unrecognized custom element is treated as block-level", () => {
  const el = elementFor("<div><my-widget>content</my-widget></div>");
  assert.equal(serialize(el), [
    "<div>",
    "  <my-widget>",
    "    content",
    "  </my-widget>",
    "</div>",
  ].join("\n"));
});

test("the selected root is always block, even when it's an inline tag itself", () => {
  const el = elementFor('<a href="/x">a link</a>');
  assert.equal(serialize(el), '<a href="/x">\n  a link\n</a>');
});
