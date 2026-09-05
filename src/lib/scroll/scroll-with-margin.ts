/**
 * The property-diffing math behind `MarginScroller`, as pure input/output
 * functions: no `Map`, no timing, no `requestAnimationFrame`.
 *
 * `MarginScroller` temporarily sets `scroll-margin-top` / `-bottom` on a target
 * so the browser's own `scrollIntoView` leaves breathing room, then reverts the
 * change on the next frame. Reverting has to tolerate the page editing the same
 * element's inline style in between, so it is not a plain "put the old string
 * back".
 */

const NAMES = ["scroll-margin-top", "scroll-margin-bottom"] as const;

interface PreviousProperty {
  name: string;
  value: string;
  priority: string;
}

/** Everything `restoreScrollMargin` needs to undo one `applyScrollMargin`. */
export interface ScrollMarginChange {
  /** `style` attribute text before the patch (`null` if there was no attribute). */
  original: string | null;
  /** `style` attribute text immediately after the patch. */
  applied: string | null;
  /** The value written to each margin property, e.g. `"96px"`. */
  marginValue: string;
  /** Each patched property's prior value and priority. */
  previous: PreviousProperty[];
}

/**
 * Write `marginPx` to both scroll-margin properties on `el` and return a record
 * describing exactly what changed.
 */
export function applyScrollMargin(el: Element, marginPx: number): ScrollMarginChange {
  const style = (el as HTMLElement).style;
  const marginValue = marginPx + "px";
  const previous: PreviousProperty[] = NAMES.map((name) => ({
    name,
    value: style.getPropertyValue(name),
    priority: style.getPropertyPriority(name),
  }));
  const original = el.getAttribute("style");
  for (const name of NAMES) style.setProperty(name, marginValue);
  return { original, applied: el.getAttribute("style"), marginValue, previous };
}

/**
 * Undo an `applyScrollMargin`.
 *
 * - If the `style` attribute is still byte-for-byte what the patch produced,
 *   restore the original attribute exactly (including whether it existed).
 * - Otherwise the page has edited the element since; restore only the margin
 *   properties Steal still owns (value unchanged, priority not raised to
 *   `!important`), leaving every other page edit — priorities included — alone.
 */
export function restoreScrollMargin(el: Element, change: ScrollMarginChange): void {
  if (el.getAttribute("style") === change.applied) {
    if (change.original === null) el.removeAttribute("style");
    else el.setAttribute("style", change.original);
    return;
  }
  const style = (el as HTMLElement).style;
  for (const prev of change.previous) {
    if (
      style.getPropertyValue(prev.name) === change.marginValue &&
      style.getPropertyPriority(prev.name) === ""
    ) {
      style.setProperty(prev.name, prev.value, prev.priority);
    }
  }
}
