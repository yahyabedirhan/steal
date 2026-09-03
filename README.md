# Steal

A lightweight Chrome extension. Click the toolbar icon, point at any element on
the page, and its raw `outerHTML` lands on your clipboard. The name is a joke;
it only touches your clipboard.

## Use

1. Click the **Steal** toolbar icon. An `ON` badge appears and the page
   shows a crosshair cursor.
2. Move the mouse. The element under the cursor is highlighted with a blue box
   and a `tag#id.class` label.
3. Fine-tune without the mouse using the arrow keys:
   - **↑ / ↓** previous / next element sibling
   - **←** parent element
   - **→** first child element
4. **Click** the element, or press **Enter**, to copy its `outerHTML`. A small
   toast confirms, and inspect mode turns off.
5. Press **Esc** or click the toolbar icon again to leave without copying.

Moving the mouse always re-selects whatever is under the cursor, discarding any
arrow-key traversal.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and choose this folder.
4. Pin the icon from the puzzle-piece menu.

### After changing the code

- Click the reload icon on the extension card in `chrome://extensions`.
- Reload any page you want to test on (the content script is injected fresh each
  activation and does not hot-update an already-open page).

The extension stays installed across restarts as long as this folder stays put.
If you move it, re-run **Load unpacked** from the new location.

## Development

- No build step. The source files are the shipped files.
- `npm test` runs the pure-logic unit tests (`node --test`, no dependencies).
- `npm run gen-icons` regenerates the placeholder crosshair icons
  (`tools/gen-icons.py`, standard library only).
- `demo.html` is a manual test page with nested lists, links, and buttons.

## Layout

| File | Role |
| --- | --- |
| `manifest.json` | MV3 manifest. `activeTab` + `scripting` only, no host permissions. |
| `background.js` | Service worker. Injects the content script on icon click, keeps the `ON` badge in sync. |
| `lib/dom-nav.js` | Pure helpers: `nextTarget(node, direction)` and `describeElement(el)`. Also `require()`-able in Node. |
| `content.js` | Inspect-mode controller: overlay, label, keyboard traversal, click suppression, clipboard write, toast. |
| `content.css` | Scoped, defensive styles for the overlay / label / toast. |
| `test/dom-nav.test.js` | Unit tests for the pure helpers. |

## Not included (v1)

iframes / cross-origin frames, HTML pretty-printing, copying selectors or XPath,
an options page, non-Chromium browsers. See `.specs/00-steal.md`.
