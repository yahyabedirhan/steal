import { test, expect } from "vitest";
import { DomNavigator } from "../src/lib/dom-navigator";

const nav = new DomNavigator();

/**
 * Build a fake element tree and wire up the pointers `DomNavigator` relies on.
 * spec: { tag, id?, classes?, children?: [spec...] }
 */
interface Spec {
  tag: string;
  id?: string;
  classes?: string[];
  children?: Spec[];
}

interface FakeEl {
  nodeType: 1;
  tagName: string;
  id: string;
  classList: string[];
  parentElement: FakeEl | null;
  previousElementSibling: FakeEl | null;
  nextElementSibling: FakeEl | null;
  firstElementChild: FakeEl | null;
  _byId?: Record<string, FakeEl>;
}

function make(spec: Spec, parent: FakeEl | null = null): FakeEl {
  const el: FakeEl = {
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

function build(spec: Spec): FakeEl {
  const root = make(spec);
  root._byId = {};
  (function walk(n: FakeEl) {
    if (n.id) root._byId![n.id] = n;
    for (let c = n.firstElementChild; c; c = c.nextElementSibling) walk(c);
  })(root);
  return root;
}

// <html> > <head>(meta,title) + <body> > div#a > (div#b) , div#c > (div#d, div#e > div#f), p#g
function doc(): FakeEl {
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

const at = (root: FakeEl, id: string): FakeEl =>
  id === "html"
    ? root
    : id === "body"
      ? root._byId!.a.parentElement!
      : root._byId![id];

// DomNavigator methods accept Element; the fake tree is structurally close
// enough for the traversal logic, which only reads the wired pointers.
const N = nav as unknown as {
  nextTarget: (n: FakeEl | null, d: string, skip?: (el: FakeEl | null) => boolean) => FakeEl | null;
  describeElement: (el: FakeEl | null) => string;
  isSkippable: (el: FakeEl | null) => boolean;
};

test("down/up between real siblings", () => {
  const r = doc();
  expect(N.nextTarget(at(r, "d"), "down")!.id).toBe("e");
  expect(N.nextTarget(at(r, "e"), "up")!.id).toBe("d");
});

test("down past a lone child jumps to the ancestor's next element", () => {
  const r = doc();
  expect(N.nextTarget(at(r, "b"), "down")!.id).toBe("c");
  expect(N.nextTarget(at(r, "f"), "down")!.id).toBe("g");
});

test("up with no previous sibling goes to the parent", () => {
  const r = doc();
  expect(N.nextTarget(at(r, "f"), "up")!.id).toBe("e");
  expect(N.nextTarget(at(r, "b"), "up")!.id).toBe("a");
  expect(N.nextTarget(at(r, "d"), "up")!.id).toBe("c");
});

test("left walks up to <body> then <html>, then stops", () => {
  const r = doc();
  expect(N.nextTarget(at(r, "b"), "left")!.id).toBe("a");
  expect(N.nextTarget(at(r, "a"), "left")!.tagName).toBe("BODY");
  expect(N.nextTarget(at(r, "body"), "left")!.tagName).toBe("HTML");
  expect(N.nextTarget(at(r, "html"), "left")).toBe(null);
});

test("right from <html> skips <head> and lands on <body>", () => {
  const r = doc();
  expect(N.nextTarget(at(r, "html"), "right")!.tagName).toBe("BODY");
  expect(N.nextTarget(at(r, "body"), "right")!.id).toBe("a");
  expect(N.nextTarget(at(r, "c"), "right")!.id).toBe("d");
});

test("up from <body> skips the <head> subtree and lands on <html>", () => {
  const r = doc();
  expect(N.nextTarget(at(r, "body"), "up")!.tagName).toBe("HTML");
});

test("no wrap-around: right on a leaf, edges", () => {
  const r = doc();
  expect(N.nextTarget(at(r, "f"), "right")).toBe(null);
  expect(N.nextTarget(at(r, "a"), "up")!.tagName).toBe("BODY");
  expect(N.nextTarget(at(r, "g"), "down")).toBe(null);
  expect(N.nextTarget(at(r, "html"), "up")).toBe(null);
});

test("a custom skip predicate is honoured", () => {
  const r = doc();
  const skipC = (el: FakeEl | null) => nav.isSkippable(el as unknown as Element) || el?.id === "c";
  expect(N.nextTarget(at(r, "b"), "down", skipC)!.id).toBe("g");
});

test("nextTarget rejects non-elements and unknown directions", () => {
  const r = doc();
  expect(N.nextTarget(null, "up")).toBe(null);
  expect(N.nextTarget({ nodeType: 3 } as unknown as FakeEl, "up")).toBe(null);
  expect(N.nextTarget(at(r, "a"), "sideways")).toBe(null);
});

test("describeElement: tag, id and classes", () => {
  expect(N.describeElement(build({ tag: "li", id: "a", classes: ["x"] }))).toBe("li#a.x");
  expect(N.describeElement(build({ tag: "li", classes: ["mid", "active"] }))).toBe("li.mid.active");
  expect(N.describeElement(build({ tag: "li" }))).toBe("li");
});

test("describeElement: non-elements give empty string", () => {
  expect(N.describeElement(null)).toBe("");
  expect(N.describeElement({ nodeType: 3 } as unknown as FakeEl)).toBe("");
});

test("isSkippable flags document metadata", () => {
  expect(N.isSkippable(build({ tag: "script" }))).toBe(true);
  expect(N.isSkippable(build({ tag: "meta" }))).toBe(true);
  expect(N.isSkippable(build({ tag: "div" }))).toBe(false);
});
