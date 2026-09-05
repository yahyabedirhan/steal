import { fullHtml } from "./full-html";
import { cleanHtml } from "./clean-html";
import { plainText } from "./plain-text";

/**
 * A copy mode: one entry in the "Full HTML / Clean HTML / Plain Text" picker.
 *
 * Duck-typed Strategy — a plain object, no base class. `transform` receives a
 * fresh clone of the selected element (as produced by `Inspector.capture`) and
 * returns either a DOM node (Full HTML, Clean HTML) or a string directly
 * (Plain Text). The caller turns a returned node into text via `formatHTML`;
 * a returned string is used as-is.
 */
export interface Mode {
  /** Stable identifier, also the `chrome.storage.local` value and icon key. */
  id: string;
  /** Digit key (`"1"` / `"2"` / `"3"`) that switches to this mode. */
  key: string;
  label: string;
  /** How the hover label names the target: full `tag#id.class`, bare `tag`, or nothing. */
  showDescriptor: "full" | "tag" | "none";
  showDimensions: boolean;
  /** Show the character length of what would actually be copied. */
  showLength: boolean;
  transform: (el: Element) => Element | string;
}

/**
 * The ordered mode registry. `Robber` and the label renderer both work only off
 * this array — adding a mode is adding a module and one entry here, nothing
 * else.
 */
export const MODES: readonly Mode[] = [fullHtml, cleanHtml, plainText];
