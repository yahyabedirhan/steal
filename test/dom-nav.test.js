"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { nextTarget, describeElement } = require("../lib/dom-nav.js");

// Minimal element fixtures. Only the properties the pure helpers touch.
function el(tag, opts = {}) {
  return {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    id: opts.id || "",
    classList: opts.classes || [],
    previousElementSibling: null,
    nextElementSibling: null,
    parentElement: null,
    firstElementChild: null,
  };
}

// Build: <html> > <body> > [<ul> > (<li a>, <li b>, <li c>), <p>]
function tree() {
  const html = el("html");
  const body = el("body");
  const ul = el("ul");
  const p = el("p");
  const a = el("li", { id: "a" });
  const b = el("li", { classes: ["mid", "active"] });
  const c = el("li");

  html.firstElementChild = body;
  body.parentElement = html;
  body.firstElementChild = ul;

  ul.parentElement = body;
  ul.firstElementChild = a;
  ul.nextElementSibling = p;
  p.parentElement = body;
  p.previousElementSibling = ul;

  a.parentElement = b.parentElement = c.parentElement = ul;
  a.nextElementSibling = b;
  b.previousElementSibling = a;
  b.nextElementSibling = c;
  c.previousElementSibling = b;

  return { html, body, ul, p, a, b, c };
}

test("nextTarget down/up move between element siblings", () => {
  const t = tree();
  assert.equal(nextTarget(t.a, "down"), t.b);
  assert.equal(nextTarget(t.b, "up"), t.a);
});

test("nextTarget left goes to the parent", () => {
  const t = tree();
  assert.equal(nextTarget(t.a, "left"), t.ul);
  assert.equal(nextTarget(t.ul, "left"), t.body);
});

test("nextTarget right goes to the first element child", () => {
  const t = tree();
  assert.equal(nextTarget(t.ul, "right"), t.a);
});

test("no wrap-around at edges", () => {
  const t = tree();
  assert.equal(nextTarget(t.a, "up"), null);
  assert.equal(nextTarget(t.c, "down"), null);
  assert.equal(nextTarget(t.c, "right"), null); // leaf
});

test("left stops at <html> (parentElement null above it)", () => {
  const t = tree();
  assert.equal(nextTarget(t.body, "left"), t.html);
  assert.equal(nextTarget(t.html, "left"), null);
});

test("nextTarget rejects non-elements and unknown directions", () => {
  const t = tree();
  assert.equal(nextTarget(null, "up"), null);
  assert.equal(nextTarget({ nodeType: 3 }, "up"), null);
  assert.equal(nextTarget(t.a, "sideways"), null);
});

test("describeElement: tag, id and classes", () => {
  const t = tree();
  assert.equal(describeElement(t.a), "li#a");
  assert.equal(describeElement(t.b), "li.mid.active");
  assert.equal(describeElement(t.c), "li");
  assert.equal(describeElement(el("div", { id: "x", classes: ["y", "z"] })), "div#x.y.z");
});

test("describeElement: non-elements give empty string", () => {
  assert.equal(describeElement(null), "");
  assert.equal(describeElement({ nodeType: 3 }), "");
});
