"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { serialize } = require("../lib/serialize.js");
const fullHtml = require("../lib/formats/full-html.js");
const cleanHtml = require("../lib/formats/clean-html.js");
const plainText = require("../lib/formats/plain-text.js");
const formats = require("../lib/formats/formats.js");

function elementFor(html) {
  const dom = new JSDOM(`<body>${html}</body>`);
  return dom.window.document.body.firstElementChild;
}

test("the registry lists exactly the three shipped formats, in key order", () => {
  assert.deepEqual(formats.map((f) => f.id), ["full-html", "clean-html", "plain-text"]);
  assert.deepEqual(formats.map((f) => f.key), ["1", "2", "3"]);
});

test("Full HTML transform is the identity", () => {
  const el = elementFor('<div class="a b">Hi</div>');
  assert.equal(fullHtml.transform(el), el);
});

test("Clean HTML drops every attribute except the allowlisted ones", () => {
  const el = elementFor(
    '<div class="card" data-x="1"><img class="icon" src="a.png" alt="An icon"><a class="link" href="/x" target="_blank">Go</a></div>'
  );
  const out = cleanHtml.transform(el);
  assert.equal(serialize(out), [
    "<div>",
    '  <img src="a.png" alt="An icon">',
    '  <a href="/x">Go</a>',
    "</div>",
  ].join("\n"));
});

test("Clean HTML drops any subtree with no text anywhere in it", () => {
  const el = elementFor(
    '<div><button aria-label="Report"><svg><path d="M0 0"></path></svg></button><p>Real content</p></div>'
  );
  const out = cleanHtml.transform(el);
  assert.equal(serialize(out), ["<div>", "  <p>", "    Real content", "  </p>", "</div>"].join("\n"));
});

test("Clean HTML never drops the root itself, even if it has no text", () => {
  const el = elementFor("<button><svg></svg></button>");
  const out = cleanHtml.transform(el);
  assert.equal(serialize(out), "<button></button>");
});

test("Clean HTML unwraps a chain of textless single-child wrappers", () => {
  const el = elementFor('<div class="a"><div class="b"><div class="c"><p>Text</p></div></div></div>');
  const out = cleanHtml.transform(el);
  assert.equal(serialize(out), ["<div>", "  <p>", "    Text", "  </p>", "</div>"].join("\n"));
});

test("a wrapper is kept once it has its own direct text, but its still-wrapper child is unwrapped", () => {
  const el = elementFor('<div class="a">Label<span class="only"><em>child</em></span></div>');
  const out = cleanHtml.transform(el);
  // The outer div has direct text ("Label") so it survives; the inner span
  // has none of its own and exactly one child, so it is unwrapped in turn.
  assert.equal(serialize(out), "<div>\n  Label<em>child</em>\n</div>");
});

test("an image with no caption keeps its wrapper alive", () => {
  const el = elementFor('<div class="card"><img class="icon" src="a.png"></div>');
  const out = cleanHtml.transform(el);
  assert.equal(serialize(out), '<div>\n  <img src="a.png">\n</div>');
});

test("Clean HTML keeps a wrapper with more than one child", () => {
  const el = elementFor('<div class="a"><p>One</p><p>Two</p></div>');
  const out = cleanHtml.transform(el);
  assert.equal(serialize(out), [
    "<div>", "  <p>", "    One", "  </p>", "  <p>", "    Two", "  </p>", "</div>",
  ].join("\n"));
});

test("Clean HTML drops <style> tags even though their textContent is non-empty", () => {
  const el = elementFor(
    '<div><svg><style>@font-face { font-family: "X"; src: url(data:font/woff2;base64,AAAA); }</style><text>One</text><text>Two</text></svg></div>'
  );
  const out = cleanHtml.transform(el);
  assert.equal(serialize(out), [
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
  ].join("\n"));
});

test("Clean HTML drops a wrapper that contains only a <style> tag", () => {
  const el = elementFor('<div><style>body { color: red; }</style><p>Real content</p></div>');
  const out = cleanHtml.transform(el);
  assert.equal(serialize(out), ["<div>", "  <p>", "    Real content", "  </p>", "</div>"].join("\n"));
});

test("Plain Text returns only the text, whitespace collapsed and trimmed", () => {
  const el = elementFor("<div>  Hello\n\n  <b>world</b>   !  </div>");
  assert.equal(plainText.transform(el), "Hello world !");
});
