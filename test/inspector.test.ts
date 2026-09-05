import { test, expect, afterEach } from "vitest";
import { Inspector } from "../src/lib/inspector";
import { formatHTML } from "../src/lib/utils/format-html";

/**
 * Extension-node tracking and clean capture, with no `chrome` mock and no
 * scroll mock needed at all — `Inspector` knows about neither.
 */

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("class");
});

function mountedRoot(inspector: Inspector): HTMLElement {
  const root = document.createElement("div");
  root.id = "__inspect_copy_ui";
  inspector.mount(root);
  return root;
}

test("isExtensionNode follows identity, not a matching id", () => {
  const inspector = new Inspector();
  const root = mountedRoot(inspector);
  const child = document.createElement("span");
  root.appendChild(child);

  document.body.innerHTML = '<p id="__inspect_copy_ui">page lookalike</p>';
  const lookalike = document.querySelector("p")!;

  expect(inspector.isExtensionNode(root)).toBe(true);
  expect(inspector.isExtensionNode(child)).toBe(true);
  expect(inspector.isExtensionNode(lookalike)).toBe(false);
});

test("capture drops a mounted root nested in the subtree, keeping page lookalikes", () => {
  const inspector = new Inspector();
  document.body.innerHTML = '<main data-inspect-copy=""><p id="__inspect_copy_ui">Page content</p></main>';
  const root = document.createElement("div");
  document.querySelector("main")!.appendChild(root);
  inspector.mount(root);

  const copy = inspector.capture(document.body);
  expect(formatHTML(copy)).toBe(
    [
      "<body>",
      '  <main data-inspect-copy="">',
      '    <p id="__inspect_copy_ui">',
      "      Page content",
      "    </p>",
      "  </main>",
      "</body>",
    ].join("\n"),
  );
});

test("setInspecting adds ic-active and restores the original class attribute exactly", () => {
  const inspector = new Inspector();
  expect(document.documentElement.hasAttribute("class")).toBe(false);
  inspector.setInspecting(true);
  expect(document.documentElement.classList.contains("ic-active")).toBe(true);
  inspector.setInspecting(false);
  expect(document.documentElement.hasAttribute("class")).toBe(false);
});

test("capture strips ic-active from a cloned <html> while inspecting", () => {
  const inspector = new Inspector();
  document.documentElement.setAttribute("class", "site");
  document.head.innerHTML = "";
  document.body.innerHTML = "Page";
  inspector.setInspecting(true);

  const copy = inspector.capture(document.documentElement);
  expect((copy as Element).getAttribute("class")).toBe("site");
});

test("a pre-existing ic-active class is left page-owned", () => {
  const inspector = new Inspector();
  document.documentElement.setAttribute("class", "ic-active site");
  inspector.setInspecting(true);
  inspector.setInspecting(false);
  expect(document.documentElement.getAttribute("class")).toBe("ic-active site");
});
