"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { JSDOM } = require("jsdom");

function inspect(t, markup = '<button id="pick">Pick me</button>') {
  const dom = new JSDOM(markup, { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  const writes = [];
  const messages = [];
  const frames = [];
  let receive;
  let pointed = document.querySelector("#pick") || document.body;
  document.elementFromPoint = () => pointed;
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.requestAnimationFrame = (fn) => frames.push(fn);
  window.chrome = { runtime: {
    sendMessage: (msg) => messages.push(msg.type),
    onMessage: { addListener: (fn) => { receive = fn; } },
  } };
  Object.defineProperty(window.navigator, "clipboard", { value: {
    writeText: (text) => new Promise((resolve, reject) => {
      writes.push({ text, resolve, reject });
    }),
  } });
  document.execCommand = () => false;
  for (const file of ["lib/dom-nav.js", "lib/page-content.js", "content.js"]) {
    window.eval(readFileSync(resolve(__dirname, "..", file), "utf8"));
  }
  return {
    window, document, writes, messages,
    toggle: () => receive({ type: "inspect:toggle" }),
    key: (key) => window.dispatchEvent(new window.KeyboardEvent("keydown", {
      key, bubbles: true, cancelable: true,
    })),
    point(el) {
      pointed = el;
      window.dispatchEvent(new window.MouseEvent("mousemove", { clientX: 100, clientY: 100 }));
    },
    frame() { for (const fn of frames.splice(0)) fn(); },
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("repeated copy input waits for the pending write and a failed copy can be retried", async (t) => {
  const app = inspect(t);
  app.toggle();
  app.key("Enter");
  app.key("Enter");
  app.window.dispatchEvent(new app.window.MouseEvent("click", { cancelable: true }));
  assert.equal(app.writes.length, 1);
  app.writes[0].reject(new Error("Denied"));
  await settle();
  assert.equal(app.document.querySelector(".ic-toast").textContent, "✕ Copy failed");
  app.key("Enter");
  assert.equal(app.writes.length, 2);
  app.writes[1].resolve();
  await settle();
  assert.equal(app.messages.filter((msg) => msg === "inspect:ended").length, 1);
});

test("a copy completing after Escape and restart leaves the new inspection active", async (t) => {
  const app = inspect(t);
  app.toggle();
  app.key("Enter");
  app.key("Escape");
  app.toggle();
  app.writes[0].resolve();
  await settle();
  assert.equal(app.messages.at(-1), "inspect:started");
  assert.equal(app.document.querySelector(".ic-toast"), null);
  app.key("Enter");
  assert.equal(app.writes.length, 2);
});

test("a rejected old copy cannot start a fallback write in a new inspection", async (t) => {
  const app = inspect(t);
  let fallbackWrites = 0;
  app.document.execCommand = () => { fallbackWrites++; return true; };
  app.toggle();
  app.key("Enter");
  app.key("Escape");
  app.toggle();
  app.writes[0].reject(new Error("Denied"));
  await settle();
  assert.equal(fallbackWrites, 0);
  assert.equal(app.messages.at(-1), "inspect:started");
});

test("a throwing fallback leaves no textarea behind and allows retry", async (t) => {
  const app = inspect(t);
  app.document.execCommand = () => { throw new Error("Unavailable"); };
  app.toggle();
  app.key("Enter");
  app.writes[0].reject(new Error("Denied"));
  await settle();
  assert.equal(app.document.querySelector("textarea"), null);
  app.key("Enter");
  app.writes[1].resolve();
  await settle();
  assert.equal(app.messages.at(-1), "inspect:ended");
});

test("copying body excludes Steal UI while preserving page markup with similar names", (t) => {
  const app = inspect(t, '<main data-inspect-copy=""><p id="__inspect_copy_ui">Page content</p></main>');
  app.toggle();
  app.point(app.document.body);
  app.key("Enter");
  assert.equal(app.writes[0].text,
    '<body><main data-inspect-copy=""><p id="__inspect_copy_ui">Page content</p></main></body>');
});

test("copying html excludes the inspect class and preserves new page classes on exit", (t) => {
  const app = inspect(t, '<html class="  site  "><head></head><body>Page</body></html>');
  app.toggle();
  app.point(app.document.documentElement);
  app.key("Enter");
  assert.equal(app.writes[0].text, '<html class="  site  "><head></head><body>Page</body></html>');
  app.document.documentElement.classList.add("changed-by-page");
  app.key("Escape");
  assert.equal(app.document.documentElement.className, "site changed-by-page");
});

test("copying before the scroll frame preserves the original inline styles", (t) => {
  const app = inspect(t, '<main id="pick"><p style="color:red;scroll-margin-top:7px!important">Child</p></main>');
  app.toggle();
  app.key("ArrowRight");
  app.key("Enter");
  assert.equal(app.writes[0].text, '<p style="color:red;scroll-margin-top:7px!important">Child</p>');
  app.key("Escape");
  assert.equal(app.document.querySelector("p").getAttribute("style"), "color:red;scroll-margin-top:7px!important");
  app.frame();
  assert.equal(app.document.querySelector("p").getAttribute("style"), "color:red;scroll-margin-top:7px!important");
});

test("scroll cleanup preserves page edits and repeated navigation never retains Steal margins", (t) => {
  const app = inspect(t, '<main id="pick"><p>Child</p></main>');
  const child = app.document.querySelector("p");
  app.toggle();
  app.key("ArrowRight");
  app.key("ArrowLeft");
  app.key("ArrowRight");
  child.style.color = "blue";
  child.style.setProperty("scroll-margin-top", "13px");
  app.frame();
  app.key("Enter");
  assert.equal(app.writes[0].text, '<p style="scroll-margin-top: 13px; color: blue;">Child</p>');
  assert.equal(app.document.querySelector("main").hasAttribute("style"), false);
});

test("an earlier success toast is excluded from the next body copy", async (t) => {
  const app = inspect(t);
  app.toggle();
  app.key("Enter");
  app.writes[0].resolve();
  await settle();
  assert.equal(app.document.querySelector(".ic-toast").textContent, "✓ Copied button#pick");
  app.toggle();
  app.point(app.document.body);
  app.key("Enter");
  assert.equal(app.writes[1].text, '<body><button id="pick">Pick me</button></body>');
});

test("a page-owned inspect class and an absent class attribute both survive inspection", (t) => {
  for (const attr of ['', ' class=""', ' class="ic-active site"']) {
    const app = inspect(t, `<html${attr}><head></head><body>Page</body></html>`);
    app.toggle();
    app.point(app.document.documentElement);
    app.key("Enter");
    assert.equal(app.writes[0].text, `<html${attr}><head></head><body>Page</body></html>`);
    app.key("Escape");
    assert.equal(app.document.documentElement.outerHTML, `<html${attr}><head></head><body>Page</body></html>`);
  }
});

test("ordinary page elements with Steal's ID are selectable and their clicks are suppressed", (t) => {
  const app = inspect(t, '<button id="__inspect_copy_ui">Page button</button>');
  const button = app.document.querySelector("button");
  let pageClicks = 0;
  button.addEventListener("click", () => pageClicks++);
  app.toggle();
  app.point(button);
  const click = new app.window.MouseEvent("click", { bubbles: true, cancelable: true });
  button.dispatchEvent(click);
  assert.equal(app.writes[0].text, '<button id="__inspect_copy_ui">Page button</button>');
  assert.equal(click.defaultPrevented, true);
  assert.equal(pageClicks, 0);
  app.key("Escape");
  button.click();
  assert.equal(pageClicks, 1);
});

test("the fallback writes the same page HTML when the primary clipboard is absent", async (t) => {
  const app = inspect(t);
  app.window.navigator.clipboard.writeText = undefined;
  let copied;
  app.document.execCommand = () => {
    copied = app.document.querySelector("textarea").value;
    return true;
  };
  app.toggle();
  app.key("Enter");
  await settle();
  assert.equal(copied, '<button id="pick">Pick me</button>');
  assert.equal(app.document.querySelector("textarea"), null);
  assert.equal(app.messages.at(-1), "inspect:ended");
});
