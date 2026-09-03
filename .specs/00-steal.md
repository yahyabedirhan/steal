# 00 - Steal

Status: implemented
Last updated: 2026-09-03

The specification of the Steal extension as it currently stands. This is the
current design, not a change log; history is in git.

## Problem Statement

When I am looking at a web page and want the HTML for one specific element, the
Chrome DevTools workflow is heavier than the task deserves. I have to open
DevTools, use the element picker, find the node in the Elements panel, right-click
it, and choose Copy > Copy element. I want a one-key way to point at an element on
the page and get its HTML onto my clipboard.

The name is a joke. The extension only ever writes to the clipboard; it sends
nothing anywhere.

## Solution

A small Chrome extension. Click its toolbar icon to turn on "inspect mode" for
the current tab. As the mouse moves, the element under the cursor is highlighted
with a translucent overlay and a label naming it. The current selection can also
be nudged around the DOM tree with the arrow keys without moving the mouse.
Clicking the element, or pressing Enter, copies its raw `outerHTML` to the
clipboard, a small toast confirms what was copied, and inspect mode turns itself
off.

## User Stories

1. As a user, I want to toggle inspect mode from the extension's toolbar icon or a keyboard shortcut, so that I do not need to open DevTools or reach for the mouse.
2. As a user, I want the toolbar icon to show an `ON` badge while inspect mode is active, so that I can tell at a glance whether it is running.
3. As a user, I want clicking the toolbar icon again to turn inspect mode off, so that I can cancel without selecting anything.
4. As a user, I want inspect mode to apply only to the tab I activated it on, so that other tabs are unaffected.
5. As a user, I want the element under my cursor to be highlighted with a translucent overlay matching its bounding box, so that I can see exactly what will be copied.
6. As a user, I want a floating label showing the element's tag name, id, classes, and pixel dimensions, so that I can confirm I have the right element.
7. As a user, I want the highlight overlay to not intercept my mouse, so that moving the cursor still reflects the true element underneath.
8. As a user, I want only one element selected at any time, so that the interaction stays simple.
9. As a user, I want to press the Up arrow to move the selection to the previous element sibling, or to the parent when there is no previous sibling, so that Up always steps somewhere sensible.
10. As a user, I want to press the Down arrow to move the selection to the next element sibling, or, when the current element has none, to the nearest following element of an ancestor, so that a lone child still steps forward instead of dead-ending.
11. As a user, I want to press the Left arrow to move the selection to the parent element, so that I can widen the selection to a container.
12. As a user, I want to press the Right arrow to move the selection to the first element child, so that I can narrow into a container.
13. As a user, I want arrow traversal to land only on element nodes, skipping text and comment nodes, so that the selection is always something copyable.
14. As a user, I want arrow traversal to skip document-metadata elements (`head`, `meta`, `title`, `script`, `link`, `style`, `base`, `noscript`) and the extension's own overlay, so that pressing Right on `html` lands on `body` and I never end up inside `head`.
15. As a user, I want arrow presses at the edges of the tree to do nothing (no wrap-around), so that I do not lose my place unexpectedly.
16. As a user, I want the selected element scrolled into view when arrow navigation lands on something offscreen, aligned to whichever edge it went past with a small margin, so that the page keeps its natural scroll direction and the highlight stays visible.
17. As a user, I want the arrow keys and Space to not scroll the page while inspect mode is active, so that navigation and scrolling do not fight each other.
18. As a user, I want moving the mouse again to immediately re-select the element under the cursor and discard any keyboard traversal state, so that the mouse is always authoritative when I use it.
19. As a user, I want to click the highlighted element to copy it, so that the interaction matches how I already point at things.
20. As a user, I want to press Enter to copy the current selection, so that I can finish a keyboard-only traversal without reaching for the mouse.
21. As a user, I want my click fully suppressed on the page (no link navigation, no button activation), so that inspecting never triggers the page's own behavior.
22. As a user, I want the element's raw `outerHTML` copied exactly as it appears in the DOM, so that I get the same thing DevTools "Copy element" gives me.
23. As a user, I want a small toast at my cursor position confirming the copy and naming what was copied, so that I have immediate feedback.
24. As a user, I want the toast to fade away on its own after about a second, so that it does not get in my way.
25. As a user, I want inspect mode to turn itself off after a successful copy, so that the page returns to normal without another step.
26. As a user, I want to press Esc to leave inspect mode without copying anything, and have the overlay disappear immediately, so that I can back out cleanly at any time.
27. As a user, I want the extension's own overlay, label, and toast to never be selectable or copyable, so that I only ever get real page content.
28. As a user, I want the extension to ask for as few permissions as possible, so that I am comfortable running it.
29. As a user, I want to load the extension into Chrome myself as an unpacked extension, so that I can use it without publishing it anywhere.
30. As a user, I want clear instructions for loading and reloading the extension, so that I can install it and pick up changes.

## Implementation Decisions

### Platform and packaging

- Chrome Manifest V3 extension.
- Plain JavaScript, HTML, and CSS. No bundler, no TypeScript, no build step. The source files are the shipped files.
- Files: `manifest.json`, a service worker (`background.js`), a content script (`content.js`), a content stylesheet (`content.css`), the pure DOM helpers (`lib/dom-nav.js`), and icon PNGs at 16, 48, and 128 px.
- Icons are a generated crosshair-snatching-a-bracket glyph (a pointer cursor lifting a `< >` pair with a motion streak), produced by `tools/gen-icons.py` — pure standard library, 4x supersampled. Placeholder art, swappable later.

### Permissions

- `activeTab` and `scripting` only.
- No declared content scripts and no host permissions in the manifest. `content.css`, `lib/dom-nav.js`, and `content.js` are injected on demand with `chrome.scripting` on activation. The `commands` key adds a keyboard shortcut and needs no permission.

### Activation and lifecycle

- Two entry points, both handled in the service worker and routed through one `toggleOnTab(tab)` function:
  - The toolbar icon (an `action` with no popup) — `chrome.action.onClicked`.
  - A keyboard command `toggle-steal`, default **Alt+Shift+S** — `chrome.commands.onCommand`. Chrome forbids a bare `Shift+S` for extension commands (a `Ctrl`/`Alt` modifier is mandatory), and the user rebinds it at `chrome://extensions/shortcuts`. The `commands` manifest key needs no permission. The listener falls back to `chrome.tabs.query({ active: true, lastFocusedWindow: true })` on older Chrome that does not pass the tab.
- `toggleOnTab` injects the stylesheet and scripts into the tab (a repeat injection is harmless), then sends a message toggling inspect mode. That message is the single source of truth for on/off state.
- While inspect mode is active on a tab, the service worker sets an `ON` badge on the action for that tab, and clears it when inspect mode ends by any route.
- Inspect mode ends on a successful copy, an Esc keypress, or another toggle (icon or shortcut). The content script notifies the service worker on start and end so the badge stays in sync; the notify call is wrapped so a stale (reloaded) extension context fails quietly.
- The content script guards against double-initialization: once loaded, a re-injection bails immediately and the toggle message drives everything.

### Selection model

- Exactly one "current target" element at a time, held in the content script.
- `mousemove` sets the current target to `document.elementFromPoint` at the cursor and discards any keyboard traversal state. The mouse is authoritative whenever it moves.
- Arrow keys move the current target relative to its present value:
  - **Up** — previous element sibling; if there is none, the parent element. No-op only at `<html>`.
  - **Down** — next element sibling; if there is none, walk up the ancestor chain and take the first ancestor that has a next element sibling. No-op only when nothing follows anywhere.
  - **Left** — parent element. Stops at `<html>` (`parentElement` is null above it).
  - **Right** — first element child. No-op on a leaf.
- Traversal lands on element nodes only. It also skips, in every direction, the document-metadata tags `head`, `meta`, `title`, `script`, `link`, `style`, `base`, `noscript`, and the extension's own overlay container. So Right on `<html>` skips `<head>` and lands on `<body>`, and Up from `<body>` skips the `<head>` subtree and lands on `<html>`.
- The traversal logic is a pure function, `nextTarget(node, direction, skip)`, in `lib/dom-nav.js`. `lib/dom-nav.js` also exports `describeElement` (the label string) and `isSkippable` (the default metadata check). The content script passes a `skip` predicate that combines `isSkippable` with an "is this our own overlay" check.
- No wrap-around at any edge.
- After an arrow move, if the new target is not fully inside the viewport minus a 96 px inset on top and bottom, it is brought into view with `scrollIntoView` on the nearest scrollable ancestor (a plain `window.scrollBy` would miss elements inside a scroll container). A temporary 96 px `scroll-margin` on the target keeps it off the viewport edge and clear of any fixed page header; the inline styles are restored on the next frame. It aligns to whichever edge the target went past — a target below the fold is bottom-aligned, a target above is top-aligned — so the page keeps its natural scroll direction. A target taller than the viewport always aligns to its top. `inline: "nearest"` handles the horizontal axis.
- `keydown` for the four arrows and for Space calls `preventDefault()` while inspect mode is active, so the page does not scroll. Space does nothing else.

### Highlight overlay and label

- A single container element (a marked `<div>` with a very high `z-index`) is appended to `document.body`, or `documentElement` if there is no body, holding the overlay box, the label, and the toast.
- The overlay is a fixed-position box whose rect is updated from `target.getBoundingClientRect()` on every target change and on scroll/resize while active. Translucent fill plus a solid border. `pointer-events: none`.
- The label is a small floating box near the overlay showing `tagname#id.class1.class2` (just the tag name when there is no id or class) followed by the target's rounded pixel dimensions. It sits just above the box, flipping to just below when the target is near the top edge.
- All extension UI is `all: initial`-reset, scoped to the container's id, and given explicit values so page styles cannot bleed in and its styles cannot leak out.

### Copy

- Copy is triggered by a capture-phase `click` on the current target, or by `Enter` in `keydown`.
- To suppress the page's reaction, the content script listens in the capture phase for `mousedown`, `mouseup`, and `click` while active and calls `preventDefault()`, `stopPropagation()`, and `stopImmediatePropagation()` on each. The copy runs from the `click` handler (or directly on `Enter`).
- The copied text is `target.outerHTML`, unmodified.
- Clipboard write: `navigator.clipboard.writeText(html)`, which is allowed because the copy runs inside a user-gesture handler. On failure or absence, it falls back to an off-screen `<textarea>` plus `document.execCommand('copy')`.
- On success: show the toast, hide the overlay and label immediately, then end inspect mode, removing the container once the toast has faded (~1.6 s).
- On failure (both methods): show an error toast and leave inspect mode active so the user can retry.
- If the user leaves inspect mode (Esc) while an async clipboard write is in flight, the copy is abandoned without a toast.

### Toast

- Appended inside the extension container at the pointer location for a mouse copy, or near the current target for an Enter copy, clamped into the viewport.
- Content: `✓ Copied ` (or `✕ ` on error) followed by the same `tag#id.class` string used in the label.
- Fades in, holds ~1.2 s, fades out, and is removed from the DOM.
- `pointer-events: none` and never selectable.

### Exit

- On a successful copy the overlay and label are hidden at once and the container is removed after the toast finishes.
- On Esc or a toolbar-icon toggle-off there is nothing to wait for, so the container is removed synchronously and the overlay disappears immediately.

### Messaging

- `background.js` <-> `content.js` over `chrome.runtime` messages: toggle (background to content), and started / ended (content to background, for badge sync). Names are indicative, not a contract.
- The service worker keeps per-tab active state keyed by tab id so the badge is correct across tab switches. State is cleared on tab close and when a tab starts loading (the injected script does not survive a navigation, so a fresh activation is needed afterward).

## Testing Decisions

A good test here exercises externally observable behavior (what lands on the
clipboard, which element is highlighted, whether inspect mode is on) and not the
internal shape of the content script.

- **Pure logic** in `lib/dom-nav.js` is unit-tested in `test/dom-nav.test.js`
  with Node's built-in runner (`npm test` → `node --test`, zero dependencies).
  Fixtures build a fake element tree — a full `<html>` with a `<head>` subtree —
  and assert the result of `nextTarget` for every direction from many starting
  points, covering the edge cases: no sibling, parent is `<html>`, leaf node,
  lone-child gap-jump, metadata skipping, custom skip predicate. `describeElement`
  and `isSkippable` are checked the same way.
- **Everything else** is verified manually against a checklist derived from the
  user stories, using the local unpacked extension in Chrome. Click-suppression
  and the clipboard user-gesture rule cannot be reproduced faithfully outside a
  real browser, so this is the only honest seam for them.
- No prior art in this repo; this is a standalone project.

## Deployment

"Deploy" means getting the extension into my own Chrome. There is no server and
nothing is published.

### Local unpacked install

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `personal-projects/steal/` folder.
4. Pin the crosshair icon from the puzzle-piece menu.

### Picking up changes

- After editing any file, click the reload (circular arrow) icon on the
  extension's card in `chrome://extensions`.
- Reload the target web page too: the content script is injected fresh each
  activation and does not hot-update an already-open page.
- `background.js` changes take effect on the extension reload; `content.js` /
  `content.css` / `lib/dom-nav.js` changes take effect on the next activation in
  a tab.
- After editing `manifest.json`, a plain reload is sometimes not enough — remove
  the entry and **Load unpacked** again.

### Keeping it available

- An unpacked extension stays installed across Chrome restarts as long as the
  source folder stays where it is. Moving or deleting the folder disables it.
- It currently lives inside the job-search vault (tracked there, no nested git
  repo). If it moves to its own repo, re-run **Load unpacked** from the new path
  (or symlink) and remove the old entry.
- Chrome periodically warns about running a developer-mode extension. Expected
  for a personal tool; dismissed each time.

### Not chosen

- **Packing a `.crx`** — Chrome blocks side-loaded `.crx` files that are not from
  the Web Store, so it does not make installation easier.
- **Publishing to the Chrome Web Store** — developer account, fee, review, and
  privacy disclosures. Far too heavy for a single-user tool. Only if it is ever
  shared.

## Out of Scope

- iframes and cross-origin frames. Top document only.
- Pretty-printing or reformatting the copied HTML. It is copied raw.
- Copying anything other than `outerHTML` — no CSS selector, XPath, computed
  styles, or screenshots.
- Firefox, Safari, and other non-Chromium browsers.
- A settings / options page. There is nothing to configure.
- Persisting inspect mode across navigations or restoring the last selection.
- Multi-element selection or a selection history.

## Further Notes

- Keyboard-only copy is Enter, not Space.
- Known escape hatch if `activeTab` injection latency or the developer-mode nag
  becomes annoying in daily use: switch to a declared content script with an
  `<all_urls>` match and a broad host permission. Not needed so far.
