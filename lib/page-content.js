// Owns Steal's additions to the page and captures HTML without those additions.
// Loaded before content.js; each controller keeps its own ownership records.
(() => {
  function createPageContent() {
    const roots = new WeakSet();
    let inspectClass = null;
    const scrollChanges = new Map();

    function restoreScrollStyle(el, change) {
      if (el.getAttribute("style") === change.applied) {
        restoreAttribute(el, "style", change.original);
      } else {
        // Preserve page edits made since scrolling, including !important.
        for (const [name, previous] of change.properties) {
          if (el.style.getPropertyValue(name) === change.margin &&
              el.style.getPropertyPriority(name) === "") {
            el.style.setProperty(name, previous.value, previous.priority);
          }
        }
      }
    }

    function finishScroll(el, change) {
      if (scrollChanges.get(el) !== change) return;
      restoreScrollStyle(el, change);
      scrollChanges.delete(el);
    }

    function scrollIntoView(el, options, margin) {
      // Repeated arrows must never save our previous margin as page content.
      if (scrollChanges.has(el)) finishScroll(el, scrollChanges.get(el));
      const change = {
        original: el.getAttribute("style"),
        margin: margin + "px",
        properties: ["scroll-margin-top", "scroll-margin-bottom"].map((name) => [name, {
          value: el.style.getPropertyValue(name),
          priority: el.style.getPropertyPriority(name),
        }]),
      };
      for (const [name] of change.properties) el.style.setProperty(name, change.margin);
      change.applied = el.getAttribute("style");
      scrollChanges.set(el, change);
      try {
        el.scrollIntoView(options);
      } catch (error) {
        finishScroll(el, change);
        throw error;
      }
      requestAnimationFrame(() => finishScroll(el, change));
    }

    function restoreAttribute(el, name, value) {
      if (value === null) el.removeAttribute(name);
      else el.setAttribute(name, value);
    }

    function restoreInspectClass(el) {
      if (el.getAttribute("class") === inspectClass.applied) {
        restoreAttribute(el, "class", inspectClass.original);
      } else if (el.classList.contains("ic-active")) {
        // The page changed its classes while inspecting. Remove only our token.
        el.classList.remove("ic-active");
        if (el.className === "" && inspectClass.original === null) el.removeAttribute("class");
      }
    }

    function setInspecting(on) {
      if (on) {
        const el = document.documentElement;
        if (inspectClass || el.classList.contains("ic-active")) return;
        const original = el.getAttribute("class");
        el.classList.add("ic-active");
        inspectClass = { el, original, applied: el.getAttribute("class") };
      } else {
        if (inspectClass) {
          restoreInspectClass(inspectClass.el);
          inspectClass = null;
        }
        for (const [el, change] of scrollChanges) finishScroll(el, change);
      }
    }

    function mount(root) {
      roots.add(root);
      (document.body || document.documentElement).appendChild(root);
    }

    function isOwnNode(el) {
      for (let node = el; node; node = node.parentElement) {
        if (roots.has(node)) return true;
      }
      return false;
    }

    function capture(el) {
      const copy = el.cloneNode(true);
      // Match by position before removing anything; page-owned IDs and classes
      // may have the same names as ours and must survive unchanged.
      const originals = [el, ...el.querySelectorAll("*")];
      const copies = [copy, ...copy.querySelectorAll("*")];
      originals.forEach((node, index) => {
        if (roots.has(node)) copies[index].remove();
        if (inspectClass && node === inspectClass.el) restoreInspectClass(copies[index]);
        if (scrollChanges.has(node)) restoreScrollStyle(copies[index], scrollChanges.get(node));
      });
      return copy.outerHTML;
    }

    return { mount, isOwnNode, capture, setInspecting, scrollIntoView };
  }

  window.__inspectCopyPage = { createPageContent };
})();
