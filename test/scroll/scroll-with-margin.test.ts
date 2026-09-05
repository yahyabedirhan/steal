import { test, expect } from "vitest";
import { applyScrollMargin, restoreScrollMargin } from "../../src/lib/scroll/scroll-with-margin";

function elementFor(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

test("apply sets both margin properties and records the prior state", () => {
  const el = elementFor('<p style="color:red">Hi</p>');
  const change = applyScrollMargin(el, 96);
  expect(el.style.getPropertyValue("scroll-margin-top")).toBe("96px");
  expect(el.style.getPropertyValue("scroll-margin-bottom")).toBe("96px");
  expect(change.original).toBe("color:red");
  expect(change.marginValue).toBe("96px");
});

test("restore on an untouched element puts the original style attribute back exactly", () => {
  const el = elementFor('<p style="color:red">Hi</p>');
  const change = applyScrollMargin(el, 96);
  restoreScrollMargin(el, change);
  expect(el.getAttribute("style")).toBe("color:red");
});

test("restore removes the style attribute entirely when there was none", () => {
  const el = elementFor("<p>Hi</p>");
  const change = applyScrollMargin(el, 96);
  restoreScrollMargin(el, change);
  expect(el.hasAttribute("style")).toBe(false);
});

test("restore keeps a page edit made after the patch, dropping only Steal's margins", () => {
  const el = elementFor("<p>Hi</p>");
  const change = applyScrollMargin(el, 96);
  el.style.color = "blue";
  restoreScrollMargin(el, change);
  expect(el.style.getPropertyValue("color")).toBe("blue");
  expect(el.style.getPropertyValue("scroll-margin-top")).toBe("");
  expect(el.style.getPropertyValue("scroll-margin-bottom")).toBe("");
});

test("restore leaves a page-overridden margin (different value) alone", () => {
  const el = elementFor("<p>Hi</p>");
  const change = applyScrollMargin(el, 96);
  el.style.setProperty("scroll-margin-top", "13px");
  restoreScrollMargin(el, change);
  expect(el.style.getPropertyValue("scroll-margin-top")).toBe("13px");
});
