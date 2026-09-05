/**
 * The `chrome.runtime` message protocol between the content script and the
 * service worker.
 *
 * A single const object instead of three bare string literals scattered across
 * `entries/content.ts` and `entries/background.ts`: a typo in one place is now a
 * compile error rather than a silent runtime mismatch.
 */
export const MessageType = {
  /** Background -> content: flip inspect mode on the current tab. */
  Toggle: "inspect:toggle",
  /** Content -> background: inspection began (show the `ON` badge). */
  Started: "inspect:started",
  /** Content -> background: inspection ended (clear the badge). */
  Ended: "inspect:ended",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

/** The shape every message on the wire shares. */
export interface Message {
  type: MessageType;
}
