// Injected on demand by background.js. Runs an inspect mode: highlight the
// element under the cursor (or reachable by arrow keys), and on click / Enter
// copy its raw outerHTML to the clipboard, then exit.

(() => {
  const UI_ID = "__inspect_copy_ui";

  // Pure DOM helpers live in lib/dom-nav.js (injected first) so they can be
  // unit-tested in Node.
  const { nextTarget, describeElement } = window.__inspectCopyNav;

  // --- Double-init guard -----------------------------------------------------

  // Re-injected on every toolbar click. Once loaded, the background's
  // "inspect:toggle" message is the single source of truth, so just bail.
  if (window.__inspectCopyController) return;

  // --- Controller ----------------------------------------------------------

  const controller = (() => {
    let active = false;
    let target = null;
    let lastMouse = { x: 0, y: 0 };
    let ui = null; // { root, overlay, label }

    function buildUi() {
      const root = document.createElement("div");
      root.id = UI_ID;
      root.setAttribute("data-inspect-copy", "");

      const overlay = document.createElement("div");
      overlay.className = "ic-overlay";

      const label = document.createElement("div");
      label.className = "ic-label";

      root.appendChild(overlay);
      root.appendChild(label);
      (document.body || document.documentElement).appendChild(root);
      return { root, overlay, label };
    }

    function isOwnNode(el) {
      return !!(el && el.closest && el.closest("#" + UI_ID));
    }

    function setTarget(el) {
      if (!el || el.nodeType !== 1 || isOwnNode(el)) return;
      target = el;
      drawOverlay();
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

      ui.label.textContent = describeElement(target) +
        "  " + Math.round(r.width) + "×" + Math.round(r.height);
      ui.label.style.display = "block";
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

    async function copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (e) {
        /* fall through to execCommand */
      }
      try {
        if (!ui) return false;
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        ta.style.opacity = "0";
        ui.root.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch (e) {
        return false;
      }
    }

    async function doCopy(originX, originY) {
      if (!target || !ui) return;
      const desc = describeElement(target);
      const html = target.outerHTML;
      const ok = await copyText(html);
      if (!ui) return; // exited mid-copy (Esc)
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

      const dirs = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };

      if (e.key in dirs) {
        e.preventDefault();
        e.stopPropagation();
        const next = nextTarget(target, dirs[e.key]);
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

    // Space to leave above a target that we scroll into view, so it never lands
    // flush against the top edge (or under a fixed page header).
    const SCROLL_MARGIN_TOP = 96;

    function scrollTargetIntoView() {
      if (!target) return;
      const r = target.getBoundingClientRect();
      const fullyVisible =
        r.top >= SCROLL_MARGIN_TOP && r.left >= 0 &&
        r.bottom <= window.innerHeight && r.right <= window.innerWidth;
      if (fullyVisible) return;

      // scrollIntoView has no padding option, so scroll the window manually:
      // land the target's top SCROLL_MARGIN_TOP px below the viewport top.
      let dx = 0;
      if (r.left < 0) dx = r.left - 8;
      else if (r.right > window.innerWidth) dx = Math.min(r.left - 8, r.right - window.innerWidth + 8);
      window.scrollBy({ top: r.top - SCROLL_MARGIN_TOP, left: dx, behavior: "auto" });
      // Re-draw after the scroll settles.
      requestAnimationFrame(drawOverlay);
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

    function start() {
      if (active) return;
      active = true;
      ui = buildUi();
      target = null;

      for (const [type, fn] of LISTENERS) window.addEventListener(type, fn, true);
      document.documentElement.classList.add("ic-active");

      // Seed the target from the current pointer position if we can.
      const el = document.elementFromPoint(lastMouse.x, lastMouse.y);
      if (el && !isOwnNode(el)) setTarget(el);

      notify("inspect:started");
    }

    function stop(_reason) {
      if (!active) return;
      active = false;

      for (const [type, fn] of LISTENERS) window.removeEventListener(type, fn, true);
      document.documentElement.classList.remove("ic-active");
      target = null;

      // Keep the root around briefly so a "Copied" toast can finish animating.
      const root = ui && ui.root;
      ui = null;
      if (root) {
        setTimeout(() => root.remove(), 1600);
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
      if (active) stop("toggle");
      else start();
    }

    return { toggle, start, stop, isActive: () => active };
  })();

  window.__inspectCopyController = controller;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "inspect:toggle") controller.toggle();
  });
})();
