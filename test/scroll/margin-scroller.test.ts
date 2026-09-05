import { test, expect, beforeEach, afterEach, vi } from "vitest";
import { MarginScroller } from "../../src/lib/scroll/margin-scroller";
import type { ScrollAlignment } from "../../src/lib/scroll/scroller";

const START: ScrollAlignment = { block: "start", inline: "nearest", margin: 96 };

let frames: FrameRequestCallback[];

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    frames.push(fn);
    return frames.length;
  });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

const runFrames = () => frames.splice(0).forEach((fn) => fn(0));

function elementFor(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

test("scrollIntoView applies the margin, then the next frame reverts it", () => {
  const el = elementFor("<p>Hi</p>");
  const scroller = new MarginScroller();
  scroller.scrollIntoView(el, START);
  expect(el.style.getPropertyValue("scroll-margin-top")).toBe("96px");
  expect(el.scrollIntoView).toHaveBeenCalledOnce();
  runFrames();
  expect(el.hasAttribute("style")).toBe(false);
});

test("flush() settles a pending change synchronously, before its frame", () => {
  const el = elementFor("<p>Hi</p>");
  const scroller = new MarginScroller();
  scroller.scrollIntoView(el, START);
  scroller.flush();
  expect(el.hasAttribute("style")).toBe(false);
  runFrames(); // the stale frame is now a no-op
  expect(el.hasAttribute("style")).toBe(false);
});

test("repeated navigation on the same element never retains a Steal margin", () => {
  const el = elementFor("<p>Hi</p>");
  const scroller = new MarginScroller();
  scroller.scrollIntoView(el, START);
  scroller.scrollIntoView(el, START);
  scroller.scrollIntoView(el, START);
  runFrames();
  expect(el.hasAttribute("style")).toBe(false);
});

test("a throwing scrollIntoView reverts the margin and rethrows", () => {
  const el = elementFor("<p>Hi</p>");
  (el.scrollIntoView as ReturnType<typeof vi.fn>).mockImplementation(() => {
    throw new Error("boom");
  });
  const scroller = new MarginScroller();
  expect(() => scroller.scrollIntoView(el, START)).toThrow("boom");
  expect(el.hasAttribute("style")).toBe(false);
});
