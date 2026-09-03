"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { nextTarget, describeElement, isSkippable } = require("../lib/dom-nav.js");

// Build a fake element tree and wire up the pointers dom-nav relies on.
// spec: { tag, id?, classes?, children?: [spec...] }
function make(spec, parent = null) {
  const el = {
    nodeType: 1,
    tagName: spec.tag.toUpperCase(),
    id: spec.id || "",
    classList: spec.classes || [],
    parentElement: parent,
    previousElementSibling: null,
    nextElementSibling: null,
    firstElementChild: null,
  };
  const kids = (spec.children || []).map((c) => make(c, el));
  kids.forEach((k, i) => {
    k.previousElementSibling = kids[i - 1] || null;
    k.nextElementSibling = kids[i + 1] || null;
  });
  el.firstElementChild = kids[0] || null;
  return el;
}

function build(spec) {
  const root = make(spec);
  root._byId = {};
  (function walk(n) {
    if (n.id) root._byId[n.id] = n;
    for (let c = n.firstElementChild; c; c = c.nextElementSibling) walk(c);
  })(root);
  return root;
}

// <html> > <head>(meta,title) + <body> > div#a > (div#b) , div#c > (div#d, div#e > div#f), p#g
function doc() {
  return build({
    tag: "html",
    children: [
      { tag: "head", children: [{ tag: "meta" }, { tag: "title" }] },
      {
        tag: "body",
        children: [
          { tag: "div", id: "a", children: [{ tag: "div", id: "b" }] },
          {
            tag: "div",
            id: "c",
            children: [
              { tag: "div", id: "d" },
              { tag: "div", id: "e", children: [{ tag: "div", id: "f" }] },
            ],
          },
          { tag: "p", id: "g" },
        ],
      },
    ],
  });
}

const at = (root, id) =>
  id === "html" ? root : id === "body" ? root._byId.a.parentElement : root._byId[id];

test("down/up between real siblings", () => {
  const r = doc();
  assert.equal(nextTarget(at(r, "d"), "down").id, "e");
  assert.equal(nextTarget(at(r, "e"), "up").id, "d");
});

test("down past a lone child jumps to the ancestor's next element", () => {
  const r = doc();
  // b is a's only child, a's next sibling is c
  assert.equal(nextTarget(at(r, "b"), "down").id, "c");
  // f is e's only child; e/c have no next sibling, so climb to g
  assert.equal(nextTarget(at(r, "f"), "down").id, "g");
});

test("up with no previous sibling goes to the parent", () => {
  const r = doc();
  assert.equal(nextTarget(at(r, "f"), "up").id, "e");
  assert.equal(nextTarget(at(r, "b"), "up").id, "a");
  assert.equal(nextTarget(at(r, "d"), "up").id, "c");
});

test("left walks up to <body> then <html>, then stops", () => {
  const r = doc();
  assert.equal(nextTarget(at(r, "b"), "left").id, "a");
  assert.equal(nextTarget(at(r, "a"), "left").tagName, "BODY");
  assert.equal(nextTarget(at(r, "body"), "left").tagName, "HTML");
  assert.equal(nextTarget(at(r, "html"), "left"), null);
});

test("right from <html> skips <head> and lands on <body>", () => {
  const r = doc();
  assert.equal(nextTarget(at(r, "html"), "right").tagName, "BODY");
  assert.equal(nextTarget(at(r, "body"), "right").id, "a");
  assert.equal(nextTarget(at(r, "c"), "right").id, "d");
});

test("up from <body> skips the <head> subtree and lands on <html>", () => {
  const r = doc();
  assert.equal(nextTarget(at(r, "body"), "up").tagName, "HTML");
});

test("no wrap-around: right on a leaf, edges", () => {
  const r = doc();
  assert.equal(nextTarget(at(r, "f"), "right"), null);
  assert.equal(nextTarget(at(r, "a"), "up").tagName, "BODY"); // no prev sibling -> parent
  assert.equal(nextTarget(at(r, "g"), "down"), null); // last element in the doc
  assert.equal(nextTarget(at(r, "html"), "up"), null); // nothing above <html>
});

test("a custom skip predicate is honoured", () => {
  const r = doc();
  const skipC = (el) => isSkippable(el) || (el && el.id === "c");
  // down from b would be c, but c is skipped -> next is g
  assert.equal(nextTarget(at(r, "b"), "down", skipC).id, "g");
});

test("nextTarget rejects non-elements and unknown directions", () => {
  const r = doc();
  assert.equal(nextTarget(null, "up"), null);
  assert.equal(nextTarget({ nodeType: 3 }, "up"), null);
  assert.equal(nextTarget(at(r, "a"), "sideways"), null);
});

test("describeElement: tag, id and classes", () => {
  assert.equal(describeElement(build({ tag: "li", id: "a", classes: ["x"] })), "li#a.x");
  assert.equal(describeElement(build({ tag: "li", classes: ["mid", "active"] })), "li.mid.active");
  assert.equal(describeElement(build({ tag: "li" })), "li");
});

test("describeElement: non-elements give empty string", () => {
  assert.equal(describeElement(null), "");
  assert.equal(describeElement({ nodeType: 3 }), "");
});

test("isSkippable flags document metadata", () => {
  assert.equal(isSkippable(build({ tag: "script" })), true);
  assert.equal(isSkippable(build({ tag: "meta" })), true);
  assert.equal(isSkippable(build({ tag: "div" })), false);
});
