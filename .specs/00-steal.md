# 00 - Steal

Status: decided, not yet implemented
Date: 2026-09-03

A written record of the design decisions made in conversation before implementation starts.

## Problem Statement

When I am looking at a web page and want the HTML for one specific element, the
Chrome DevTools workflow is heavier than the task deserves. I have to open
DevTools, use the element picker, find the node in the Elements panel, right-click
it, and choose Copy > Copy element. I want a one-key way to point at an element on
the page and get its HTML onto my clipboard.

## Solution

A small Chrome extension. I click its toolbar icon to turn on "inspect mode" for
the current tab. As I move the mouse, the element under the cursor is highlighted
with a translucent overlay and a label telling me what it is. I can also nudge the
current selection around the DOM tree with the arrow keys without moving the
mouse. When I click the element, or press Enter, its raw `outerHTML` is copied to
the clipboard, a small toast confirms what was copied, and inspect mode turns
itself off.

## User Stories

1. As a user, I want to toggle inspect mode from the extension's toolbar icon, so that I do not need to open DevTools.
2. As a user, I want the toolbar icon to show an `ON` badge while inspect mode is active, so that I can tell at a glance whether it is running.
3. As a user, I want clicking the toolbar icon again to turn inspect mode off, so that I can cancel without selecting anything.
4. As a user, I want inspect mode to apply only to the tab I activated it on, so that other tabs are unaffected.
5. As a user, I want the element under my cursor to be highlighted with a translucent overlay matching its bounding box, so that I can see exactly what will be copied.
6. As a user, I want a floating label showing the element's tag name, its id, and its classes, so that I can confirm I have the right element.
7. As a user, I want the highlight overlay to not intercept my mouse, so that moving the cursor still reflects the true element underneath.
8. As a user, I want only one element selected at any time, so that the interaction stays simple.
9. As a user, I want to press the Up arrow to move the selection to the previous element sibling, or to the parent when there is no previous sibling, so that Up always steps somewhere sensible.
10. As a user, I want to press the Down arrow to move the selection to the next element sibling, or, when the current element has none, to the nearest following element of an ancestor, so that a lone child still steps forward instead of dead-ending.
11. As a user, I want to press the Left arrow to move the selection to the parent element, so that I can widen the selection to a container.
12. As a user, I want to press the Right arrow to move the selection to the first element child, so that I can narrow into a container.
13. As a user, I want arrow traversal to skip text and comment nodes and only land on element nodes, so that the selection is always something copyable.
13a. As a user, I want arrow traversal to skip document-metadata elements (`head`, `meta`, `title`, `script`, `link`, `style`, `base`, `noscript`) and the extension's own overlay, so that pressing Right on `html` lands on `body` and I never end up inside `head`.
14. As a user, I want arrow presses at the edges of the tree to do nothing (no wrap-around), so that I do not lose my place unexpectedly.
15. As a user, I want the selected element to scroll into view when arrow navigation lands on something offscreen, so that I can always see the highlight.
16. As a user, I want the arrow keys and Space to not scroll the page while inspect mode is active, so that navigation and scrolling do not fight each other.
17. As a user, I want moving the mouse again to immediately re-select the element under the cursor and discard any keyboard traversal state, so that the mouse is always authoritative when I use it.
18. As a user, I want to click the highlighted element to copy it, so that the interaction matches how I already point at things.
19. As a user, I want to press Enter to copy the current selection, so that I can finish a keyboard-only traversal without reaching for the mouse.
20. As a user, I want my click to be fully suppressed on the page (no link navigation, no button activation), so that inspecting never triggers the page's own behavior.
21. As a user, I want the element's raw `outerHTML` copied exactly as it appears in the DOM, so that I get the same thing DevTools "Copy element" gives me.
22. As a user, I want a small toast at my cursor position confirming the copy, showing the tag, id, and classes of what was copied, so that I have immediate feedback.
23. As a user, I want the toast to fade away on its own after about a second, so that it does not get in my way.
24. As a user, I want inspect mode to turn itself off after a successful copy, so that the page returns to normal without another step.
25. As a user, I want to press Esc to leave inspect mode without copying anything, so that I can back out at any time.
26. As a user, I want the extension's own overlay, label, and toast to never be selectable or copyable, so that I only ever get real page content.
27. As a user, I want the extension to ask for as few permissions as possible, so that I am comfortable running it.
28. As a user, I want to load the extension into Chrome myself as an unpacked extension, so that I can use it without publishing it anywhere.
29. As a user, I want clear instructions for loading and reloading the extension, so that I can install it and pick up changes.

## Implementation Decisions

### Platform and packaging

- Chrome Manifest V3 extension.
- Plain JavaScript, HTML, and CSS. No bundler, no TypeScript, no build step. The source files are the shipped files.
- Components: `manifest.json`, a service worker (`background.js`), a content script (`content.js`), a content stylesheet (`content.css`), and generated icon PNGs at 16, 48, and 128 px.
- Icons are a simple generated crosshair/target glyph, treated as placeholder art.

### Permissions

- `activeTab` and `scripting` only.
- No declared content scripts and no host permissions in the manifest. The content script and stylesheet are injected on demand with `chrome.scripting` when the user clicks the toolbar icon.

### Activation and lifecycle

- The toolbar icon (an `action` with no popup) is the only entry point. Its click is handled in the service worker.
- On click, the service worker injects `content.css` and `content.js` into the active tab (if not already injected) and sends a message toggling inspect mode.
- While inspect mode is active on a tab, the service worker sets an `ON` badge on the action for that tab. The badge is cleared when inspect mode ends, by any route.
- Inspect mode ends on: a successful copy, an Esc keypress, or another toolbar icon click. The content script notifies the service worker so the badge stays in sync.
- Injecting a second time into a tab that already has the content script must not create duplicate listeners or overlays. The content script guards against double-initialization; repeat activations just toggle a flag.

### Selection model

- Exactly one "current target" element at a time, held in the content script.
- `mousemove` sets the current target to `document.elementFromPoint` at the cursor, and clears any keyboard traversal state. The mouse is authoritative whenever it moves.
- Arrow keys move the current target relative to its present value:
  - Up: previous element sibling; if there is none, the parent element. No-op only at `<html>`.
  - Down: next element sibling; if there is none, walk up the ancestor chain and take the first ancestor's next element sibling. No-op only when nothing follows anywhere.
  - Left: parent element, stopping at `<html>` (never `document` or above), or no-op.
  - Right: first element child, or no-op on a leaf.
- Traversal considers element nodes only; text and comment nodes are never targets. It also skips document-metadata tags (`head`, `meta`, `title`, `script`, `link`, `style`, `base`, `noscript`) and the extension's own overlay container, in every direction. So Right on `<html>` skips `<head>` and lands on `<body>`, and Up from `<body>` skips the `<head>` subtree and lands on `<html>`.
- The traversal logic is a pure function, `nextTarget(node, direction, skip)`, in `lib/dom-nav.js`; the content script passes a `skip` predicate that combines the default metadata check with an "is this our own overlay" check.
- No wrap-around at any edge.
- After an arrow move, if the new target is not fully in the viewport (or its top is within 96 px of the viewport top), scroll the window so the target's top sits 96 px below the viewport top, plus a small horizontal nudge if it is off to the side. The 96 px gap keeps the target clear of the top edge and of any fixed page header. `scrollIntoView` is not used because it has no padding option.
- `keydown` for the four arrows and for Space calls `preventDefault()` while inspect mode is active, so the page does not scroll.
- The extension's own DOM nodes (overlay, label, toast, and their container) carry a marker and are excluded from selection. When `elementFromPoint` returns one of them, it is ignored. The overlay and label are also `pointer-events: none`, which prevents this in the common case; the marker check covers the rest.

### Highlight overlay and label

- A single container element appended to `document.body` (or `documentElement` if there is no body), holding the overlay box, the label, and later the toast.
- The overlay is a positioned box whose rect is updated from `target.getBoundingClientRect()` on every target change and on scroll/resize while active. Translucent fill plus a solid border. `pointer-events: none`.
- The label is a small floating box positioned near the overlay showing `tagname#id.class1.class2` built from the target, followed by its rounded pixel dimensions. If the element has no id or classes, just the tag name and dimensions. The label flips to stay on screen when the target is near the top edge.
- All extension UI uses a very high `z-index` and its own class namespace to avoid clashing with page styles. Styles are scoped and defensive (explicit values, no reliance on inheritance).

### Copy

- Copy is triggered by a capture-phase `click` on the current target, or by `Enter` in `keydown`.
- To suppress the page's reaction to the click, the content script listens in the capture phase for `mousedown`, `mouseup`, and `click` while active, and calls `preventDefault()` and `stopPropagation()` (and `stopImmediatePropagation()`) on them. The copy is performed from the `click` (or `mousedown`) handler.
- The copied text is `target.outerHTML`, unmodified.
- Clipboard write: `navigator.clipboard.writeText(html)`. This is allowed because the copy happens inside a user-gesture handler. On failure or absence, fall back to creating an off-screen `<textarea>`, selecting it, and calling `document.execCommand('copy')`.
- On a successful write: show the toast, then end inspect mode (remove listeners, remove the overlay container after the toast finishes, clear the badge).
- On a failed write (both methods): show an error toast and leave inspect mode active so the user can retry.

### Toast

- Appended inside the extension container. Positioned at the pointer location for a mouse copy, or near the current target for an Enter copy.
- Content: `✓ Copied ` followed by the same `tag#id.class` string used in the label.
- Fades out via a CSS transition after roughly 1.2 s, then is removed from the DOM.
- The toast is `pointer-events: none` and never selectable.

### Messaging

- `background.js` <-> `content.js` over `chrome.runtime` messages.
- Message types (names indicative, not binding): toggle inspect mode (background to content), inspect mode started / inspect mode ended (content to background, for badge sync).
- The service worker keeps per-tab active state keyed by tab id so the badge is correct when the user switches tabs. State is cleared on tab close and on navigation (the injected script does not survive a page load, so a fresh activation is required after navigating).

## Testing Decisions

This is a small, DOM- and browser-API-heavy extension with no existing test
suite and no build tooling. A good test here exercises externally observable
behavior (what ends up on the clipboard, which element is highlighted, whether
inspect mode is on) and not the internal shape of the content script.

- Primary verification is manual, against a checklist derived from the user
  stories, using the local unpacked extension in Chrome. This is the highest and
  only natural seam for the click-suppression and clipboard-gesture behavior,
  which cannot be reproduced faithfully outside a real browser.
- The one piece worth isolating as a pure function is DOM traversal: given a
  node and a direction (up/down/left/right), return the next target or null.
  This has clear inputs and outputs, all the edge cases (no sibling, parent is
  `<html>`, leaf node, text nodes interleaved), and no browser APIs beyond
  standard DOM. If a test runner is added later, it is tested with jsdom by
  building a small fixture tree and asserting the returned node for each
  direction from several starting points. Until then it is structured as a
  standalone function so it stays trivially testable.
- The `tag#id.class` label/toast string builder is likewise a pure function of
  an element and is checked the same way (element with id and classes, id only,
  classes only, neither).
- No prior art in this repo; this is a new standalone project.

## Deployment

"Deploy" here means getting the extension into my own Chrome. There is no server
and nothing is published.

### Local unpacked install (the primary method)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the
   `personal-projects/steal/` folder.
4. The extension appears with its crosshair icon. Pin it from the puzzle-piece
   menu so the toolbar icon is always visible.

### Picking up changes

- After editing any file, return to `chrome://extensions` and click the reload
  (circular arrow) icon on the extension's card.
- Reload the target web page too, because the content script is injected fresh
  each activation and old injected code does not update in an already-open page.
- Changes to `background.js` take effect on the extension reload; changes to
  `content.js` / `content.css` take effect on the next activation in a tab.

### Keeping it available long-term

- An unpacked extension stays installed across Chrome restarts as long as the
  source folder stays where it is. Moving or deleting the folder disables it.
- Because it lives inside the job-search vault for now, it will keep working from
  that path. If it is later moved to its own repo, re-run **Load unpacked** from
  the new location (or use a symlink) and remove the old entry.
- Chrome may periodically warn about running an unpacked/developer-mode
  extension. That is expected for a personal tool and is dismissed each time.

### Options considered and not chosen

- **Packing a `.crx`**: Chrome blocks side-loaded `.crx` files that are not from
  the Web Store, so this does not actually make installation easier. Not worth it.
- **Publishing to the Chrome Web Store**: requires a developer account and a
  registration fee, a review process, and privacy disclosures. Far too heavy for
  a single-user utility. Revisit only if the extension is ever shared.
- **A dedicated "developer" Chrome profile** for the unpacked extension: a
  reasonable hygiene choice if the developer-mode warning becomes annoying, but
  optional. Noted, not required.

## Out of Scope

- iframes and cross-origin frames. v1 inspects the top document only.
- Pretty-printing or reformatting the copied HTML. It is copied raw.
- Copying anything other than `outerHTML` (no CSS selector, no XPath, no computed
  styles, no screenshots).
- Firefox, Safari, or other browsers. Chrome (and Chromium-based browsers that
  accept the same unpacked extension) only.
- A settings/options page. There is nothing to configure.
- Persisting inspect mode across page navigations or restoring the last selection.
- Multi-element selection or a selection history.
- Publishing to the Chrome Web Store.

## Further Notes

- The project folder is tracked inside the job-search vault (no nested git repo).
  It can be moved to a standalone repo later; the deployment steps cover
  re-pointing Chrome at a new path.
- Keyboard-only copy is Enter, not Space. Space is only intercepted to stop the
  page scrolling.
- If the developer-mode nag or the injection-latency on first activation turns
  out to be annoying in daily use, the fallback is to switch to a declared
  content script with an `<all_urls>` match and a broader host permission. That
  trade is deliberately deferred, not taken now.
