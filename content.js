// Injected on demand by background.js. Runs an inspect mode: highlight the
// element under the cursor (or reachable by arrow keys), and on click / Enter
// copy its page HTML to the clipboard, then exit.

(() => {
  const UI_ID = "__inspect_copy_ui";

  // Pure DOM helpers live in lib/dom-nav.js (injected first) so they can be
  // unit-tested in Node.
  const { nextTarget, describeElement, isSkippable } = window.__inspectCopyNav;
  const { serialize } = window.__inspectCopySerialize;
  const FORMATS = window.__inspectCopyFormats;
  const FORMAT_STORAGE_KEY = "activeFormatId";

  // A format's transform() may return either a DOM node (Full HTML, Clean
  // HTML) or a string directly (Plain Text). Only the node case needs
  // lib/serialize.js.
  function stringifyFormatOutput(output) {
    return output && output.nodeType === 1 ? serialize(output) : output;
  }

  // Paint (fill/stroke/etc.) is set in content.css, not here — a plain
  // attribute here would lose to the "all: initial" reset every element
  // under #__inspect_copy_ui gets, same as any other CSS property.
  //
  // Geometry (d, cx/cy/r) is a plain attribute AND set again inline via
  // `style`: Chrome treats these as CSS properties too, and "all: initial"
  // resets them like anything else — but unlike paint, the shape differs
  // per icon, so each is repeated inline here rather than shared in
  // content.css. Inline style beats any external rule regardless of
  // specificity, so this survives the reset without it (or the rules that
  // depend on its specificity) needing to change at all.
  const ICONS = {
    "full-html": '<svg viewBox="0 0 24 24"><path d="M8 5 3 12l5 7M16 5l5 7-5 7" style="d:path(\'M8 5 3 12l5 7M16 5l5 7-5 7\')"/></svg>',
    "clean-html": '<svg viewBox="0 0 24 24"><path d="M8 5 3 12l5 7M16 5l5 7-5 7" style="d:path(\'M8 5 3 12l5 7M16 5l5 7-5 7\')"/><circle class="ic-icon-dot" cx="12" cy="12" r="1.6" style="cx:12px;cy:12px;r:1.6px"/></svg>',
    "plain-text": '<svg viewBox="0 0 24 24"><path d="M5 6h14M12 6v13" style="d:path(\'M5 6h14M12 6v13\')"/></svg>',
  };

  // --- Double-init guard -----------------------------------------------------

  // Re-injected on every toolbar click. Once loaded, the background's
  // "inspect:toggle" message is the single source of truth, so just bail.
  if (window.__inspectCopyController) return;

  // --- Controller ----------------------------------------------------------

  const controller = (() => {
    const page = window.__inspectCopyPage.createPageContent();
    let session = null;
    let target = null;
    let lastMouse = { x: 0, y: 0 };
    let ui = null; // { root, overlay, label }
    // Caches showLength's transform+serialize by (target, format): drawOverlay
    // also runs on scroll/resize, where the target hasn't changed, so this
    // keeps the expensive part to once per genuine target/format change.
    let lengthCache = null; // { target, formatId, length }

    function buildUi() {
      const root = document.createElement("div");
      root.id = UI_ID;
      root.setAttribute("data-inspect-copy", "");

      const overlay = document.createElement("div");
      overlay.className = "ic-overlay";

      const label = document.createElement("div");
      label.className = "ic-label";
      const labelIcon = document.createElement("span");
      labelIcon.className = "ic-label-icon";
      const labelText = document.createElement("span");
      labelText.className = "ic-label-text";
      label.appendChild(labelIcon);
      label.appendChild(labelText);

      root.appendChild(overlay);
      root.appendChild(label);
      page.mount(root);
      return { root, overlay, label, labelIcon, labelText };
    }

    function isOwnNode(el) {
      return page.isOwnNode(el);
    }

    // Arrow navigation skips document metadata (via isSkippable) and the
    // extension's own overlay nodes.
    function skipForNav(el) {
      return isSkippable(el) || isOwnNode(el);
    }

    function setTarget(el) {
      if (!el || el.nodeType !== 1 || isOwnNode(el) || el === target) return;
      target = el;
      drawOverlay();
    }

    // Builds the hover label's text for the currently active format. Purely
    // data-driven off the format's own showDescriptor/showDimensions/
    // showLength fields — no branching here on which format is active, so a
    // future format needs only to set those fields, not touch this function.
    function buildLabelText(format, r) {
      const parts = [];
      if (format.showDescriptor === "full") parts.push(describeElement(target));
      else if (format.showDescriptor === "tag") parts.push(target.tagName.toLowerCase());
      if (format.showDimensions) parts.push(Math.round(r.width) + "×" + Math.round(r.height));
      let text = parts.join("  ");
      if (format.showLength) {
        if (!lengthCache || lengthCache.target !== target || lengthCache.formatId !== format.id) {
          const output = format.transform(page.capture(target));
          lengthCache = { target, formatId: format.id, length: stringifyFormatOutput(output).length };
        }
        text += (text ? "  ·  " : "") + lengthCache.length + " chars";
      }
      return text;
    }

    function drawOverlay() {
      if (!target || !ui) return;
      const r = target.getBoundingClientRect();
      const o = ui.overlay.style;
      o.display = "block";
      o.top = r.top + "px";
      o.left = r.left + "px";
      o.width = Math.max(0, r.width) + "px";
      o.height = Math.max(0, r.height) + "px";

      const format = session.format;
      if (ui.label.dataset.icon !== format.id) {
        ui.labelIcon.innerHTML = ICONS[format.id] || "";
        ui.label.dataset.icon = format.id;
      }
      ui.labelText.textContent = buildLabelText(format, r);
      ui.label.style.display = "flex";
      // Place the label just above the box, or just below if there is no room.
      const labelH = 20;
      let ly = r.top - labelH - 2;
      if (ly < 0) ly = r.bottom + 2;
      ui.label.style.top = ly + "px";
      ui.label.style.left = Math.max(0, r.left) + "px";
    }

    function showToast(text, x, y, isError) {
      if (!ui) return;
      const toast = document.createElement("div");
      toast.className = "ic-toast" + (isError ? " ic-toast-error" : "");
      toast.textContent = (isError ? "✕ " : "✓ ") + text;
      ui.root.appendChild(toast);
      // Clamp into the viewport.
      const tx = Math.min(Math.max(8, x), window.innerWidth - 8);
      const ty = Math.min(Math.max(8, y), window.innerHeight - 8);
      toast.style.left = tx + "px";
      toast.style.top = ty + "px";
      requestAnimationFrame(() => toast.classList.add("ic-toast-in"));
      setTimeout(() => {
        toast.classList.remove("ic-toast-in");
        setTimeout(() => toast.remove(), 250);
      }, 1200);
    }

    async function copyText(text, owner) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (e) {
        /* fall through to execCommand */
      }
      let ta;
      try {
        if (session !== owner) return false;
        ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        ta.style.opacity = "0";
        ui.root.appendChild(ta);
        ta.select();
        return document.execCommand("copy");
      } catch (e) {
        return false;
      } finally {
        if (ta) ta.remove();
      }
    }

    async function doCopy(originX, originY) {
      if (!target || !session || session.copying) return;
      const owner = session;
      const desc = describeElement(target);
      const output = owner.format.transform(page.capture(target));
      const html = stringifyFormatOutput(output);
      owner.copying = true;
      const ok = await copyText(html, owner);
      if (session !== owner) return; // This inspection ended while copying.
      owner.copying = false;
      if (ok) {
        showToast("Copied " + desc, originX, originY, false);
        // Let the toast render, then exit.
        stop("copied");
      } else {
        showToast("Copy failed", originX, originY, true);
      }
    }

    // --- Event handlers (capture phase) -----------------------------------

    function onMouseMove(e) {
      lastMouse = { x: e.clientX, y: e.clientY };
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && !isOwnNode(el)) setTarget(el);
    }

    function swallow(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    function onClick(e) {
      swallow(e);
      doCopy(e.clientX, e.clientY);
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        stop("escape");
        return;
      }

      const format = FORMATS.find((f) => f.key === e.key);
      if (format) {
        e.preventDefault();
        e.stopPropagation();
        if (session.format !== format) {
          session.format = format;
          drawOverlay();
          setStoredFormat(format.id);
        }
        return;
      }

      const dirs = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };

      if (e.key in dirs) {
        e.preventDefault();
        e.stopPropagation();
        const next = nextTarget(target, dirs[e.key], skipForNav);
        if (next) {
          target = next;
          drawOverlay();
          scrollTargetIntoView();
        }
        return;
      }

      if (e.key === " " || e.code === "Space") {
        // Only intercepted to stop the page scrolling.
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (target) {
          const r = target.getBoundingClientRect();
          doCopy(r.left + Math.min(r.width, 40), Math.max(0, r.top));
        }
      }
    }

    // Breathing room to leave between a scrolled-to target and the viewport
    // edge it lands against (also keeps it clear of a fixed page header).
    const SCROLL_MARGIN = 96;

    function scrollTargetIntoView() {
      if (!target) return;
      const r = target.getBoundingClientRect();
      const vh = window.innerHeight;
      const above = r.top < SCROLL_MARGIN;
      const below = r.bottom > vh - SCROLL_MARGIN;
      const offSide = r.left < 0 || r.right > window.innerWidth;
      if (!above && !below && !offSide) return;

      // scrollIntoView walks up to the nearest scrollable ancestor (a plain
      // window.scrollBy would miss elements inside a scroll container).
      // scroll-margin gives it the gap it otherwise has no option for.
      // Align to whichever edge the target went past so the page keeps its
      // natural scroll direction; if the target is taller than the viewport,
      // fall back to aligning its top.
      const tallerThanViewport = r.height + SCROLL_MARGIN * 2 > vh;
      const toEnd = below && !above && !tallerThanViewport;

      page.scrollIntoView(target, { block: toEnd ? "end" : "start", inline: "nearest" }, SCROLL_MARGIN);
      const owner = session;
      requestAnimationFrame(() => { if (session === owner) drawOverlay(); });
    }

    function onScrollOrResize() {
      drawOverlay();
    }

    // --- Lifecycle -------------------------------------------------------

    // All in the capture phase, so we see events before the page does.
    const LISTENERS = [
      ["mousemove", onMouseMove],
      ["mousedown", swallow],
      ["mouseup", swallow],
      ["click", onClick],
      ["keydown", onKeyDown],
      ["scroll", onScrollOrResize],
      ["resize", onScrollOrResize],
    ];

    function setStoredFormat(id) {
      try {
        chrome.storage.local.set({ [FORMAT_STORAGE_KEY]: id });
      } catch (e) {
        // Extension context invalidated (e.g. reloaded). Nothing to do.
      }
    }

    function start() {
      if (session) return;
      const owner = session = { copying: false, format: FORMATS[0] };
      ui = buildUi();
      target = null;

      for (const [type, fn] of LISTENERS) window.addEventListener(type, fn, true);
      page.setInspecting(true);

      // Seed the target from the current pointer position if we can.
      const el = document.elementFromPoint(lastMouse.x, lastMouse.y);
      if (el && !isOwnNode(el)) setTarget(el);

      // Restore the last-used format once storage answers; if the session
      // already ended or moved on to a different format by then, drop it.
      try {
        chrome.storage.local.get([FORMAT_STORAGE_KEY], (result) => {
          if (session !== owner || owner.format !== FORMATS[0]) return;
          const stored = FORMATS.find((f) => f.id === result[FORMAT_STORAGE_KEY]);
          if (stored) {
            owner.format = stored;
            drawOverlay();
          }
        });
      } catch (e) {
        // Extension context invalidated (e.g. reloaded). Stay on the default.
      }

      notify("inspect:started");
    }

    function stop(reason) {
      if (!session) return;
      session = null;

      for (const [type, fn] of LISTENERS) window.removeEventListener(type, fn, true);
      page.setInspecting(false);
      target = null;
      lengthCache = null;

      const root = ui && ui.root;
      ui = null;
      if (root) {
        if (reason === "copied") {
          // A "Copied" toast is animating inside root. Drop the picker chrome
          // now, then remove the whole node once the toast has faded.
          for (const sel of [".ic-overlay", ".ic-label"]) {
            const n = root.querySelector(sel);
            if (n) n.style.display = "none";
          }
          setTimeout(() => root.remove(), 1600);
        } else {
          // Esc / toggle-off: nothing to wait for, remove immediately.
          root.remove();
        }
      }

      notify("inspect:ended");
    }

    function notify(type) {
      try {
        chrome.runtime.sendMessage({ type });
      } catch (e) {
        // Extension context invalidated (e.g. reloaded). Nothing to do.
      }
    }

    function toggle() {
      if (session) stop("toggle");
      else start();
    }

    return { toggle };
  })();

  window.__inspectCopyController = controller;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "inspect:toggle") controller.toggle();
  });
})();
