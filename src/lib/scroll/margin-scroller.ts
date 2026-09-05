import type { Scroller, ScrollAlignment } from "./scroller";
import {
  applyScrollMargin,
  restoreScrollMargin,
  type ScrollMarginChange,
} from "./scroll-with-margin";

/**
 * The only `Scroller` shipped this pass: a temporary `scroll-margin` patch that
 * self-cleans on the next animation frame.
 *
 * The browser's own `Element.scrollIntoView` walks to the nearest scrollable
 * ancestor (a plain `window.scrollBy` would miss elements inside a scroll
 * container), and `scroll-margin` is the only way to give it the edge gap it
 * otherwise has no option for. The patch is reverted a frame later — or
 * immediately, via `flush()` — so it is never captured as page content.
 */
export class MarginScroller implements Scroller {
  private readonly scrollChanges = new Map<Element, ScrollMarginChange>();

  scrollIntoView(el: Element, alignment: ScrollAlignment): void {
    // A repeated arrow press must never save our own previous margin as the
    // "original" for the next revert.
    const pending = this.scrollChanges.get(el);
    if (pending) this.finishScroll(el, pending);

    const change = applyScrollMargin(el, alignment.margin);
    this.scrollChanges.set(el, change);
    try {
      el.scrollIntoView({ block: alignment.block, inline: alignment.inline });
    } catch (error) {
      this.finishScroll(el, change);
      throw error;
    }
    requestAnimationFrame(() => this.finishScroll(el, change));
  }

  flush(): void {
    for (const [el, change] of this.scrollChanges) this.finishScroll(el, change);
  }

  /** Revert one still-pending change, unless a newer one has replaced it. */
  private finishScroll(el: Element, change: ScrollMarginChange): void {
    if (this.scrollChanges.get(el) !== change) return;
    restoreScrollMargin(el, change);
    this.scrollChanges.delete(el);
  }
}
