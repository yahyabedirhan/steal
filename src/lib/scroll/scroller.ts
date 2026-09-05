/**
 * The swap point for "how do we bring a target into view."
 *
 * Fully independent of `Inspector` — a `Scroller` never references DOM-footprint
 * tracking, and `Inspector` never references scrolling. `Robber` is the only
 * entity that holds both. Trying a different scrolling approach later
 * (`AncestorScroller`, sketched in the spec) is a one-line swap in `Robber`.
 */

export interface ScrollAlignment {
  /** Which edge of the viewport the target went past. */
  block: "start" | "end";
  inline: "nearest";
  /** Breathing room, in px, to leave between the target and that edge. */
  margin: number;
}

export interface Scroller {
  /** Bring `el` into view, honoring `alignment`. */
  scrollIntoView(el: Element, alignment: ScrollAlignment): void;
  /**
   * Synchronously settle any pending scroll patch right now.
   *
   * `Robber` calls this immediately before `Inspector.capture()` and on
   * `stop()`, so the live page never carries scroll-related residue by the time
   * anything is cloned — which is what lets `Inspector` stay unaware a
   * `Scroller` exists.
   */
  flush(): void;
}
